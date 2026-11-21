/**
 * Testes (Vitest) das regras puras de robustez do renderer: leitura segura dos ajustes do editor
 * de criativos, validação de slot de foto e foco circular dos diálogos.
 */
import { describe, expect, it } from "vitest";
import { lerAjustes } from "../src/renderer/src/lib/creative-settings";
import { proximoIndiceDeFoco } from "../src/renderer/src/lib/focus-trap";
import { ehSlot, SLOTS } from "../src/renderer/src/lib/vehicle-files";

describe("lerAjustes", () => {
  it("sem texto não há ajustes nem erro", () => {
    expect(lerAjustes(null)).toEqual({ ajustes: null, corrompido: false });
    expect(lerAjustes(undefined)).toEqual({ ajustes: null, corrompido: false });
    expect(lerAjustes("")).toEqual({ ajustes: null, corrompido: false });
  });

  it("lê um objeto válido", () => {
    expect(lerAjustes('{"zoom":1.2}')).toEqual({
      ajustes: { zoom: 1.2 },
      corrompido: false,
    });
  });

  it("JSON quebrado ou que não é objeto vira corrompido, sem lançar erro", () => {
    for (const ruim of ['{"zoom":', "isto não é json", "[1,2]", "42", "null"])
      expect(lerAjustes(ruim), ruim).toEqual({
        ajustes: null,
        corrompido: true,
      });
  });
});

describe("ehSlot", () => {
  it("aceita só os slots conhecidos", () => {
    for (const slot of SLOTS) expect(ehSlot(slot)).toBe(true);
    for (const ruim of ["", "MAIN", "../main", "main.png", 1, null, undefined])
      expect(ehSlot(ruim), String(ruim)).toBe(false);
  });
});

describe("proximoIndiceDeFoco", () => {
  it("Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último", () => {
    expect(proximoIndiceDeFoco(4, 3, false)).toBe(0);
    expect(proximoIndiceDeFoco(4, 0, true)).toBe(3);
  });

  it("no meio da lista o navegador segue sozinho", () => {
    expect(proximoIndiceDeFoco(4, 1, false)).toBeNull();
    expect(proximoIndiceDeFoco(4, 2, true)).toBeNull();
  });

  it("foco fora do diálogo entra por uma ponta", () => {
    expect(proximoIndiceDeFoco(4, -1, false)).toBe(0);
    expect(proximoIndiceDeFoco(4, -1, true)).toBe(3);
  });

  it("um único item prende o foco nele; lista vazia não interfere", () => {
    expect(proximoIndiceDeFoco(1, 0, false)).toBe(0);
    expect(proximoIndiceDeFoco(1, 0, true)).toBe(0);
    expect(proximoIndiceDeFoco(0, -1, false)).toBeNull();
  });
});
