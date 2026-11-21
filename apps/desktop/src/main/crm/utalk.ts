/**
 * Token do CRM (uTalk). O token da API é gerado pelo usuário em account.umbler.com/profile e fica
 * só neste computador, cifrado pelo sistema (safeStorage) dentro do config.json. A interface nunca
 * recebe o token de volta: só sabe se ele existe.
 */
import * as caminhos from "../core/paths";
import { cofre } from "../core/secret-store";
import { limparSegredo } from "../core/secret-vault";

const CHAVE = "utalkTokenCifrado";

/** Só o processo principal usa o token (Soul IA e métricas); a interface nunca o recebe. */
export function tokenUtalk() {
  return lerToken();
}

function lerToken(): string | null {
  return cofre.ler(CHAVE);
}

function estadoUtalk() {
  return { configurado: lerToken() !== null };
}

export function salvarTokenUtalk(token: string) {
  const limpo = limparSegredo(token);
  if (limpo.length < 10) throw new Error("Cole o token completo do uTalk.");
  const cifrado = cofre.cifrar(
    limpo,
    "O Windows não liberou a cifragem para guardar o token com segurança.",
  );
  caminhos.gravarConfig({ [CHAVE]: cifrado });
  return estadoUtalk();
}

export function removerTokenUtalk() {
  cofre.apagar(CHAVE);
  return estadoUtalk();
}
