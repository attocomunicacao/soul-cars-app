/**
 * Cliente somente-leitura da API do uTalk (Umbler), sem Electron para poder ser testado.
 * Conta os leads (contatos) de cada etiqueta. Nada é alterado no CRM.
 */

import { classificarEtiqueta } from "../compartilhado/crm-etiquetas";

export const BASE_UTALK = "https://app-utalk.umbler.com/api";

export type Buscar = (url: string, init: RequestInit) => Promise<Response>;

export type ContagemEtiqueta = {
  id: string;
  nome: string;
  emoji: string | null;
  leads: number;
};

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
  /** Leads sem FINALIZADO nem DESQUALIFICADO; `null` se essas etiquetas não existem. */
  emAtendimento: number | null;
  conversasNovas7d: number;
  conversasAbertas: number;
  aguardando: number;
  /** Todas as etiquetas com o total de leads (a interface classifica e agrupa). */
  etiquetas: ContagemEtiqueta[];
  listaAguardando: LeadResumo[];
  listaQuentes: LeadResumo[];
};

export type Pagina<T> = { items?: T[]; page?: { totalItems?: number } };
type Etiqueta = { id: string; name?: string; emoji?: string | null };

const TOMADA = 100;
const SIMULTANEAS = 4;
const ESPERA_TENTATIVA_MS = 800;

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
  const TENTATIVAS = 3;
  let r: Response | undefined;
  let falha: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      r = await buscar(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });
      // Erro do servidor costuma passar sozinho; as demais respostas seguem para a checagem abaixo.
      if (r.status < 500 || tentativa === TENTATIVAS) break;
    } catch (e) {
      falha = e;
      r = undefined;
    }
    if (tentativa < TENTATIVAS)
      await new Promise((ok) =>
        setTimeout(ok, ESPERA_TENTATIVA_MS * tentativa),
      );
  }
  if (!r) {
    const nome = falha instanceof Error ? falha.name : "";
    throw new ErroUtalk(
      nome === "TimeoutError" || nome === "AbortError"
        ? "O uTalk demorou demais para responder. Tente de novo em instantes."
        : "Não consegui falar com o uTalk (tentei 3 vezes). Confira a internet, o firewall ou a VPN e tente de novo.",
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
    State: "All",
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

/** Visão geral do CRM: totais, leads por etiqueta, quem espera resposta e os leads quentes. */
export async function visaoGeral(
  buscar: Buscar,
  token: string,
  agora = new Date(),
): Promise<VisaoGeral> {
  const org = await descobrirOrganizacao(buscar, token);
  const todas = await listarEtiquetas(buscar, token, org.id);

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
      State: "All",
      ...extra,
    });
  const total = (p: Pagina<unknown>) => p.page?.totalItems ?? 0;

  const encerradas = todas
    .filter(
      (e) => classificarEtiqueta(e.name ?? "", e.emoji).tipo === "encerrado",
    )
    .map((e) => e.id);
  const idQuente = todas.find((e) => {
    const c = classificarEtiqueta(e.name ?? "", e.emoji);
    return c.tipo === "temperatura" && c.chave === "quente";
  })?.id;

  const [totalLeads, ativos, novas, abertas, espera, listaEspera, contadas] =
    await Promise.all([
      contarContatos(buscar, token, org.id),
      encerradas.length
        ? contatos({
            "Tags.Rule": "None",
            "Tags.Values": encerradas,
            Behavior: "CountOnly",
            Take: "1",
          })
        : Promise.resolve(null),
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
      emLotes(todas, SIMULTANEAS, async (e) => ({
        id: e.id,
        nome: (e.name ?? "").trim() || "(sem nome)",
        emoji: e.emoji ?? null,
        leads: await contarContatos(buscar, token, org.id, e.id),
      })),
    ]);
  contadas.sort(
    (a, b) => b.leads - a.leads || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  let listaQuentes: LeadResumo[] = [];
  if (idQuente) {
    const q = await contatos({
      "Tags.Rule": "ContainsAny",
      "Tags.Values": [idQuente],
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
    emAtendimento: ativos === null ? null : total(ativos),
    conversasNovas7d: total(novas),
    conversasAbertas: total(abertas),
    aguardando: total(espera),
    etiquetas: contadas,
    listaAguardando: (listaEspera.items ?? []).map((c) => ({
      id: c.id,
      nome: (c.contact?.name ?? "").trim() || "(sem nome)",
      desde: c.waitingSinceUTC ?? c.eventAtUTC ?? null,
      etiquetas: nomesDasEtiquetas(c.tags ?? c.contact?.tags),
    })),
    listaQuentes,
  };
}
