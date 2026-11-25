/**
 * Detecta a pasta ESTOQUE do Google Drive para Desktop a partir do link colado pelo usuário.
 *
 * Liga a regra de `locate.ts` ao disco real do Windows (unidades e subpastas). Só lê o disco.
 */
import fs from "node:fs";
import os from "node:os";
import { extrairIdPastaDrive } from "../../shared/drive-link";
import { localizarPastaDrive, type DiscoDrive } from "./locate";

/** Disco real: letras de A a Z que existem, e subpastas legíveis de uma pasta. */
const DISCO_REAL: DiscoDrive = {
  unidades: () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .filter((letra) => fs.existsSync(`${letra}:\\`)),
  subpastas: (pasta) => {
    try {
      return fs
        .readdirSync(pasta, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }
  },
  home: () => os.homedir(),
};

export type DeteccaoDrive =
  { situacao: "link-invalido" } | ReturnType<typeof localizarPastaDrive>;

/** Lê o link e procura a pasta correspondente no computador. */
export function detectarPastaDrive(link: string): DeteccaoDrive {
  const id = extrairIdPastaDrive(link);
  if (!id) return { situacao: "link-invalido" };
  return localizarPastaDrive(id, DISCO_REAL);
}
