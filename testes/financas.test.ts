import { describe, expect, it } from "vitest";
import {
  dataIso,
  lerMeses,
  lerValorDigitado,
  resumirMes,
  valorVariavel,
} from "../src/renderer/src/lib/financas";
import type { Celula } from "../src/renderer/src/lib/xlsx";

const linha = (...c: Celula[]): Celula[] => [null, ...c];

const aba = {
  nome: "OUTUBRO",
  linhas: [
    [],
    linha("FINANCEIRO"),
    linha(
      "VENCIMENTO",
      "DESTINATÁRIO",
      "VALOR",
      "CHAVE",
      "VIA",
      "ACESSO",
      "LOCAL",
    ),
    linha("2026-10-05", "ENEL", 404.5, "-", "WEB", "a@b.c", "Av. São Miguel"),
    linha("2026-10-05", "ENEL", 497, "-", "WEB", "d@e.f", "Rua X"),
    linha("2026-10-05", "VIVO", 150, "-", "DÉBITO", null, "-"),
    linha("05/10/2026", "TOTAL", 901.5, null, "-"),
    [],
    linha("VENCIMENTO", "DESTINATÁRIO", "VALOR"),
    linha("2026-10-20", "GESSE", null, "-", "WHATSAPP"),
    linha("2026-10-20", "SABESP", 163.96),
    linha("20/10/2026", "TOTAL", 163.96),
  ],
};

describe("finanças: leitura da planilha mensal", () => {
  it("converte datas ISO e brasileiras", () => {
    expect(dataIso("2026-10-05")).toBe("2026-10-05");
    expect(dataIso("5/7/2026")).toBe("2026-07-05");
    expect(dataIso("TOTAL")).toBeNull();
  });

  it("separa os blocos e soma o que a planilha deixou de fora", () => {
    const [mes] = lerMeses([aba]);
    expect(mes.blocos).toHaveLength(2);
    expect(mes.blocos[0].rotulo).toBe("Vencimento dia 05");
    expect(mes.blocos[0].contas).toHaveLength(3);
    expect(mes.blocos[0].total).toBe(1051.5);
    expect(mes.blocos[0].totalPlanilha).toBe(901.5);
    expect(mes.blocos[1].contas[0].valor).toBeNull();
  });

  it("dá id único a destinatários repetidos", () => {
    const [mes] = lerMeses([aba]);
    const ids = mes.blocos[0].contas.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("ignora abas sem tabelas", () => {
    expect(lerMeses([{ nome: "VAZIA", linhas: [linha("oi")] }])).toEqual([]);
  });

  it("resume pago, a pagar, atraso e próximo vencimento", () => {
    const [mes] = lerMeses([aba]);
    const enel = mes.blocos[0].contas[0].id;
    const r = resumirMes(mes, { [enel]: true }, "2026-10-10");
    expect(r.total).toBe(1215.46);
    expect(r.pago).toBe(404.5);
    expect(r.aPagar).toBe(810.96);
    expect(r.atrasadas).toBe(2);
    expect(r.proxima?.destinatario).toBe("GESSE");
  });
});

describe("finanças: edição", () => {
  it("lê valores digitados no formato brasileiro", () => {
    expect(lerValorDigitado("1.234,56")).toBe(1234.56);
    expect(lerValorDigitado("R$ 90")).toBe(90);
    expect(lerValorDigitado("90.5")).toBe(90.5);
    expect(lerValorDigitado("  ")).toBeNull();
    expect(lerValorDigitado("abc")).toBeUndefined();
  });

  it("informa a linha de cada conta e a do TOTAL", () => {
    const [mes] = lerMeses([aba]);
    expect(mes.blocos[0].contas.map((c) => c.linha)).toEqual([4, 5, 6]);
    expect(mes.blocos[0].linhaTotal).toBe(7);
    expect(mes.blocos[1].linhaTotal).toBe(12);
  });

  it("só as contas variáveis de cada bloco aceitam valor", () => {
    expect(valorVariavel(0, "PORTO VISTORIAS")).toBe(true);
    expect(valorVariavel(0, "Cartório São Miguel")).toBe(true);
    expect(valorVariavel(0, "CAMERA CARLOS")).toBe(false);
    expect(valorVariavel(0, "GESSE")).toBe(false);
    expect(valorVariavel(1, "GESSE")).toBe(true);
    expect(valorVariavel(1, "COMGÁS")).toBe(true);
    expect(valorVariavel(1, "ESTACIONAMENTO")).toBe(false);
    expect(valorVariavel(2, "ENEL")).toBe(false);
  });
});
