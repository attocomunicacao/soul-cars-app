import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocosDeCopia } from "../src/renderer/src/lib/publicacao";

const fixture = readFileSync(
  new URL("./fixtures/DES.md", import.meta.url),
  "utf8",
);

describe("publicação", () => {
  it("gera os blocos do # ANUNCIO na ordem do sistema antigo", () => {
    const blocos = blocosDeCopia(fixture);
    expect(blocos.map((b) => b.label)).toEqual([
      "Nome da campanha",
      "1. TEXTO PRINCIPAL",
      "2. TEXTO PRINCIPAL",
      "3. TEXTO PRINCIPAL",
      "4. TEXTO PRINCIPAL",
      "5. TEXTO PRINCIPAL",
      "Título 1",
      "Título 2",
      "Título 3",
      "Título 4",
      "Título 5",
      "Descrição 1",
      "Descrição 2",
      "Descrição 3",
      "Descrição 4",
      "Descrição 5",
      "MENSAGEM DE BOAS-VINDAS",
      "MENSAGEM PRONTA",
      "MENSAGEM PARA O WHATSAPP",
    ]);
    expect(blocos[0].text).toBe("[VENDA] FORD FIESTA 2016");
    expect(
      blocos[1].text.startsWith(
        "🚗 FORD FIESTA S 1.5 16V MANUAL 2016\n\n💰 R$ 48.900,00",
      ),
    ).toBe(true);
    expect(blocos[6].text).toBe("FORD FIESTA S 1.5 16V MANUAL 2016");
    expect(blocos.at(-1)!.text).toContain("*VALOR: R$ 48.900,00*");
  });

  it("texto sem # ANUNCIO não gera blocos", () => {
    expect(blocosDeCopia("# DESCRIÇÃO\n\n## MOTOR\n1.0")).toEqual([]);
  });
});
