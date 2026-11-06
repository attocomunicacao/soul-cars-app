/**
 * Testes (Vitest) de src/main/soul-ai/performance.ts (números do painel de desempenho).
 */
import { describe, expect, it } from "vitest";
import type { Analise } from "../src/main/soul-ai/analysis";
import {
  calcularDesempenho,
  faixaDeEspera,
} from "../src/main/soul-ai/performance";

const AGORA = new Date("2026-10-16T15:00:00Z");

const metrica = (criadaEm: string, esperaMin: number | null, sem = false) =>
  ({
    criadaEm,
    esperaMin,
    semResposta: sem,
    msgsLead: 1,
    anuncio: null,
  }) as unknown as Analise["metricas"][number];

describe("desempenho", () => {
  it("classifica a espera em faixas", () => {
    expect(faixaDeEspera(null)).toBe("Sem resposta");
    expect(faixaDeEspera(3)).toBe("Até 5 min");
    expect(faixaDeEspera(45)).toBe("30 min a 1 h");
    expect(faixaDeEspera(500)).toBe("Mais de 4 h");
  });

  it("agrupa por dia (UTC-3), zera dias vazios e soma as faixas", () => {
    const a = {
      conversas: 3,
      conversasComLead: 3,
      semRespostaPct: 33,
      positivas: 0,
      metricas: [
        metrica("2026-10-16T12:00:00Z", 2),
        metrica("2026-10-16T01:00:00Z", null, true), // 15/10 22h no Brasil
        metrica("2026-10-15T20:00:00Z", 90),
      ],
      espera: {
        medianaMin: 2,
        ate5minPct: 50,
        ate1hPct: 50,
        porFaixa: [],
        porAtendente: [],
      },
      positivasVsDemais: {
        positivasEsperaMin: null,
        demaisEsperaMin: 2,
      },
    } as unknown as Analise;
    const d = calcularDesempenho(a, AGORA, 3);
    expect(d.porDia.map((x) => x.dia)).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
    expect(d.porDia.map((x) => x.conversas)).toEqual([0, 2, 1]);
    expect(d.porDia[1].semResposta).toBe(1);
    expect(d.faixasEspera.reduce((s, f) => s + f.conversas, 0)).toBe(3);
  });
});
