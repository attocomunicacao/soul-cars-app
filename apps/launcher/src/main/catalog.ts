/**
 * Catálogo de apps: lê o manifesto da release mais recente e, sem internet, usa o
 * último manifesto válido guardado no estado. Se nunca houve leitura, mostra o
 * catálogo embutido (os apps conhecidos, ainda sem pacote para baixar).
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  lerManifesto,
  type AppRelease,
  type Manifest,
} from "../shared/manifest";
import {
  FEED_DE_TESTE,
  TEMPO_LIMITE_MANIFESTO_MS,
  URL_MANIFESTO,
} from "./config";
import { gravarEstado, lerEstado } from "./state";

/** Apps conhecidos pelo Launcher antes da primeira leitura do manifesto. */
export const CATALOGO_EMBUTIDO: AppRelease[] = [
  {
    id: "soul-cars",
    name: "Soul Cars",
    tagline:
      "Do estoque ao anúncio publicado: BNDV, ficha, fotos, vídeo, criativos, CRM e finanças.",
    version: "0.0.0",
    releasedAt: "",
    notes: "",
    executable: { win32: "SoulCars.exe" },
    downloads: {},
  },
];

/** Busca o manifesto (https ou file://) com tempo limite. */
async function baixarManifesto(): Promise<Manifest> {
  if (URL_MANIFESTO.startsWith("file:")) {
    const texto = fs.readFileSync(fileURLToPath(URL_MANIFESTO), "utf8");
    return lerManifesto(JSON.parse(texto), {
      permitirHttpLocal: FEED_DE_TESTE,
    });
  }
  const resposta = await fetch(URL_MANIFESTO, {
    signal: AbortSignal.timeout(TEMPO_LIMITE_MANIFESTO_MS),
    headers: { accept: "application/json" },
    redirect: "follow",
  });
  if (resposta.status === 404)
    throw new Error(
      "Nenhuma versão publicada ainda (manifest.json não encontrado na última release).",
    );
  if (!resposta.ok)
    throw new Error(`O servidor de versões respondeu ${resposta.status}.`);
  return lerManifesto(await resposta.json(), {
    permitirHttpLocal: FEED_DE_TESTE,
  });
}

/** Resultado da verificação: manifesto em uso e o erro, se a leitura falhou. */
export type Catalogo = { manifesto: Manifest | null; erro: string | null };

/** Atualiza o catálogo pela internet; em caso de falha, devolve o último guardado. */
export async function verificarCatalogo(): Promise<Catalogo> {
  try {
    const manifesto = await baixarManifesto();
    gravarEstado((e) => {
      e.catalogo = manifesto;
      e.verificadoEm = new Date().toISOString();
    });
    return { manifesto, erro: null };
  } catch (erro) {
    const motivo =
      erro instanceof Error && erro.name === "TimeoutError"
        ? "Sem resposta do servidor de versões (verifique a internet)."
        : erro instanceof Error
          ? erro.message
          : String(erro);
    return { manifesto: lerEstado().catalogo, erro: motivo };
  }
}

/** Apps a exibir: os do manifesto, mais os embutidos que ele ainda não lista. */
export function appsDoCatalogo(manifesto: Manifest | null): AppRelease[] {
  const doManifesto = manifesto?.apps ?? [];
  const ids = new Set(doManifesto.map((a) => a.id));
  return [...doManifesto, ...CATALOGO_EMBUTIDO.filter((a) => !ids.has(a.id))];
}
