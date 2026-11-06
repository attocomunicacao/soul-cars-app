/**
 * Testes (Vitest) de src/renderer/src/lib/description-generator.ts com ficha da web.
 */
import { describe, expect, it } from "vitest";
import {
  camposVazios,
  gerarDes,
  type FichaDes,
} from "../src/renderer/src/lib/description-generator";

const loja = { contato: "11 90000-0000", horario: "Seg a Sex" } as Parameters<
  typeof gerarDes
>[1];

const base: FichaDes = {
  nome: "Mercedes Benz GLA-250",
  ano: "2016",
  marca_modelo: "Mercedes BENZ GLA 250",
  cor: "BRANCA",
  combustivel: "GASOLINA",
  preco: 117900,
  km: 114997,
  versao: "",
  configuracao: "",
  lugares: "",
  portas: "",
  cambio: "",
  direcao: "",
  seguranca: "",
  conforto: "",
  infotenimento: "",
};

describe("DES.md com a ficha vinda da web", () => {
  it("os dados técnicos da consulta entram no DES.md", () => {
    const comWeb: FichaDes = {
      ...base,
      versao: "Sport 2.0 Turbo",
      configuracao: "SUV",
      lugares: "5",
      portas: "4",
      cambio: "Automatizado de 7 marchas",
      direcao: "Elétrica",
    };
    const md = gerarDes(comWeb, loja);
    expect(md).toContain("Sport 2.0 Turbo");
    expect(md).toContain("Automatizado de 7 marchas");
    expect(md).toContain("SUV");
    expect(md).toContain("Elétrica");
  });

  it("campos que a consulta não trouxe aparecem na lista de vazios", () => {
    expect(camposVazios(base)).toEqual(
      expect.arrayContaining(["Motor", "Câmbio", "Segurança", "Conforto"]),
    );
  });
});
