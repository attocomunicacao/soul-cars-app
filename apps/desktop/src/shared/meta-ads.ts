/**
 * Regras puras do painel Meta Ads (vindo do Soul APP): períodos atual × anterior, qual ação
 * conta como "resultado" em cada objetivo, totais, nota de saúde da conta, situação de cada
 * campanha e os destaques. Sem Electron: usadas pelo main (Graph API) e pela interface.
 */

/** Períodos do painel (mesmos nomes da Graph API). */
export const PERIODOS_META = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["last_7d", "7 dias"],
  ["last_30d", "30 dias"],
  ["this_month", "Este mês"],
] as const;
export type PresetMeta = (typeof PERIODOS_META)[number][0];

/** Preferências do painel Meta Ads. */
export type ConfigMeta = {
  datePreset: PresetMeta;
  /** Alerta quando o custo por resultado passa disto (0 = sem alerta). */
  alertCpr: number;
  /** Alerta quando o gasto da campanha no período passa disto (0 = sem alerta). */
  alertSpend: number;
  /** Meta de ROAS (só vale com vendas rastreadas). */
  roasTarget: number;
  /** Dias dos gráficos diários. */
  chartDays: 7 | 14 | 30;
};

export const CONFIG_META_PADRAO: ConfigMeta = {
  datePreset: "last_7d",
  alertCpr: 0,
  alertSpend: 0,
  roasTarget: 3,
  chartDays: 14,
};

/** Ação da Graph API (`actions`, `action_values`, `cost_per_action_type`). */
export type AcaoGraph = { action_type: string; value: string | number };

const RESULTADO_POR_OBJETIVO: Record<string, string[]> = {
  OUTCOME_SALES: ["purchase", "omni_purchase"],
  OUTCOME_LEADS: [
    "lead",
    "onsite_conversion.lead_grouped",
    "onsite_conversion.messaging_conversation_started_7d",
  ],
  OUTCOME_ENGAGEMENT: [
    "onsite_conversion.messaging_conversation_started_7d",
    "post_engagement",
    "page_engagement",
  ],
  OUTCOME_TRAFFIC: ["link_click", "landing_page_view"],
  OUTCOME_AWARENESS: [],
  OUTCOME_APP_PROMOTION: ["mobile_app_install", "app_install"],
};
const RESERVA = [
  "purchase",
  "lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "link_click",
];
const COMPRA = ["purchase", "omni_purchase"];

const num = (v: unknown) => Number(v || 0);

/** Primeira ação da lista de tipos que aparece (na ordem de preferência). */
export function acharAcao(lista: AcaoGraph[] | undefined, tipos: string[]) {
  for (const t of tipos) {
    const a = (lista ?? []).find((x) => x.action_type === t);
    if (a) return { type: t, value: num(a.value) };
  }
  return null;
}

/** Resultado de uma campanha conforme o objetivo dela. */
export function escolherResultado(
  objetivo: string | undefined,
  acoes: AcaoGraph[] = [],
  custos: AcaoGraph[] = [],
) {
  const a = acharAcao(acoes, [
    ...(RESULTADO_POR_OBJETIVO[objetivo ?? ""] ?? []),
    ...RESERVA,
  ]);
  if (!a)
    return {
      type: null as string | null,
      results: 0,
      costPerResult: null as number | null,
    };
  const c = acharAcao(custos, [a.type]);
  return {
    type: a.type as string | null,
    results: a.value,
    costPerResult: c ? c.value : null,
  };
}

/** Receita de compras rastreadas. */
export const receitaDe = (valores?: AcaoGraph[]) =>
  (acharAcao(valores, COMPRA) ?? { value: 0 }).value;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mais = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Período atual e o anterior de mesmo tamanho (para comparar). */
export function periodos(preset: PresetMeta, agora = new Date()) {
  const t = new Date(agora);
  t.setHours(12, 0, 0, 0);
  let atual: [Date, Date];
  let antes: [Date, Date];
  switch (preset) {
    case "yesterday":
      atual = [mais(t, -1), mais(t, -1)];
      antes = [mais(t, -2), mais(t, -2)];
      break;
    case "last_7d":
      atual = [mais(t, -7), mais(t, -1)];
      antes = [mais(t, -14), mais(t, -8)];
      break;
    case "last_30d":
      atual = [mais(t, -30), mais(t, -1)];
      antes = [mais(t, -60), mais(t, -31)];
      break;
    case "this_month": {
      const primeiro = new Date(t.getFullYear(), t.getMonth(), 1, 12);
      const ultimoAnterior = new Date(t.getFullYear(), t.getMonth(), 0, 12);
      const inicioAnterior = new Date(t.getFullYear(), t.getMonth() - 1, 1, 12);
      const fimAnterior = mais(inicioAnterior, t.getDate() - 1);
      atual = [primeiro, t];
      antes = [
        inicioAnterior,
        fimAnterior > ultimoAnterior ? ultimoAnterior : fimAnterior,
      ];
      break;
    }
    default:
      atual = [t, t];
      antes = [mais(t, -1), mais(t, -1)];
  }
  return {
    atual: { since: iso(atual[0]), until: iso(atual[1]) },
    anterior: { since: iso(antes[0]), until: iso(antes[1]) },
  };
}

/** Campanha ativa com as métricas do período. */
export type LinhaCampanha = {
  id: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number | null;
  spend: number;
  revenue: number;
  roas: number | null;
  resultType: string | null;
  results: number;
  costPerResult: number | null;
};

export type Totais = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  revenue: number;
};

/** Dia da série diária (campanhas ativas somadas). */
export type DiaMeta = Totais & { date: string };

/** Fatia de público (idade × gênero) ou de posicionamento. */
export type Fatia<K> = {
  key: K;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
};

/** Tudo o que o painel Meta Ads mostra. */
export type DadosMeta = {
  rows: LinhaCampanha[];
  series: DiaMeta[];
  demographics: Fatia<{ age: string; gender: string }>[];
  placements: Fatia<{ platform: string; position: string }>[];
  funnel: { name: string; value: number }[];
  mainType: string;
  totals: Totais;
  prevTotals: Totais;
  period: { cur: [string, string]; prev: [string, string] };
  updatedAt: string;
  accountId: string;
};

/** Soma linhas (campanhas ou dias). */
export function somar(lista: Totais[]): Totais {
  return lista.reduce<Totais>(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      reach: a.reach + r.reach,
      clicks: a.clicks + r.clicks,
      results: a.results + r.results,
      revenue: a.revenue + r.revenue,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0, revenue: 0 },
  );
}

/** Métricas derivadas dos totais. */
export function metricas(t: Totais) {
  return {
    ...t,
    roas: t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : null,
    cpr: t.results > 0 ? t.spend / t.results : null,
    ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null,
    cpc: t.clicks > 0 ? t.spend / t.clicks : null,
    freq: t.reach > 0 ? t.impressions / t.reach : null,
  };
}
export type Metricas = ReturnType<typeof metricas>;

/** Variação relativa (null quando não dá para comparar). */
export const variacao = (atual: number | null, antes: number | null) =>
  atual == null || antes == null || antes === 0
    ? null
    : (atual - antes) / antes;

/** Nome do resultado principal ("Conversas", "Leads"…). */
export function rotuloResultado(tipo: string | null | undefined) {
  if (!tipo) return "Resultados";
  if (/messaging|conversation/.test(tipo)) return "Conversas";
  if (/purchase/.test(tipo)) return "Compras";
  if (/lead/.test(tipo)) return "Leads";
  if (/link_click|landing/.test(tipo)) return "Cliques";
  if (/install/.test(tipo)) return "Instalações";
  return "Resultados";
}

/** Situação de uma campanha. */
export type Situacao = {
  rotulo: string;
  tom: "bom" | "atencao" | "ruim" | "neutro";
  ordem: number;
};

/** Situação pela meta de ROAS (com vendas) ou pelo custo por resultado médio. */
export function situacaoDaCampanha(
  r: Pick<LinhaCampanha, "spend" | "roas" | "results" | "costPerResult">,
  cprMedio: number,
  metaRoas: number,
  temReceita: boolean,
): Situacao {
  if (r.spend <= 0) return { rotulo: "Sem gasto", tom: "neutro", ordem: 0 };
  if (temReceita) {
    if (r.roas == null) return { rotulo: "Sem retorno", tom: "ruim", ordem: 1 };
    if (r.roas >= metaRoas * 1.2)
      return { rotulo: "Escalar", tom: "bom", ordem: 4 };
    if (r.roas >= metaRoas) return { rotulo: "Saudável", tom: "bom", ordem: 3 };
    if (r.roas >= 1) return { rotulo: "Atenção", tom: "atencao", ordem: 2 };
    return { rotulo: "Otimizar", tom: "ruim", ordem: 1 };
  }
  if (!r.results) return { rotulo: "Sem resultado", tom: "ruim", ordem: 1 };
  if (!cprMedio || r.costPerResult == null)
    return { rotulo: "Ativa", tom: "neutro", ordem: 2 };
  if (r.costPerResult <= cprMedio * 0.8)
    return { rotulo: "Eficiente", tom: "bom", ordem: 4 };
  if (r.costPerResult <= cprMedio * 1.2)
    return { rotulo: "Na média", tom: "neutro", ordem: 3 };
  return { rotulo: "Caro", tom: "atencao", ordem: 2 };
}

const limitar = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));

/** Nota de 0 a 100: ROAS (ou neutro), tendência do custo por resultado, CTR e frequência. */
export function notaDeSaude(
  atual: Metricas,
  antes: Metricas,
  metaRoas: number,
  temReceita: boolean,
) {
  let pts =
    temReceita && atual.roas != null
      ? (limitar(atual.roas / metaRoas, 0, 1.5) / 1.5) * 50
      : 25;
  const dc = variacao(atual.cpr, antes.cpr);
  pts += dc == null ? 20 : 20 + limitar(-dc, -0.5, 0.5) * 40;
  pts +=
    atual.ctr == null
      ? 4
      : atual.ctr >= 1.5
        ? 10
        : atual.ctr >= 1
          ? 7
          : atual.ctr >= 0.7
            ? 4
            : 1;
  if (atual.freq && atual.freq > 2.5)
    pts -= limitar((atual.freq - 2.5) * 5, 0, 10);
  return Math.round(limitar(pts, 0, 100));
}

/** Rótulo e tom da nota de saúde. */
export const faixaDeSaude = (
  n: number,
): [string, "bom" | "atencao" | "ruim"] =>
  n >= 75
    ? ["Excelente", "bom"]
    : n >= 55
      ? ["Boa", "bom"]
      : n >= 35
        ? ["Atenção", "atencao"]
        : ["Crítica", "ruim"];

/** Campanhas que passaram dos limites de alerta, com os motivos. */
export function alertas(rows: LinhaCampanha[], cfg: ConfigMeta) {
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const saida: Record<string, string[]> = {};
  for (const r of rows) {
    const motivos: string[] = [];
    if (
      cfg.alertCpr > 0 &&
      r.costPerResult != null &&
      r.costPerResult > cfg.alertCpr
    )
      motivos.push(
        `Custo por resultado ${brl(r.costPerResult)} (limite ${brl(cfg.alertCpr)})`,
      );
    if (cfg.alertSpend > 0 && r.spend > cfg.alertSpend)
      motivos.push(`Gasto ${brl(r.spend)} (limite ${brl(cfg.alertSpend)})`);
    if (motivos.length) saida[r.id] = motivos;
  }
  return saida;
}

const GENERO: Record<string, string> = {
  male: "Masculino",
  female: "Feminino",
  unknown: "Não informado",
};
/** Nome do gênero da Graph API em português. */
export const nomeGenero = (g: string) => GENERO[g] ?? g;

/** Destaques do painel (texto com trechos em negrito entre **). */
export function destaquesMeta(d: DadosMeta, metaRoas: number) {
  const atual = metricas(d.totals);
  const antes = metricas(d.prevTotals);
  const temReceita = d.totals.revenue > 0;
  const comCpr = d.rows.filter((r) => r.costPerResult != null && r.results > 0);
  const cprMedio = comCpr.length
    ? comCpr.reduce((a, r) => a + (r.costPerResult ?? 0), 0) / comCpr.length
    : 0;
  const rotulo = rotuloResultado(d.mainType).toLowerCase().replace(/s$/, "");
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const x2 = (v: number) =>
    v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const p = (v: number) =>
    `${(Math.abs(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const out: { tom: "bom" | "atencao" | "ruim" | "info"; texto: string }[] = [];
  if (temReceita && atual.roas != null) {
    if (atual.roas >= metaRoas)
      out.push({
        tom: "bom",
        texto: `ROAS de **${x2(atual.roas)}x**, acima da meta de ${x2(metaRoas)}x.`,
      });
    else if (atual.roas >= 1)
      out.push({
        tom: "atencao",
        texto: `ROAS de **${x2(atual.roas)}x**: dá retorno, mas abaixo da meta de ${x2(metaRoas)}x.`,
      });
    else
      out.push({
        tom: "ruim",
        texto: `ROAS de **${x2(atual.roas)}x**: as vendas rendem menos do que o investido.`,
      });
  }
  const dCpr = variacao(atual.cpr, antes.cpr);
  if (dCpr != null && Math.abs(dCpr) >= 0.05)
    out.push({
      tom: dCpr < 0 ? "bom" : "ruim",
      texto: `Custo por ${rotulo} ${dCpr < 0 ? "caiu" : "subiu"} **${p(dCpr)}** em relação ao período anterior.`,
    });
  const comGasto = d.rows.filter((r) => r.spend > 0);
  if (comGasto.length > 1) {
    const chave = temReceita
      ? (r: LinhaCampanha) => r.roas ?? -1
      : (r: LinhaCampanha) =>
          r.costPerResult != null ? -r.costPerResult : -1e9;
    const ord = [...comGasto].sort((a, b) => chave(b) - chave(a));
    const melhor = ord[0];
    out.push({
      tom: "bom",
      texto: `Melhor campanha: **${melhor.name}**${temReceita && melhor.roas ? ` (ROAS ${x2(melhor.roas)}x)` : melhor.costPerResult != null ? `, a ${brl(melhor.costPerResult)} por resultado` : ""}.`,
    });
    const pior = ord[ord.length - 1];
    if (
      pior.id !== melhor.id &&
      (temReceita
        ? (pior.roas ?? 0) < metaRoas
        : pior.costPerResult == null ||
          (cprMedio && pior.costPerResult > cprMedio * 1.2))
    )
      out.push({
        tom: "ruim",
        texto: `Pior campanha: **${pior.name}**${pior.results ? `: ${pior.results.toLocaleString("pt-BR")} resultados com ${brl(pior.spend)}` : " (sem resultados)"}. Revise criativo, público ou pause.`,
      });
  }
  const cansadas = d.rows.filter((r) => r.frequency > 2.5 && r.spend > 0);
  if (cansadas.length)
    out.push({
      tom: "atencao",
      texto: `Possível fadiga (frequência acima de 2,5): ${cansadas
        .slice(0, 2)
        .map((r) => `**${r.name}**`)
        .join(", ")}.`,
    });
  const publico = d.demographics
    .filter((x) => x.results > 0 && x.spend > 0)
    .sort((a, b) => a.spend / a.results - b.spend / b.results)[0];
  if (publico)
    out.push({
      tom: "info",
      texto: `Público mais eficiente: **${nomeGenero(publico.key.gender)}, ${publico.key.age}** (${brl(publico.spend / publico.results)} por resultado).`,
    });
  return { destaques: out.slice(0, 5), cprMedio, temReceita, atual, antes };
}
