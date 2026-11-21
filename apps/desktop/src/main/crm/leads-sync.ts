/**
 * Monta a leitura dos leads do uTalk (módulo CRM · Leads, vindo do Soul APP).
 *
 * Na conta real: as etiquetas (carro e status) ficam nos CONTATOS; o SDR vem dos
 * ATENDIMENTOS (chats), pelos bots que ele aciona ("LIGAÇÃO ATENDIDA"…) ou pelo membro
 * do chat. Buscar todos os chats é lento, então eles ficam num cache em memória e, a cada
 * ciclo, só vêm os chats com mensagem nova; a cada 15 min o cache é refeito inteiro.
 */
import type { AcaoSdr, LeadCrm, SnapshotCrm } from "../../shared/crm-leads";
import type { ClienteUmbler } from "./umbler-client";

const REFAZER_CHATS_MS = 15 * 60_000;
const MARGEM_MS = 3 * 60_000;

type Ref = { id?: string; Id?: string } | null | undefined;
const idDe = (x: Ref) => (x ? x.id || x.Id || null : null);

type ChatApi = {
  id: string;
  contact?: Ref;
  createdAtUTC: string;
  eventAtUTC?: string;
  organizationMember?: Ref;
  lastOrganizationMember?: Ref;
  closedBy?: Ref;
  organizationMemberHistory?: { memberId?: string }[];
  bots?: {
    memberId?: string;
    botTitle?: string;
    triggerName?: string;
    createdAt?: string;
  }[];
  open?: boolean;
  waiting?: boolean;
  sector?: { name?: string } | null;
};

type ChatResumo = {
  id: string;
  contactId: string | null;
  eventAt: string;
  memberId: string | null;
  open: boolean;
  waiting: boolean;
  sector: string;
  actions: AcaoSdr[];
};

/** Resumo de um chat: ações dos SDRs e quem atende (a última ação vale mais que o histórico). */
export function resumirChat(ch: ChatApi): ChatResumo {
  const hist = ch.organizationMemberHistory ?? [];
  const actions = (ch.bots ?? [])
    .filter((b) => b.memberId)
    .map((b) => ({
      memberId: b.memberId!,
      title: b.botTitle ?? "",
      trigger: b.triggerName ?? "",
      at: b.createdAt ?? ch.eventAtUTC ?? ch.createdAtUTC,
    }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const ultima = actions[actions.length - 1];
  const memberId =
    idDe(ch.organizationMember) ||
    ultima?.memberId ||
    idDe(ch.lastOrganizationMember) ||
    (hist.length ? hist[hist.length - 1].memberId : null) ||
    idDe(ch.closedBy);
  return {
    id: ch.id,
    contactId: idDe(ch.contact),
    eventAt: ch.eventAtUTC || ch.createdAtUTC,
    memberId: memberId || null,
    open: !!ch.open,
    waiting: !!ch.waiting,
    sector: ch.sector?.name ?? "",
    actions,
  };
}

const cache = {
  chave: "",
  chats: new Map<string, ChatResumo>(),
  ultima: 0,
  ultimaCompleta: 0,
};

/** Esquece os chats guardados (troca de token, organização ou janela). */
export function limparCacheDeChats() {
  Object.assign(cache, {
    chave: "",
    chats: new Map(),
    ultima: 0,
    ultimaCompleta: 0,
  });
}

async function sincronizarChats(
  cli: ClienteUmbler,
  org: string,
  janelaDias: number,
) {
  const chave = `${org}|${janelaDias}`;
  if (cache.chave !== chave) {
    limparCacheDeChats();
    cache.chave = chave;
  }
  const agora = Date.now();
  const inicioJanela = janelaDias > 0 ? agora - janelaDias * 864e5 : 0;
  const completa =
    !cache.ultimaCompleta || agora - cache.ultimaCompleta > REFAZER_CHATS_MS;
  const ate = completa ? inicioJanela : cache.ultima - MARGEM_MS;
  const itens = await cli.todasAsPaginas<ChatApi>(
    "/v1/chats/",
    {
      organizationId: org,
      ChatState: "All",
      ContactTypes: ["DirectMessage"],
      ChatOrderBy: "LastMessage",
      Order: "Desc",
      IncludePinneds: false,
    },
    {
      parar: ate
        ? (ch) => Date.parse(ch.eventAtUTC || ch.createdAtUTC) < ate
        : undefined,
    },
  );
  if (completa) cache.chats = new Map();
  for (const ch of itens) cache.chats.set(ch.id, resumirChat(ch));
  if (inicioJanela)
    for (const [id, ch] of cache.chats)
      if (Date.parse(ch.eventAt) < inicioJanela) cache.chats.delete(id);
  cache.ultima = agora;
  if (completa) cache.ultimaCompleta = agora;
  return [...cache.chats.values()];
}

type ContatoApi = {
  id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  createdAtUTC: string;
  lastActiveUTC?: string;
  contactType?: string;
  tags?: { id?: string; Id?: string; name?: string }[];
  organizationMembers?: string[];
};
type EtiquetaApi = {
  id: string;
  name?: string;
  color?: string;
  emoji?: string;
  groupIds?: string[];
};
type OrgApi = {
  id: string;
  name: string;
  organizationMembers?: {
    id: string;
    displayName?: string;
    name?: string;
    active?: boolean;
  }[];
  groups?: { id: string; name: string }[];
};

/** Lê organização, etiquetas, contatos da janela e chats, e monta os leads. */
export async function lerLeads(
  cli: ClienteUmbler,
  org: string,
  janelaDias: number,
): Promise<SnapshotCrm> {
  const desde = janelaDias > 0 ? Date.now() - janelaDias * 864e5 : null;
  const [o, etiquetas, contatos, chats] = await Promise.all([
    cli.get<OrgApi>(`/v1/organizations/${encodeURIComponent(org)}/`),
    cli.todasAsPaginas<EtiquetaApi>("/v1/tags/", { organizationId: org }),
    cli.todasAsPaginas<ContatoApi>(
      "/v1/contacts/",
      { organizationId: org, OrderBy: "LastActiveUTC", Order: "Desc" },
      {
        parar: desde
          ? (c) => !!c.lastActiveUTC && Date.parse(c.lastActiveUTC) < desde
          : undefined,
      },
    ),
    sincronizarChats(cli, org, janelaDias),
  ]);
  return montarLeads(o, etiquetas, contatos, chats);
}

/** Junta contatos e chats: chat mais recente (aberto/espera) e o mais recente com SDR. */
export function montarLeads(
  o: OrgApi,
  etiquetas: EtiquetaApi[],
  contatos: ContatoApi[],
  chats: ChatResumo[],
): SnapshotCrm {
  const ultimo = new Map<string, ChatResumo>();
  const ultimoComSdr = new Map<string, ChatResumo>();
  const quantos = new Map<string, number>();
  const acoes = new Map<string, AcaoSdr[]>();
  for (const ch of chats) {
    if (!ch.contactId) continue;
    quantos.set(ch.contactId, (quantos.get(ch.contactId) ?? 0) + 1);
    if (ch.actions.length)
      acoes.set(ch.contactId, [
        ...(acoes.get(ch.contactId) ?? []),
        ...ch.actions,
      ]);
    const t = Date.parse(ch.eventAt);
    const a = ultimo.get(ch.contactId);
    if (!a || t > Date.parse(a.eventAt)) ultimo.set(ch.contactId, ch);
    if (ch.memberId) {
      const b = ultimoComSdr.get(ch.contactId);
      if (!b || t > Date.parse(b.eventAt)) ultimoComSdr.set(ch.contactId, ch);
    }
  }
  const tags = etiquetas.map((t) => ({
    id: t.id,
    name: (t.name ?? "").trim(),
    color: t.color,
    emoji: t.emoji,
    groupIds: t.groupIds ?? [],
  }));
  const conhecidas = new Set(tags.map((t) => t.id));
  const leads: LeadCrm[] = [];
  for (const c of contatos) {
    if (c.contactType && c.contactType !== "DirectMessage") continue;
    const ch = ultimo.get(c.id);
    const chm = ultimoComSdr.get(c.id);
    const refs = (c.tags ?? []).filter((t) => idDe(t));
    // Etiqueta que o contato ainda tem, mas que foi apagada da lista da organização.
    for (const t of refs) {
      const id = idDe(t)!;
      if (conhecidas.has(id)) continue;
      conhecidas.add(id);
      tags.push({
        id,
        name: (t.name ?? id).trim(),
        color: "Gray",
        emoji: "",
        groupIds: [],
      });
    }
    leads.push({
      id: c.id,
      name: c.name || c.phoneNumber || "Sem nome",
      phone: c.phoneNumber ?? "",
      email: c.email ?? "",
      createdAt: c.createdAtUTC,
      lastActive: c.lastActiveUTC || ch?.eventAt || c.createdAtUTC,
      tagIds: [...new Set(refs.map((t) => idDe(t)!))],
      memberId: chm?.memberId ?? c.organizationMembers?.[0] ?? null,
      chatId: ch?.id ?? null,
      chatOpen: ch?.open ?? false,
      waiting: ch?.waiting ?? false,
      sector: ch?.sector ?? "",
      totalChats: quantos.get(c.id) ?? 0,
      actions: (acoes.get(c.id) ?? []).sort(
        (a, b) => Date.parse(a.at) - Date.parse(b.at),
      ),
    });
  }
  return {
    organization: { id: o.id, name: o.name },
    tags,
    groups: (o.groups ?? []).map((g) => ({ id: g.id, name: g.name })),
    members: (o.organizationMembers ?? []).map((m) => ({
      id: m.id,
      name: m.displayName || m.name || "Sem nome",
      active: m.active !== false,
    })),
    leads,
    fetchedAt: new Date().toISOString(),
  };
}
