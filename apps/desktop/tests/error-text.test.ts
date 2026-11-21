/**
 * Testes (Vitest) de `textoDoErro` (src/renderer/src/app/components.tsx): a mensagem de erro mostrada ao
 * usuário não pode carregar o prefixo técnico do Electron nem "Error:" repetido.
 */
import { describe, expect, it } from "vitest";
import { textoDoErro } from "../src/renderer/src/app/components";

describe("textoDoErro", () => {
  it("tira o prefixo técnico do Electron e o Error: repetido", () => {
    const e = new Error(
      "Error invoking remote method 'soul:invoke': Error: Cadastre o token do uTalk.",
    );
    expect(textoDoErro(e)).toBe("Cadastre o token do uTalk.");
  });

  it("aceita texto puro e valores que não são Error", () => {
    expect(textoDoErro("Error: Error: Falhou")).toBe("Falhou");
    expect(textoDoErro("sem prefixo")).toBe("sem prefixo");
    expect(textoDoErro(404)).toBe("404");
  });

  it("não mexe em mensagens normais", () => {
    expect(textoDoErro(new Error("Pasta não encontrada"))).toBe(
      "Pasta não encontrada",
    );
  });
});
