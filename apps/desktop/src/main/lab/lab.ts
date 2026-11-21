/**
 * Laboratório de testes da IA no processo principal: lista os cenários do corpus, roda lotes com o
 * modelo do app (Groq/Ollama), guarda execuções e avaliações humanas em `<raizDados>/lab-ia/` (fora do
 * git), gera a análise anonimizada do histórico do uTalk e exporta o relatório com as notas.
 * Nunca escreve no uTalk: só consulta o modelo e grava arquivos locais.
 */
import fs from "node:fs";
import path from "node:path";
import { shell } from "electron";
import * as caminhos from "../core/paths";
import { conversasDaMemoria } from "../soul-ai/soul-ai";
import {
  atendimentoLigado,
  auditoriaParaLab,
  contextoDoLab,
} from "../pre-service/pre-service";
import { LIMITE_DIARIO_GROQ, type UsoModelo } from "../pre-service/llm";
import {
  CONJUNTO_RAPIDO,
  categorias,
  cenariosBase,
  corpusCompleto,
} from "../../shared/lab-corpus";
import { cenariosDaAuditoria } from "./audit-scenarios";
import type { Avaliacao, Cenario, EtiquetaErro } from "../../shared/lab";
import { ETIQUETAS_ERRO } from "../../shared/lab";
import { rodarLote, type ResultadoCenario } from "./runner";
import {
  analisarHistorico,
  cenariosDoHistorico,
  relatorioMarkdown,
} from "./history-analysis";

export type Emitir = (nome: string, carga: unknown) => void;

export type Execucao = {
  id: string;
  em: string;
  modelo: string;
  repeticoes: number;
  resultados: ResultadoCenario[];
  /** Tokens gastos no total (quando o provedor informa). */
  tokens?: number;
  /** Por que a execução parou antes do fim (ex.: limite diário do Groq). */
  interrompida?: string;
  /** Quantos cenários foram pedidos (para mostrar "X de Y" quando parou antes). */
  pedidos?: number;
};

const pasta = () => path.join(caminhos.raizDados(), "lab-ia");
const pastaExecucoes = () => path.join(pasta(), "execucoes");
const arquivoAvaliacoes = () => path.join(pasta(), "avaliacoes.jsonl");
const arquivoHistorico = () => path.join(pasta(), "cenarios-historico.json");
const arquivoAuditoria = () => path.join(pasta(), "cenarios-auditoria.json");

/** Espera do Laboratório quando o Groq avisa limite por minuto (o lote é sequencial). */
const ESPERA_LIMITE_MINUTO_MS = 20_000;
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Lê uma lista de cenários gravada pelo Laboratório (vazia se ainda não existe). */
function lerCenarios(arquivo: string): Cenario[] {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as Cenario[];
  } catch {
    return [];
  }
}

let cancelar = false;
let rodando = false;

/** Cenários do corpus (base e variações) mais os do histórico e os de erros reais, se já gerados. */
function todosOsCenarios(): Cenario[] {
  return [
    ...corpusCompleto(),
    ...lerCenarios(arquivoHistorico()),
    ...lerCenarios(arquivoAuditoria()),
  ];
}

/** Lista os cenários e as categorias para a tela. */
export function listarCenarios() {
  const todos = todosOsCenarios();
  return {
    base: cenariosBase().length,
    total: todos.length,
    categorias: categorias(todos),
    cenarios: todos.map((c) => ({
      id: c.id,
      categoria: c.categoria,
      titulo: c.titulo,
      turnos: c.turnos.length,
      origem: c.origem ?? "manual",
    })),
    rapido: CONJUNTO_RAPIDO.filter((id) => todos.some((c) => c.id === id)),
    atendimentoLigado: atendimentoLigado(),
    pasta: pasta(),
  };
}

/** Roda os cenários escolhidos (ids ou categoria) com o modelo do app; avisa o progresso e guarda a execução. */
export async function rodarLab(
  a: { ids?: string[]; categoria?: string; repeticoes?: number },
  emitir: Emitir,
): Promise<Execucao> {
  if (rodando) throw new Error("Já existe uma execução em andamento.");
  rodando = true;
  cancelar = false;
  try {
    let lista = todosOsCenarios();
    if (a.ids?.length) {
      const ids = new Set(a.ids);
      lista = lista.filter((c) => ids.has(c.id));
    } else if (a.categoria)
      lista = lista.filter((c) => c.categoria === a.categoria);
    if (!lista.length) throw new Error("Nenhum cenário selecionado.");
    const ctx = contextoDoLab();
    const repeticoes = Math.min(5, Math.max(1, a.repeticoes ?? 1));
    // Limite por minuto do Groq: no Laboratório vale esperar e tentar de novo (até 3 vezes).
    const gerar = async (
      mensagens: { role: string; content: string }[],
      uso?: UsoModelo,
    ) => {
      for (let tentativa = 0; ; tentativa++) {
        try {
          return await ctx.gerar(mensagens, uso);
        } catch (e) {
          if (!/limite por minuto/.test((e as Error).message) || tentativa >= 3)
            throw e;
          await espera(ESPERA_LIMITE_MINUTO_MS);
        }
      }
    };
    let interrompida: string | undefined;
    const resultados = await rodarLote(
      lista,
      { ...ctx, gerar },
      {
        repeticoes,
        cancelado: () => cancelar,
        pararSe: (r) => {
          if (!r.erro?.includes(LIMITE_DIARIO_GROQ)) return false;
          const msg = r.erro.charAt(0).toUpperCase() + r.erro.slice(1);
          interrompida = `${msg}. Rode o restante depois desse prazo.`;
          return true;
        },
        progresso: (feito, total, r) =>
          emitir("lab:progresso", {
            feito,
            total,
            id: r.id,
            falhas: r.falhas.length,
          }),
      },
    );
    const execucao: Execucao = {
      id: new Date().toISOString().replace(/[:.]/g, "-"),
      em: new Date().toISOString(),
      modelo: ctx.modelo,
      repeticoes,
      resultados,
      tokens: resultados
        .flatMap((r) => r.turnos)
        .reduce((s, t) => s + (t.uso?.tokens ?? 0), 0),
      pedidos: lista.length * repeticoes,
      ...(interrompida
        ? { interrompida }
        : cancelar
          ? { interrompida: "Cancelada pelo usuário." }
          : {}),
    };
    fs.mkdirSync(pastaExecucoes(), { recursive: true });
    fs.writeFileSync(
      path.join(pastaExecucoes(), `${execucao.id}.json`),
      JSON.stringify(execucao),
    );
    return execucao;
  } finally {
    rodando = false;
  }
}

/** Para a execução depois do cenário atual. */
export function cancelarLab() {
  cancelar = true;
  return true;
}

/** Lê uma execução guardada (o id só pode ter letras, números, hífen). */
export function lerExecucao(id: string): Execucao {
  if (!/^[\w-]+$/.test(id)) throw new Error("Execução inválida.");
  return JSON.parse(
    fs.readFileSync(path.join(pastaExecucoes(), `${id}.json`), "utf8"),
  ) as Execucao;
}

/** Execuções anteriores (mais nova primeiro), só o resumo. */
export function listarExecucoes() {
  try {
    return fs
      .readdirSync(pastaExecucoes())
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 50)
      .map((f) => {
        const e = lerExecucao(f.replace(/\.json$/, ""));
        return {
          id: e.id,
          em: e.em,
          modelo: e.modelo,
          cenarios: e.resultados.length,
          comFalhas: e.resultados.filter((r) => r.falhas.length).length,
          tokens: e.tokens ?? 0,
          chamadas: e.resultados
            .flatMap((r) => r.turnos)
            .filter((t) => t.uso?.tokens).length,
          interrompida: e.interrompida,
        };
      });
  } catch {
    return [];
  }
}

/** Guarda a avaliação humana de uma resposta (uma linha por avaliação, só acrescenta). */
export function salvarAvaliacao(a: {
  execucaoId: string;
  cenarioId: string;
  repeticao: number;
  turno: number;
  nota: number;
  etiquetas: string[];
  comentario: string;
}) {
  if (!/^[\w-]+$/.test(a.execucaoId)) throw new Error("Execução inválida.");
  if (a.nota < 1 || a.nota > 5) throw new Error("A nota vai de 1 a 5.");
  const etiquetas = a.etiquetas.filter((e): e is EtiquetaErro =>
    (ETIQUETAS_ERRO as readonly string[]).includes(e),
  );
  const av: Avaliacao = {
    execucaoId: a.execucaoId,
    cenarioId: a.cenarioId,
    repeticao: a.repeticao,
    turno: a.turno,
    nota: a.nota as Avaliacao["nota"],
    etiquetas,
    comentario: a.comentario.slice(0, 1000),
    em: new Date().toISOString(),
  };
  fs.mkdirSync(pasta(), { recursive: true });
  fs.appendFileSync(arquivoAvaliacoes(), JSON.stringify(av) + "\n");
  return av;
}

/** Todas as avaliações; a mais recente de cada (execução, cenário, repetição, turno) vale. */
export function listarAvaliacoes(execucaoId?: string): Avaliacao[] {
  let linhas: string[];
  try {
    linhas = fs.readFileSync(arquivoAvaliacoes(), "utf8").split("\n");
  } catch {
    return [];
  }
  const mapa = new Map<string, Avaliacao>();
  for (const l of linhas) {
    if (!l.trim()) continue;
    try {
      const a = JSON.parse(l) as Avaliacao;
      if (execucaoId && a.execucaoId !== execucaoId) continue;
      mapa.set(`${a.execucaoId}|${a.cenarioId}|${a.repeticao}|${a.turno}`, a);
    } catch {
      /* linha corrompida: ignora */
    }
  }
  return [...mapa.values()];
}

/** Relatório em Markdown de uma execução com as notas, pronto para colar no chat. */
export function relatorioDaExecucao(execucaoId: string): string {
  const e = lerExecucao(execucaoId);
  const notas = new Map(
    listarAvaliacoes(execucaoId).map((a) => [
      `${a.cenarioId}|${a.repeticao}|${a.turno}`,
      a,
    ]),
  );
  const linhas = [
    `# Relatório do Laboratório — ${e.em}`,
    "",
    `Modelo: ${e.modelo} · cenários: ${e.resultados.length} · com falha automática: ${e.resultados.filter((r) => r.falhas.length).length}`,
    "",
  ];
  for (const r of e.resultados) {
    const avaliado = r.turnos.some((_, i) =>
      notas.has(`${r.id}|${r.repeticao}|${i}`),
    );
    if (!r.falhas.length && !avaliado) continue;
    linhas.push(`## ${r.id} — ${r.titulo}`, "");
    if (r.falhas.length) linhas.push(...r.falhas.map((f) => `- ⚠ ${f}`), "");
    r.turnos.forEach((t, i) => {
      linhas.push(
        `**Cliente:** ${t.cliente}`,
        `**IA:** ${t.texto || "(vazio)"}`,
      );
      const n = notas.get(`${r.id}|${r.repeticao}|${i}`);
      if (t.sinais.length) linhas.push(`Alertas: ${t.sinais.join(", ")}`);
      if (n)
        linhas.push(
          `Nota: ${n.nota}/5${n.etiquetas.length ? ` [${n.etiquetas.join(", ")}]` : ""}${n.comentario ? ` — ${n.comentario}` : ""}`,
        );
      linhas.push("");
    });
  }
  const texto = linhas.join("\n");
  fs.mkdirSync(pasta(), { recursive: true });
  fs.writeFileSync(path.join(pasta(), `relatorio-${execucaoId}.md`), texto);
  return texto;
}

/** Analisa a memória do uTalk (já sincronizada) e grava o relatório anonimizado e os cenários. */
export function analisarHistoricoLab() {
  const conversas = conversasDaMemoria();
  if (!conversas.length)
    throw new Error(
      "A memória do uTalk está vazia. Clique em Sincronizar histórico primeiro.",
    );
  const analise = analisarHistorico(conversas);
  fs.mkdirSync(pasta(), { recursive: true });
  fs.writeFileSync(
    path.join(pasta(), "analise-historico.json"),
    JSON.stringify(analise, null, 2),
  );
  fs.writeFileSync(
    path.join(pasta(), "analise-historico.md"),
    relatorioMarkdown(analise),
  );
  fs.writeFileSync(
    arquivoHistorico(),
    JSON.stringify(cenariosDoHistorico(analise)),
  );
  return { analise, pasta: pasta() };
}

/**
 * Transforma os erros reais da auditoria do atendimento (turnos com sinal) em cenários anonimizados
 * da categoria "auditoria" e grava em `<raizDados>/lab-ia/cenarios-auditoria.json` (fora do git).
 */
export function gerarCenariosDaAuditoria() {
  const { turnos, historicos } = auditoriaParaLab();
  const cenarios = cenariosDaAuditoria(turnos, historicos);
  fs.mkdirSync(pasta(), { recursive: true });
  fs.writeFileSync(arquivoAuditoria(), JSON.stringify(cenarios));
  return { cenarios: cenarios.length, turnosLidos: turnos.length };
}

/** Abre a pasta do laboratório no Explorer. */
export async function abrirPastaLab() {
  fs.mkdirSync(pasta(), { recursive: true });
  await shell.openPath(pasta());
  return true;
}
