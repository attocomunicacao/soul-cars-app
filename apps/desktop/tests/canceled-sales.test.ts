/**
 * Testes (Vitest) de src/main/inventory/canceled-sales.ts: venda cancelada no BNDV
 * (veículo de volta a "DISPONÍVEL ESTOQUE") não conta como vendido. Dados fictícios.
 */
import { describe, expect, it } from "vitest";
import {
  disponivelNoEstoque,
  vendasValidas,
  veiculosComVendaCancelada,
} from "../src/main/inventory/canceled-sales";

const veiculos = [
  { idVehicle: "1", status: "VENDIDO", active: "true" },
  { idVehicle: "2", status: "DISPONÍVEL ESTOQUE", active: "true" },
  { idVehicle: "3", status: "DISPONÍVEL ESTOQUE", active: "true" },
  { idVehicle: "4", status: "DISPONÍVEL ESTOQUE", active: "false" },
];
const vendas = [
  { idSale: "a", idVehicle: "1" },
  { idSale: "b", idVehicle: "2" },
  { idSale: "c", idVehicle: "4" },
];

describe("vendas canceladas no BNDV", () => {
  it("veículo ativo e disponível no estoque está no estoque (com ou sem acento)", () => {
    expect(disponivelNoEstoque(veiculos[1])).toBe(true);
    expect(
      disponivelNoEstoque({ status: "Disponivel estoque", active: "TRUE" }),
    ).toBe(true);
    expect(disponivelNoEstoque(veiculos[0])).toBe(false);
    expect(disponivelNoEstoque(veiculos[3])).toBe(false);
  });

  it("tira só a venda do veículo que voltou ao estoque", () => {
    expect([...veiculosComVendaCancelada(veiculos, vendas)]).toEqual(["2"]);
    expect(vendasValidas(veiculos, vendas).map((s) => s.idSale)).toEqual([
      "a",
      "c",
    ]);
  });

  it("sem venda cancelada devolve a mesma lista", () => {
    const so = [vendas[0]];
    expect(vendasValidas(veiculos, so)).toBe(so);
  });
});
