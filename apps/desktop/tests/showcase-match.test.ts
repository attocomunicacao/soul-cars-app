/**
 * Testes (Vitest) de `cartaoDaFicha` (src/shared/showcase.ts): liga a ficha do Studio
 * ao cartão do BNDV, usado pela chave "Só em estoque" e pela quilometragem da ficha.
 */
import { describe, expect, it } from "vitest";
import { cartaoDaFicha, type CartaoVitrine } from "../src/shared/showcase";

const cartao = (extra: Partial<CartaoVitrine>): CartaoVitrine => ({
  idBndv: "1",
  marca: "Ford",
  modelo: "Fiesta",
  placa: "",
  tabela: 0,
  consignado: false,
  dias: null,
  entrada: "",
  pasta: null,
  foto: null,
  detalhes: {
    km: 84000,
    cor: null,
    cambio: null,
    combustivel: null,
    ano: null,
    versao: null,
  },
  estudio: null,
  ...extra,
});

describe("cartaoDaFicha", () => {
  it("casa pela pasta, pelo id da ficha ou pela placa sem diferenciar caixa", () => {
    const porPasta = cartao({ idBndv: "a", pasta: "C:/ESTOQUE/1_FIESTA" });
    const porId = cartao({ idBndv: "b", estudio: { id: 7 } });
    const porPlaca = cartao({ idBndv: "c", placa: "abc1d23" });
    const lista = [porPasta, porId, porPlaca];
    expect(cartaoDaFicha(lista, { id: 1, pasta: "C:/ESTOQUE/1_FIESTA" })).toBe(
      porPasta,
    );
    expect(cartaoDaFicha(lista, { id: 7 })).toBe(porId);
    expect(cartaoDaFicha(lista, { id: 2, placa: " ABC1D23 " })).toBe(porPlaca);
  });

  it("não casa placa vazia nem pasta ausente", () => {
    const lista = [cartao({ placa: "", pasta: null })];
    expect(cartaoDaFicha(lista, { id: 3, placa: "", pasta: null })).toBe(
      undefined,
    );
  });
});
