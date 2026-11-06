/**
 * Identificador do "runtime" (o Electron) de uma pasta de app instalada.
 *
 * O Windows (Smart App Control) só confia em executáveis que já conhece. Atualizações que não
 * mudam o Electron reaproveitam o executável já liberado e trocam só a pasta `resources`;
 * para saber se uma versão instalada serve de base, comparamos este id com o do manifesto.
 *
 * O id é o SHA-256 dos arquivos do Electron que mudam a cada versão dele (não do executável,
 * que muda de versão em versão por causa do número gravado nele). O mesmo algoritmo roda no
 * CI em `scripts/release/runtime-id.mjs`; `tests/runtime.test.ts` garante que coincidem.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Arquivos do Electron usados para formar o id (mesma lista e ordem do script do CI). */
export const ARQUIVOS_DO_RUNTIME = [
  "resources.pak",
  "icudtl.dat",
  "v8_context_snapshot.bin",
  "ffmpeg.dll",
] as const;

/** Id do runtime da pasta (onde está o executável), ou null se faltar algum arquivo. */
export function idDoRuntime(pasta: string): string | null {
  const hash = createHash("sha256");
  for (const nome of ARQUIVOS_DO_RUNTIME) {
    const arquivo = path.join(pasta, nome);
    if (!fs.existsSync(arquivo)) return null;
    hash.update(nome).update(fs.readFileSync(arquivo));
  }
  return hash.digest("hex");
}
