/**
 * Regras puras da entrada de arquivos por pasta sincronizada: achar a placa no nome
 * da pasta, classificar o arquivo e ignorar temporários. Sem disco, sem Electron.
 */

export type TipoArquivo =
  "foto" | "foto-heic" | "video" | "documento" | "outro";

const FOTOS = [".jpg", ".jpeg", ".png", ".webp"];
const HEIC = [".heic", ".heif"];
/** Os mesmos vídeos que o Studio reconhece (arquivos.ts). */
const VIDEOS = [".mp4", ".mov", ".mkv", ".avi"];

const TEMPORARIOS_EXT = [
  ".tmp",
  ".temp",
  ".crdownload",
  ".partial",
  ".part",
  ".parcial",
  ".gdoc",
  ".gsheet",
  ".gslides",
];
const TEMPORARIOS_NOME = ["desktop.ini", "thumbs.db"];

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Placa antiga (ABC1234, com ou sem hífen) ou Mercosul (ABC1D23). */
const PLACA = /(?<![A-Z0-9])([A-Z]{3})-?(\d[A-Z0-9]\d{2})(?![A-Z0-9])/g;

/** Todas as placas que aparecem no nome, normalizadas (sem hífen), na ordem. */
export function extrairPlacas(nome: string): string[] {
  const achadas: string[] = [];
  for (const m of semAcento(nome).matchAll(PLACA)) {
    const placa = m[1] + m[2];
    if (!achadas.includes(placa)) achadas.push(placa);
  }
  return achadas;
}

/** A placa do nome de uma pasta do estoque: o último trecho que parece placa. */
export function placaDaPasta(nome: string): string | null {
  return extrairPlacas(nome).at(-1) ?? null;
}

export function ehTemporario(nome: string): boolean {
  const n = nome.toLowerCase();
  return (
    n.startsWith(".") ||
    n.startsWith("~$") ||
    TEMPORARIOS_NOME.includes(n) ||
    TEMPORARIOS_EXT.some((e) => n.endsWith(e))
  );
}

export function classificar(nome: string): TipoArquivo {
  const ponto = nome.lastIndexOf(".");
  const ext = ponto >= 0 ? nome.slice(ponto).toLowerCase() : "";
  if (FOTOS.includes(ext)) return "foto";
  if (HEIC.includes(ext)) return "foto-heic";
  if (VIDEOS.includes(ext)) return "video";
  if (ext === ".pdf") return "documento";
  return "outro";
}

/** `FOTO.jpg` + 2 → `FOTO_2.jpg` (sufixo previsível para nomes que colidem). */
export function nomeComSufixo(nome: string, n: number): string {
  const ponto = nome.lastIndexOf(".");
  return ponto > 0
    ? `${nome.slice(0, ponto)}_${n}${nome.slice(ponto)}`
    : `${nome}_${n}`;
}

export const AVISO_HEIC =
  "HEIC não aparece no app (painel, editor e publicação). Converta para JPG.";
