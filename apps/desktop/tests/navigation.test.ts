/**
 * Testes (Vitest) de src/renderer/src/app/navigation.ts: desde a 1.0.3 o menu lateral
 * mostra o Estoque, os painéis CRM · Leads, Meta Ads e Funil (1.0.12) e os sites embutidos; as demais páginas ficam guardadas em MENU_OCULTO.
 */
import { describe, expect, it } from "vitest";
import {
  MENU,
  MENU_OCULTO,
  itemSelecionado,
} from "../src/renderer/src/app/navigation";

describe("menu lateral", () => {
  it("mostra o Estoque no topo e os painéis do Soul APP junto dos sites", () => {
    expect(MENU.map((i) => [i.grupo ?? "", i.pagina, i.rotulo])).toEqual([
      ["", "estoque", "Estoque"],
      ["CRM", "leadsCrm", "Leads"],
      ["CRM", "crm", "Atendimento"],
      ["Meta Ads", "metaPainel", "Campanhas"],
      ["Meta Ads", "meta", "Gerenciador"],
      ["Funil", "funil", "Meta → CRM"],
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
