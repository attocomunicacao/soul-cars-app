/**
 * O cofre de segredos do app, ligado ao `safeStorage` do Electron e ao `config.json` reais.
 * A lógica está em `secret-vault.ts`; aqui só se escolhem as dependências.
 */
import { safeStorage } from "electron";
import * as caminhos from "./paths";
import { criarCofre } from "./secret-vault";

export const cofre = criarCofre({
  cripto: safeStorage,
  lerConfig: caminhos.lerConfig,
  gravarConfig: caminhos.gravarConfig,
});
