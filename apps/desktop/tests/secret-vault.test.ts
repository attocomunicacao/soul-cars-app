/**
 * Testes (Vitest) de src/main/core/secret-vault.ts: o cofre dos segredos (tokens do uTalk e do
 * Meta, chave do Groq). Usa uma cifragem falsa e reversível no lugar do `safeStorage`.
 * O ponto principal é a compatibilidade: o formato gravado é `base64(encryptString(valor))`, o
 * mesmo das versões anteriores, então tokens já salvos continuam valendo.
 */
import { describe, expect, it, vi } from "vitest";
import {
  criarCofre,
  limparSegredo,
  type Cripto,
} from "../src/main/core/secret-vault";

/** Cifragem de mentira: prefixa "ENC:" e recusa o que não veio dela (como o safeStorage). */
function criptoFalsa(disponivel = true): Cripto & { cifradas: number } {
  const c = {
    cifradas: 0,
    isEncryptionAvailable: () => disponivel,
    encryptString: (t: string) => {
      c.cifradas++;
      return Buffer.from("ENC:" + t, "utf8");
    },
    decryptString: (d: Buffer) => {
      const t = d.toString("utf8");
      if (!t.startsWith("ENC:")) throw new Error("não decifrável");
      return t.slice(4);
    },
  };
  return c;
}

function cofreComConfig(disponivel = true) {
  const config: Record<string, unknown> = {};
  const gravarConfig = vi.fn((patch: Record<string, unknown>) =>
    Object.assign(config, patch),
  );
  const cripto = criptoFalsa(disponivel);
  const cofre = criarCofre({ cripto, lerConfig: () => config, gravarConfig });
  return { cofre, config, gravarConfig, cripto };
}

describe("limparSegredo", () => {
  it("tira espaços e o prefixo Bearer", () => {
    expect(limparSegredo("  abc123  ")).toBe("abc123");
    expect(limparSegredo("Bearer abc123")).toBe("abc123");
    expect(limparSegredo("  bearer    abc123 ")).toBe("abc123");
  });

  it("não mexe em quem só começa com as letras de Bearer", () => {
    expect(limparSegredo("Bearerabc")).toBe("Bearerabc");
  });
});

describe("cofre.ler", () => {
  it("devolve null quando não há valor, ele está vazio ou não é texto", () => {
    const { cofre, config } = cofreComConfig();
    expect(cofre.ler("tokenCifrado")).toBeNull();
    config.tokenCifrado = "";
    expect(cofre.ler("tokenCifrado")).toBeNull();
    config.tokenCifrado = 42;
    expect(cofre.ler("tokenCifrado")).toBeNull();
  });

  it("lê um valor no formato antigo: base64 do que o safeStorage devolveu", () => {
    const { cofre, config } = cofreComConfig();
    // É exatamente o que a versão anterior gravava.
    config.utalkTokenCifrado = Buffer.from("ENC:meu-token-antigo").toString(
      "base64",
    );
    expect(cofre.ler("utalkTokenCifrado")).toBe("meu-token-antigo");
  });

  it("devolve null (sem lançar) quando não dá para decifrar", () => {
    const { cofre, config } = cofreComConfig();
    config.metaTokenCifrado = Buffer.from("lixo qualquer").toString("base64");
    expect(cofre.ler("metaTokenCifrado")).toBeNull();
  });
});

describe("cofre.cifrar", () => {
  it("devolve base64 do que a cifragem do sistema produziu (formato inalterado)", () => {
    const { cofre } = cofreComConfig();
    const guardado = cofre.cifrar("segredo", "sem cifragem");
    expect(Buffer.from(guardado, "base64").toString("utf8")).toBe(
      "ENC:segredo",
    );
  });

  it("o que foi cifrado volta pela leitura", () => {
    const { cofre, config } = cofreComConfig();
    config.groqChaveCifrada = cofre.cifrar("gsk_abc", "sem cifragem");
    expect(cofre.ler("groqChaveCifrada")).toBe("gsk_abc");
  });

  it("sem cifragem no sistema falha com a mensagem dada e não cifra nada", () => {
    const { cofre, cripto } = cofreComConfig(false);
    expect(() => cofre.cifrar("segredo", "O Windows não liberou.")).toThrow(
      "O Windows não liberou.",
    );
    expect(cripto.cifradas).toBe(0);
  });
});

describe("cofre.apagar", () => {
  it("grava vazio na chave e a leitura passa a dar null", () => {
    const { cofre, config, gravarConfig } = cofreComConfig();
    config.metaTokenCifrado = cofre.cifrar("token-do-meta", "x");
    expect(cofre.ler("metaTokenCifrado")).toBe("token-do-meta");
    cofre.apagar("metaTokenCifrado");
    expect(gravarConfig).toHaveBeenCalledWith({ metaTokenCifrado: "" });
    expect(cofre.ler("metaTokenCifrado")).toBeNull();
  });

  it("cada segredo tem a sua chave: apagar um não afeta os outros", () => {
    const { cofre, config } = cofreComConfig();
    config.utalkTokenCifrado = cofre.cifrar("a", "x");
    config.groqChaveCifrada = cofre.cifrar("b", "x");
    cofre.apagar("utalkTokenCifrado");
    expect(cofre.ler("utalkTokenCifrado")).toBeNull();
    expect(cofre.ler("groqChaveCifrada")).toBe("b");
  });
});
