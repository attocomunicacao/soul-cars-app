/**
 * Testes do ciclo rápido do Laboratório da IA (dados 100% fictícios): exemplos reais da equipe no
 * prompt, uso/tokens por turno, parada no limite diário do Groq, conjunto rápido e conversão de erros
 * reais da auditoria em cenários anonimizados.
 */
import { describe, expect, it } from "vitest";
import { cenariosDaAuditoria } from "../src/main/lab/audit-scenarios";
import { rodarCenario, rodarLote } from "../src/main/lab/runner";
import {
  LIMITE_DIARIO_GROQ,
  gerar,
  lerLimiteGroq,
  type UsoModelo,
} from "../src/main/pre-service/llm";
import type { Cenario } from "../src/shared/lab";
import {
  CONJUNTO_RAPIDO,
  CPF_TESTE,
  cenariosBase,
} from "../src/shared/lab-corpus";
import { CONFIG_PADRAO } from "../src/shared/pre-service";
import type { TurnoAuditado } from "../src/shared/pre-service-audit";

const cenario = (id: string, turnos: string[]): Cenario => ({
  id,
  categoria: "teste",
  titulo: id,
  turnos,
});

describe("exemplos reais no Laboratório", () => {
  it("entram no prompt e ficam registrados no turno", async () => {
    let sistema = "";
    const r = await rodarCenario(cenario("t", ["Vocês financiam?"]), {
      reais: [
        {
          conversa: "c1",
          pergunta: "Vocês financiam?",
          resposta: "Financiamos sim, a análise é pelo nosso sistema.",
        },
      ],
      gerar: async (m) => {
        sistema = m[0].content;
        return "Financiamos sim!";
      },
    });
    expect(sistema).toContain("COMO NOSSA EQUIPE JÁ RESPONDEU");
    expect(r.turnos[0].reais).toBe(1);
  });

  it("registra quem respondeu e os tokens quando o modelo informa", async () => {
    const r = await rodarCenario(cenario("t", ["Oi"]), {
      gerar: async (_m, uso) => {
        Object.assign(uso!, {
          provedor: "groq",
          modelo: "x",
          reserva: false,
          tokens: 2100,
        });
        return "Olá! Como posso ajudar?";
      },
    });
    expect(r.turnos[0].uso).toMatchObject({ provedor: "groq", tokens: 2100 });
  });
});

describe("rodarLote com pararSe", () => {
  it("interrompe no limite diário e devolve o que já rodou", async () => {
    let chamadas = 0;
    const lista = ["a", "b", "c"].map((id) => cenario(id, ["Oi"]));
    const r = await rodarLote(
      lista,
      {
        gerar: async () => {
          chamadas++;
          if (chamadas === 2) throw new Error(LIMITE_DIARIO_GROQ);
          return "Olá!";
        },
      },
      { pararSe: (x) => !!x.erro?.includes(LIMITE_DIARIO_GROQ) },
    );
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
    expect(chamadas).toBe(2);
  });
});

describe("tokens do provedor", () => {
  const resposta = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("lê usage.total_tokens do Groq", async () => {
    const uso: UsoModelo = { provedor: "", modelo: "", reserva: false };
    const texto = await gerar(
      async () =>
        resposta({
          choices: [{ message: { content: "Oi!" } }],
          usage: { total_tokens: 1234 },
        }),
      [{ role: "user", content: "oi" }],
      { ...CONFIG_PADRAO, provedor: "groq" },
      "chave-ficticia",
      () => {},
      uso,
    );
    expect(texto).toBe("Oi!");
    expect(uso).toMatchObject({ provedor: "groq", tokens: 1234 });
  });

  it("soma prompt_eval_count e eval_count do Ollama", async () => {
    const uso: UsoModelo = { provedor: "", modelo: "", reserva: false };
    await gerar(
      async () =>
        resposta({
          message: { content: "Oi!" },
          prompt_eval_count: 900,
          eval_count: 40,
        }),
      [{ role: "user", content: "oi" }],
      { ...CONFIG_PADRAO, provedor: "ollama" },
      null,
      () => {},
      uso,
    );
    expect(uso).toMatchObject({ provedor: "ollama", tokens: 940 });
  });

  it("sem reserva, o limite diário do Groq chega como erro reconhecível", async () => {
    await expect(
      gerar(
        async () =>
          new Response("{}", {
            status: 429,
            headers: { "retry-after": "3600" },
          }),
        [{ role: "user", content: "oi" }],
        { ...CONFIG_PADRAO, provedor: "groq", reservaOllama: false },
        "chave-ficticia",
      ),
    ).rejects.toThrow(LIMITE_DIARIO_GROQ);
  });
});

describe("conjunto rápido", () => {
  it("só tem ids que existem no corpus, sem repetir", () => {
    const ids = new Set(cenariosBase().map((c) => c.id));
    expect(CONJUNTO_RAPIDO.length).toBeGreaterThanOrEqual(20);
    expect(new Set(CONJUNTO_RAPIDO).size).toBe(CONJUNTO_RAPIDO.length);
    for (const id of CONJUNTO_RAPIDO) expect(ids.has(id), id).toBe(true);
  });
});

describe("cenariosDaAuditoria", () => {
  const turno = (p: Partial<TurnoAuditado>): TurnoAuditado => ({
    id: "x",
    em: "2026-01-01T12:10:00.000Z",
    origem: "laco",
    chatId: "chat1",
    nome: "Fulano Beltrano",
    telefone: null,
    recebidas: [],
    provedor: "groq",
    modelo: "m",
    reserva: false,
    latenciaMs: 500,
    bruto: "",
    texto: "",
    transferir: false,
    encerrar: false,
    usados: { respostas: [], veiculos: 0, exemplos: 0, reais: 0 },
    fotos: { veiculo: null, qtd: 0, semFotos: false },
    estoque: 0,
    desfecho: "pendente" as TurnoAuditado["desfecho"],
    sinais: [],
    ...p,
  });
  const em = (min: number) => Date.UTC(2026, 0, 1, 12, min);
  const historicos = {
    chat1: [
      { role: "user" as const, content: "Oi, aqui é o Fulano", em: em(0) },
      { role: "assistant" as const, content: "Olá! Qual seu CPF?", em: em(1) },
      { role: "user" as const, content: `Meu CPF é ${CPF_TESTE}`, em: em(2) },
      {
        role: "user" as const,
        content: "Me liga no (11) 98888-7777 ou a@b.com",
        em: em(3),
      },
      { role: "user" as const, content: "Depois do erro", em: em(30) },
    ],
  };

  it("cria cenário só de turnos com sinal, anonimizado e até o turno do erro", () => {
    const c = cenariosDaAuditoria(
      [
        turno({ id: "ok", sinais: [] }),
        turno({ id: "ruim", sinais: ["prometeu-consultor-sem-transferir"] }),
      ],
      historicos,
    );
    expect(c).toHaveLength(1);
    expect(c[0].categoria).toBe("auditoria");
    expect(c[0].esperado?.semSinais).toEqual([
      "prometeu-consultor-sem-transferir",
    ]);
    const tudo = JSON.stringify(c);
    expect(tudo).not.toMatch(/Fulano|529\.982|98888|a@b\.com/);
    expect(tudo).not.toContain("Depois do erro");
    expect(c[0].turnos).toHaveLength(3);
  });

  it("sem histórico usa as mensagens recebidas e ignora o simulador", () => {
    const c = cenariosDaAuditoria(
      [
        turno({
          chatId: "outro",
          recebidas: ["Tem Civic?"],
          sinais: ["preco-fora-do-estoque"],
        }),
        turno({
          origem: "simulador",
          recebidas: ["teste"],
          sinais: ["sem-resposta"],
        }),
      ],
      historicos,
    );
    expect(c.map((x) => x.turnos)).toEqual([["Tem Civic?"]]);
  });
});

describe("lerLimiteGroq", () => {
  const corpo = (message: string) => JSON.stringify({ error: { message } });

  it("reconhece tokens por dia e o prazo informado pelo Groq", () => {
    const r = lerLimiteGroq(
      corpo(
        "Rate limit reached for model on tokens per day (TPD): Limit 200000, Used 199000. Please try again in 12m3.5s.",
      ),
      0,
    );
    expect(r.diario).toBe(true);
    expect(r.segundos).toBeCloseTo(723.5);
    expect(r.mensagem.startsWith(LIMITE_DIARIO_GROQ)).toBe(true);
    expect(r.mensagem).toContain("tokens/dia");
    expect(r.mensagem).toContain("~13 min");
  });

  it("tokens por minuto não é diário, mesmo com prazo longo", () => {
    const r = lerLimiteGroq(
      corpo("Limit on tokens per minute (TPM). Please try again in 7.2s."),
      0,
    );
    expect(r.diario).toBe(false);
    expect(r.segundos).toBeCloseTo(7.2);
  });

  it("sem tipo no corpo, usa o retry-after (acima de 20 s = diário)", () => {
    expect(lerLimiteGroq("{}", 3600).diario).toBe(true);
    expect(lerLimiteGroq("{}", 3600).mensagem).toContain("~1 h");
    expect(lerLimiteGroq("", 5).diario).toBe(false);
  });

  it("limite por minuto tenta de novo e responde", async () => {
    let n = 0;
    const texto = await gerar(
      async () =>
        ++n === 1
          ? new Response(corpo("tokens per minute (TPM). try again in 0.01s"), {
              status: 429,
            })
          : new Response(
              JSON.stringify({ choices: [{ message: { content: "Oi!" } }] }),
            ),
      [{ role: "user", content: "oi" }],
      { ...CONFIG_PADRAO, provedor: "groq", reservaOllama: false },
      "chave-ficticia",
    );
    expect(texto).toBe("Oi!");
    expect(n).toBe(2);
  });
});

describe("resposta vazia do modelo", () => {
  it("tenta mais uma vez e soma os tokens", async () => {
    let n = 0;
    const uso: UsoModelo = { provedor: "", modelo: "", reserva: false };
    const texto = await gerar(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: ++n === 1 ? "<think>x</think> " : "Salve! Tudo bem?",
                },
              },
            ],
            usage: { total_tokens: 1000 },
          }),
        ),
      [{ role: "user", content: "Salve." }],
      { ...CONFIG_PADRAO, provedor: "groq" },
      "chave-ficticia",
      () => {},
      uso,
    );
    expect(texto).toBe("Salve! Tudo bem?");
    expect(n).toBe(2);
    expect(uso.tokens).toBe(2000);
  });

  it("não repete quando a primeira resposta tem texto", async () => {
    let n = 0;
    await gerar(
      async () => {
        n++;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "Oi!" } }] }),
        );
      },
      [{ role: "user", content: "oi" }],
      { ...CONFIG_PADRAO, provedor: "groq" },
      "chave-ficticia",
    );
    expect(n).toBe(1);
  });
});
