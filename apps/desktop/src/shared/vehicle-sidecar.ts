/**
 * Sidecar do veículo: `.soul-veiculo.json` dentro da pasta de cada veículo.
 *
 * Leva os campos editados no app para o outro computador pelo Google Drive (o soul.db é local
 * a cada PC e não pode ser sincronizado). Vale o registro mais recente inteiro (sem mesclar
 * campo a campo). Regra pura, sem Electron nem disco.
 */
import { EDITAVEIS } from "./vehicle";

export const NOME_SIDECAR = ".soul-veiculo.json";
export const FORMATO_SIDECAR = 1;

/** Campos que viajam: o caminho da pasta é de cada PC e o DES.md já é um arquivo da pasta. */
export const CAMPOS_SIDECAR = EDITAVEIS.filter(
  (c) => c !== "pasta" && c !== "des_md",
);
export type CampoSidecar = (typeof CAMPOS_SIDECAR)[number];

export type ValorSidecar = string | number | null;

export type Sidecar = {
  formato: typeof FORMATO_SIDECAR;
  /** Momento da edição, ISO 8601 em UTC. */
  atualizadoEm: string;
  /** Nome do computador que gravou (para diagnóstico; nunca dado pessoal). */
  autor: string;
  campos: Partial<Record<CampoSidecar, ValorSidecar>>;
};

/** Tamanho máximo de um texto do sidecar (os ajustes do editor de criativos são os maiores). */
const MAX_TEXTO = 1_000_000;

/** Monta o sidecar a partir da linha do veículo (colunas fora da lista são ignoradas). */
export function montarSidecar(
  linha: Record<string, unknown>,
  autor: string,
  agora: Date,
): Sidecar {
  const campos: Sidecar["campos"] = {};
  for (const c of CAMPOS_SIDECAR) {
    const v = linha[c];
    campos[c] = typeof v === "string" || typeof v === "number" ? v : null;
  }
  return {
    formato: FORMATO_SIDECAR,
    atualizadoEm: agora.toISOString(),
    autor: autor.slice(0, 100),
    campos,
  };
}

/**
 * Lê e valida o texto de um sidecar. Devolve `null` se não for JSON, se o formato for outro ou
 * se a data for inválida. Campos desconhecidos ou de tipo errado são descartados, nunca aplicados.
 */
export function lerSidecar(texto: string): Sidecar | null {
  let bruto: unknown;
  try {
    // O Drive ou o Bloco de Notas podem ter gravado uma marca de ordem de bytes (BOM) no começo.
    bruto = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
  } catch {
    return null;
  }
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (o.formato !== FORMATO_SIDECAR) return null;
  if (typeof o.atualizadoEm !== "string") return null;
  if (Number.isNaN(Date.parse(o.atualizadoEm))) return null;
  const origem = o.campos;
  if (!origem || typeof origem !== "object") return null;
  const campos: Sidecar["campos"] = {};
  for (const c of CAMPOS_SIDECAR) {
    const v = (origem as Record<string, unknown>)[c];
    if (v === null) campos[c] = null;
    else if (typeof v === "number" && Number.isFinite(v)) campos[c] = v;
    else if (typeof v === "string" && v.length <= MAX_TEXTO) campos[c] = v;
  }
  return {
    formato: FORMATO_SIDECAR,
    atualizadoEm: new Date(o.atualizadoEm).toISOString(),
    autor: typeof o.autor === "string" ? o.autor.slice(0, 100) : "",
    campos,
  };
}

/**
 * O sidecar traz novidade? Sim se este computador nunca viu nenhum (`marcador` vazio) ou se o
 * sidecar é mais recente que o último que gravou ou aplicou aqui.
 */
export function sidecarEhNovo(
  sidecar: Sidecar,
  marcador: string | null,
): boolean {
  if (!marcador) return true;
  const visto = Date.parse(marcador);
  if (Number.isNaN(visto)) return true;
  return Date.parse(sidecar.atualizadoEm) > visto;
}
