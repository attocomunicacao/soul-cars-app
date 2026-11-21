/**
 * Testes (Vitest) de src/renderer/src/app/navigation.ts: desde a 1.0.3 o menu lateral
 * mostra o Estoque, os painéis CRM · Leads, Meta Ads e Funil (1.0.12) e os sites embutidos. As páginas ocultas (Finanças, painel antigo de Leads e BNDV) foram removidas.
 */
import { describe, expect, it } from "vitest";
import {
  MENU,
  PAGINAS_EMBUTIDAS,
  itemSelecionado,
} from "../src/renderer/src/app/navigation";

describe("menu lateral", () => {
  it("mostra o Estoque no topo e os painéis do Soul APP junto dos sites", () => {
    expect(MENU.map((i) => [i.grupo ?? "", i.pagina, i.rotulo])).toEqual([
      ["", "estoque", "Estoque"],
      ["CRM", "leadsCrm", "Leads"],
      ["CRM", "crm", "Atendimento"],
      ["CRM", "preAtendimento", "Pré-atendimento IA"],
      ["Meta Ads", "metaPainel", "Campanhas"],
      ["Meta Ads", "meta", "Gerenciador"],
      ["Funil", "funil", "Meta → CRM"],
    ]);
    expect(MENU.every((i) => !!i.icone)).toBe(true);
  });

  it("só o CRM e o Meta Ads são sites embutidos", () => {
    expect([...PAGINAS_EMBUTIDAS]).toEqual(["crm", "meta"]);
  });

  it("o Estoque continua marcado com a ficha (studio) aberta", () => {
    expect(itemSelecionado("studio", "estoque")).toBe(true);
    expect(itemSelecionado("estoque", "estoque")).toBe(true);
  });
});
