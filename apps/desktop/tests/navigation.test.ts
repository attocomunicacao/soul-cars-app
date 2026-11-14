/**
 * Testes (Vitest) de src/renderer/src/app/navigation.ts: desde a 1.0.3 o menu lateral
 * mostra Estoque, CRM e Meta Ads (sem numeração desde a 1.0.9); as demais páginas ficam guardadas em MENU_OCULTO.
 */
import { describe, expect, it } from "vitest";
import {
  MENU,
  MENU_OCULTO,
  itemSelecionado,
} from "../src/renderer/src/app/navigation";

describe("menu lateral", () => {
  it("mostra Estoque, CRM e Meta Ads, cada um com ícone", () => {
    expect(MENU.map((i) => [i.pagina, i.rotulo])).toEqual([
      ["estoque", "Estoque"],
      ["crm", "CRM"],
      ["meta", "Meta Ads"],
    ]);
    expect(MENU.every((i) => !!i.icone)).toBe(true);
  });

  it("guarda as páginas ocultas para voltar depois, sem repetir o Estoque", () => {
    expect(MENU_OCULTO.map((i) => i.pagina)).toEqual([
      "leads",
      "bndv",
      "financas",
    ]);
    expect(MENU_OCULTO.some((i) => i.pagina === "estoque")).toBe(false);
  });

  it("o Estoque continua marcado com a ficha (studio) aberta", () => {
    expect(itemSelecionado("studio", "estoque")).toBe(true);
    expect(itemSelecionado("estoque", "estoque")).toBe(true);
  });
});
