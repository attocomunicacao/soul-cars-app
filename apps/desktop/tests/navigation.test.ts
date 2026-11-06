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
  it("mostra o 01 · Estoque e o 02 · CRM", () => {
    expect(MENU.map((i) => [i.pagina, i.rotulo])).toEqual([
      ["estoque", "01 · Estoque"],
      ["crm", "02 · CRM"],
    ]);
    expect(MENU.every((i) => !!i.icone)).toBe(true);
  });

  it("guarda as páginas ocultas para voltar depois, sem repetir o Estoque", () => {
    expect(MENU_OCULTO.map((i) => i.pagina)).toEqual([
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
