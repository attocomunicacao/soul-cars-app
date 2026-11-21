/**
 * Log do Launcher em %LOCALAPPDATA%\SoulCars\logs\launcher.log.
 *
 * Uma linha por evento (instalação, abertura, falhas), para diagnosticar problemas da
 * loja sem depender do registro do Windows. Passando de 1 MB, o arquivo atual vira
 * launcher.1.log (guarda só o anterior).
 */
import fs from "node:fs";
import path from "node:path";
import { pastaInstalacao } from "./config";

const LIMITE_BYTES = 1024 * 1024;

/** Caminho do arquivo de log atual. */
export const arquivoLog = () =>
  path.join(pastaInstalacao(), "logs", "launcher.log");

/** Acrescenta uma linha ao log; nunca lança (o log não pode derrubar o Launcher). */
export function registrar(texto: string): void {
  try {
    const arquivo = arquivoLog();
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).size > LIMITE_BYTES)
      fs.renameSync(arquivo, arquivo.replace(/\.log$/, ".1.log"));
    fs.appendFileSync(
      arquivo,
      `[${new Date().toISOString()}] ${texto}\n`,
      "utf8",
    );
  } catch {
    /* sem log: segue em frente */
  }
}
