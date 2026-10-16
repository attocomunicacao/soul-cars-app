/**
 * Cliente somente-leitura da API do uTalk (Umbler), sem Electron para poder ser testado.
 * Conta os leads (contatos) de cada etiqueta. Nada é alterado no CRM.
 */

export const BASE_UTALK = "https://app-utalk.umbler.com/api";

export type Buscar = (url: string, init: RequestInit) => Promise<Response>;

export type ContagemEtiqueta = {
  id: string;
  nome: string;
  emoji: string | null;
  leads: number;
};

export type Temperatura = "quente" | "morno" | "frio";

export type LeadResumo = {
  id: string;
  nome: string;
  desde: string | null;
  etiquetas: string[];
};

export type VisaoGeral = {
  organizacao: string;
  atualizadoEm: string;
  totalLeads: number;
  conversasNovas7d: number;
  conversasAbertas: number;
  aguardando: number;
  /** Leads por etiqueta de temperatura; `null` quando a etiqueta não existe no uTalk. */
  temperatura: Record<Temperatura, number | null>;
  listaAguardando: LeadResumo[];
  listaQuentes: LeadResumo[];
};

export type MetricasUtalk = {
  organizacao: string;
  totalLeads: number;
  etiquetas: ContagemEtiqueta[];
  atualizadoEm: string;
};

export type Pagina<T> = { items?: T[]; page?: { totalItems?: number } };
type Etiqueta = { id: string; name?: string; emoji?: string | null };

const TOMADA = 100;
const SIMULTANEAS = 4;

export class ErroUtalk extends Error {}

export async function pedir<T>(
  buscar: Buscar,
  token: string,
  caminho: string,
  consulta: Record<string, string | string[]> = {},
): Promise<T> {
  const url = new URL(BASE_UTALK + caminho);
  for (const [k, v] of Object.entries(consulta))
    for (const item of Array.isArray(v) ? v : [v])
      url.searchParams.append(k, item);
  let r: Response;
  try {
    r = await buscar(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ErroUtalk(
      "Não consegui falar com o uTalk. Confira a internet e tente de novo.",
    );
  }
  if (r.status === 401 || r.status === 403)
    throw new ErroUtalk(
      "O uTalk recusou o token. Gere outro em account.umbler.com/profile e cadastre de novo.",
    );
  if (r.status === 429)
    throw new ErroUtalk("O uTalk pediu para esperar. Tente em um minuto.");
  if (!r.ok) throw new ErroUtalk(`O uTalk respondeu com erro ${r.status}.`);
  return (await r.json()) as T;
}

/** Roda `fn` sobre os itens, com no máximo `limite` chamadas ao mesmo tempo. */
export async function emLotes<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) },
    async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        saida[i] = await fn(itens[i]);
      }
    },
  );
  await Promise.all(trabalhadores);
  return saida;
}

/** Organização do token: a primeira ativa de `GET /v1/members/me/`. */
export async function descobrirOrganizacao(buscar: Buscar, token: string) {
  const eu = await pedir<{
    organizations?: { id: string; name?: string; active?: boolean }[];
  }>(buscar, token, "/v1/members/me/");
  const orgs = eu.organizations ?? [];
  const org = orgs.find((o) => o.active !== false) ?? orgs[0];
  if (!org) throw new ErroUtalk("Este token não tem nenhuma organização.");
  return { id: org.id, nome: org.name ?? "" };
}

export async function listarEtiquetas(
  buscar: Buscar,
  token: string,
  organizationId: string,
) {
  const todas: Etiqueta[] = [];
  for (let skip = 0; skip < 5000; skip += TOMADA) {
    const p = await pedir<Pagina<Etiqueta>>(buscar, token, "/v1/tags/", {
      organizationId,
      Skip: String(skip),
      Take: String(TOMADA),
    });
    const itens = p.items ?? [];
    todas.push(...itens);
    if (itens.length < TOMADA) break;
  }
  return todas;
}

async function contarContatos(
  buscar: Buscar,
  token: string,
  organizationId: string,
  etiquetaId?: string,
) {
  const consulta: Record<string, string | string[]> = {
    organizationId,
    Behavior: "CountOnly",
    Take: "1",
    State: "Active",
  };
  if (etiquetaId) {
    consulta["Tags.Rule"] = "ContainsAny";
    consulta["Tags.Values"] = [etiquetaId];
  }
  const p = await pedir<Pagina<unknown>>(
    buscar,
    token,
    "/v1/contacts/",
    consulta,
  );
  return p.page?.totalItems ?? 0;
}

/** Leads por etiqueta (maior primeiro) e o total de contatos ativos. */
export async function metricas(
  buscar: Buscar,
  token: string,
): Promise<MetricasUtalk> {
  const org = await descobrirOrganizacao(buscar, token);
  const [etiquetas, totalLeads] = await Promise.all([
    listarEtiquetas(buscar, token, org.id),
    contarContatos(buscar, token, org.id),
  ]);
  const contadas = await emLotes(etiquetas, SIMULTANEAS, async (e) => ({
    id: e.id,
    nome: (e.name ?? "").trim() || "(sem nome)",
    emoji: e.emoji ?? null,
    leads: await contarContatos(buscar, token, org.id, e.id),
  }));
  contadas.sort(
    (a, b) => b.leads - a.leads || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return {
    organizacao: org.nome,
    totalLeads,
    etiquetas: contadas,
    atualizadoEm: new Date().toISOString(),
  };
}

const TEMPERATURAS: Temperatura[] = ["quente", "morno", "frio"];

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Reconhece etiquetas como "QUENTE", "Lead quente" ou "🔥 Quente". */
export function temperaturaDaEtiqueta(nome: string): Temperatura | null {
  const n = semAcento(nome);
  return TEMPERATURAS.find((t) => new RegExp(`\\b${t}\\b`).test(n)) ?? null;
}

type ContatoItem = {
  id: string;
  name?: string | null;
  lastActiveUTC?: string | null;
  tags?: { name?: string }[];
};
type ConversaItem = {
  id: string;
  waitingSinceUTC?: string | null;
  eventAtUTC?: string | null;
  contact?: ContatoItem;
  tags?: { name?: string }[];
};

const nomesDasEtiquetas = (tags?: { name?: string }[]) =>
  (tags ?? []).map((e) => (e.name ?? "").trim()).filter(Boolean);

/** Visão geral do CRM: cartões, quem espera resposta e os leads quentes. */
export async function visaoGeral(
  buscar: Buscar,
  token: string,
  agora = new Date(),
): Promise<VisaoGeral> {
  const org = await descobrirOrganizacao(buscar, token);
  const etiquetas = await listarEtiquetas(buscar, token, org.id);
  const idTemperatura: Partial<Record<Temperatura, string>> = {};
  for (const e of etiquetas) {
    const t = temperaturaDaEtiqueta(e.name ?? "");
    if (t && !idTemperatura[t]) idTemperatura[t] = e.id;
  }

  const sete = new Date(agora.getTime() - 7 * 86_400_000).toISOString();
  const conversas = (extra: Record<string, string | string[]>) =>
    pedir<Pagina<ConversaItem>>(buscar, token, "/v1/chats/", {
      organizationId: org.id,
      ContactTypes: ["DirectMessage"],
      ...extra,
    });
  const contatos = (extra: Record<string, string | string[]>) =>
    pedir<Pagina<ContatoItem>>(buscar, token, "/v1/contacts/", {
      organizationId: org.id,
      State: "Active",
      ...extra,
    });
  const total = (p: Pagina<unknown>) => p.page?.totalItems ?? 0;

  const [totalLeads, novas, abertas, espera, listaEspera] = await Promise.all([
    contarContatos(buscar, token, org.id),
    conversas({
      ChatState: "All",
      DateStartCreatedAtUTC: sete,
      Behavior: "CountOnly",
      Take: "1",
    }),
    conversas({ ChatState: "Open", Behavior: "CountOnly", Take: "1" }),
    conversas({
      ChatState: "Open",
      LastMessage: "Contact",
      Behavior: "CountOnly",
      Take: "1",
    }),
    conversas({
      ChatState: "Open",
      LastMessage: "Contact",
      ChatOrderBy: "LastMessage",
      Order: "Asc",
      Take: "30",
    }),
  ]);

  const temperatura: Record<Temperatura, number | null> = {
    quente: null,
    morno: null,
    frio: null,
  };
  for (const t of TEMPERATURAS) {
    const id = idTemperatura[t];
    if (id) temperatura[t] = await contarContatos(buscar, token, org.id, id);
  }

  let listaQuentes: LeadResumo[] = [];
  if (idTemperatura.quente) {
    const q = await contatos({
      "Tags.Rule": "ContainsAny",
      "Tags.Values": [idTemperatura.quente],
      OrderBy: "LastActiveUTC",
      Order: "Desc",
      Take: "20",
    });
    listaQuentes = (q.items ?? []).map((c) => ({
      id: c.id,
      nome: (c.name ?? "").trim() || "(sem nome)",
      desde: c.lastActiveUTC ?? null,
      etiquetas: nomesDasEtiquetas(c.tags),
    }));
  }

  return {
    organizacao: org.nome,
    atualizadoEm: agora.toISOString(),
    totalLeads,
    conversasNovas7d: total(novas),
    conversasAbertas: total(abertas),
    aguardando: total(espera),
    temperatura,
    listaAguardando: (listaEspera.items ?? []).map((c) => ({
      id: c.id,
      nome: (c.contact?.name ?? "").trim() || "(sem nome)",
      desde: c.waitingSinceUTC ?? c.eventAtUTC ?? null,
      etiquetas: nomesDasEtiquetas(c.tags ?? c.contact?.tags),
    })),
    listaQuentes,
  };
}
