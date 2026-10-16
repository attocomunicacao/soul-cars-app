/**
 * Métricas do CRM (uTalk). O token da API é gerado pelo usuário em account.umbler.com/profile e fica
 * só neste computador, cifrado pelo sistema (safeStorage) dentro do config.json. A interface nunca
 * recebe o token de volta: só sabe se ele existe.
 */
import { safeStorage } from "electron";
import * as caminhos from "./caminhos";
import { visaoGeral, type Buscar } from "./utalk-api";

const CHAVE = "utalkTokenCifrado";

/** Só o processo principal usa o token (Soul IA e métricas); a interface nunca o recebe. */
export function tokenUtalk() {
  return lerToken();
}

function lerToken(): string | null {
  const guardado = caminhos.lerConfig()[CHAVE];
  if (typeof guardado !== "string" || !guardado) return null;
  try {
    return safeStorage.decryptString(Buffer.from(guardado, "base64"));
  } catch {
    return null;
  }
}

export function estadoUtalk() {
  return { configurado: lerToken() !== null };
}

export function salvarTokenUtalk(token: string) {
  const limpo = token.trim().replace(/^Bearer\s+/i, "");
  if (limpo.length < 10) throw new Error("Cole o token completo do uTalk.");
  if (!safeStorage.isEncryptionAvailable())
    throw new Error(
      "O Windows não liberou a cifragem para guardar o token com segurança.",
    );
  const cifrado = safeStorage.encryptString(limpo).toString("base64");
  caminhos.gravarConfig({ [CHAVE]: cifrado });
  return estadoUtalk();
}

export function removerTokenUtalk() {
  caminhos.gravarConfig({ [CHAVE]: "" });
  return estadoUtalk();
}

export async function visaoUtalk() {
  const token = lerToken();
  if (!token) throw new Error("Cadastre o token do uTalk primeiro.");
  return visaoGeral(fetch as Buscar, token);
}
