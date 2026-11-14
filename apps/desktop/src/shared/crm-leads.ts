/**
 * Regras puras do módulo CRM · Leads (vindo do Soul APP): formato dos leads lidos do uTalk,
 * classificação das etiquetas (carro × status), coluna do Kanban, filtros, séries por dia
 * e a comparação entre duas leituras (feed de atividade). Usadas pelo main e pela interface.
 */

/** Ação de um SDR num atendimento (bot acionado no chat: "LIGAÇÃO ATENDIDA" etc.). */
export type AcaoSdr = {
  memberId: string;
  title: string;
  trigger: string;
  at: string;
};

/** Um lead (contato do uTalk) com o resumo do atendimento mais recente. */
export type LeadCrm = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  lastActive: string;
  tagIds: string[];
  memberId: string | null;
  chatId: string | null;
  chatOpen: boolean;
  waiting: boolean;
  sector: string;
  totalChats: number;
  actions: AcaoSdr[];
};

/** Etiqueta do uTalk (cor no padrão do uTalk: "Blue", "Gold"…). */
export type EtiquetaCrm = {
  id: string;
  name: string;
  color?: string | null;
  emoji?: string | null;
  groupIds: string[];
  orphan?: boolean;
};

/** Leitura completa dos leads de uma organização. */
export type SnapshotCrm = {
  organization: { id: string; name: string };
  tags: EtiquetaCrm[];
  groups: { id: string; name: string }[];
  members: { id: string; name: string; active?: boolean }[];
  leads: LeadCrm[];
  fetchedAt: string;
};

/** Evento do feed de atividade. */
export type EventoCrm = {
  at: string;
  type: "novo" | "tag+" | "tag-" | "sdr";
  leadId: string;
  text: string;
  tags?: string[];
};

/** Papel de uma etiqueta no módulo CRM. */
export type CategoriaEtiqueta = "car" | "status" | "ignore";

/** Preferências do módulo CRM · Leads. */
export type ConfigLeads = {
  /** Só contatos ativos nos últimos N dias (0 = todos). */
  windowDays: number;
  /** Intervalo da atualização automática, em segundos. */
  intervalSec: number;
  /** Avisa no Windows quando chega lead novo. */
  notifyNewLeads: boolean;
  tagCategories: Record<string, CategoriaEtiqueta>;
  /** Etiquetas de status na ordem do funil (colunas do Kanban). */
  statusOrder: string[];
};

export const CONFIG_LEADS_PADRAO: ConfigLeads = {
  windowDays: 30,
  intervalSec: 60,
  notifyNewLeads: true,
  tagCategories: {},
  statusOrder: [],
};

/** Coluna "Sem status" do Kanban e valor "(sem carro/sem SDR)" dos filtros. */
export const NENHUM = "__none__";

const ANO = /\b(19|20)\d{2}\b/;
const STATUS =
  /(quente|frio|morno|agend|desqualif|perdid|vendid|ganho|novo|call|follow|liga[cç]|simula|confirm|finaliz|visita|negocia|proposta|retorno|sem resposta|n[aã]o responde|atendid|fechad|qualificad)/i;
const POSICAO: [RegExp, number][] = [
  [/novo/i, 5],
  [/1\s*call/i, 10],
  [/2\s*call/i, 11],
  [/3\s*call/i, 12],
  [/call/i, 13],
  [/1\s*follow/i, 20],
  [/2\s*follow/i, 21],
  [/follow/i, 22],
  [/sem resposta|n[aã]o responde/i, 25],
  [/frio/i, 30],
  [/morno/i, 35],
  [/quente/i, 40],
  [/simula/i, 45],
  [/liga[cç]/i, 50],
  [/reagend/i, 62],
  [/agend/i, 60],
  [/visita/i, 65],
  [/confirm/i, 70],
  [/proposta|negocia/i, 75],
  [/finaliz|atendid/i, 85],
  [/vendid|ganho|fechad/i, 90],
  [/perdid/i, 95],
  [/desqualif/i, 100],
];

/** Posição de uma etiqueta de status no funil (ordem das colunas do Kanban). */
export function posicaoNoFunil(nome: string): number {
  for (const [re, r] of POSICAO) if (re.test(nome)) return r;
  return 50;
}

/**
 * Classifica as etiquetas ainda sem categoria (carro × status) e acrescenta as de status
 * novas à ordem do Kanban. Devolve a configuração nova e se algo mudou.
 */
export function classificarEtiquetas(
  snap: Pick<SnapshotCrm, "tags" | "groups">,
  cfg: ConfigLeads,
): { cfg: ConfigLeads; mudou: boolean } {
  const categorias = { ...cfg.tagCategories };
  let mudou = false;
  const grupo = new Map(
    (snap.groups ?? []).map((g) => [g.id, (g.name || "").toLowerCase()]),
  );
  for (const t of snap.tags) {
    if (categorias[t.id]) continue;
    const grupos = (t.groupIds ?? []).map((g) => grupo.get(g) ?? "");
    let c: CategoriaEtiqueta;
    if (grupos.some((g) => /status|etapa|funil|temperatura/.test(g)))
      c = "status";
    else if (
      grupos.some((g) => /carro|ve[ií]culo|modelo|produto|campanha/.test(g))
    )
      c = "car";
    else if (ANO.test(t.name)) c = "car";
    else c = STATUS.test(t.name) ? "status" : "car";
    categorias[t.id] = c;
    mudou = true;
  }
  const porId = new Map(snap.tags.map((t) => [t.id, t]));
  const deStatus = snap.tags
    .filter((t) => categorias[t.id] === "status")
    .map((t) => t.id);
  const ordem = cfg.statusOrder.filter((id) => deStatus.includes(id));
  const novos = deStatus
    .filter((id) => !ordem.includes(id))
    .sort(
      (a, b) =>
        posicaoNoFunil(porId.get(a)!.name) - posicaoNoFunil(porId.get(b)!.name),
    );
  if (novos.length || ordem.length !== cfg.statusOrder.length) mudou = true;
  return {
    cfg: {
      ...cfg,
      tagCategories: categorias,
      statusOrder: [...ordem, ...novos],
    },
    mudou,
  };
}

/** Categoria de uma etiqueta (sem categoria = carro, como no Soul APP). */
export const categoria = (cfg: ConfigLeads, tagId: string) =>
  cfg.tagCategories[tagId] ?? "car";

/** Coluna do Kanban: o status mais avançado no funil que o lead tem (ou NENHUM). */
export function statusDoLead(lead: LeadCrm, ordem: string[]): string {
  for (let i = ordem.length - 1; i >= 0; i--)
    if (lead.tagIds.includes(ordem[i])) return ordem[i];
  return NENHUM;
}

const AGENDADO = /agend|confirm|vendid|ganho/i;
/** Etiquetas de status que contam como perda (cinza nos gráficos). */
export const PERDIDO = /desqualif|perdid|descart/i;

/** Lead com etiqueta de agendado, confirmado ou vendido. */
export function ehAgendado(
  lead: LeadCrm,
  etiquetas: Map<string, EtiquetaCrm>,
  cfg: ConfigLeads,
) {
  return lead.tagIds.some(
    (id) =>
      categoria(cfg, id) === "status" &&
      AGENDADO.test(etiquetas.get(id)?.name ?? ""),
  );
}

/** Nome de status que conta como agendamento. */
export const nomeDeAgendamento = (nome: string) => AGENDADO.test(nome);

/** Período dos filtros: "today", "7", "30", "90" ou "all". */
export type PeriodoLeads = "today" | "7" | "30" | "90" | "all";

/** Início do período em ms (null = tudo). */
export function inicioDoPeriodo(p: PeriodoLeads, agora = Date.now()) {
  if (p === "all") return null;
  if (p === "today") {
    const d = new Date(agora);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return agora - Number(p) * 864e5;
}

/** Filtros da tela de leads. */
export type FiltrosLeads = {
  period: PeriodoLeads;
  car: string;
  member: string;
  search: string;
};

/** Aplica período (data de entrada), carro, SDR e busca por nome ou telefone. */
export function filtrarLeads(
  leads: LeadCrm[],
  f: FiltrosLeads,
  cfg: ConfigLeads,
  agora = Date.now(),
) {
  const inicio = inicioDoPeriodo(f.period, agora);
  const q = f.search.trim().toLowerCase();
  const digitos = q.replace(/\D/g, "");
  const temCarro = (l: LeadCrm) =>
    l.tagIds.some((t) => categoria(cfg, t) === "car");
  return leads.filter((l) => {
    if (inicio && Date.parse(l.createdAt) < inicio) return false;
    if (f.car === NENHUM ? temCarro(l) : f.car && !l.tagIds.includes(f.car))
      return false;
    if (f.member === NENHUM ? l.memberId : f.member && l.memberId !== f.member)
      return false;
    if (
      q &&
      !(
        l.name.toLowerCase().includes(q) ||
        (digitos && l.phone.replace(/\D/g, "").includes(digitos))
      )
    )
      return false;
    return true;
  });
}

/** "2026-11-14" no fuso local. */
export function diaLocal(data: string | number | Date) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Leads que entraram em cada um dos últimos `dias` dias (mais antigo primeiro). */
export function seriePorDia(
  leads: LeadCrm[],
  dias: number,
  agora = Date.now(),
) {
  const contagem = new Map<string, number>();
  for (const l of leads) {
    const k = diaLocal(l.createdAt);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const saida: { dia: string; valor: number }[] = [];
  const d = new Date(agora);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - dias + 1);
  for (let i = 0; i < dias; i++) {
    const k = diaLocal(d);
    saida.push({ dia: k, valor: contagem.get(k) ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return saida;
}

/** Conta quantos leads têm cada chave (ex.: etiqueta). */
export function contarPor(leads: LeadCrm[], chaves: (l: LeadCrm) => string[]) {
  const m = new Map<string, number>();
  for (const l of leads)
    for (const k of chaves(l)) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** Ações dos SDRs no período: total, ligações não atendidas e atendidas por SDR. */
export function acoesPorSdr(leads: LeadCrm[], desde: number) {
  const m = new Map<
    string,
    { total: number; naoAtend: number; atend: number }
  >();
  for (const l of leads)
    for (const a of l.actions ?? []) {
      if (Date.parse(a.at) < desde) continue;
      const x = m.get(a.memberId) ?? { total: 0, naoAtend: 0, atend: 0 };
      x.total++;
      const txt = `${a.title} ${a.trigger}`;
      if (/n[aã]o atendida/i.test(txt)) x.naoAtend++;
      else if (/atendida/i.test(txt)) x.atend++;
      m.set(a.memberId, x);
    }
  return m;
}

/**
 * Compara duas leituras e gera os eventos do feed: lead novo, etiqueta ganha ou perdida
 * e troca de SDR. Contato antigo que só "entrou na janela" por atividade não é lead novo.
 */
export function compararLeituras(
  antes: SnapshotCrm | null,
  depois: SnapshotCrm,
): EventoCrm[] {
  if (!antes || antes.organization.id !== depois.organization.id) return [];
  const eventos: EventoCrm[] = [];
  const at = depois.fetchedAt;
  const nomeTag = new Map(depois.tags.map((t) => [t.id, t.name]));
  const nomeSdr = new Map(depois.members.map((m) => [m.id, m.name]));
  const velhos = new Map(antes.leads.map((l) => [l.id, l]));
  for (const l of depois.leads) {
    const o = velhos.get(l.id);
    if (!o) {
      if (Date.parse(l.createdAt) < Date.parse(antes.fetchedAt) - 10 * 60_000)
        continue;
      eventos.push({
        at,
        type: "novo",
        leadId: l.id,
        text: `Novo lead: ${l.name}`,
        tags: l.tagIds
          .map((t) => nomeTag.get(t))
          .filter((t): t is string => !!t),
      });
      continue;
    }
    for (const t of l.tagIds.filter((t) => !o.tagIds.includes(t)))
      eventos.push({
        at,
        type: "tag+",
        leadId: l.id,
        text: `${l.name} recebeu a etiqueta "${nomeTag.get(t) ?? t}"`,
      });
    for (const t of o.tagIds.filter((t) => !l.tagIds.includes(t)))
      eventos.push({
        at,
        type: "tag-",
        leadId: l.id,
        text: `${l.name} perdeu a etiqueta "${nomeTag.get(t) ?? t}"`,
      });
    if (l.memberId && l.memberId !== o.memberId)
      eventos.push({
        at,
        type: "sdr",
        leadId: l.id,
        text: `${l.name} foi atribuído a ${nomeSdr.get(l.memberId) ?? "outro SDR"}`,
      });
  }
  return eventos;
}
