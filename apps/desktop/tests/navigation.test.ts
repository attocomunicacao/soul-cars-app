/**
 * Testes (Vitest) de src/renderer/src/app/navigation.ts: desde a 1.0.3 o menu lateral
 * mostra só o 01 · Estoque; as demais páginas ficam guardadas em MENU_OCULTO.
 */
import { describe, expect, it } from "vitest";
import {
  MENU,
  MENU_OCULTO,
  itemSelecionado,
} from "../src/renderer/src/app/navigation";

describe("menu lateral", () => {
  it("mostra só o 01 · Estoque", () => {
    expect(MENU).toEqual([{ pagina: "estoque", rotulo: "01 · Estoque" }]);
  });

  it("guarda as páginas ocultas para voltar depois, sem repetir o Estoque", () => {
    expect(MENU_OCULTO.map((i) => i.pagina)).toEqual([
      "crm",
      "leads",
      "bndv",
      "meta",
      "financas",
    ]);
    expect(MENU_OCULTO.some((i) => i.pagina === "estoque")).toBe(false);
  });

  it("o Estoque continua marcado com a ficha (studio) aberta", () => {
    expect(itemSelecionado("studio", "estoque")).toBe(true);
    expect(itemSelecionado("estoque", "estoque")).toBe(true);
  });
});
