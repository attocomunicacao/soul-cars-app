/**
 * Segredos do Pré-atendimento IA: ficha cifrada do lead e chave do Groq.
 *
 * CPF e data de nascimento são cifrados com `safeStorage` antes de qualquer gravação (sem cifragem no
 * sistema, só se marca "informado"). A chave do Groq fica cifrada no `config.json` e nunca volta à
 * interface.
 */
import { safeStorage } from "electron";
import * as caminhos from "../core/paths";
import { cofre } from "../core/secret-store";
import { limparSegredo } from "../core/secret-vault";
import type { MensagemIa } from "../../shared/pre-service";
import {
  FICHA_VAZIA,
  fichaDaConversa,
  type FichaLead,
} from "../../shared/lead-profile";

const CHAVE_GROQ = "groqChaveCifrada";

// ------------------------------------------------------------ ficha do lead
/** Guarda CPF e nascimento cifrados (safeStorage); sem criptografia no sistema, só marca como informado. */
function cifrar(valor: string): string {
  return safeStorage.isEncryptionAvailable()
    ? "enc:" + safeStorage.encryptString(valor).toString("base64")
    : "informado";
}
/** Valor em claro a partir do que está guardado ("" se não der para decifrar). */
export function lerSegredo(guardado: string): string {
  if (!guardado.startsWith("enc:")) return "";
  try {
    return safeStorage.decryptString(Buffer.from(guardado.slice(4), "base64"));
  } catch {
    return "";
  }
}
/** Atualiza a ficha com a conversa e cifra o CPF e o nascimento recém-lidos (nunca são gravados em claro). */
export function atualizarFicha(
  base: FichaLead | undefined,
  conversa: MensagemIa[],
) {
  const f = fichaDaConversa(conversa, base ?? FICHA_VAZIA);
  if (/^[0-9]{11}$/.test(f.cpf)) f.cpf = cifrar(f.cpf);
  if (/^[0-9]{2}[/][0-9]{2}[/][0-9]{4}$/.test(f.nascimento))
    f.nascimento = cifrar(f.nascimento);
  return f;
}

// ------------------------------------------------------------ chave do Groq
export function chaveGroq(): string | null {
  return cofre.ler(CHAVE_GROQ);
}
/** Guarda a chave do Groq cifrada pelo sistema; "" remove. */
export function guardarChaveGroq(chave: string) {
  const limpa = limparSegredo(chave);
  if (!limpa) cofre.apagar(CHAVE_GROQ);
  else {
    if (limpa.length < 20)
      throw new Error("Cole a chave completa do Groq (começa com gsk_).");
    caminhos.gravarConfig({
      [CHAVE_GROQ]: cofre.cifrar(
        limpa,
        "O Windows não liberou a cifragem para guardar a chave com segurança.",
      ),
    });
  }
}
