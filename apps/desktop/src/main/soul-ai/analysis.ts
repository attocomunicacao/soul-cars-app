/**
 * Análise do atendimento da Soul IA: como nós respondemos os leads.
 *
 * Só estatística e regras sobre a memória (nada de modelo de IA, nada de serviço pago). Produz:
 *  - métricas por conversa (usadas na planilha);
 *  - o "padrão de atendimento" (resumo descritivo, em Markdown);
 *  - exemplos pergunta-do-lead → nossa resposta, anonimizados, por situação (base do futuro agente);
 *  - um prompt pronto para colar no chat do usuário e refinar o padrão com conversas de amostra.
 * Tudo que sai é anonimizado: telefone, CPF, e-mail, placa e primeiro nome do lead são trocados.
 */
import type { ConversaLida, MensagemLida } from "./memory";

// ------------------------------------------------------------------ utilidades
const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const UTC_MENOS_3 = 3 * 3_600_000; // Brasil (sem horário de verão desde 2019)
const ms = (iso: string) => new Date(iso).getTime();
const local = (iso: string) => new Date(ms(iso) - UTC_MENOS_3);

export const mediana = (v: number[]): number | null => percentil(v, 0.5);

export function percentil(v: number[], p: number): number | null {
  if (v.length === 0) return null;
  const o = [...v].sort((a, b) => a - b);
  const i = Math.min(o.length - 1, Math.max(0, Math.ceil(p * o.length) - 1));
  return o[i];
}

const arred = (n: number | null, casas = 1) =>
  n === null ? null : Math.round(n * 10 ** casas) / 10 ** casas;

export function formatarMinutos(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return `${Math.round(min * 60)} s`;
  if (min < 90) return `${Math.round(min)} min`;
  if (min < 48 * 60) return `${(min / 60).toFixed(1).replace(".", ",")} h`;
  return `${Math.round(min / 1440)} dias`;
}

const pct = (parte: number, total: number) =>
  total === 0 ? 0 : Math.round((parte / total) * 100);

/** Troca dados pessoais por marcadores. `nomeLead` é o nome do contato, se conhecido. */
export function anonimizar(texto: string, nomeLead?: string | null): string {
  let t = texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(
      /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g,
      "[TELEFONE]",
    )
    .replace(/\b[A-Za-z]{3}-?\d[A-Za-z0-9]\d{2}\b/g, "[PLACA]");
  const primeiro = (nomeLead ?? "").trim().split(/\s+/)[0];
  if (primeiro && primeiro.length >= 3) {
    const alvo = semAcento(primeiro).replace(/[^a-z]/g, "");
    if (alvo.length >= 3)
      t = t.replace(/[\p{L}]+/gu, (p) =>
        semAcento(p) === alvo ? "[NOME]" : p,
      );
  }
  return t;
}

const EMOJI = /\p{Extended_Pictographic}/u;
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const normalizarFrase = (t: string) =>
  semAcento(t)
    .replace(/[^\p{L}\p{N}\s?]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// ------------------------------------------------------------------- situações
export type Situacao =
  | "anuncio"
  | "disponibilidade"
  | "preco"
  | "negociacao"
  | "financiamento"
  | "troca"
  | "fotos_videos"
  | "visita"
  | "detalhes"
  | "saudacao";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  anuncio: "Veio de anúncio/portal",
  disponibilidade: "Disponibilidade",
  preco: "Preço",
  negociacao: "Negociação / desconto",
  financiamento: "Financiamento / entrada",
  troca: "Troca / avaliação do usado",
  fotos_videos: "Fotos e vídeos",
  visita: "Visita / endereço / horário",
  detalhes: "Detalhes do carro (km, ano, documentos…)",
  saudacao: "Só cumprimentou",
};

/** Ordem importa: a primeira regra que bate é a situação principal da mensagem. */
const REGRAS: [Situacao, RegExp][] = [
  ["financiamento", /financ|entrada|parcel|prestac|banco|simula|consorcio/],
  [
    "troca",
    /\btroca|trocar|meu carro|meu veiculo|avali|pegam o meu|aceita (o )?meu/,
  ],
  [
    "negociacao",
    /desconto|ultimo valor|melhor (preco|valor)|faz (por|ate)|abaixa|menos de|negoci/,
  ],
  [
    "visita",
    /visita|ver (o|ele|ela) (carro|pessoalmente)|ir (ai|na loja|ate)|passar (ai|ae|na loja)|endereco|onde fica|localizac|horario|funciona|test.?drive|abre|aberto/,
  ],
  ["fotos_videos", /\bfotos?\b|\bvideos?\b|imagens?|mais fotos/],
  [
    "preco",
    /\bpreco|\bvalor|quanto (custa|e|esta|ta|fica|sai)|a vista|\bpor quanto/,
  ],
  [
    "disponibilidade",
    /disponivel|ainda (tem|esta|ta)|esta a venda|ainda a venda|vendido|continua/,
  ],
  [
    "detalhes",
    /\bkm\b|quilometr|\bano\b|dono|revis|document|ipva|licenciad|laudo|cautelar|manual|chave reserva|motor|cambio|flex|consumo|cor\b|\bpneus?\b|\bbanco de couro/,
  ],
  [
    "anuncio",
    /vi (o |seu |um )?anuncio|anuncio|instagram|olx|webmotors|facebook|marketplace|icarros|mercado livre/,
  ],
  ["saudacao", /^(oi|ola|opa|eae|e ai|bom dia|boa tarde|boa noite|tudo bem)\b/],
];

export function situacaoDaMensagem(texto: string): Situacao | null {
  const t = semAcento(texto).trim();
  if (!t) return null;
  for (const [s, r] of REGRAS) if (r.test(t)) return s;
  return null;
}

/** Etiquetas que indicam avanço do lead (visita, proposta, venda). Heurística: confira com a loja. */
const ETIQUETA_POSITIVA =
  /visita|agend|proposta|vendid|vendeu|fechad|negoci|financ|comprou/;
export const temEtiquetaPositiva = (etiquetas: string[]) =>
  etiquetas.some((e) => ETIQUETA_POSITIVA.test(semAcento(e)));

// ------------------------------------------------------------ métricas por conversa
const nossa = (m: MensagemLida) =>
  !m.privada && (m.origem === "vendedor" || m.origem === "externo");
const doLead = (m: MensagemLida) => !m.privada && m.origem === "lead";
const comTexto = (m: MensagemLida) => !!m.texto && m.texto.trim().length > 0;

export type MetricaConversa = {
  id: string;
  nome: string | null;
  telefone: string | null;
  criadaEm: string | null;
  etiquetas: string[];
  canal: string | null;
  setor: string | null;
  atendente: string | null;
  anuncio: string | null;
  aberta: boolean;
  msgsLead: number;
  msgsNossas: number;
  msgsRobo: number;
  inicioPor: "lead" | "nos" | "robo" | "vazia";
  /** Minutos entre a primeira mensagem do lead e a primeira resposta humana nossa. */
  esperaMin: number | null;
  semResposta: boolean;
  leadRespondeuDepois: boolean;
  ultimaOrigem: string | null;
  ultimaEm: string | null;
  diasParado: number | null;
  situacoes: Situacao[];
  positiva: boolean;
};

function textoDoAnuncio(a: unknown): string | null {
  if (!a || typeof a !== "object") return null;
  const r = a as Record<string, unknown>;
  for (const k of ["title", "headline", "body", "sourceUrl", "name"])
    if (typeof r[k] === "string" && r[k]) return String(r[k]).slice(0, 120);
  return null;
}

export function metricaDaConversa(
  c: ConversaLida,
  agora: Date,
): MetricaConversa {
  const msgs = c.mensagens.filter((m) => !m.privada);
  const lead = msgs.filter(doLead);
  const nos = msgs.filter(nossa);
  const robo = msgs.filter((m) => m.origem === "robo");
  const primeira = msgs[0];
  const inicioPor = !primeira
    ? "vazia"
    : primeira.origem === "lead"
      ? "lead"
      : primeira.origem === "robo"
        ? "robo"
        : "nos";
  const primeiraLead = lead[0];
  const respostaHumana = primeiraLead
    ? nos.find((m) => ms(m.em) >= ms(primeiraLead.em))
    : undefined;
  const esperaMin =
    primeiraLead && respostaHumana
      ? (ms(respostaHumana.em) - ms(primeiraLead.em)) / 60_000
      : null;
  const primeiraNossa = nos[0];
  const ultima = msgs[msgs.length - 1];
  const situacoes = new Set<Situacao>();
  for (const m of lead) {
    if (!comTexto(m)) continue;
    const s = situacaoDaMensagem(m.texto!);
    if (s) situacoes.add(s);
  }
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    criadaEm: c.criadaEm,
    etiquetas: c.etiquetas,
    canal: c.canal,
    setor: c.setor,
    atendente: c.atendente,
    anuncio: textoDoAnuncio(c.anuncio),
    aberta: c.aberta,
    msgsLead: lead.length,
    msgsNossas: nos.length,
    msgsRobo: robo.length,
    inicioPor,
    esperaMin,
    semResposta: lead.length > 0 && nos.length === 0,
    leadRespondeuDepois:
      !!primeiraNossa && lead.some((m) => ms(m.em) > ms(primeiraNossa.em)),
    ultimaOrigem: ultima?.origem ?? null,
    ultimaEm: ultima?.em ?? null,
    diasParado: ultima
      ? Math.floor((agora.getTime() - ms(ultima.em)) / 86_400_000)
      : null,
    situacoes: [...situacoes],
    positiva: temEtiquetaPositiva(c.etiquetas),
  };
}

// ------------------------------------------------------------------- exemplos
export type Exemplo = {
  situacao: Situacao;
  conversaId: string;
  lead: string;
  resposta: string;
  esperaSeg: number;
  positiva: boolean;
};

/** Para cada mensagem do lead com situação reconhecida: o que respondemos em seguida (bloco do vendedor). */
export function extrairExemplos(conversas: ConversaLida[]): Exemplo[] {
  const saida: Exemplo[] = [];
  for (const c of conversas) {
    const msgs = c.mensagens.filter((m) => !m.privada);
    const positiva = temEtiquetaPositiva(c.etiquetas);
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.origem !== "lead" || !comTexto(m)) continue;
      const situacao = situacaoDaMensagem(m.texto!);
      if (!situacao || situacao === "saudacao") continue;
      // Mensagens seguidas do lead formam uma pergunta só.
      let j = i + 1;
      const falaLead = [m.texto!.trim()];
      while (j < msgs.length && msgs[j].origem === "lead") {
        if (comTexto(msgs[j])) falaLead.push(msgs[j].texto!.trim());
        j++;
      }
      const resposta: string[] = [];
      let primeiraResposta: MensagemLida | null = null;
      while (j < msgs.length && msgs[j].origem !== "lead") {
        const r = msgs[j];
        if (nossa(r) && comTexto(r)) {
          primeiraResposta ??= r;
          resposta.push(r.texto!.trim());
        }
        j++;
      }
      if (!primeiraResposta) continue;
      saida.push({
        situacao,
        conversaId: c.id,
        lead: anonimizar(falaLead.join(" "), c.nome).slice(0, 400),
        resposta: anonimizar(resposta.join("\n"), c.nome).slice(0, 900),
        esperaSeg: Math.max(
          0,
          Math.round((ms(primeiraResposta.em) - ms(m.em)) / 1000),
        ),
        positiva,
      });
      i = j - 1;
    }
  }
  return saida;
}

function contar(itens: string[], minimo = 1, topo = 10) {
  const mapa = new Map<string, number>();
  for (const i of itens) mapa.set(i, (mapa.get(i) ?? 0) + 1);
  return [...mapa.entries()]
    .filter(([, n]) => n >= minimo)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, topo);
}

/** Respostas mais "típicas" por situação: abertura frequente e tamanho perto da mediana. */
export function exemplosTipicos(exemplos: Exemplo[], porSituacao = 5) {
  const grupos = new Map<Situacao, Exemplo[]>();
  for (const e of exemplos) {
    const l = grupos.get(e.situacao) ?? [];
    l.push(e);
    grupos.set(e.situacao, l);
  }
  const saida = new Map<Situacao, Exemplo[]>();
  for (const [s, lista] of grupos) {
    const abertura = (e: Exemplo) =>
      normalizarFrase(e.resposta).split(" ").slice(0, 3).join(" ");
    const freq = new Map<string, number>();
    for (const e of lista)
      freq.set(abertura(e), (freq.get(abertura(e)) ?? 0) + 1);
    const med = mediana(lista.map((e) => palavras(e.resposta))) ?? 0;
    const ordenados = [...lista].sort(
      (a, b) =>
        Number(b.positiva) - Number(a.positiva) ||
        (freq.get(abertura(b)) ?? 0) - (freq.get(abertura(a)) ?? 0) ||
        Math.abs(palavras(a.resposta) - med) -
          Math.abs(palavras(b.resposta) - med),
    );
    const usadas = new Set<string>();
    const escolhidos: Exemplo[] = [];
    for (const e of ordenados) {
      const chave = normalizarFrase(e.resposta).slice(0, 60);
      if (usadas.has(chave)) continue;
      usadas.add(chave);
      escolhidos.push(e);
      if (escolhidos.length >= porSituacao) break;
    }
    saida.set(s, escolhidos);
  }
  return saida;
}

// ------------------------------------------------------------------ visão geral
export type Faixa =
  | "manhã (6h–12h)"
  | "tarde (12h–18h)"
  | "noite (18h–23h)"
  | "madrugada (23h–6h)";
const FAIXAS: Faixa[] = [
  "manhã (6h–12h)",
  "tarde (12h–18h)",
  "noite (18h–23h)",
  "madrugada (23h–6h)",
];
const faixaDe = (iso: string): Faixa => {
  const h = local(iso).getUTCHours();
  if (h >= 6 && h < 12) return FAIXAS[0];
  if (h >= 12 && h < 18) return FAIXAS[1];
  if (h >= 18 && h < 23) return FAIXAS[2];
  return FAIXAS[3];
};

export type Analise = {
  geradaEm: string;
  periodo: { de: string | null; ate: string | null };
  conversas: number;
  conversasComLead: number;
  semResposta: number;
  semRespostaPct: number;
  leadRespondeuDepoisPct: number;
  positivas: number;
  mensagensLead: number;
  mensagensNossas: number;
  mensagensRobo: number;
  mensagensSemTexto: number;
  espera: {
    medianaMin: number | null;
    p90Min: number | null;
    ate5minPct: number;
    ate30minPct: number;
    ate1hPct: number;
    porFaixa: { faixa: Faixa; conversas: number; medianaMin: number | null }[];
    porAtendente: {
      atendente: string;
      conversas: number;
      medianaMin: number | null;
    }[];
  };
  estilo: {
    medianaPalavras: number | null;
    mensagensPorResposta: number | null;
    comEmojiPct: number;
    emojis: [string, number][];
    usaNomeDoLeadPct: number;
    tratamento: { voce: number; senhor: number; informal: number };
    terminaComPerguntaPct: number;
  };
  aberturas: { texto: string; vezes: number }[];
  fechamentos: { texto: string; vezes: number }[];
  frasesRepetidas: { texto: string; vezes: number }[];
  perguntasNossas: { texto: string; vezes: number }[];
  perguntasDoLead: { texto: string; vezes: number }[];
  situacoes: {
    situacao: Situacao;
    conversas: number;
    medianaPalavrasResposta: number | null;
  }[];
  etiquetas: { nome: string; conversas: number }[];
  positivasVsDemais: {
    positivasEsperaMin: number | null;
    demaisEsperaMin: number | null;
    positivasMsgsNossas: number | null;
    demaisMsgsNossas: number | null;
  };
  metricas: MetricaConversa[];
  exemplos: Exemplo[];
};

export function analisar(
  conversas: ConversaLida[],
  agora = new Date(),
): Analise {
  const metricas = conversas.map((c) => metricaDaConversa(c, agora));
  const todasMsgs = conversas.flatMap((c) =>
    c.mensagens.filter((m) => !m.privada),
  );
  const datas = todasMsgs.map((m) => m.em).sort();
  const comLead = metricas.filter((m) => m.msgsLead > 0);
  const semResposta = comLead.filter((m) => m.semResposta);
  const respondidas = comLead.filter((m) => m.esperaMin !== null);
  const esperas = respondidas.map((m) => m.esperaMin!);

  // Espera por faixa do dia (do horário em que o lead escreveu) e por atendente.
  const porFaixa = FAIXAS.map((faixa) => {
    const v: number[] = [];
    conversas.forEach((c, i) => {
      const m = metricas[i];
      if (m.esperaMin === null) return;
      const primeira = c.mensagens.find((x) => doLead(x));
      if (primeira && faixaDe(primeira.em) === faixa) v.push(m.esperaMin);
    });
    return { faixa, conversas: v.length, medianaMin: arred(mediana(v)) };
  });
  const mapaAtendente = new Map<string, number[]>();
  conversas.forEach((c, i) => {
    const m = metricas[i];
    if (m.esperaMin === null) return;
    const primeiraLead = c.mensagens.find(doLead);
    const resp = c.mensagens.find(
      (x) => nossa(x) && primeiraLead && ms(x.em) >= ms(primeiraLead.em),
    );
    const nome = resp?.atendente ?? m.atendente ?? "(não informado)";
    mapaAtendente.set(nome, [...(mapaAtendente.get(nome) ?? []), m.esperaMin]);
  });

  // Estilo: só mensagens nossas com texto.
  const nossasTexto = conversas.flatMap((c) =>
    c.mensagens.filter((m) => nossa(m) && comTexto(m)).map((m) => ({ m, c })),
  );
  const brutos = nossasTexto.map(({ m, c }) => ({
    original: m.texto!.trim(),
    anon: anonimizar(m.texto!.trim(), c.nome),
    nome: c.nome,
  }));
  const emojisTodos: string[] = [];
  for (const b of brutos)
    for (const ch of b.original.match(/\p{Extended_Pictographic}/gu) ?? [])
      emojisTodos.push(ch);
  const primeiroNome = (n: string | null) =>
    semAcento((n ?? "").trim().split(/\s+/)[0] ?? "").replace(/[^a-z]/g, "");
  const usaNome = brutos.filter((b) => {
    const pn = primeiroNome(b.nome);
    return pn.length >= 3 && semAcento(b.original).includes(pn);
  }).length;
  const tem = (b: { original: string }, r: RegExp) =>
    r.test(semAcento(b.original));

  // Blocos de resposta (mensagens nossas seguidas) e aberturas/fechamentos.
  const tamanhosBloco: number[] = [];
  const aberturas: string[] = [];
  const fechamentos: string[] = [];
  const perguntasNossas: string[] = [];
  const perguntasLead: string[] = [];
  for (const c of conversas) {
    const msgs = c.mensagens.filter((m) => !m.privada);
    let bloco = 0;
    for (const m of msgs) {
      if (nossa(m)) bloco++;
      else if (bloco > 0) {
        tamanhosBloco.push(bloco);
        bloco = 0;
      }
    }
    if (bloco > 0) tamanhosBloco.push(bloco);
    const primeiraLead = msgs.findIndex(doLead);
    const primeiraNossa = msgs.find(
      (m, i) => nossa(m) && comTexto(m) && i > primeiraLead,
    );
    if (primeiraLead >= 0 && primeiraNossa)
      aberturas.push(anonimizar(primeiraNossa.texto!.trim(), c.nome));
    const ultima = msgs[msgs.length - 1];
    if (ultima && nossa(ultima) && comTexto(ultima) && msgs.some(doLead))
      fechamentos.push(anonimizar(ultima.texto!.trim(), c.nome));
    for (const m of msgs) {
      if (!comTexto(m)) continue;
      const frases = m.texto!.split(/(?<=[?.!])\s+|\n+/);
      for (const f of frases) {
        if (!f.trim().endsWith("?")) continue;
        const a = anonimizar(f.trim(), c.nome);
        if (nossa(m)) perguntasNossas.push(a);
        else if (doLead(m)) perguntasLead.push(a);
      }
    }
  }
  const norm = (lista: string[]) => {
    // Agrupa pela forma normalizada e mostra a grafia mais comum de cada grupo.
    const grupos = new Map<string, Map<string, number>>();
    for (const t of lista) {
      const k = normalizarFrase(t);
      if (!k) continue;
      const g = grupos.get(k) ?? new Map<string, number>();
      g.set(t, (g.get(t) ?? 0) + 1);
      grupos.set(k, g);
    }
    return [...grupos.values()].map((g) => {
      const total = [...g.values()].reduce((a, b) => a + b, 0);
      const melhor = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { texto: melhor, vezes: total };
    });
  };
  const topo = (lista: string[], minimo: number, n: number) =>
    norm(lista)
      .filter((x) => x.vezes >= minimo)
      .sort(
        (a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto, "pt-BR"),
      )
      .slice(0, n);

  const exemplos = extrairExemplos(conversas);
  const porSit = new Map<Situacao, MetricaConversa[]>();
  for (const m of metricas)
    for (const s of m.situacoes) porSit.set(s, [...(porSit.get(s) ?? []), m]);

  const positivas = metricas.filter((m) => m.positiva);
  const demais = metricas.filter((m) => !m.positiva);
  const etiquetasContadas = contar(
    metricas.flatMap((m) => m.etiquetas),
    1,
    25,
  );

  return {
    geradaEm: agora.toISOString(),
    periodo: { de: datas[0] ?? null, ate: datas[datas.length - 1] ?? null },
    conversas: conversas.length,
    conversasComLead: comLead.length,
    semResposta: semResposta.length,
    semRespostaPct: pct(semResposta.length, comLead.length),
    leadRespondeuDepoisPct: pct(
      metricas.filter((m) => m.leadRespondeuDepois).length,
      metricas.filter((m) => m.msgsNossas > 0).length,
    ),
    positivas: positivas.length,
    mensagensLead: todasMsgs.filter(doLead).length,
    mensagensNossas: todasMsgs.filter(nossa).length,
    mensagensRobo: todasMsgs.filter((m) => m.origem === "robo").length,
    mensagensSemTexto: todasMsgs.filter((m) => !comTexto(m)).length,
    espera: {
      medianaMin: arred(mediana(esperas)),
      p90Min: arred(percentil(esperas, 0.9)),
      ate5minPct: pct(esperas.filter((e) => e <= 5).length, esperas.length),
      ate30minPct: pct(esperas.filter((e) => e <= 30).length, esperas.length),
      ate1hPct: pct(esperas.filter((e) => e <= 60).length, esperas.length),
      porFaixa,
      porAtendente: [...mapaAtendente.entries()]
        .map(([atendente, v]) => ({
          atendente,
          conversas: v.length,
          medianaMin: arred(mediana(v)),
        }))
        .sort((a, b) => b.conversas - a.conversas),
    },
    estilo: {
      medianaPalavras: mediana(brutos.map((b) => palavras(b.original))),
      mensagensPorResposta: arred(mediana(tamanhosBloco)),
      comEmojiPct: pct(
        brutos.filter((b) => EMOJI.test(b.original)).length,
        brutos.length,
      ),
      emojis: contar(emojisTodos, 1, 8),
      usaNomeDoLeadPct: pct(usaNome, brutos.length),
      tratamento: {
        voce: brutos.filter((b) => tem(b, /\b(voce|vc)\b/)).length,
        senhor: brutos.filter((b) => tem(b, /\b(senhor|senhora|sr|sra)\b/))
          .length,
        informal: brutos.filter((b) =>
          tem(b, /\b(amigo|parceiro|chefe|meu querido|mano|irmao)\b/),
        ).length,
      },
      terminaComPerguntaPct: pct(
        brutos.filter((b) => b.original.endsWith("?")).length,
        brutos.length,
      ),
    },
    aberturas: topo(aberturas, 2, 8),
    fechamentos: topo(fechamentos, 2, 8),
    frasesRepetidas: topo(
      brutos.filter((b) => palavras(b.anon) >= 3).map((b) => b.anon),
      3,
      15,
    ),
    perguntasNossas: topo(perguntasNossas, 2, 12),
    perguntasDoLead: topo(perguntasLead, 2, 12),
    situacoes: [...porSit.entries()]
      .map(([situacao, ms_]) => ({
        situacao,
        conversas: ms_.length,
        medianaPalavrasResposta: mediana(
          exemplos
            .filter((e) => e.situacao === situacao)
            .map((e) => palavras(e.resposta)),
        ),
      }))
      .sort((a, b) => b.conversas - a.conversas),
    etiquetas: etiquetasContadas.map(([nome, n]) => ({ nome, conversas: n })),
    positivasVsDemais: {
      positivasEsperaMin: arred(
        mediana(
          positivas.flatMap((m) => (m.esperaMin === null ? [] : [m.esperaMin])),
        ),
      ),
      demaisEsperaMin: arred(
        mediana(
          demais.flatMap((m) => (m.esperaMin === null ? [] : [m.esperaMin])),
        ),
      ),
      positivasMsgsNossas: mediana(positivas.map((m) => m.msgsNossas)),
      demaisMsgsNossas: mediana(demais.map((m) => m.msgsNossas)),
    },
    metricas,
    exemplos,
  };
}

// ------------------------------------------------------------------ documentos
const dataBr = (iso: string | null) =>
  iso
    ? local(iso).toISOString().slice(0, 10).split("-").reverse().join("/")
    : "—";
const aspas = (t: string) => `“${t.replace(/\s*\n\s*/g, " ⏎ ")}”`;

/** O padrão de atendimento em Markdown: descritivo, para a equipe revisar antes de virar regra. */
export function gerarPadraoMd(a: Analise): string {
  const e = a.espera;
  const s = a.estilo;
  const L: string[] = [];
  L.push("# Padrão de atendimento da Soul Cars");
  L.push("");
  L.push(
    `> Gerado automaticamente em ${dataBr(a.geradaEm)} a partir de ${a.conversas} conversas (${dataBr(a.periodo.de)} a ${dataBr(a.periodo.ate)}). **É um retrato de como respondemos hoje, não uma regra aprovada.** A equipe deve revisar, riscar o que não queremos repetir e só então usar como base do agente.`,
  );
  L.push("");
  L.push("## 1. Visão geral");
  L.push("");
  L.push(`- Conversas com mensagem do lead: **${a.conversasComLead}**`);
  L.push(
    `- Sem nenhuma resposta humana nossa: **${a.semResposta}** (${a.semRespostaPct}%)`,
  );
  L.push(
    `- Depois da nossa primeira resposta, o lead voltou a escrever em **${a.leadRespondeuDepoisPct}%** das conversas`,
  );
  L.push(
    `- Mensagens: ${a.mensagensLead} do lead · ${a.mensagensNossas} nossas · ${a.mensagensRobo} do robô do uTalk · ${a.mensagensSemTexto} sem texto (áudio, foto, vídeo…)`,
  );
  L.push(
    `- Conversas com etiqueta de avanço (visita, proposta, venda…): **${a.positivas}**`,
  );
  L.push("");
  L.push("## 2. Tempo de resposta");
  L.push("");
  L.push(
    `Mediana da primeira resposta: **${formatarMinutos(e.medianaMin)}** · 9 de cada 10 respondidas em até **${formatarMinutos(e.p90Min)}**. Até 5 min: ${e.ate5minPct}% · até 30 min: ${e.ate30minPct}% · até 1 h: ${e.ate1hPct}%.`,
  );
  L.push("");
  L.push("| Quando o lead escreveu | Conversas | Mediana |");
  L.push("|---|---|---|");
  for (const f of e.porFaixa)
    L.push(
      `| ${f.faixa} | ${f.conversas} | ${formatarMinutos(f.medianaMin)} |`,
    );
  if (e.porAtendente.length > 0) {
    L.push("");
    L.push("| Atendente | Conversas | Mediana |");
    L.push("|---|---|---|");
    for (const t of e.porAtendente.slice(0, 10))
      L.push(
        `| ${t.atendente} | ${t.conversas} | ${formatarMinutos(t.medianaMin)} |`,
      );
  }
  L.push("");
  L.push("## 3. Como escrevemos");
  L.push("");
  L.push(
    `- Mensagem típica: **${s.medianaPalavras ?? "—"} palavras**; cada resposta costuma ter **${s.mensagensPorResposta ?? "—"} mensagem(ns)** seguidas.`,
  );
  L.push(
    `- Emoji em ${s.comEmojiPct}% das mensagens${s.emojis.length ? ` (mais usados: ${s.emojis.map(([x, n]) => `${x} ${n}`).join(" · ")})` : ""}.`,
  );
  L.push(
    `- Chamamos o lead pelo nome em ${s.usaNomeDoLeadPct}% das mensagens.`,
  );
  L.push(
    `- Tratamento: “você/vc” em ${s.tratamento.voce} mensagens · “senhor/senhora” em ${s.tratamento.senhor} · apelidos (amigo, parceiro…) em ${s.tratamento.informal}.`,
  );
  L.push(
    `- ${s.terminaComPerguntaPct}% das mensagens terminam com uma pergunta.`,
  );
  L.push("");
  if (a.aberturas.length) {
    L.push("### Como abrimos a primeira resposta");
    L.push("");
    for (const x of a.aberturas) L.push(`- ${aspas(x.texto)} (${x.vezes}×)`);
    L.push("");
  }
  if (a.perguntasNossas.length) {
    L.push("### Perguntas que mais fazemos");
    L.push("");
    for (const x of a.perguntasNossas)
      L.push(`- ${aspas(x.texto)} (${x.vezes}×)`);
    L.push("");
  }
  if (a.fechamentos.length) {
    L.push("### Como encerramos");
    L.push("");
    for (const x of a.fechamentos) L.push(`- ${aspas(x.texto)} (${x.vezes}×)`);
    L.push("");
  }
  if (a.frasesRepetidas.length) {
    L.push("### Frases que repetimos (candidatas a respostas prontas)");
    L.push("");
    for (const x of a.frasesRepetidas)
      L.push(`- ${aspas(x.texto)} (${x.vezes}×)`);
    L.push("");
  }
  L.push("## 4. O que os leads perguntam e como respondemos");
  L.push("");
  L.push("| Situação | Conversas | Resposta típica (palavras) |");
  L.push("|---|---|---|");
  for (const x of a.situacoes)
    L.push(
      `| ${ROTULO_SITUACAO[x.situacao]} | ${x.conversas} | ${x.medianaPalavrasResposta ?? "—"} |`,
    );
  L.push("");
  if (a.perguntasDoLead.length) {
    L.push("Perguntas literais mais repetidas dos leads:");
    L.push("");
    for (const x of a.perguntasDoLead)
      L.push(`- ${aspas(x.texto)} (${x.vezes}×)`);
    L.push("");
  }
  const tipicos = exemplosTipicos(a.exemplos, 3);
  for (const x of a.situacoes) {
    const lista = tipicos.get(x.situacao);
    if (!lista?.length) continue;
    L.push(`### ${ROTULO_SITUACAO[x.situacao]}`);
    L.push("");
    for (const ex of lista) {
      L.push(`- Lead: ${aspas(ex.lead)}`);
      L.push(
        `  Nós${ex.positiva ? " (conversa que avançou)" : ""}: ${aspas(ex.resposta)}`,
      );
    }
    L.push("");
  }
  L.push("## 5. Conversas que avançaram × demais");
  L.push("");
  const p = a.positivasVsDemais;
  L.push(
    `Mediana da espera: ${formatarMinutos(p.positivasEsperaMin)} nas que avançaram × ${formatarMinutos(p.demaisEsperaMin)} nas demais. Mensagens nossas por conversa: ${p.positivasMsgsNossas ?? "—"} × ${p.demaisMsgsNossas ?? "—"}. “Avançou” = etiqueta com visita, proposta, venda, financiamento etc.; é uma aproximação.`,
  );
  L.push("");
  L.push("## 6. Rascunho de regras para o futuro agente");
  L.push("");
  L.push("Derivadas dos números acima. **Revisar antes de usar.**");
  L.push("");
  if (e.medianaMin !== null)
    L.push(
      `- Meta de resposta: hoje a mediana é ${formatarMinutos(e.medianaMin)}; o agente deve responder bem antes disso e passar para um vendedor quando o assunto for fechar negócio.`,
    );
  if (s.medianaPalavras !== null)
    L.push(
      `- Mensagens curtas, perto de ${s.medianaPalavras} palavras, em ${s.mensagensPorResposta ?? 1} mensagem(ns) por vez.`,
    );
  L.push(
    s.comEmojiPct >= 30
      ? `- Usar emoji com moderação (nós usamos em ${s.comEmojiPct}%).`
      : `- Pouco ou nenhum emoji (nós usamos em ${s.comEmojiPct}%).`,
  );
  if (a.perguntasNossas[0])
    L.push(
      `- Conduzir a conversa com perguntas, como: ${aspas(a.perguntasNossas[0].texto)}`,
    );
  L.push(
    "- Nunca inventar preço, disponibilidade, condição de financiamento ou avaliação de troca: consultar o estoque do app ou chamar um vendedor.",
  );
  L.push(
    "- Passar para um humano: negociação de valor, avaliação do carro na troca, financiamento aprovado, reclamação, pedido de visita com data.",
  );
  L.push("");
  L.push("## 7. Limites desta análise");
  L.push("");
  L.push("- Áudios, fotos e vídeos não têm texto aqui; só entram na contagem.");
  L.push(
    "- O tempo de resposta mede só a primeira resposta humana depois da primeira mensagem do lead; não considera horário de funcionamento da loja.",
  );
  L.push("- As situações (preço, visita…) vêm de palavras-chave: podem errar.");
  L.push("- “Avançou” depende das etiquetas que a equipe aplica.");
  L.push("");
  return L.join("\n");
}

/** Uma linha JSON por exemplo, anonimizada: base para recuperar respostas parecidas no futuro agente. */
export function gerarExemplosJsonl(exemplos: Exemplo[]): string {
  return (
    exemplos
      .map((e) =>
        JSON.stringify({
          situacao: e.situacao,
          lead: e.lead,
          resposta: e.resposta,
          espera_seg: e.esperaSeg,
          avancou: e.positiva,
        }),
      )
      .join("\n") + (exemplos.length ? "\n" : "")
  );
}

/** Prompt pronto para colar no chat do usuário (sem API paga): refina o padrão com conversas de amostra. */
export function gerarPromptRefino(
  conversas: ConversaLida[],
  a: Analise,
  maxConversas = 12,
  maxCaracteres = 14_000,
): string {
  const ordem = [...conversas]
    .map((c, i) => ({ c, m: a.metricas[i] }))
    .filter(({ m }) => m.msgsLead > 0 && m.msgsNossas > 0)
    .sort(
      (x, y) =>
        Number(y.m.positiva) - Number(x.m.positiva) ||
        y.m.msgsNossas - x.m.msgsNossas,
    );
  const blocos: string[] = [];
  let total = 0;
  for (const { c, m } of ordem) {
    if (blocos.length >= maxConversas) break;
    const linhas = c.mensagens
      .filter((x) => !x.privada && comTexto(x) && x.origem !== "robo")
      .slice(0, 30)
      .map(
        (x) =>
          `${x.origem === "lead" ? "Lead" : "Vendedor"}: ${anonimizar(x.texto!.trim(), c.nome).replace(/\s*\n\s*/g, " ")}`,
      );
    const bloco = `### Conversa ${blocos.length + 1}${m.positiva ? " (avançou)" : ""}\n${linhas.join("\n")}`;
    if (total + bloco.length > maxCaracteres) break;
    blocos.push(bloco);
    total += bloco.length;
  }
  return [
    "Você é consultor de atendimento comercial de uma loja de carros seminovos (Soul Cars).",
    "Abaixo estão (1) um retrato estatístico de como a loja responde leads no WhatsApp e (2) conversas reais anonimizadas.",
    "",
    "Tarefa:",
    "1. Descreva o tom de voz da loja em até 8 regras objetivas (formato, tamanho, tratamento, uso de emoji, como conduz a conversa).",
    "2. Para cada situação (preço, financiamento, troca, visita, fotos, disponibilidade, detalhes do carro), escreva o roteiro ideal em 2 ou 3 passos, usando as frases reais da loja.",
    "3. Aponte erros que a loja comete e não deve ser copiados (demora, resposta seca, pergunta sem seguimento).",
    "4. Liste as situações em que um humano deve assumir.",
    "5. Não invente fatos sobre carros, preços ou condições. Onde faltar dado, escreva [consultar estoque] ou [chamar vendedor].",
    "",
    "## Retrato estatístico",
    gerarPadraoMd(a),
    "",
    "## Conversas de amostra",
    blocos.join("\n\n") || "(sem conversas com resposta nossa ainda)",
    "",
  ].join("\n");
}
