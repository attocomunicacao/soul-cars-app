/**
 * Cliente somente-leitura da Graph API do Meta (Facebook) para o painel Meta Ads e o Funil,
 * vindo do Soul APP. A API é gratuita; o token (permissão `ads_read`) é do próprio usuário.
 * Nada é alterado nas campanhas. Sem Electron: o `fetch` é injetado para os testes.
 */
import type { DiaCampanha, Intervalo, MetaFunil } from "../../shared/funnel";
import {
  acharAcao,
  escolherResultado,
  periodos,
  receitaDe,
  somar,
  type AcaoGraph,
  type ConfigMeta,
  type DadosMeta,
  type DiaMeta,
  type LinhaCampanha,
} from "../../shared/meta-ads";
import type { Buscar } from "../crm/utalk-api";

/** Versão padrão da Graph API. */
export const VERSAO_GRAPH = "v25.0";

/** Credenciais de leitura do Meta. */
export type CredMeta = { token: string; conta: string; versao: string };

/** "123" → "act_123". */
export const normalizarConta = (v: string) => {
  const id = String(v || "").trim();
  return !id || id.startsWith("act_") ? id : `act_${id}`;
};

/**
 * Erro da Graph API em português. O 200/5258005 ("API access blocked") é um bloqueio da
 * própria Meta sobre o app ou o token, não do Soul Cars: explica onde resolver.
 */
export function mensagemDoMeta(e: {
  code?: number;
  error_subcode?: number;
  message?: string;
}) {
  if (e.code === 190)
    return "Token do Meta inválido ou expirado. Atualize em Configurações › Conexões.";
  if (
    e.code === 200 &&
    (e.error_subcode === 5258005 || /access blocked/i.test(e.message ?? ""))
  )
    return "A Meta bloqueou o acesso à API para este token (API access blocked). Confira o app em developers.facebook.com (status e alertas) ou gere um token novo de Usuário do Sistema no Gerenciador de Negócios e cole em Configurações › Conexões.";
  if (e.code === 4 || e.code === 17 || e.code === 613)
    return "A Meta limitou as consultas por alguns minutos. Tente de novo daqui a pouco.";
  return `Meta: ${e.message ?? "erro da API"}`;
}

/** GET paginado (segue `paging.next`). Token inválido vira mensagem clara. */
export async function graphGet<T = Record<string, unknown>>(
  buscar: Buscar,
  url: string,
  token: string,
  maxPaginas = 60,
): Promise<T[]> {
  const out: T[] = [];
  let proxima: string | undefined = url;
  for (let i = 0; proxima && i < maxPaginas; i++) {
    let res: Response;
    try {
      res = await buscar(proxima, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(45_000),
      });
    } catch (e) {
      throw new Error(`Sem conexão com o Meta (${(e as Error).message})`, {
        cause: e,
      });
    }
    const json = (await res.json().catch(() => ({}))) as {
      data?: T[];
      paging?: { next?: string };
      error?: { code?: number; error_subcode?: number; message?: string };
    };
    if (json.error) {
      throw new Error(mensagemDoMeta(json.error));
    }
    out.push(...(json.data ?? []));
    proxima = json.paging?.next;
  }
  return out;
}

const num = (v: unknown) => Number(v || 0);
const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type InsightApi = {
  campaign_id: string;
  campaign_name?: string;
  objective?: string;
  date_start?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: AcaoGraph[];
  action_values?: AcaoGraph[];
  cost_per_action_type?: AcaoGraph[];
};

/** Dados do painel: campanhas ativas, período anterior, série diária, público e funil. */
export async function buscarPainel(
  buscar: Buscar,
  cred: CredMeta,
  cfg: ConfigMeta,
): Promise<DadosMeta> {
  if (!cred.token || !cred.conta)
    throw new Error("Configure o token e a conta de anúncios do Meta.");
  const base = `https://graph.facebook.com/${cred.versao}/${normalizarConta(cred.conta)}`;
  const p = periodos(cfg.datePreset);
  const rg = (x: Intervalo) => JSON.stringify(x);
  const ativo = JSON.stringify([
    { field: "campaign.effective_status", operator: "IN", value: ["ACTIVE"] },
  ]);
  const F =
    "impressions,reach,frequency,spend,ctr,cpc,clicks,actions,action_values,cost_per_action_type";
  const get = <T>(url: string) => graphGet<T>(buscar, url, cred.token);
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - (cfg.chartDays - 1));

  type CampApi = {
    id: string;
    name: string;
    objective: string;
    effective_status: string;
    daily_budget?: string;
    lifetime_budget?: string;
  };
  const [campanhas, insights, anteriores, diarios] = await Promise.all([
    get<CampApi>(
      `${base}/campaigns?${q({
        fields:
          "id,name,objective,effective_status,daily_budget,lifetime_budget",
        filtering: JSON.stringify([
          { field: "effective_status", operator: "IN", value: ["ACTIVE"] },
        ]),
        limit: "200",
      })}`,
    ),
    get<InsightApi>(
      `${base}/insights?${q({ level: "campaign", fields: `campaign_id,${F}`, time_range: rg(p.atual), limit: "500" })}`,
    ),
    get<InsightApi>(
      `${base}/insights?${q({ level: "campaign", fields: "campaign_id,impressions,reach,spend,clicks,actions,action_values", time_range: rg(p.anterior), limit: "500" })}`,
    ).catch(() => []),
    get<InsightApi>(
      `${base}/insights?${q({ level: "campaign", time_increment: "1", fields: "campaign_id,spend,impressions,clicks,actions,action_values", time_range: rg({ since: iso(desde), until: iso(hoje) }), limit: "500" })}`,
    ),
  ]);
  const porCamp = new Map(insights.map((i) => [i.campaign_id, i]));
  const camp = new Map(campanhas.map((c) => [c.id, c]));

  const rows: LinhaCampanha[] = campanhas.map((c) => {
    const i = porCamp.get(c.id) ?? ({} as InsightApi);
    const r = escolherResultado(c.objective, i.actions, i.cost_per_action_type);
    const spend = num(i.spend);
    const revenue = receitaDe(i.action_values);
    return {
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.effective_status,
      dailyBudget: c.daily_budget ? num(c.daily_budget) / 100 : null,
      lifetimeBudget: c.lifetime_budget ? num(c.lifetime_budget) / 100 : null,
      impressions: num(i.impressions),
      reach: num(i.reach),
      frequency: num(i.frequency),
      clicks: num(i.clicks),
      ctr: num(i.ctr),
      cpc: i.cpc != null ? num(i.cpc) : null,
      spend,
      revenue,
      roas: spend > 0 && revenue > 0 ? revenue / spend : null,
      resultType: r.type,
      results: r.results,
      costPerResult: r.costPerResult,
    };
  });
  const prevRows = anteriores
    .filter((x) => camp.has(x.campaign_id))
    .map((x) => ({
      spend: num(x.spend),
      impressions: num(x.impressions),
      reach: num(x.reach),
      clicks: num(x.clicks),
      results: escolherResultado(camp.get(x.campaign_id)!.objective, x.actions)
        .results,
      revenue: receitaDe(x.action_values),
    }));

  const gastoPorTipo: Record<string, number> = {};
  for (const r of rows)
    if (r.resultType)
      gastoPorTipo[r.resultType] = (gastoPorTipo[r.resultType] ?? 0) + r.spend;
  const mainType =
    Object.entries(gastoPorTipo).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "purchase";

  const porDia = new Map<string, DiaMeta>();
  for (const d of diarios) {
    const c = camp.get(d.campaign_id);
    if (!c || !d.date_start) continue;
    const e = porDia.get(d.date_start) ?? {
      date: d.date_start,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      results: 0,
      revenue: 0,
    };
    e.spend += num(d.spend);
    e.impressions += num(d.impressions);
    e.clicks += num(d.clicks);
    e.results += escolherResultado(c.objective, d.actions).results;
    e.revenue += receitaDe(d.action_values);
    porDia.set(d.date_start, e);
  }

  // Público, posicionamento e funil são opcionais: se falharem, o painel aparece sem eles.
  type QuebraApi = InsightApi & {
    age?: string;
    gender?: string;
    publisher_platform?: string;
    platform_position?: string;
  };
  const quebra = (b: string) =>
    get<QuebraApi>(
      `${base}/insights?${q({ breakdowns: b, fields: "spend,impressions,clicks,actions,action_values", time_range: rg(p.atual), filtering: ativo, limit: "500" })}`,
    );
  const [pub, pos, fun] = await Promise.allSettled([
    quebra("age,gender"),
    quebra("publisher_platform,platform_position"),
    get<InsightApi>(
      `${base}/insights?${q({ fields: "impressions,clicks,actions", time_range: rg(p.atual), filtering: ativo })}`,
    ),
  ]);
  const fatias = <K>(
    r: PromiseSettledResult<QuebraApi[]>,
    chave: (x: QuebraApi) => K,
  ) =>
    (r.status === "fulfilled" ? r.value : []).map((x) => ({
      key: chave(x),
      spend: num(x.spend),
      impressions: num(x.impressions),
      clicks: num(x.clicks),
      results: (acharAcao(x.actions, [mainType]) ?? { value: 0 }).value,
      revenue: receitaDe(x.action_values),
    }));
  const f =
    fun.status === "fulfilled"
      ? (fun.value[0] ?? ({} as InsightApi))
      : ({} as InsightApi);
  const etapa = (t: string) =>
    (acharAcao(f.actions, [t]) ?? { value: 0 }).value;
  const funnel = (
    [
      ["Impressões", num(f.impressions)],
      ["Cliques no link", etapa("link_click")],
      ["Visualizações da página", etapa("landing_page_view")],
      ["Viu o produto", etapa("view_content")],
      ["Adicionou ao carrinho", etapa("add_to_cart")],
      ["Iniciou checkout", etapa("initiate_checkout")],
      ["Compras", etapa("purchase")],
    ] as [string, number][]
  )
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return {
    rows,
    series: [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date)),
    demographics: fatias(pub, (x) => ({
      age: x.age ?? "",
      gender: x.gender ?? "unknown",
    })),
    placements: fatias(pos, (x) => ({
      platform: x.publisher_platform ?? "",
      position: x.platform_position ?? "",
    })),
    funnel,
    mainType,
    totals: somar(rows),
    prevTotals: somar(prevRows),
    period: {
      cur: [p.atual.since, p.atual.until],
      prev: [p.anterior.since, p.anterior.until],
    },
    updatedAt: new Date().toISOString(),
    accountId: normalizarConta(cred.conta),
  };
}

const CONVERSA = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];

/** Topo do funil por campanha e por dia: gasto, impressões, cliques e conversas iniciadas. */
export async function buscarMetaDoFunil(
  buscar: Buscar,
  cred: CredMeta,
  intervalo: Intervalo,
): Promise<MetaFunil> {
  if (!cred.conta)
    throw new Error(
      "Informe a conta de anúncios do Meta em Configurações › Conexões.",
    );
  if (!cred.token)
    throw new Error("Cadastre o token do Meta em Configurações › Conexões.");
  const conta = normalizarConta(cred.conta);
  const linhas = await graphGet<InsightApi>(
    buscar,
    `https://graph.facebook.com/${cred.versao}/${conta}/insights?${q({
      level: "campaign",
      time_increment: "1",
      time_range: JSON.stringify(intervalo),
      fields:
        "campaign_id,campaign_name,objective,spend,impressions,reach,clicks,inline_link_clicks,actions",
      limit: "500",
    })}`,
    cred.token,
  );
  const daily: DiaCampanha[] = linhas.map((r) => ({
    date: r.date_start ?? "",
    campaignId: r.campaign_id,
    spend: num(r.spend),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    linkClicks: num(r.inline_link_clicks),
    conversations: (acharAcao(r.actions, CONVERSA) ?? { value: 0 }).value,
  }));
  const campanhas = new Map<
    string,
    { id: string; name: string; objective?: string }
  >();
  for (const r of linhas)
    if (!campanhas.has(r.campaign_id))
      campanhas.set(r.campaign_id, {
        id: r.campaign_id,
        name: r.campaign_name ?? r.campaign_id,
        objective: r.objective,
      });
  return {
    accountId: conta,
    range: intervalo,
    campaigns: [...campanhas.values()],
    daily,
    fetchedAt: new Date().toISOString(),
  };
}

/** Validade, vencimento e permissões do token (`/debug_token`). Nunca lança. */
export async function infoDoToken(
  buscar: Buscar,
  token: string,
  versao: string,
) {
  try {
    const res = await buscar(
      `https://graph.facebook.com/${versao}/debug_token?${q({ input_token: token, access_token: token })}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const d = (((await res.json()) as { data?: Record<string, unknown> })
      .data ?? {}) as {
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
    };
    return {
      valido: d.is_valid !== false,
      venceEm: d.expires_at
        ? new Date(d.expires_at * 1000).toISOString()
        : null,
      permissoes: d.scopes ?? [],
    };
  } catch {
    return {
      valido: null as boolean | null,
      venceEm: null,
      permissoes: [] as string[],
    };
  }
}

/** Teste das Configurações: token válido e acesso à conta de anúncios. */
export async function testarConexao(buscar: Buscar, cred: CredMeta) {
  if (!cred.token) throw new Error("Cole o token do Meta (ou salve um antes).");
  const info = await infoDoToken(buscar, cred.token, cred.versao);
  if (info.valido === false)
    throw new Error("Token do Meta inválido ou expirado.");
  let conta: { nome: string; moeda: string } | null = null;
  if (cred.conta) {
    const res = await buscar(
      `https://graph.facebook.com/${cred.versao}/${normalizarConta(cred.conta)}?fields=name,account_status,currency`,
      {
        headers: { Authorization: `Bearer ${cred.token}` },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const j = (await res.json().catch(() => ({}))) as {
      name?: string;
      currency?: string;
      error?: { code?: number; error_subcode?: number; message?: string };
    };
    if (j.error)
      throw new Error(
        j.error.code === 200 || j.error.code === 190
          ? mensagemDoMeta(j.error)
          : `Token válido, mas sem acesso à conta ${normalizarConta(cred.conta)}: ${j.error.message}`,
      );
    conta = { nome: j.name ?? "", moeda: j.currency ?? "" };
  }
  const faltando =
    info.permissoes.length && !info.permissoes.includes("ads_read")
      ? ["ads_read"]
      : [];
  return { ...info, conta, faltando };
}
