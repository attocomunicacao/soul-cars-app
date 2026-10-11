/** Liga os segredos ao cofre do sistema (safeStorage do Electron). */
import { safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import * as caminhos from "./caminhos";
import { criarSegredos, migrarChaveDoBanco, type Segredos } from "./segredos";

let instancia: Segredos | null = null;

export function segredos(): Segredos {
  return (instancia ??= criarSegredos(
    path.join(caminhos.userData(), "segredos.json"),
    {
      disponivel: () => safeStorage.isEncryptionAvailable(),
      cifrar: (texto) => safeStorage.encryptString(texto),
      decifrar: (dados) => safeStorage.decryptString(dados),
    },
  ));
}

/** Roda uma vez por abertura, antes de qualquer uso do banco. */
export function migrarSegredos() {
  let backups: string[] = [];
  try {
    backups = listarBancos(caminhos.PASTA_BACKUPS());
  } catch {
    /* sem backups ainda */
  }
  return migrarChaveDoBanco(segredos(), [caminhos.BANCO(), ...backups]);
}

function listarBancos(pasta: string) {
  return fs
    .readdirSync(pasta)
    .filter((n) => n.endsWith(".db"))
    .map((n) => path.join(pasta, n));
}
