/**
 * Importa do Soul APP (app separado que juntava CRM, Meta Ads e Funil) as conexões e
 * as regras, para não configurar tudo de novo depois da unificação.
 *
 * Os tokens do Soul APP foram cifrados pelo safeStorage dele: AES-256-GCM com uma chave
 * guardada no "Local State" dele, protegida pelo DPAPI do usuário do Windows. A chave é
 * aberta com o DPAPI do próprio usuário (PowerShell), o token é decifrado aqui e logo
 * cifrado de novo com a chave do Soul Cars. Nada sai do computador.
 */
import { app } from "electron";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { arquivoInterno, gravarJson, lerJson } from "../core/json-store";
import { salvarConfigFunil } from "../funnel/funnel";
import { salvarConfigMeta, salvarMeta } from "../meta/meta";
import { definirOrganizacao, salvarConfigLeads } from "./leads";
import { salvarTokenUtalk } from "./utalk";

/** Pasta de dados do Soul APP (`%APPDATA%\Soul APP`). */
export const pastaSoulApp = () => path.join(app.getPath("appData"), "Soul APP");

/** Há um Soul APP configurado neste computador? */
export function soulAppEncontrado() {
  return fs.existsSync(path.join(pastaSoulApp(), "credentials.json"));
}

function dpapiAbrir(b64: string): Promise<Buffer> {
  if (process.platform !== "win32")
    return Promise.reject(new Error("DPAPI só existe no Windows"));
  const script =
    "Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String($env:SOUL_BLOB); " +
    "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))";
  return new Promise((ok, falha) =>
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        env: { ...process.env, SOUL_BLOB: b64 },
        timeout: 20_000,
        windowsHide: true,
      },
      (erro, saida) =>
        erro ? falha(erro) : ok(Buffer.from(String(saida).trim(), "base64")),
    ),
  );
}

async function chaveDoSoulApp(): Promise<Buffer | null> {
  const ls = lerJson<{ os_crypt?: { encrypted_key?: string } } | null>(
    path.join(pastaSoulApp(), "Local State"),
    null,
  );
  const k = ls?.os_crypt?.encrypted_key;
  if (!k) return null;
  const bruto = Buffer.from(k, "base64");
  if (bruto.subarray(0, 5).toString() !== "DPAPI") return null;
  const chave = await dpapiAbrir(bruto.subarray(5).toString("base64")).catch(
    () => null,
  );
  return chave?.length === 32 ? chave : null;
}

/** Decifra um valor de `safeStorage.encryptString(...)` (formato "v10" + nonce + dados + tag). */
export function decifrarV10(chave: Buffer, b64: string): string {
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.subarray(0, 3).toString() !== "v10" || buf.length < 31) return "";
    const d = crypto.createDecipheriv(
      "aes-256-gcm",
      chave,
      buf.subarray(3, 15),
    );
    d.setAuthTag(buf.subarray(buf.length - 16));
    return Buffer.concat([
      d.update(buf.subarray(15, buf.length - 16)),
      d.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

type CredSoulApp = {
  metaTokenEnc?: string | null;
  metaAccountId?: string;
  metaVersion?: string;
  crmTokenEnc?: string | null;
  crmOrganizationId?: string;
  crmOrganizationName?: string;
};

/** Importa conexões, regras e a última leitura de leads. Devolve o que foi trazido. */
export async function importarSoulApp(): Promise<string[]> {
  const pasta = pastaSoulApp();
  const cred = lerJson<CredSoulApp | null>(
    path.join(pasta, "credentials.json"),
    null,
  );
  if (!cred) throw new Error("Não achei o Soul APP neste computador.");
  const trazidos: string[] = [];
  const chave = await chaveDoSoulApp();
  const decifrar = (v?: string | null) =>
    chave && v ? decifrarV10(chave, v) : "";

  const tokenCrm = decifrar(cred.crmTokenEnc);
  if (tokenCrm) {
    salvarTokenUtalk(tokenCrm);
    trazidos.push("token do uTalk");
  }
  if (cred.crmOrganizationId) {
    definirOrganizacao({
      id: cred.crmOrganizationId,
      nome: cred.crmOrganizationName ?? "",
    });
    trazidos.push(
      `organização ${cred.crmOrganizationName || cred.crmOrganizationId}`,
    );
  }
  const tokenMeta = decifrar(cred.metaTokenEnc);
  salvarMeta({
    token: tokenMeta || undefined,
    conta: cred.metaAccountId || undefined,
    versao: cred.metaVersion || undefined,
  });
  if (tokenMeta) trazidos.push("token do Meta");
  if (cred.metaAccountId)
    trazidos.push(`conta de anúncios ${cred.metaAccountId}`);
  if ((cred.crmTokenEnc && !tokenCrm) || (cred.metaTokenEnc && !tokenMeta))
    trazidos.push(
      "(um token não pôde ser aberto: cadastre-o de novo em Conexões)",
    );

  const crm = lerJson<Record<string, unknown> | null>(
    path.join(pasta, "crm", "settings.json"),
    null,
  );
  if (crm) {
    salvarConfigLeads({
      windowDays: Number(crm.windowDays ?? 30),
      intervalSec: Number(crm.intervalSec ?? 60),
      notifyNewLeads: crm.notifyNewLeads !== false,
      tagCategories: (crm.tagCategories as never) ?? {},
      statusOrder: (crm.statusOrder as string[]) ?? [],
    });
    trazidos.push("etiquetas e colunas do Kanban");
    const cache = lerJson<{ snapshot?: unknown; events?: unknown[] } | null>(
      path.join(pasta, "crm", "cache.json"),
      null,
    );
    if (cache?.snapshot && !crm.demo) {
      gravarJson(arquivoInterno("crm-leads", "cache.json"), {
        snapshot: cache.snapshot,
        events: cache.events ?? [],
      });
      trazidos.push("última leitura de leads");
    }
  }
  const meta = lerJson<Record<string, unknown> | null>(
    path.join(pasta, "meta", "settings.json"),
    null,
  );
  if (meta) {
    salvarConfigMeta({
      datePreset: (meta.datePreset as never) ?? "last_7d",
      alertCpr: Number(meta.alertCpr ?? 0),
      alertSpend: Number(meta.alertSpend ?? 0),
      roasTarget: Number(meta.roasTarget ?? 3),
      chartDays: Number(meta.chartDays ?? 14) as 7 | 14 | 30,
    });
    trazidos.push("alertas do Meta Ads");
  }
  const funil = lerJson<Record<string, unknown> | null>(
    path.join(pasta, "funil", "settings.json"),
    null,
  );
  if (funil) {
    salvarConfigFunil({
      ...(funil.period ? { period: funil.period as never } : {}),
      clickMetric: funil.clickMetric === "clicks" ? "clicks" : "linkClicks",
      cumulative: funil.cumulative !== false,
      tagRoles: (funil.tagRoles as never) ?? {},
      campaignProducts: (funil.campaignProducts as never) ?? {},
    });
    trazidos.push("regras do Funil");
  }
  return trazidos;
}
