/**
 * Memória da Soul IA: tudo o que o uTalk (CRM) conversou com os leads, guardado neste computador.
 *
 * Fica num banco SQLite próprio (`soul-ia.db`, na pasta de dados do app), separado do `soul.db` do
 * Studio, para poder ser apagado inteiro sem afetar estoque e anúncios. Sem Electron: recebe o banco
 * pronto, para ser testado em memória. Os dados são pessoais (LGPD): nada daqui sai do computador.
 */
import type { DatabaseSync } from "node:sqlite";

/** Migrações da memória. Acrescente uma nova no fim; nunca edite uma que já rodou. */
export const MIGRACOES_IA: { versao: number; nome: string; sql: string }[] = [
  {
    versao: 1,
    nome: "memoria",
    sql: `
      CREATE TABLE IF NOT EXISTS ia_leads (
        contato_id    TEXT PRIMARY KEY,
        nome          TEXT,
        telefone      TEXT,
        criado_em     TEXT,
        ultima_atividade TEXT,
        campos_json   TEXT,
        atualizado_em TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ia_conversas (
        id            TEXT PRIMARY KEY,
        contato_id    TEXT,
        criada_em     TEXT,
        evento_em     TEXT,
        aberta        INTEGER NOT NULL DEFAULT 0,
        aguardando    INTEGER NOT NULL DEFAULT 0,
        fechada_em    TEXT,
        setor         TEXT,
        atendente     TEXT,
        canal         TEXT,
        etiquetas_json TEXT,
        anuncio_json  TEXT,
        sync_evento_em TEXT,
        sincronizada_em TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ia_conversas_contato ON ia_conversas (contato_id);
      CREATE TABLE IF NOT EXISTS ia_mensagens (
        id            TEXT PRIMARY KEY,
        conversa_id   TEXT NOT NULL,
        em            TEXT NOT NULL,
        origem        TEXT NOT NULL,
        tipo          TEXT,
        texto         TEXT,
        privada       INTEGER NOT NULL DEFAULT 0,
        atendente     TEXT,
        anuncio_json  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ia_mensagens_conversa ON ia_mensagens (conversa_id, em);
      CREATE TABLE IF NOT EXISTS ia_eventos (
        id            TEXT PRIMARY KEY,
        conversa_id   TEXT NOT NULL,
        em            TEXT NOT NULL,
        tipo          TEXT NOT NULL,
        detalhe       TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ia_eventos_conversa ON ia_eventos (conversa_id, em);
      CREATE TABLE IF NOT EXISTS ia_sync (
        chave         TEXT PRIMARY KEY,
        valor         TEXT
      );
    `,
  },
];

/** Quem escreveu: o lead, um vendedor, o robô do uTalk ou um aparelho externo (celular). */
export type Origem = "lead" | "vendedor" | "robo" | "externo";

export type LeadGravar = {
  contatoId: string;
  nome: string | null;
  telefone: string | null;
  criadoEm: string | null;
  ultimaAtividade: string | null;
  campos: Record<string, unknown> | null;
};

export type ConversaGravar = {
  id: string;
  contatoId: string;
  criadaEm: string | null;
  eventoEm: string | null;
  aberta: boolean;
  aguardando: boolean;
  fechadaEm: string | null;
  setor: string | null;
  atendente: string | null;
  canal: string | null;
  etiquetas: string[];
  anuncio: unknown;
};

export type MensagemGravar = {
  id: string;
  conversaId: string;
  em: string;
  origem: Origem;
  tipo: string | null;
  texto: string | null;
  privada: boolean;
  atendente: string | null;
  anuncio: unknown;
};

export type EventoGravar = {
  id: string;
  conversaId: string;
  em: string;
  tipo: string;
  detalhe: string | null;
};

export function migrarMemoria(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS ia_migracoes(versao INTEGER PRIMARY KEY)",
  );
  const jaRodou = db.prepare("SELECT 1 FROM ia_migracoes WHERE versao = ?");
  const registrar = db.prepare("INSERT INTO ia_migracoes VALUES (?)");
  for (const m of MIGRACOES_IA) {
    if (jaRodou.get(m.versao)) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const comando of m.sql.split(";"))
        if (comando.trim()) db.exec(comando);
      registrar.run(m.versao);
      db.exec("COMMIT");
    } catch (erro) {
      db.exec("ROLLBACK");
      throw erro;
    }
  }
}

const json = (v: unknown) => (v == null ? null : JSON.stringify(v));

export function gravarLead(db: DatabaseSync, l: LeadGravar, agora: string) {
  db.prepare(
    `INSERT INTO ia_leads (contato_id, nome, telefone, criado_em, ultima_atividade, campos_json, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(contato_id) DO UPDATE SET
       nome = COALESCE(excluded.nome, nome),
       telefone = COALESCE(excluded.telefone, telefone),
       criado_em = COALESCE(excluded.criado_em, criado_em),
       ultima_atividade = COALESCE(excluded.ultima_atividade, ultima_atividade),
       campos_json = COALESCE(excluded.campos_json, campos_json),
       atualizado_em = excluded.atualizado_em`,
  ).run(
    l.contatoId,
    l.nome,
    l.telefone,
    l.criadoEm,
    l.ultimaAtividade,
    json(l.campos),
    agora,
  );
}

/** Grava os dados da conversa sem mexer em `sync_evento_em` (só `marcarSincronizada` mexe). */
export function gravarConversa(db: DatabaseSync, c: ConversaGravar) {
  db.prepare(
    `INSERT INTO ia_conversas (id, contato_id, criada_em, evento_em, aberta, aguardando, fechada_em,
        setor, atendente, canal, etiquetas_json, anuncio_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       contato_id = excluded.contato_id, criada_em = excluded.criada_em, evento_em = excluded.evento_em,
       aberta = excluded.aberta, aguardando = excluded.aguardando, fechada_em = excluded.fechada_em,
       setor = excluded.setor, atendente = excluded.atendente, canal = excluded.canal,
       etiquetas_json = excluded.etiquetas_json,
       anuncio_json = COALESCE(excluded.anuncio_json, anuncio_json)`,
  ).run(
    c.id,
    c.contatoId,
    c.criadaEm,
    c.eventoEm,
    c.aberta ? 1 : 0,
    c.aguardando ? 1 : 0,
    c.fechadaEm,
    c.setor,
    c.atendente,
    c.canal,
    JSON.stringify(c.etiquetas),
    json(c.anuncio),
  );
}

/** Insere as mensagens novas; devolve quantas eram realmente novas. */
export function gravarMensagens(
  db: DatabaseSync,
  mensagens: MensagemGravar[],
): number {
  const existe = db.prepare("SELECT 1 FROM ia_mensagens WHERE id = ?");
  const inserir = db.prepare(
    `INSERT INTO ia_mensagens (id, conversa_id, em, origem, tipo, texto, privada, atendente, anuncio_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let novas = 0;
  for (const m of mensagens) {
    if (existe.get(m.id)) continue;
    inserir.run(
      m.id,
      m.conversaId,
      m.em,
      m.origem,
      m.tipo,
      m.texto,
      m.privada ? 1 : 0,
      m.atendente,
      json(m.anuncio),
    );
    novas++;
  }
  return novas;
}

export function gravarEventos(db: DatabaseSync, eventos: EventoGravar[]) {
  const inserir = db.prepare(
    `INSERT OR IGNORE INTO ia_eventos (id, conversa_id, em, tipo, detalhe) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const e of eventos) inserir.run(e.id, e.conversaId, e.em, e.tipo, e.detalhe);
}

export function marcarSincronizada(
  db: DatabaseSync,
  conversaId: string,
  eventoEm: string | null,
  agora: string,
) {
  db.prepare(
    "UPDATE ia_conversas SET sync_evento_em = ?, sincronizada_em = ? WHERE id = ?",
  ).run(eventoEm, agora, conversaId);
}

/** Estado guardado de uma conversa, para decidir se precisa baixar mensagens de novo. */
export function estadoDaConversa(db: DatabaseSync, id: string) {
  const c = db
    .prepare("SELECT sync_evento_em FROM ia_conversas WHERE id = ?")
    .get(id) as { sync_evento_em: string | null } | undefined;
  const ultima = db
    .prepare("SELECT MAX(em) AS em FROM ia_mensagens WHERE conversa_id = ?")
    .get(id) as { em: string | null };
  return { syncEventoEm: c?.sync_evento_em ?? null, ultimaMensagem: ultima.em };
}

export function definirSync(db: DatabaseSync, chave: string, valor: string) {
  db.prepare(
    `INSERT INTO ia_sync (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
  ).run(chave, valor);
}

export function lerSync(db: DatabaseSync, chave: string): string | null {
  const r = db.prepare("SELECT valor FROM ia_sync WHERE chave = ?").get(chave) as
    | { valor: string | null }
    | undefined;
  return r?.valor ?? null;
}

export type ResumoMemoria = {
  leads: number;
  conversas: number;
  mensagens: number;
  mensagensDoLead: number;
  mensagensNossas: number;
  primeira: string | null;
  ultima: string | null;
  ultimaSincronizacao: string | null;
};

export function resumoDaMemoria(db: DatabaseSync): ResumoMemoria {
  const n = (sql: string) =>
    Number((db.prepare(sql).get() as { n: number }).n);
  const faixa = db
    .prepare("SELECT MIN(em) AS a, MAX(em) AS b FROM ia_mensagens")
    .get() as { a: string | null; b: string | null };
  return {
    leads: n("SELECT COUNT(*) AS n FROM ia_leads"),
    conversas: n("SELECT COUNT(*) AS n FROM ia_conversas"),
    mensagens: n("SELECT COUNT(*) AS n FROM ia_mensagens WHERE privada = 0"),
    mensagensDoLead: n(
      "SELECT COUNT(*) AS n FROM ia_mensagens WHERE privada = 0 AND origem = 'lead'",
    ),
    mensagensNossas: n(
      "SELECT COUNT(*) AS n FROM ia_mensagens WHERE privada = 0 AND origem IN ('vendedor','externo')",
    ),
    primeira: faixa.a,
    ultima: faixa.b,
    ultimaSincronizacao: lerSync(db, "ultima_sincronizacao"),
  };
}

export type ConversaLida = {
  id: string;
  contatoId: string;
  nome: string | null;
  telefone: string | null;
  criadaEm: string | null;
  eventoEm: string | null;
  aberta: boolean;
  fechadaEm: string | null;
  setor: string | null;
  atendente: string | null;
  canal: string | null;
  etiquetas: string[];
  anuncio: unknown;
  mensagens: MensagemLida[];
};

export type MensagemLida = {
  id: string;
  em: string;
  origem: Origem;
  tipo: string | null;
  texto: string | null;
  privada: boolean;
  atendente: string | null;
};

const tentar = <T>(texto: string | null, padrao: T): T => {
  if (!texto) return padrao;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return padrao;
  }
};

/** Todas as conversas com suas mensagens em ordem cronológica (para análise e planilha). */
export function lerConversas(db: DatabaseSync): ConversaLida[] {
  const linhas = db
    .prepare(
      `SELECT c.*, l.nome AS lead_nome, l.telefone AS lead_telefone
         FROM ia_conversas c LEFT JOIN ia_leads l ON l.contato_id = c.contato_id
        ORDER BY c.criada_em`,
    )
    .all() as Record<string, string | number | null>[];
  const porConversa = new Map<string, MensagemLida[]>();
  const msgs = db
    .prepare(
      "SELECT id, conversa_id, em, origem, tipo, texto, privada, atendente FROM ia_mensagens ORDER BY em, id",
    )
    .all() as Record<string, string | number | null>[];
  for (const m of msgs) {
    const lista = porConversa.get(String(m.conversa_id)) ?? [];
    lista.push({
      id: String(m.id),
      em: String(m.em),
      origem: m.origem as Origem,
      tipo: (m.tipo as string | null) ?? null,
      texto: (m.texto as string | null) ?? null,
      privada: m.privada === 1,
      atendente: (m.atendente as string | null) ?? null,
    });
    porConversa.set(String(m.conversa_id), lista);
  }
  return linhas.map((c) => ({
    id: String(c.id),
    contatoId: String(c.contato_id ?? ""),
    nome: (c.lead_nome as string | null) ?? null,
    telefone: (c.lead_telefone as string | null) ?? null,
    criadaEm: (c.criada_em as string | null) ?? null,
    eventoEm: (c.evento_em as string | null) ?? null,
    aberta: c.aberta === 1,
    fechadaEm: (c.fechada_em as string | null) ?? null,
    setor: (c.setor as string | null) ?? null,
    atendente: (c.atendente as string | null) ?? null,
    canal: (c.canal as string | null) ?? null,
    etiquetas: tentar<string[]>(c.etiquetas_json as string | null, []),
    anuncio: tentar<unknown>(c.anuncio_json as string | null, null),
    mensagens: porConversa.get(String(c.id)) ?? [],
  }));
}

export type EventoLido = {
  conversaId: string;
  em: string;
  tipo: string;
  detalhe: string | null;
};

export function lerEventos(db: DatabaseSync): EventoLido[] {
  return (
    db
      .prepare(
        "SELECT conversa_id, em, tipo, detalhe FROM ia_eventos ORDER BY em",
      )
      .all() as Record<string, string | null>[]
  ).map((e) => ({
    conversaId: String(e.conversa_id),
    em: String(e.em),
    tipo: String(e.tipo),
    detalhe: e.detalhe ?? null,
  }));
}

/** Apaga toda a memória (leads, conversas, mensagens e eventos). */
export function esquecerTudo(db: DatabaseSync) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const t of [
      "ia_eventos",
      "ia_mensagens",
      "ia_conversas",
      "ia_leads",
      "ia_sync",
    ])
      db.exec(`DELETE FROM ${t}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
