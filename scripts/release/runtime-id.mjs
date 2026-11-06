/**
 * Id do runtime (Electron) de uma pasta de app empacotada: SHA-256 dos arquivos do Electron.
 * Mesmo algoritmo de apps/launcher/src/main/runtime.ts (o Launcher compara este id com o do
 * manifesto para decidir se pode atualizar só trocando a pasta `resources`).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const ARQUIVOS_DO_RUNTIME = [
  "resources.pak",
  "icudtl.dat",
  "v8_context_snapshot.bin",
  "ffmpeg.dll",
];

/** Id do runtime da pasta, ou null se faltar algum arquivo. */
export function idDoRuntime(pasta) {
  const hash = createHash("sha256");
  for (const nome of ARQUIVOS_DO_RUNTIME) {
    const arquivo = path.join(pasta, nome);
    if (!fs.existsSync(arquivo)) return null;
    hash.update(nome).update(fs.readFileSync(arquivo));
  }
  return hash.digest("hex");
}
