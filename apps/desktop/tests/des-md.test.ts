/**
 * Testes (Vitest) da leitura de quilometragem e valor do DES.md (src/shared/des-md.ts) e de como
 * o Pré-atendimento IA usa esses dados no prompt. Dados fictícios.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lerKmEValor } from "../src/shared/des-md";
import {
  LOJA_PADRAO,
  PERSONA_PADRAO,
  RESPOSTAS_PADRAO,
  REGRAS_DE_ENCAMINHAMENTO,
  descreverVeiculo,
  montarMensagens,
} from "../src/shared/pre-service";

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures", "DES.md"),
  "utf8",
);

describe("lerKmEValor", () => {
  it("lê km e valor da fixture oficial do DES.md", () => {
    expect(lerKmEValor(fixture)).toEqual({ km: "84.000", valor: "48.900" });
  });
  it("aceita CRLF e devolve vazio quando falta ou não é informado", () => {
    expect(
      lerKmEValor("## QUILOMETRAGEM\r\n12.500\r\n\r\n## VALOR\r\nR$59.990,00"),
    ).toEqual({ km: "12.500", valor: "59.990" });
    expect(
      lerKmEValor("## QUILOMETRAGEM\nNÃO INFORMADO\n\n## VALOR\nR$0,00"),
    ).toEqual({ km: "", valor: "" });
    expect(lerKmEValor("sem seções")).toEqual({ km: "", valor: "" });
  });
});

describe("prompt do Pré-atendimento IA", () => {
  const veiculos = [
    {
      id: "1",
      marca: "Ford",
      modelo: "Fiesta",
      placa: "AAA1A11",
      preco: "48.900",
      km: "84.000",
    },
    {
      id: "2",
      marca: "Chevrolet",
      modelo: "Onix",
      placa: "BBB2B22",
      preco: "",
    },
  ];
  const monta = (persona: string) =>
    montarMensagens({
      persona,
      loja: LOJA_PADRAO,
      config: { nomeAgente: "Sofia" } as never,
      veiculos,
      respostas: RESPOSTAS_PADRAO,
      exemplos: [],
      reais: [],
      conversa: [{ role: "user", content: "Quantos km tem o Fiesta?" }],
      nomeLead: "Ana",
    }).mensagens[0].content;

  it("mostra o km na lista de estoque e avisa que dado ausente não existe", () => {
    expect(descreverVeiculo(veiculos[0])).toBe(
      "Ford Fiesta · R$ 48.900 · 84.000 km",
    );
    const sistema = monta(PERSONA_PADRAO);
    expect(sistema).toContain("Ford Fiesta · R$ 48.900 · 84.000 km");
    expect(sistema).toContain("não mostra preço ou km");
  });

  it("as regras de encaminhamento entram mesmo com persona antiga", () => {
    const sistema = monta(
      "Persona antiga: se não souber, diga que vai confirmar.",
    );
    expect(sistema).toContain(REGRAS_DE_ENCAMINHAMENTO);
    expect(REGRAS_DE_ENCAMINHAMENTO).toContain("[TRANSFERIR]");
    expect(REGRAS_DE_ENCAMINHAMENTO).toMatch(/LIGAÇÃO/);
    expect(REGRAS_DE_ENCAMINHAMENTO).toMatch(/NÃO agenda nem oferece visita/);
    expect(REGRAS_DE_ENCAMINHAMENTO).toMatch(/Não responda "sem problemas"/);
  });
});
