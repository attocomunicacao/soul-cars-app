/**
 * Testes do executor do Laboratório da IA com modelo roteirizado (sem LLM): estado entre turnos,
 * detecção de repetição e de CPF em claro, conferência do que se espera e execução em lote.
 */
import { describe, expect, it } from "vitest";
import { conferir, rodarCenario, rodarLote } from "../src/main/lab/runner";
import type { Cenario } from "../src/shared/lab";
import { FICHA_VAZIA } from "../src/shared/lead-profile";
import { CPF_TESTE } from "../src/shared/lab-corpus";

/** Modelo falso: devolve as respostas na ordem (a última se repete). */
const roteiro = (...respostas: string[]) => {
  let i = 0;
  return async () => respostas[Math.min(i++, respostas.length - 1)];
};

const cenario = (
  turnos: string[],
  esperado?: Cenario["esperado"],
): Cenario => ({
  id: "t",
  categoria: "teste",
  titulo: "t",
  turnos,
  esperado,
});

describe("rodarCenario", () => {
  it("mantém o histórico entre os turnos e passa a conversa ao modelo", async () => {
    const vistas: number[] = [];
    const r = await rodarCenario(cenario(["Oi", "Tem Civic?"]), {
      gerar: async (m) => {
        vistas.push(m.length);
        return vistas.length === 1
          ? "Olá! Como posso ajudar?"
          : "O Civic está disponível.";
      },
    });
    expect(r.turnos).toHaveLength(2);
    expect(r.turnos[1].texto).toContain("Civic");
    // o 2º turno enxerga mais mensagens que o 1º (histórico acumulado)
    expect(vistas[1]).toBeGreaterThan(vistas[0]);
  });

  it("guarda remove do 2º turno a frase que o modelo repetiu", async () => {
    const fala =
      "O Civic 2019 está disponível por R$ 109.900 e tem 84.000 km rodados.";
    const r = await rodarCenario(cenario(["Tem Civic?", "Tem Civic?"]), {
      gerar: roteiro(fala, fala),
    });
    expect(r.turnos[0].texto).toContain("Civic 2019");
    expect(r.turnos[1].texto).not.toContain("Civic 2019");
    expect(r.turnos[1].sinais).not.toContain("frase-duplicada");
  });

  it("detecta CPF em claro na resposta", async () => {
    const r = await rodarCenario(
      cenario(["Quero financiar o Onix", CPF_TESTE]),
      {
        gerar: roteiro("Certo!", `Anotei o CPF ${CPF_TESTE}.`),
      },
    );
    expect(r.turnos[1].sinais).toContain("cpf-em-claro");
  });

  it("devolve o erro sem derrubar o lote", async () => {
    const r = await rodarCenario(cenario(["Oi"]), {
      gerar: async () => {
        throw new Error("modelo fora do ar");
      },
    });
    expect(r.erro).toBe("modelo fora do ar");
    expect(r.falhas[0]).toContain("modelo fora do ar");
  });

  it("transfere quando o cliente pede um humano", async () => {
    const r = await rodarCenario(
      cenario(["Quero falar com um vendedor"], { transfere: true }),
      { gerar: roteiro("Claro! Vou chamar um consultor.") },
    );
    expect(r.turnos[0].transferir).toBe(true);
    expect(r.falhas).toEqual([]);
  });
});

describe("conferir", () => {
  it("aponta trecho proibido e ausente", () => {
    const turno = {
      cliente: "x",
      bruto: "",
      texto: "Temos o Civic por R$ 100.000",
      transferir: false,
      encerrar: false,
      omitido: false,
      fotos: 0,
      sinais: [],
      latenciaMs: 0,
    };
    const f = conferir(
      { proibido: ["R$ 100.000"], contem: ["corolla"] },
      [turno],
      // ficha mínima: só o necessário para conferir
      FICHA_VAZIA,
    );
    expect(f.join(" ")).toContain("proibido");
    expect(f.join(" ")).toContain("Nenhuma resposta contém");
  });
});

describe("rodarLote", () => {
  it("repete cada cenário, avisa o progresso e respeita o cancelamento", async () => {
    const feitos: number[] = [];
    const todos = await rodarLote(
      [cenario(["Oi"]), { ...cenario(["Olá"]), id: "t2" }],
      { gerar: roteiro("Olá! Como posso ajudar?") },
      { repeticoes: 2, progresso: (n) => feitos.push(n) },
    );
    expect(todos).toHaveLength(4);
    expect(feitos).toEqual([1, 2, 3, 4]);
    let n = 0;
    const parcial = await rodarLote(
      [cenario(["Oi"]), { ...cenario(["Olá"]), id: "t2" }],
      { gerar: roteiro("Oi!") },
      { cancelado: () => n++ >= 1 },
    );
    expect(parcial).toHaveLength(1);
  });
});
