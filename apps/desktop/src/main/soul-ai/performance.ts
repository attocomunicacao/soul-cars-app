/**
 * Números do painel de desempenho: tirados da análise da memória da Soul IA (nada vai para fora).
 * Funções puras, para testar sem banco.
 */
import type { Analise } from "./analysis";

const UTC_MENOS_3 = 3 * 3_600_000; // Brasil (sem horário de verão desde 2019)

export type Desempenho = {
  geradoEm: string;
  conversas: number;
  conversasComLead: number;
  semRespostaPct: number;
  medianaEsperaMin: number | null;
  ate5minPct: number;
  ate1hPct: number;
  /** Conversas iniciadas por dia nos últimos `dias` dias (zeradas quando não houve). */
  porDia: { dia: string; conversas: number; semResposta: number }[];
  /** Quanto o lead esperou pela 1ª resposta humana; a soma é igual a conversasComLead. */
  faixasEspera: { rotulo: string; conversas: number }[];
  porFaixaDoDia: {
    faixa: string;
    conversas: number;
    medianaMin: number | null;
  }[];
  porAtendente: {
    atendente: string;
    conversas: number;
    medianaMin: number | null;
  }[];
  /** Conversas iniciadas por dia da semana (0 = domingo) e hora (0 a 23), no horário do Brasil. */
  mapaHorario: number[][];
  anuncios: { nome: string; conversas: number }[];
  positivas: number;
  positivasEsperaMin: number | null;
  demaisEsperaMin: number | null;
};

const diaLocal = (iso: string) =>
  new Date(new Date(iso).getTime() - UTC_MENOS_3).toISOString().slice(0, 10);

export function faixaDeEspera(min: number | null): string {
  if (min === null) return "Sem resposta";
  if (min <= 5) return "Até 5 min";
  if (min <= 30) return "5 a 30 min";
  if (min <= 60) return "30 min a 1 h";
  if (min <= 240) return "1 a 4 h";
  return "Mais de 4 h";
}

const ORDEM_FAIXAS = [
  "Até 5 min",
  "5 a 30 min",
  "30 min a 1 h",
  "1 a 4 h",
  "Mais de 4 h",
  "Sem resposta",
];

export function calcularDesempenho(
  a: Analise,
  agora = new Date(),
  dias = 30,
): Desempenho {
  const comLead = a.metricas.filter((m) => m.msgsLead > 0);

  const contagemDia = new Map<string, { c: number; s: number }>();
  for (const m of a.metricas) {
    if (!m.criadaEm || m.msgsLead === 0) continue;
    const d = diaLocal(m.criadaEm);
    const atual = contagemDia.get(d) ?? { c: 0, s: 0 };
    atual.c += 1;
    if (m.semResposta) atual.s += 1;
    contagemDia.set(d, atual);
  }
  const porDia: Desempenho["porDia"] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = diaLocal(
      new Date(agora.getTime() - i * 86_400_000).toISOString(),
    );
    const v = contagemDia.get(d);
    porDia.push({ dia: d, conversas: v?.c ?? 0, semResposta: v?.s ?? 0 });
  }

  const faixas = new Map<string, number>(ORDEM_FAIXAS.map((f) => [f, 0]));
  for (const m of comLead) {
    const f = faixaDeEspera(m.semResposta ? null : m.esperaMin);
    faixas.set(f, (faixas.get(f) ?? 0) + 1);
  }

  const mapaHorario = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const m of comLead) {
    if (!m.criadaEm) continue;
    const t = new Date(new Date(m.criadaEm).getTime() - UTC_MENOS_3);
    mapaHorario[t.getUTCDay()][t.getUTCHours()] += 1;
  }

  const anuncios = new Map<string, number>();
  for (const m of a.metricas)
    if (m.anuncio) anuncios.set(m.anuncio, (anuncios.get(m.anuncio) ?? 0) + 1);

  return {
    geradoEm: agora.toISOString(),
    conversas: a.conversas,
    conversasComLead: a.conversasComLead,
    semRespostaPct: a.semRespostaPct,
    medianaEsperaMin: a.espera.medianaMin,
    ate5minPct: a.espera.ate5minPct,
    ate1hPct: a.espera.ate1hPct,
    porDia,
    faixasEspera: ORDEM_FAIXAS.map((rotulo) => ({
      rotulo,
      conversas: faixas.get(rotulo) ?? 0,
    })),
    porFaixaDoDia: a.espera.porFaixa,
    porAtendente: [...a.espera.porAtendente]
      .sort((x, y) => y.conversas - x.conversas)
      .slice(0, 8),
    mapaHorario,
    anuncios: [...anuncios.entries()]
      .map(([nome, conversas]) => ({ nome, conversas }))
      .sort((x, y) => y.conversas - x.conversas)
      .slice(0, 8),
    positivas: a.positivas,
    positivasEsperaMin: a.positivasVsDemais.positivasEsperaMin,
    demaisEsperaMin: a.positivasVsDemais.demaisEsperaMin,
  };
}
