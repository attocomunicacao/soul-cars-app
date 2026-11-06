/**
 * Testes (Vitest) de src/main/core/config-json.ts (leitura tolerante do config.json).
 */
import { describe, expect, it } from "vitest";
import { lerConfigJson } from "../src/main/core/config-json";

describe("config.json", () => {
  it("lê JSON normal e JSON com BOM (o que o PowerShell do Windows grava)", () => {
    const json = JSON.stringify({ raizDados: "C:/Dados", x: 1 });
    expect(lerConfigJson(json)).toEqual({ raizDados: "C:/Dados", x: 1 });
    expect(lerConfigJson("\uFEFF" + json)).toEqual({
      raizDados: "C:/Dados",
      x: 1,
    });
  });

  it("devolve null para texto estragado ou que não é um objeto", () => {
    for (const ruim of [
      "",
      "{",
      "não é json",
      "[1,2]",
      "42",
      "null",
      '"texto"',
    ])
      expect(lerConfigJson(ruim)).toBeNull();
  });
});
