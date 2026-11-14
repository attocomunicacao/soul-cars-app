/**
 * Regras puras do Funil Meta Ads → CRM (vindo do Soul APP): período, papel das etiquetas
 * (call 1/2/3, quente, frio, agendado, desqualificado, produto), campanha → produto,
 * contagem de cada etapa e os destaques do diagnóstico. Sem Electron: testável.
 */
import {
  diaLocal,
  type EtiquetaCrm,
  type LeadCrm,
  type SnapshotCrm,
} from "./crm-leads";

/** Papéis que uma etiqueta pode ter no funil ("" = nenhum). */
export const PAPEIS = [
  "product",
  "call1",
  "call2",
  "call3",
  "quente",
  "frio",
  "agendado",
  "desqualificado",
] as const;
export type Papel = (typeof PAPEIS)[number] | "";

/** Rótulo de cada papel nas Configurações do funil. */
export const ROTULO_PAPEL: Record<Papel, string> = {
  "": "Sem papel",
  product: "Produto (carro)",
  call1: "Call 1",
  call2: "Call 2",
  call3: "Call 3",
  quente: "Quente",
  frio: "Frio",
  agendado: "Agendado",
  desqualificado: "Desqualificado",
};

/** Períodos prontos do funil. */
export const PERIODOS_FUNIL = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["last_7d", "7 dias"],
  ["last_14d", "14 dias"],
  ["last_30d", "30 dias"],
  ["last_90d", "90 dias"],
  ["this_month", "Este mês"],
  ["last_month", "Mês passado"],
  ["custom", "Personalizado"],
] as const;
export type PresetFunil = (typeof PERIODOS_FUNIL)[number][0];

export type PeriodoFunil = {
  preset: PresetFunil;
  since: string;
  until: string;
};
export type Intervalo = { since: string; until: string };

/** Preferências do funil. */
export type ConfigFunil = {
  period: PeriodoFunil;
  /** Cliques no link (padrão) ou todos os cliques. */
  clickMetric: "linkClicks" | "clicks";
  /** Call 3 também conta como call 2 e call 1. */
  cumulative: boolean;
  tagRoles: Record<string, Papel>;
  /** campanha → etiqueta de produto ("" = nenhum; ausente = automático pelo nome). */
  campaignProducts: Record<string, string>;
};

export const CONFIG_FUNIL_PADRAO: ConfigFunil = {
  period: { preset: "last_30d", since: "", until: "" },
  clickMetric: "linkClicks",
  cumulative: true,
  tagRoles: {},
  campaignProducts: {},
};

/** Linha diária de uma campanha (Graph API, nível campanha, por dia). */
export type DiaCampanha = {
  date: string;
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  conversations: number;
};

/** Dados do Meta usados pelo funil. */
export type MetaFunil = {
  accountId: string;
  range: Intervalo;
  campaigns: { id: string; name: string; objective?: string }[];
  daily: DiaCampanha[];
  fetchedAt: string;
};

const iso = diaLocal;
const somarDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Datas (AAAA-MM-DD) de um período do funil. */
export function resolverPeriodo(
  p: PeriodoFunil,
  agora = new Date(),
): Intervalo {
  const t = new Date(agora);
  t.setHours(12, 0, 0, 0);
  let a: Date;
  let b: Date = t;
  switch (p.preset) {
    case "today":
      a = t;
      break;
    case "yesterday":
      a = b = somarDias(t, -1);
      break;
    case "last_7d":
      a = somarDias(t, -6);
      break;
    case "last_14d":
      a = somarDias(t, -13);
      break;
    case "last_90d":
      a = somarDias(t, -89);
      break;
    case "this_month":
      a = new Date(t.getFullYear(), t.getMonth(), 1, 12);
      break;
    case "last_month":
      a = new Date(t.getFullYear(), t.getMonth() - 1, 1, 12);
      b = new Date(t.getFullYear(), t.getMonth(), 0, 12);
      break;
    case "custom":
      if (p.since && p.until && p.since <= p.until)
        return { since: p.since, until: p.until };
      a = somarDias(t, -29);
      break;
    default:
      a = somarDias(t, -29);
  }
  return { since: iso(a), until: iso(b) };
}

/** Texto sem acento, minúsculo. */
export const normalizar = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Sugere o papel de uma etiqueta pelo nome e pelos grupos dela. */
export function sugerirPapel(nome: string, grupos: string[]): Papel {
  const n = normalizar(nome);
  const call =
    n.match(/(?:call|ligacao|lig\.?|contato|tentativa)\s*#?0?([123])\b/) ||
    n.match(/\b0?([123])\s*[ªaº°o]?\s*(?:call|ligacao|contato|tentativa)/);
  if (call) return `call${call[1]}` as Papel;
  if (/desqualif|descart|perdid|nao qualif/.test(n)) return "desqualificado";
  if (/agend|visita marcada|reuniao marcada/.test(n)) return "agendado";
  if (/quente|hot/.test(n)) return "quente";
  if (/frio|cold/.test(n)) return "frio";
  if (
    grupos.some((g) =>
      /carro|veiculo|modelo|produto|campanha/.test(normalizar(g)),
    )
  )
    return "product";
  return "";
}

/**
 * Dá papel às etiquetas que ainda não têm. Etiquetas de carro do CRM viram produto.
 * Devolve os papéis novos e se algo mudou.
 */
export function completarPapeis(
  crm: Pick<SnapshotCrm, "tags" | "groups">,
  papeis: Record<string, Papel>,
  etiquetasDeCarro: Set<string>,
) {
  const saida = { ...papeis };
  let mudou = false;
  const grupo = new Map((crm.groups ?? []).map((g) => [g.id, g.name]));
  for (const t of crm.tags) {
    if (saida[t.id] !== undefined) continue;
    const s = sugerirPapel(
      t.name,
      (t.groupIds ?? []).map((g) => grupo.get(g) ?? ""),
    );
    saida[t.id] = s || (etiquetasDeCarro.has(t.id) ? "product" : "");
    mudou = true;
  }
  return { papeis: saida, mudou };
}

const chaveProduto = (nome: string) =>
  normalizar(nome)
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const palavras = (s: string) =>
  ` ${normalizar(s).replace(/[^a-z0-9]+/g, " ")} `;

/** Produto de uma campanha pelo nome (nome completo primeiro, depois o modelo sem ano). */
export function produtoPeloNome(
  nomeCampanha: string,
  produtos: Pick<EtiquetaCrm, "id" | "name">[],
): string | null {
  const n = palavras(nomeCampanha);
  const itens = produtos
    .map((p) => ({ p, cheio: normalizar(p.name), chave: chaveProduto(p.name) }))
    .filter((x) => x.chave);
  const porCheio = itens
    .filter((x) => n.includes(palavras(x.cheio)))
    .sort((a, b) => b.cheio.length - a.cheio.length)[0];
  if (porCheio) return porCheio.p.id;
  const porModelo = itens
    .filter((x) => n.includes(palavras(x.chave)))
    .sort((a, b) => b.chave.length - a.chave.length)[0];
  return porModelo ? porModelo.p.id : null;
}

/** Etapas de um lead no funil. */
export type EtapasLead = {
  call1: boolean;
  call2: boolean;
  call3: boolean;
  maxCall: number;
  quente: boolean;
  frio: boolean;
  agendado: boolean;
  desq: boolean;
  products: string[];
};

/** Lê as etapas do lead pelos papéis das etiquetas (acumulado: call 3 conta como 2 e 1). */
export function etapasDoLead(lead: LeadCrm, cfg: ConfigFunil): EtapasLead {
  const r = new Set(lead.tagIds.map((t) => cfg.tagRoles[t]).filter(Boolean));
  let maxCall = r.has("call3")
    ? 3
    : r.has("call2")
      ? 2
      : r.has("call1")
        ? 1
        : 0;
  const quente = r.has("quente");
  const frio = r.has("frio");
  const agendado = r.has("agendado");
  if (cfg.cumulative && maxCall === 0 && (quente || frio || agendado))
    maxCall = 1;
  const call = (n: number) =>
    cfg.cumulative ? maxCall >= n : r.has(`call${n}` as Papel);
  return {
    call1: call(1),
    call2: call(2),
    call3: call(3),
    maxCall,
    quente,
    frio,
    agendado,
    desq: r.has("desqualificado"),
    products: lead.tagIds.filter((t) => cfg.tagRoles[t] === "product"),
  };
}

/** Filtro de produto: "" = todos, "__none" = sem produto, ou o id da etiqueta. */
export const SEM_PRODUTO = "__none";

export type TotaisMeta = {
  spend: number;
  impressions: number;
  clicks: number;
  conversations: number;
  byDay: Record<string, number>;
};
export type TotaisCrm = {
  leads: number;
  call1: number;
  call2: number;
  call3: number;
  quente: number;
  frio: number;
  qualified: number;
  agendado: number;
  desq: number;
  noCall: number;
  byDay: Record<string, { leads: number; agendado: number }>;
  list: { lead: LeadCrm; info: EtapasLead; day: string }[];
};

/** Etiquetas de produto do CRM. */
export const etiquetasDeProduto = (crm: SnapshotCrm | null, cfg: ConfigFunil) =>
  (crm?.tags ?? []).filter((t) => cfg.tagRoles[t.id] === "product");

/** Produto de uma campanha: o escolhido nas regras ou o automático pelo nome. */
export function produtoDaCampanha(
  c: { id: string; name: string },
  produtos: EtiquetaCrm[],
  cfg: ConfigFunil,
): string | null {
  const escolhido = cfg.campaignProducts[c.id];
  return escolhido !== undefined
    ? escolhido || null
    : produtoPeloNome(c.name, produtos);
}

/** Soma o Meta e o CRM do período para um produto (ou todos). */
export function calcularFunil(
  meta: MetaFunil | null,
  crm: SnapshotCrm | null,
  cfg: ConfigFunil,
  intervalo: Intervalo,
  produto: string,
): { m: TotaisMeta; c: TotaisCrm } {
  const { since, until } = intervalo;
  const produtos = etiquetasDeProduto(crm, cfg);
  const prodCamp = new Map(
    (meta?.campaigns ?? []).map((c) => [
      c.id,
      produtoDaCampanha(c, produtos, cfg),
    ]),
  );
  const casa = (id: string) =>
    produto === ""
      ? true
      : produto === SEM_PRODUTO
        ? !prodCamp.get(id)
        : prodCamp.get(id) === produto;
  const m: TotaisMeta = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversations: 0,
    byDay: {},
  };
  for (const r of meta?.daily ?? []) {
    if (r.date < since || r.date > until || !casa(r.campaignId)) continue;
    m.spend += r.spend;
    m.impressions += r.impressions;
    m.clicks += cfg.clickMetric === "clicks" ? r.clicks : r.linkClicks;
    m.conversations += r.conversations;
    m.byDay[r.date] = (m.byDay[r.date] ?? 0) + r.conversations;
  }
  const c: TotaisCrm = {
    leads: 0,
    call1: 0,
    call2: 0,
    call3: 0,
    quente: 0,
    frio: 0,
    qualified: 0,
    agendado: 0,
    desq: 0,
    noCall: 0,
    byDay: {},
    list: [],
  };
  for (const l of crm?.leads ?? []) {
    const day = diaLocal(l.createdAt);
    if (day < since || day > until) continue;
    const li = etapasDoLead(l, cfg);
    if (
      produto === SEM_PRODUTO
        ? li.products.length
        : produto && !li.products.includes(produto)
    )
      continue;
    c.leads++;
    if (li.call1) c.call1++;
    else c.noCall++;
    if (li.call2) c.call2++;
    if (li.call3) c.call3++;
    if (li.quente) c.quente++;
    if (li.frio) c.frio++;
    if (li.quente || li.frio) c.qualified++;
    if (li.agendado) c.agendado++;
    if (li.desq) c.desq++;
    const d = (c.byDay[day] ??= { leads: 0, agendado: 0 });
    d.leads++;
    if (li.agendado) d.agendado++;
    c.list.push({ lead: l, info: li, day });
  }
  return { m, c };
}

/** Destaque do diagnóstico: tom (cor/ícone) e texto, com trechos em negrito entre **. */
export type Destaque = {
  tom: "bom" | "atencao" | "ruim" | "info";
  texto: string;
};

const pctTxt = (a: number, b: number) =>
  b > 0
    ? `${((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : "—";
const moedaTxt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Diagnóstico do funil: onde o lead se perde e quanto custou cada agendamento. */
export function diagnosticar(
  m: TotaisMeta,
  c: TotaisCrm,
  porProduto: { nome: string; spend: number; agendado: number }[] = [],
): Destaque[] {
  const out: Destaque[] = [];
  if (m.conversations > 0) {
    const r = c.leads / m.conversations;
    if (r < 0.7)
      out.push({
        tom: "atencao",
        texto: `Só **${pctTxt(c.leads, m.conversations)}** das conversas do Meta viraram contato no CRM. Confira se todo atendimento entra no uTalk.`,
      });
    else if (r > 1.3)
      out.push({
        tom: "info",
        texto: `O CRM recebeu **${pctTxt(c.leads, m.conversations)}** das conversas do Meta: parte dos leads vem de fora dos anúncios.`,
      });
    else
      out.push({
        tom: "bom",
        texto: `**${pctTxt(c.leads, m.conversations)}** das conversas do Meta aparecem no CRM.`,
      });
  }
  if (c.noCall > 0)
    out.push({
      tom: c.noCall / Math.max(c.leads, 1) > 0.3 ? "ruim" : "atencao",
      texto: `**${c.noCall.toLocaleString("pt-BR")} leads** ainda sem nenhuma call (${pctTxt(c.noCall, c.leads)}). É o primeiro lugar para agir.`,
    });
  const passos = (
    [
      ["Lead → call 1", c.call1, c.leads],
      ["Call 1 → call 2", c.call2, c.call1],
      ["Call 2 → call 3", c.call3, c.call2],
      ["Quente → agendado", c.agendado, c.quente],
    ] as [string, number, number][]
  ).filter(([, , b]) => b >= 5);
  const pior = [...passos].sort((a, b) => a[1] / a[2] - b[1] / b[2])[0];
  if (pior)
    out.push({
      tom: "ruim",
      texto: `Maior perda: **${pior[0]}** converte ${pctTxt(pior[1], pior[2])}.`,
    });
  if (c.quente + c.frio > 0)
    out.push({
      tom: c.quente >= c.frio ? "bom" : "atencao",
      texto: `**${pctTxt(c.quente, c.quente + c.frio)}** dos qualificados estão quentes (${c.quente} × ${c.frio} frios).`,
    });
  if (c.agendado > 0 && m.spend > 0)
    out.push({
      tom: "info",
      texto: `Cada agendamento custou **${moedaTxt(m.spend / c.agendado)}**: 1 a cada ${(m.conversations / c.agendado).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} conversas.`,
    });
  const eficientes = porProduto
    .filter((p) => p.agendado > 0 && p.spend > 0)
    .sort((a, b) => a.spend / a.agendado - b.spend / b.agendado);
  if (eficientes.length >= 2)
    out.push({
      tom: "bom",
      texto: `Produto mais eficiente: **${eficientes[0].nome}**, a ${moedaTxt(eficientes[0].spend / eficientes[0].agendado)} por agendamento.`,
    });
  return out;
}
