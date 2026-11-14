/**
 * Arquivos JSON pequenos na pasta de dados interna do app (`%APPDATA%\soul-cars-app`):
 * preferências e caches dos módulos CRM · Leads, Meta Ads e Funil. Gravação atômica
 * (arquivo temporário + renomear) para um desligamento no meio não corromper o arquivo.
 */
import fs from "node:fs";
import path from "node:path";
import { userData } from "./paths";

/** Caminho de um arquivo dentro da pasta de dados interna. */
export const arquivoInterno = (...partes: string[]) =>
  path.join(userData(), ...partes);

/** Lê um JSON; devolve `padrao` se não existe ou está ilegível. */
export function lerJson<T>(arquivo: string, padrao: T): T {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return structuredClone(padrao);
  }
}

/** Grava um JSON criando a pasta, de forma atômica. */
export function gravarJson(arquivo: string, dados: unknown) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(dados));
  fs.renameSync(tmp, arquivo);
}
