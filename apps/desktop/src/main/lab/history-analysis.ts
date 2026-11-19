/**
 * Análise de contexto do histórico completo do uTalk (sem Electron, só funções puras): recebe as
 * conversas lidas da memória (`soul-ia.db`) e devolve estatísticas ANONIMIZADAS — perguntas mais
 * frequentes dos clientes, respostas repetidas, repetição em sequência, dados que o cliente já deu e
 * foram pedidos de novo. Nenhum texto sai sem passar por `mascararConversa` (CPF, datas, telefone,
 * e-mail e nomes próprios do contato) e frases raras (que podem identificar alguém) são descartadas.
 */
import { mascararConversa } from "../../shared/lead-profile";
import { similaridade, tokens } from "../../shared/pre-service-guard";
import { perguntouCampo, type Campo } from "../../shared/lead-profile";
import type { ConversaLida } from "../soul-ai/memory";

/** Um item de ranking: o texto (anonimizado) e quantas vezes apareceu. */
export type ItemFrequente = { texto: string; vezes: number };

export type AnaliseHistorico = {
  geradoEm: string;
  conversas: number;
  mensagens: number;
  /** Mensagens do cliente (lead) e das respostas (vendedor, robô ou externo). */
  doCliente: number;
  daEmpresa: number;
  perguntasFrequentes: ItemFrequente[];
  respostasRepetidas: ItemFrequente[];
  /** Conversas em que a empresa mandou duas respostas quase iguais seguidas. */
  conversasComRepeticao: number;
  repeticoesSeguidas: number;
  /** Vezes em que a empresa pediu de novo um dado que o cliente já tinha dado. */
  dadosPedidosDeNovo: Partial<Record<Campo, number>>;
  /** Mensagens do cliente muito curtas ou vazias (ok, emoji, mídia). */
  mensagensCurtas: number;
  /** Tempo mediano entre a mensagem do cliente e a primeira resposta (minutos), ou null. */
  respostaMedianaMin: number | null;
};

const CAMPOS: Campo[] = [
  "veiculo",
  "regiao",
  "pagamento",
  "troca",
  "cpf",
  "nascimento",
  "cnh",
  "entrada",
  "horario",
];

/** Tira o que identifica uma pessoa: CPF, datas, telefone, e-mail, links e números longos. */
export function anonimizar(texto: string): string {
  const base = mascararConversa([{ role: "user", content: texto }])[0].content;
  return base
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[e-mail]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g, "[telefone]")
    .replace(/\d{6,}/g, "[número]")
    .replace(/\s+/g, " ")
    .trim();
}

/** Agrupa textos parecidos (Jaccard ≥ 0,7) e conta; devolve só os que aparecem `minimo` vezes ou mais. */
export function agrupar(
  textos: string[],
  minimo: number,
  limite: number,
): ItemFrequente[] {
  const grupos: { texto: string; vezes: number; tk: number }[] = [];
  for (const t of textos) {
    if (tokens(t).length < 2) continue;
    const g = grupos.find((x) => similaridade(x.texto, t) >= 0.7);
    if (g) g.vezes++;
    else grupos.push({ texto: t, vezes: 1, tk: tokens(t).length });
  }
  return grupos
    .filter((g) => g.vezes >= minimo)
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, limite)
    .map(({ texto, vezes }) => ({ texto, vezes }));
}

const mediana = (n: number[]) => {
  if (!n.length) return null;
  const o = [...n].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
};

/**
 * Analisa as conversas. `minimo` é o número mínimo de ocorrências para um texto aparecer no relatório
 * (protege privacidade: frases ditas uma ou duas vezes não saem).
 */
export function analisarHistorico(
  conversas: ConversaLida[],
  opcoes: { agora?: Date; minimo?: number } = {},
): AnaliseHistorico {
  const minimo = opcoes.minimo ?? 3;
  const perguntas: string[] = [];
  const respostas: string[] = [];
  const dados: Partial<Record<Campo, number>> = {};
  let mensagens = 0;
  let doCliente = 0;
  let daEmpresa = 0;
  let curtas = 0;
  let comRepeticao = 0;
  let seguidas = 0;
  const esperas: number[] = [];

  for (const c of conversas) {
    const msgs = c.mensagens.filter((m) => !m.privada && m.texto?.trim());
    mensagens += msgs.length;
    let repetiu = false;
    let ultimaEmpresa: string | null = null;
    let aguardandoDesde: number | null = null;
    const jaDeu = new Set<Campo>();
    for (const m of msgs) {
      const texto = anonimizar(m.texto ?? "");
      const em = Date.parse(m.em);
      if (m.origem === "lead") {
        doCliente++;
        if (texto.length < 3) curtas++;
        for (const campo of CAMPOS) if (cliente(texto, campo)) jaDeu.add(campo);
        if (texto.includes("?")) perguntas.push(texto);
        if (aguardandoDesde === null && Number.isFinite(em))
          aguardandoDesde = em;
      } else {
        daEmpresa++;
        respostas.push(texto);
        if (aguardandoDesde !== null && Number.isFinite(em)) {
          esperas.push((em - aguardandoDesde) / 60000);
          aguardandoDesde = null;
        }
        if (ultimaEmpresa && similaridade(ultimaEmpresa, texto) >= 0.85) {
          seguidas++;
          repetiu = true;
        }
        ultimaEmpresa = texto;
        for (const campo of jaDeu)
          if (
            texto.includes("?") &&
            perguntouCampo(
              texto
                .split(/(?<=[.!?])\s+|\n+/)
                .filter((s) => s.includes("?"))
                .join(" "),
              campo,
            )
          )
            dados[campo] = (dados[campo] ?? 0) + 1;
      }
    }
    if (repetiu) comRepeticao++;
  }

  return {
    geradoEm: (opcoes.agora ?? new Date()).toISOString(),
    conversas: conversas.length,
    mensagens,
    doCliente,
    daEmpresa,
    perguntasFrequentes: agrupar(perguntas, minimo, 60),
    respostasRepetidas: agrupar(respostas, minimo, 40),
    conversasComRepeticao: comRepeticao,
    repeticoesSeguidas: seguidas,
    dadosPedidosDeNovo: dados,
    mensagensCurtas: curtas,
    respostaMedianaMin: mediana(esperas),
  };
}

/** O cliente deu este dado nesta mensagem? (heurística simples, só para estatística) */
function cliente(texto: string, campo: Campo): boolean {
  switch (campo) {
    case "cpf":
      return /\[cpf\]|\bcpf\b/i.test(texto);
    case "nascimento":
      return /\[data\]|nasc/i.test(texto);
    case "regiao":
      return /\b(moro|sou de|resido)\b/i.test(texto);
    case "pagamento":
      return /\b(vista|financ|cartao|cartão|consorcio|consórcio)\b/i.test(
        texto,
      );
    case "entrada":
      return /\bentrada\b/i.test(texto);
    case "troca":
      return /\btroca\b/i.test(texto);
    case "cnh":
      return /\bcnh\b/i.test(texto);
    default:
      return false;
  }
}

/** Relatório em Markdown (anonimizado) para o usuário ler e para virar cenários do corpus. */
export function relatorioMarkdown(a: AnaliseHistorico): string {
  const lista = (itens: ItemFrequente[]) =>
    itens.length
      ? itens.map((i) => `- (${i.vezes}x) ${i.texto}`).join("\n")
      : "_Nada se repete o suficiente para aparecer (mínimo de ocorrências por privacidade)._";
  return [
    "# Análise do histórico do uTalk",
    "",
    `Gerado em ${a.geradoEm}. Textos anonimizados (CPF, datas, telefones, e-mails e links removidos).`,
    "",
    `- Conversas: **${a.conversas}** · Mensagens: **${a.mensagens}** (cliente ${a.doCliente}, empresa ${a.daEmpresa})`,
    `- Mensagens curtas/vazias do cliente: ${a.mensagensCurtas}`,
    `- Resposta mediana: ${a.respostaMedianaMin === null ? "—" : a.respostaMedianaMin.toFixed(1) + " min"}`,
    `- Conversas com resposta repetida em sequência: **${a.conversasComRepeticao}** (${a.repeticoesSeguidas} repetições)`,
    `- Dados pedidos de novo depois de informados: ${
      Object.entries(a.dadosPedidosDeNovo)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "nenhum"
    }`,
    "",
    "## Perguntas mais frequentes dos clientes",
    lista(a.perguntasFrequentes),
    "",
    "## Respostas da empresa que mais se repetem",
    lista(a.respostasRepetidas),
    "",
  ].join("\n");
}

/** Transforma as perguntas frequentes em cenários do corpus (origem "historico"). */
export function cenariosDoHistorico(a: AnaliseHistorico) {
  return a.perguntasFrequentes.map((p, i) => ({
    id: `historico-${String(i + 1).padStart(3, "0")}`,
    categoria: "historico",
    titulo: p.texto,
    turnos: [p.texto],
    origem: "historico" as const,
  }));
}
