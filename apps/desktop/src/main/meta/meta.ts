/**
 * Conexão com o Meta Ads (Graph API), vinda do Soul APP. Segunda exceção autorizada à regra
 * "sem chave de API" (a primeira é o uTalk): o token é opcional, gratuito, só de leitura
 * (`ads_read`), fica cifrado pelo Windows (safeStorage) no config.json e nunca volta para a
 * interface. Também guarda a conta de anúncios, a versão da API e as preferências do painel.
 */
import { safeStorage } from "electron";
import {
  CONFIG_META_PADRAO,
  type ConfigMeta,
  type PresetMeta,
} from "../../shared/meta-ads";
import { arquivoInterno, gravarJson, lerJson } from "../core/json-store";
import * as caminhos from "../core/paths";
import type { Buscar } from "../crm/utalk-api";
import {
  VERSAO_GRAPH,
  buscarPainel,
  infoDoToken,
  normalizarConta,
  testarConexao,
  type CredMeta,
} from "./graph-api";

const CHAVE_TOKEN = "metaTokenCifrado";
const ARQ_CONFIG = () => arquivoInterno("meta-ads", "config.json");

function lerToken(): string | null {
  const guardado = caminhos.lerConfig()[CHAVE_TOKEN];
  if (typeof guardado !== "string" || !guardado) return null;
  try {
    return safeStorage.decryptString(Buffer.from(guardado, "base64"));
  } catch {
    return null;
  }
}

/** Credenciais para o main (o token nunca vai para a interface). */
export function credMeta(): CredMeta {
  const c = caminhos.lerConfig();
  return {
    token: lerToken() ?? "",
    conta: typeof c.metaConta === "string" ? c.metaConta : "",
    versao:
      typeof c.metaVersao === "string" && c.metaVersao
        ? c.metaVersao
        : VERSAO_GRAPH,
  };
}

/** O que a interface pode saber da conexão. */
export function estadoMeta() {
  const c = credMeta();
  return { configurado: !!c.token, conta: c.conta, versao: c.versao };
}

/** Grava token (se veio), conta e versão. */
export function salvarMeta(p: {
  token?: string;
  conta?: string;
  versao?: string;
}) {
  const patch: Record<string, unknown> = {};
  const token = (p.token ?? "").trim().replace(/^Bearer\s+/i, "");
  if (token) {
    if (token.length < 20) throw new Error("Cole o token completo do Meta.");
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        "O Windows não liberou a cifragem para guardar o token com segurança.",
      );
    patch[CHAVE_TOKEN] = safeStorage.encryptString(token).toString("base64");
  }
  if (p.conta !== undefined) patch.metaConta = normalizarConta(p.conta);
  if (p.versao !== undefined)
    patch.metaVersao = p.versao.trim() || VERSAO_GRAPH;
  caminhos.gravarConfig(patch);
  return estadoMeta();
}

/** Grava o token já em texto (importação do Soul APP). */
export function gravarTokenMeta(token: string) {
  return salvarMeta({ token });
}

/** Esquece o token do Meta. */
export function removerTokenMeta() {
  caminhos.gravarConfig({ [CHAVE_TOKEN]: "" });
  return estadoMeta();
}

/** Testa token e conta (pode testar um token novo antes de salvar). */
export function testarMeta(p: { token?: string; conta?: string }) {
  const c = credMeta();
  return testarConexao(fetch as Buscar, {
    token: (p.token ?? "").trim() || c.token,
    conta: (p.conta ?? "").trim() || c.conta,
    versao: c.versao,
  });
}

/** Preferências do painel (com padrões). */
export function configMeta(): ConfigMeta {
  return {
    ...CONFIG_META_PADRAO,
    ...lerJson<Partial<ConfigMeta>>(ARQ_CONFIG(), {}),
  };
}

/** Grava preferências do painel, com limites. */
export function salvarConfigMeta(patch: Partial<ConfigMeta>) {
  const n = { ...configMeta(), ...patch };
  n.alertCpr = Math.max(0, Number(n.alertCpr) || 0);
  n.alertSpend = Math.max(0, Number(n.alertSpend) || 0);
  n.roasTarget = Math.max(0.1, Number(n.roasTarget) || 3);
  n.chartDays = ([7, 14, 30] as const).includes(n.chartDays) ? n.chartDays : 14;
  gravarJson(ARQ_CONFIG(), n);
  return n;
}

/** Dados do painel no período pedido (ou no último escolhido). */
export async function painelMeta(preset?: PresetMeta) {
  const cfg = preset ? salvarConfigMeta({ datePreset: preset }) : configMeta();
  const cred = credMeta();
  const dados = await buscarPainel(fetch as Buscar, cred, cfg);
  return { dados, config: cfg };
}

/** Vencimento e validade do token (para o aviso de token perto de vencer). */
export function validadeTokenMeta() {
  const c = credMeta();
  if (!c.token) return Promise.resolve(null);
  return infoDoToken(fetch as Buscar, c.token, c.versao);
}
