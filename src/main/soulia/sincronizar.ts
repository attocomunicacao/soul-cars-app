/**
 * Sincronização da memória da Soul IA com o uTalk (API somente leitura).
 *
 * Lista as conversas (mais recentes primeiro), grava os dados do lead e baixa as mensagens de cada
 * conversa que mudou desde a última vez. Quem não mudou é pulado, então a segunda sincronização é
 * rápida. Nada é escrito no CRM. Sem Electron, para ser testado com uma API falsa.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  ErroUtalk,
  descobrirOrganizacao,
  emLotes,
  pedir,
  type Buscar,
  type Pagina,
} from "../utalk-api";
import {
  definirSync,
  estadoDaConversa,
  gravarConversa,
  gravarEventos,
  gravarLead,
  gravarMensagens,
  marcarSincronizada,
  type EventoGravar,
  type MensagemGravar,
  type Origem,
} from "./memoria";

type Registro = Record<string, unknown>;

export type Progresso = {
  fase: "listando" | "baixando" | "pronto";
  feito: number;
  total: number;
  texto: string;
};

export type OpcoesSincronizacao = {
  /** Máximo de conversas recentes a considerar (padrão: todas, até 20 mil). */
  limite?: number;
  aoProgresso?: (p: Progresso) => void;
  cancelado?: () => boolean;
  agora?: () => Date;
};

export type ResultadoSincronizacao = {
  conversasVistas: number;
  conversasBaixadas: number;
  mensagensNovas: number;
  eventosVistos: number;
  cancelado: boolean;
  falhas: number;
};

const POR_PAGINA = 100;
const MENSAGENS_POR_PAGINA = 100;
const SIMULTANEAS = 3;
const MAX_PAGINAS_POR_CONVERSA = 300;

const reg = (v: unknown): Registro | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : null;
const txt = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const nomeDe = (v: unknown): string | null => {
  const r = reg(v);
  if (!r) return null;
  return txt(r.name) ?? txt(r.displayName) ?? txt(r.phoneNumber) ?? null;
};

export function origemDaMensagem(m: Registro): Origem {
  switch (m.source) {
    case "Contact":
      return "lead";
    case "Member":
      return "vendedor";
    case "Bot":
      return "robo";
    case "External":
      return "externo";
  }
  if (reg(m.sentByOrganizationMember)) return "vendedor";
  return "lead";
}

/** Entradas sem `messageType`/`source` são metadados da linha do tempo (etiqueta, transferência…). */
const ehMensagem = (m: Registro) =>
  m.messageType !== undefined || m.source !== undefined;

export function mensagemDaApi(
  m: Registro,
  conversaId: string,
): MensagemGravar | null {
  const id = txt(m.id);
  const em = txt(m.eventAtUTC) ?? txt(m.createdAtUTC);
  if (!id || !em) return null;
  const membro = reg(m.sentByOrganizationMember);
  return {
    id,
    conversaId,
    em,
    origem: origemDaMensagem(m),
    tipo: txt(m.messageType),
    texto: txt(m.content),
    privada: m.isPrivate === true,
    atendente: membro ? (txt(membro.name) ?? txt(membro.id)) : null,
    anuncio: reg(m.ad) ?? null,
  };
}

export function eventoDaApi(
  m: Registro,
  conversaId: string,
): EventoGravar | null {
  const em = txt(m.eventAtUTC) ?? txt(m.createdAtUTC);
  const tipo = txt(m._t);
  if (!em || !tipo) return null;
  const { _t, id, createdAtUTC, eventAtUTC, ...resto } = m;
  void _t;
  void createdAtUTC;
  void eventAtUTC;
  return {
    id: txt(id) ?? `${conversaId}:${tipo}:${em}`,
    conversaId,
    em,
    tipo,
    detalhe: JSON.stringify(resto).slice(0, 800),
  };
}

type PaginaMensagens = { messages?: Registro[] };

async function baixarMensagens(
  db: DatabaseSync,
  buscar: Buscar,
  token: string,
  organizationId: string,
  conversaId: string,
  ate: string | null,
  agora: Date,
) {
  let de = new Date(agora.getTime() + 86_400_000).toISOString();
  let novas = 0;
  let eventos = 0;
  for (let i = 0; i < MAX_PAGINAS_POR_CONVERSA; i++) {
    const p = await pedir<PaginaMensagens>(
      buscar,
      token,
      `/v1/chats/${encodeURIComponent(conversaId)}/relative-messages/`,
      {
        organizationId,
        FromEventUTC: de,
        Take: String(MENSAGENS_POR_PAGINA),
        Direction: "TakeBefore",
        IncludeMetadata: "true",
      },
    );
    const lote = (p.messages ?? []).filter((m) => reg(m)) as Registro[];
    if (lote.length === 0) break;
    const msgs: MensagemGravar[] = [];
    const evs: EventoGravar[] = [];
    let maisAntiga = de;
    for (const m of lote) {
      const em = txt(m.eventAtUTC) ?? txt(m.createdAtUTC);
      if (em && em < maisAntiga) maisAntiga = em;
      if (ehMensagem(m)) {
        const g = mensagemDaApi(m, conversaId);
        if (g) msgs.push(g);
      } else {
        const e = eventoDaApi(m, conversaId);
        if (e) evs.push(e);
      }
    }
    db.exec("BEGIN IMMEDIATE");
    let novasDoLote = 0;
    try {
      novasDoLote = gravarMensagens(db, msgs);
      gravarEventos(db, evs);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    novas += novasDoLote;
    eventos += evs.length;
    // Fim: lote incompleto, nada novo (voltamos ao que já tínhamos) ou já passamos do que estava guardado.
    if (lote.length < MENSAGENS_POR_PAGINA) break;
    if (novasDoLote === 0 && evs.length === 0) break;
    if (ate && maisAntiga <= ate) break;
    if (maisAntiga >= de) break;
    de = maisAntiga;
  }
  return { novas, eventos };
}

export async function sincronizar(
  db: DatabaseSync,
  buscar: Buscar,
  token: string,
  opcoes: OpcoesSincronizacao = {},
): Promise<ResultadoSincronizacao> {
  const agora = opcoes.agora?.() ?? new Date();
  const limite = Math.max(1, opcoes.limite ?? 20_000);
  const avisar = (p: Progresso) => opcoes.aoProgresso?.(p);
  const cancelado = () => opcoes.cancelado?.() === true;
  const org = await descobrirOrganizacao(buscar, token);

  // 1) Lista as conversas e guarda os dados dos leads.
  const pendentes: { id: string; eventoEm: string | null; ate: string | null }[] =
    [];
  let vistas = 0;
  for (let skip = 0; skip < limite && !cancelado(); skip += POR_PAGINA) {
    const p = await pedir<Pagina<Registro>>(buscar, token, "/v1/chats/", {
      organizationId: org.id,
      ContactTypes: ["DirectMessage"],
      ChatState: "All",
      ChatOrderBy: "LastMessage",
      Order: "Desc",
      Skip: String(skip),
      Take: String(Math.min(POR_PAGINA, limite - skip)),
      Behavior: "CountAllAndGetSlice",
    });
    const itens = p.items ?? [];
    const total = Math.min(p.page?.totalItems ?? itens.length, limite);
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const c of itens) vistas += registrarConversa(db, c, agora, pendentes);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    avisar({
      fase: "listando",
      feito: vistas,
      total,
      texto: `Lendo a lista de conversas (${vistas} de ${total})…`,
    });
    if (itens.length === 0 || vistas >= total) break;
  }

  // 2) Baixa as mensagens das conversas que mudaram.
  let baixadas = 0;
  let mensagensNovas = 0;
  let eventosVistos = 0;
  let falhas = 0;
  let feito = 0;
  let ultimoErro: unknown = null;
  await emLotes(pendentes, SIMULTANEAS, async (c) => {
    if (cancelado()) return;
    try {
      const r = await baixarMensagens(
        db,
        buscar,
        token,
        org.id,
        c.id,
        c.ate,
        agora,
      );
      mensagensNovas += r.novas;
      eventosVistos += r.eventos;
      marcarSincronizada(db, c.id, c.eventoEm, agora.toISOString());
      baixadas++;
    } catch (e) {
      falhas++;
      ultimoErro = e;
    }
    feito++;
    avisar({
      fase: "baixando",
      feito,
      total: pendentes.length,
      texto: `Baixando mensagens (${feito} de ${pendentes.length})…`,
    });
  });

  // Se tudo falhou, o motivo (token recusado, internet) importa mais que o contador.
  if (pendentes.length > 0 && baixadas === 0 && ultimoErro && !cancelado())
    throw ultimoErro instanceof ErroUtalk
      ? ultimoErro
      : new ErroUtalk("Não consegui baixar as mensagens do uTalk.");

  if (!cancelado()) definirSync(db, "ultima_sincronizacao", agora.toISOString());
  avisar({
    fase: "pronto",
    feito: pendentes.length,
    total: pendentes.length,
    texto: cancelado() ? "Sincronização interrompida." : "Memória atualizada.",
  });
  return {
    conversasVistas: vistas,
    conversasBaixadas: baixadas,
    mensagensNovas,
    eventosVistos,
    cancelado: cancelado(),
    falhas,
  };
}

/** Grava lead e conversa; se a conversa mudou, entra na fila de download. Devolve 1 (conversa vista). */
function registrarConversa(
  db: DatabaseSync,
  c: Registro,
  agora: Date,
  fila: { id: string; eventoEm: string | null; ate: string | null }[],
): number {
  const id = txt(c.id);
  if (!id) return 0;
  const contato = reg(c.contact);
  const contatoId = txt(contato?.id) ?? `chat:${id}`;
  const etiquetas = (Array.isArray(c.tags) ? c.tags : [])
    .map((t) => nomeDe(t))
    .filter((n): n is string => !!n);
  const campos = reg(contato?.customFields) ?? null;
  gravarLead(
    db,
    {
      contatoId,
      nome: txt(contato?.name),
      telefone: txt(contato?.phoneNumber) ?? txt(contato?.phone),
      criadoEm: txt(contato?.createdAtUTC),
      ultimaAtividade: txt(contato?.lastActiveUTC),
      campos,
    },
    agora.toISOString(),
  );
  const eventoEm = txt(c.eventAtUTC);
  gravarConversa(db, {
    id,
    contatoId,
    criadaEm: txt(c.createdAtUTC),
    eventoEm,
    aberta: c.open === true,
    aguardando: c.waiting === true,
    fechadaEm: txt(c.closedAtUTC),
    setor: nomeDe(c.sector),
    atendente: nomeDe(c.organizationMember),
    canal: nomeDe(c.channel),
    etiquetas,
    anuncio: null,
  });
  const estado = estadoDaConversa(db, id);
  if (!estado.syncEventoEm || estado.syncEventoEm !== eventoEm)
    fila.push({ id, eventoEm, ate: estado.ultimaMensagem });
  return 1;
}
