/**
 * Tabelas da planilha da Soul IA (abas Resumo, Leads, Mensagens, Eventos, Situações e Exemplos).
 * Funções puras: viram CSV (sempre) e .xlsx (pelo motor Python, se estiver disponível).
 */
import { ROTULO_SITUACAO, formatarMinutos, type Analise } from "./analise";
import type { ConversaLida, EventoLido } from "./memoria";

export type Celula = string | number | boolean | null;
export type Aba = {
  nome: string;
  colunas: string[];
  linhas: Celula[][];
  larguras?: number[];
};

const UTC_MENOS_3 = 3 * 3_600_000;

/** "2026-10-16T14:30:00Z" → "16/10/2026 11:30" (horário de Brasília). */
export function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = new Date(t - UTC_MENOS_3);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const ROTULO_ORIGEM = {
  lead: "Lead",
  vendedor: "Vendedor",
  robo: "Robô",
  externo: "Celular da loja",
} as const;

export function montarAbas(
  conversas: ConversaLida[],
  eventos: EventoLido[],
  a: Analise,
): Aba[] {
  const porId = new Map(conversas.map((c) => [c.id, c]));
  const leads: Aba = {
    nome: "Leads",
    colunas: [
      "Primeira mensagem",
      "Nome",
      "Telefone",
      "Etiquetas",
      "Canal",
      "Setor",
      "Atendente",
      "Anúncio de origem",
      "Assuntos do lead",
      "Msgs do lead",
      "Msgs nossas",
      "Msgs do robô",
      "Quem começou",
      "1ª resposta (min)",
      "Sem resposta nossa",
      "Lead voltou a escrever",
      "Última mensagem de",
      "Última mensagem em",
      "Dias parado",
      "Conversa aberta",
      "Avançou (etiqueta)",
      "ID da conversa",
    ],
    larguras: [
      18, 24, 16, 30, 16, 14, 16, 30, 28, 10, 10, 10, 12, 12, 12, 12, 16, 18,
      10, 10, 12, 20,
    ],
    linhas: a.metricas.map((m) => {
      const c = porId.get(m.id);
      const primeira = c?.mensagens.find((x) => !x.privada);
      return [
        dataHoraBr(primeira?.em ?? m.criadaEm),
        m.nome ?? "",
        m.telefone ?? "",
        m.etiquetas.join(", "),
        m.canal ?? "",
        m.setor ?? "",
        m.atendente ?? "",
        m.anuncio ?? "",
        m.situacoes.map((s) => ROTULO_SITUACAO[s]).join(", "),
        m.msgsLead,
        m.msgsNossas,
        m.msgsRobo,
        { lead: "Lead", nos: "Nós", robo: "Robô", vazia: "" }[m.inicioPor],
        m.esperaMin === null ? null : Math.round(m.esperaMin * 10) / 10,
        m.semResposta ? "sim" : "não",
        m.leadRespondeuDepois ? "sim" : "não",
        m.ultimaOrigem
          ? ROTULO_ORIGEM[m.ultimaOrigem as keyof typeof ROTULO_ORIGEM]
          : "",
        dataHoraBr(m.ultimaEm),
        m.diasParado,
        m.aberta ? "sim" : "não",
        m.positiva ? "sim" : "não",
        m.id,
      ];
    }),
  };
  const mensagens: Aba = {
    nome: "Mensagens",
    colunas: [
      "Data e hora",
      "Lead",
      "Quem escreveu",
      "Atendente",
      "Tipo",
      "Texto",
      "ID da conversa",
    ],
    larguras: [18, 24, 16, 16, 12, 80, 20],
    linhas: conversas.flatMap((c) =>
      c.mensagens
        .filter((m) => !m.privada)
        .map((m) => [
          dataHoraBr(m.em),
          c.nome ?? "",
          ROTULO_ORIGEM[m.origem],
          m.atendente ?? "",
          m.tipo ?? "",
          m.texto ?? "",
          c.id,
        ]),
    ),
  };
  const abaEventos: Aba = {
    nome: "Eventos",
    colunas: ["Data e hora", "Lead", "Tipo", "Detalhe", "ID da conversa"],
    larguras: [18, 24, 28, 80, 20],
    linhas: eventos.map((e) => [
      dataHoraBr(e.em),
      porId.get(e.conversaId)?.nome ?? "",
      e.tipo,
      e.detalhe ?? "",
      e.conversaId,
    ]),
  };
  const e = a.espera;
  const resumo: Aba = {
    nome: "Resumo",
    colunas: ["Indicador", "Valor"],
    larguras: [48, 30],
    linhas: [
      ["Conversas na memória", a.conversas],
      ["Conversas com mensagem do lead", a.conversasComLead],
      ["Sem nenhuma resposta humana nossa", a.semResposta],
      ["% sem resposta", `${a.semRespostaPct}%`],
      ["Lead voltou após nossa 1ª resposta", `${a.leadRespondeuDepoisPct}%`],
      ["Conversas que avançaram (etiqueta)", a.positivas],
      ["Mensagens do lead", a.mensagensLead],
      ["Mensagens nossas", a.mensagensNossas],
      ["Mensagens do robô", a.mensagensRobo],
      ["Mensagens sem texto (áudio, foto…)", a.mensagensSemTexto],
      ["1ª resposta: mediana", formatarMinutos(e.medianaMin)],
      ["1ª resposta: 90% até", formatarMinutos(e.p90Min)],
      ["Respondidas em até 5 min", `${e.ate5minPct}%`],
      ["Respondidas em até 30 min", `${e.ate30minPct}%`],
      ["Respondidas em até 1 h", `${e.ate1hPct}%`],
      ["Palavras por mensagem (mediana)", a.estilo.medianaPalavras],
      ["Mensagens com emoji", `${a.estilo.comEmojiPct}%`],
      ["Mensagens que usam o nome do lead", `${a.estilo.usaNomeDoLeadPct}%`],
      ["Período", `${dataHoraBr(a.periodo.de)} a ${dataHoraBr(a.periodo.ate)}`],
    ],
  };
  const situacoes: Aba = {
    nome: "Situações",
    colunas: ["Situação", "Conversas", "Palavras da resposta típica"],
    larguras: [40, 12, 26],
    linhas: a.situacoes.map((s) => [
      ROTULO_SITUACAO[s.situacao],
      s.conversas,
      s.medianaPalavrasResposta,
    ]),
  };
  const exemplos: Aba = {
    nome: "Exemplos",
    colunas: [
      "Situação",
      "Lead (anonimizado)",
      "Nossa resposta (anonimizada)",
      "Espera (s)",
      "Avançou",
    ],
    larguras: [30, 60, 80, 10, 10],
    linhas: a.exemplos.map((x) => [
      ROTULO_SITUACAO[x.situacao],
      x.lead,
      x.resposta,
      x.esperaSeg,
      x.positiva ? "sim" : "não",
    ]),
  };
  return [resumo, leads, mensagens, abaEventos, situacoes, exemplos];
}

const escaparCsv = (v: Celula) => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Evita que o Excel execute fórmulas vindas de mensagens de clientes.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV com ponto e vírgula e BOM, que o Excel em português abre direto. */
export function paraCsv(aba: Aba): string {
  const linhas = [aba.colunas, ...aba.linhas].map((l) =>
    l.map(escaparCsv).join(";"),
  );
  return "﻿" + linhas.join("\r\n") + "\r\n";
}
