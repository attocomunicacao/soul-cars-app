import { describe, expect, it } from "vitest";
import {
  classificarEtiqueta,
  demandaPorModelo,
  emEstoque,
} from "../src/compartilhado/crm-etiquetas";

describe("classificarEtiqueta", () => {
  it("reconhece veículos com ou sem emoji", () => {
    expect(classificarEtiqueta("🚘 FIESTA 2016")).toEqual({
      tipo: "veiculo",
      modelo: "FIESTA",
      ano: 2016,
    });
    expect(classificarEtiqueta("AUDI A3 2015", "🚘")).toMatchObject({
      modelo: "AUDI A3",
      ano: 2015,
    });
    expect(classificarEtiqueta("🏍 NMAX 2023")).toMatchObject({
      modelo: "NMAX",
    });
    expect(classificarEtiqueta("🚘 ZAFIRA")).toEqual({
      tipo: "veiculo",
      modelo: "ZAFIRA",
      ano: null,
    });
  });

  it("reconhece etapas, encerrados e temperatura", () => {
    expect(classificarEtiqueta("👀 1 FOLLOW")).toEqual({
      tipo: "etapa",
      chave: "follow1",
    });
    expect(classificarEtiqueta("📞 LIGAÇÃO COM HORA MARCADA")).toEqual({
      tipo: "etapa",
      chave: "horaMarcada",
    });
    expect(classificarEtiqueta("🔏 SIMULAÇÃO")).toMatchObject({
      chave: "simulacao",
    });
    expect(classificarEtiqueta("🤑 VENDIDO")).toMatchObject({
      chave: "vendido",
    });
    expect(classificarEtiqueta("❌ DESQUALIFICADO")).toEqual({
      tipo: "encerrado",
      chave: "desqualificado",
    });
    expect(classificarEtiqueta("🔥 QUENTE")).toEqual({
      tipo: "temperatura",
      chave: "quente",
    });
    expect(classificarEtiqueta("🧊 FRIO")).toMatchObject({ chave: "frio" });
    expect(classificarEtiqueta("Promoção")).toEqual({ tipo: "outra" });
  });
});

describe("demandaPorModelo", () => {
  it("soma anos e etiquetas repetidas de um modelo", () => {
    const d = demandaPorModelo([
      { nome: "🚘 PRISMA 2011", leads: 115 },
      { nome: "🚘 Prisma 2011", leads: 5 },
      { nome: "🚘 PRISMA 2017", leads: 90 },
      { nome: "🚘 FIESTA 2016", leads: 176 },
      { nome: "❌ FINALIZADO", leads: 1265 },
    ]);
    expect(d.map((x) => [x.modelo, x.leads])).toEqual([
      ["PRISMA", 210],
      ["FIESTA", 176],
    ]);
    expect(d[0].anos).toEqual([
      { ano: 2017, leads: 90 },
      { ano: 2011, leads: 120 },
    ]);
  });
});

describe("emEstoque", () => {
  const estoque = [
    { marca: "VW", modelo: "T-CROSS 200 TSI", ano: "2020/2020" },
    { marca: "FORD", modelo: "FIESTA 1.6", ano: "2016/2016" },
  ];
  it("ignora hífen e espaço e confere o ano quando informado", () => {
    expect(emEstoque("TCROSS", 2020, estoque)).toBe(1);
    expect(emEstoque("TCROSS", 2019, estoque)).toBe(0);
    expect(emEstoque("FIESTA", null, estoque)).toBe(1);
    expect(emEstoque("HB20", null, estoque)).toBe(0);
  });
});
