/**
 * Testes (Vitest) da auditoria do Pré-atendimento IA: os sinais de alerta de
 * `src/shared/pre-service-audit.ts` e a gravação JSONL de `src/main/pre-service/audit.ts`.
 * Veículos e conversas fictícios.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  avaliarTurno,
  mascararTelefone,
  type EntradaAvaliacao,
  type TurnoAuditado,
} from "../src/shared/pre-service-audit";
import {
  gravarDesfecho,
  gravarTurno,
  lerTurnos,
} from "../src/main/pre-service/audit";

const veiculos = ["Onix", "Corolla", "Civic", "T-Cross"].map((modelo, i) => ({
  id: String(i + 1),
  marca: "Marca",
  modelo,
  placa: `AAA${i}A00`,
  preco: ["62.900", "109.900", "98.500", "88.000"][i],
}));

const base: EntradaAvaliacao = {
  texto: "Temos o Onix por R$ 62.900.",
  transferir: false,
  encerrar: false,
  recebidas: ["Quanto está o Onix?"],
  veiculos,
  anteriores: [],
  fotosPlanejadas: 0,
};

describe("avaliarTurno", () => {
  it("resposta correta não gera sinal", () => {
    expect(avaliarTurno(base)).toEqual([]);
  });

  it("prometer consultor sem transferir é alerta; com transferir não", () => {
    const t = "Vou confirmar a quilometragem exata com o consultor.";
    expect(avaliarTurno({ ...base, texto: t })).toContain(
      "prometeu-consultor-sem-transferir",
    );
    expect(avaliarTurno({ ...base, texto: t, transferir: true })).not.toContain(
      "prometeu-consultor-sem-transferir",
    );
  });

  it("preço fora do estoque é alerta; preço do estoque não", () => {
    expect(
      avaliarTurno({ ...base, texto: "O Onix sai por R$ 66.900." }),
    ).toContain("preco-fora-do-estoque");
    expect(avaliarTurno({ ...base, texto: "Entrada de R$ 500." })).toEqual([]);
    // O valor que o próprio cliente digitou (entrada) não conta como preço citado pela IA.
    expect(
      avaliarTurno({
        ...base,
        texto: "Com R$ 10.000 de entrada, um consultor continua por aqui.",
        recebidas: ["Tenho 10.000 de entrada"],
        transferir: true,
      }),
    ).toEqual([]);
  });

  it("diz ter só um carro com estoque maior e conta errada", () => {
    expect(
      avaliarTurno({
        ...base,
        texto: "No momento, temos apenas o Onix disponível no estoque.",
      }),
    ).toContain("nega-estoque-existente");
    expect(
      avaliarTurno({ ...base, texto: "Temos 19 veículos disponíveis." }),
    ).toContain("contagem-estoque-diferente");
    expect(
      avaliarTurno({ ...base, texto: "Temos 4 veículos disponíveis." }),
    ).toEqual([]);
  });

  it("repetir o fechamento 'agendar visita' três vezes é alerta", () => {
    const fecha = "Fico feliz!\n\nQuer agendar uma visita para ver o carro?";
    expect(
      avaliarTurno({ ...base, texto: fecha, anteriores: [fecha, fecha] }),
    ).toContain("fechamento-repetido");
    expect(
      avaliarTurno({ ...base, texto: fecha, anteriores: [fecha] }),
    ).not.toContain("fechamento-repetido");
  });

  it("resposta vazia, longa e pedido de foto sem plano", () => {
    expect(avaliarTurno({ ...base, texto: "" })).toContain("sem-resposta");
    expect(avaliarTurno({ ...base, texto: "a".repeat(501) })).toContain(
      "resposta-longa",
    );
    expect(
      avaliarTurno({
        ...base,
        texto: "Segue as fotos do Onix 👇",
        recebidas: ["Tem foto?"],
      }),
    ).toContain("foto-sem-plano");
    // Perguntar de qual carro são as fotos é o comportamento certo, não um alerta.
    expect(
      avaliarTurno({
        ...base,
        texto: "De qual carro você quer as fotos?",
        recebidas: ["Tem foto?"],
      }),
    ).toEqual([]);
    expect(
      avaliarTurno({
        ...base,
        texto: "Segue 👇",
        recebidas: ["Tem foto?"],
        fotosPlanejadas: 6,
      }),
    ).toEqual([]);
  });
});

describe("simulação e promessas sem transferir", () => {
  it("oferecer simular parcelas é alerta, salvo se transferiu", () => {
    const t = "Podemos simular as parcelas para você.";
    expect(avaliarTurno({ ...base, texto: t })).toContain("ofereceu-simulacao");
    expect(avaliarTurno({ ...base, texto: t, transferir: true })).not.toContain(
      "ofereceu-simulacao",
    );
  });
  it("'para o consultor fazer a simulação' conta como promessa", () => {
    expect(
      avaliarTurno({
        ...base,
        texto: "Prefere uma ligação para o consultor fazer essa simulação?",
      }),
    ).toContain("prometeu-consultor-sem-transferir");
  });
});

describe("qualificação do lead", () => {
  const coleta = {
    financiado: true,
    pendentes: ["cpf", "nascimento", "entrada"],
    podeTransferir: false,
  };
  const fala = { ...base, recebidas: ["Vcs financiam?"] };

  it("alerta quando o cliente fala de financiamento e a IA não pede os dados", () => {
    expect(
      avaliarTurno({
        ...fala,
        texto: "Trabalhamos com vários bancos.",
        coleta,
      }),
    ).toContain("financiamento-sem-dados");
  });
  it("não alerta quando pede os dados, nem num simples cumprimento", () => {
    expect(
      avaliarTurno({
        ...fala,
        texto: "Preciso do seu CPF. Quanto você dispõe de entrada?",
        coleta,
      }),
    ).not.toContain("financiamento-sem-dados");
    expect(
      avaliarTurno({
        ...base,
        recebidas: ["Oi"],
        texto: "Oi! Como posso ajudar?",
        coleta,
      }),
    ).not.toContain("financiamento-sem-dados");
  });
  it("alerta quando transfere antes de poder", () => {
    expect(
      avaliarTurno({
        ...base,
        texto: "Um consultor vai te ligar.",
        transferir: true,
        coleta,
      }),
    ).toContain("transferiu-sem-coletar");
    expect(
      avaliarTurno({
        ...base,
        texto: "Um consultor vai te ligar.",
        transferir: true,
        coleta: { ...coleta, podeTransferir: true },
      }),
    ).not.toContain("transferiu-sem-coletar");
  });
  it("oferecer agendar visita é alerta; combinar ligação não", () => {
    expect(
      avaliarTurno({
        ...base,
        texto: "Gostaria de agendar uma visita para ver o carro?",
      }),
    ).toContain("ofereceu-visita");
    expect(
      avaliarTurno({
        ...base,
        texto: "Um consultor vai te ligar e combinar os próximos passos.",
      }),
    ).not.toContain("ofereceu-visita");
  });
});

describe("mascararTelefone", () => {
  it("guarda só o começo e os 2 últimos dígitos", () => {
    expect(mascararTelefone("+55 11 91234-5678")).toBe("5511*******78");
    expect(mascararTelefone(null)).toBeNull();
  });
});

describe("gravação da auditoria", () => {
  const turno = (id: string, em: string): TurnoAuditado => ({
    id,
    em,
    origem: "laco",
    chatId: "c1",
    nome: "Cliente",
    telefone: null,
    recebidas: ["Oi"],
    provedor: "groq",
    modelo: "m",
    reserva: false,
    latenciaMs: 10,
    bruto: "Oi!",
    texto: "Oi!",
    transferir: false,
    encerrar: false,
    usados: { respostas: [], veiculos: 0, exemplos: 0, reais: 0 },
    fotos: { veiculo: null, qtd: 0, semFotos: false },
    estoque: 4,
    desfecho: "rascunho",
    sinais: [],
  });

  it("lê os mais novos primeiro e aplica o desfecho", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auditoria-"));
    const arq = path.join(dir, "a.jsonl");
    gravarTurno(arq, turno("a", "2026-01-01T10:00:00.000Z"));
    gravarTurno(arq, turno("b", "2026-01-01T11:00:00.000Z"));
    gravarDesfecho(arq, "a", "aprovado");
    fs.appendFileSync(arq, "{linha cortada\n");
    const lidos = lerTurnos(arq);
    expect(lidos.map((t) => t.id)).toEqual(["b", "a"]);
    expect(lidos[1].desfecho).toBe("aprovado");
    expect(lerTurnos(path.join(dir, "nao-existe.jsonl"))).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
