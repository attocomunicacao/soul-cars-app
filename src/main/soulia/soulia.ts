/**
 * Soul IA no processo principal: junta o token do uTalk, o banco da memória e as pastas de saída.
 * O banco é separado do soul.db (`soul-ia.db`). As saídas (planilha, padrão de atendimento, exemplos
 * e prompt) ficam em `<pasta de dados da loja>/soul-ia`, fora do Git.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { shell } from "electron";
import * as caminhos from "../caminhos";
import { chamarMotor, type Emitir } from "../studio/motor";
import { tokenUtalk } from "../utalk";
import type { Buscar } from "../utalk-api";
import {
  analisar,
  gerarExemplosJsonl,
  gerarPadraoMd,
  gerarPromptRefino,
  type Analise,
} from "./analise";
import {
  esquecerTudo,
  lerConversas,
  lerEventos,
  migrarMemoria,
  resumoDaMemoria,
} from "./memoria";
import { calcularDesempenho } from "./desempenho";
import { montarAbas, paraCsv } from "./planilha";
import { sincronizar } from "./sincronizar";

let conexao: DatabaseSync | null = null;
let controle: { cancelar: boolean } | null = null;

const arquivoBanco = () => path.join(caminhos.userData(), "soul-ia.db");
export const pastaSaida = () => path.join(caminhos.raizDados(), "soul-ia");

function banco(): DatabaseSync {
  if (conexao) return conexao;
  fs.mkdirSync(caminhos.userData(), { recursive: true });
  const db = new DatabaseSync(arquivoBanco());
  db.exec("PRAGMA journal_mode = WAL");
  migrarMemoria(db);
  conexao = db;
  return db;
}

export function fecharMemoria() {
  conexao?.close();
  conexao = null;
}

export function estadoSouliaIa() {
  return {
    sincronizando: controle !== null,
    pasta: pastaSaida(),
    memoria: resumoDaMemoria(banco()),
  };
}

export async function sincronizarSouliaIa(
  a: { limite?: number },
  emitir: Emitir,
) {
  if (controle) throw new Error("Já existe uma sincronização em andamento.");
  const token = tokenUtalk();
  if (!token)
    throw new Error("Cadastre o token do uTalk na aba 02 · CRM primeiro.");
  const estado = { cancelar: false };
  controle = estado;
  try {
    const r = await sincronizar(banco(), fetch as Buscar, token, {
      limite: a.limite,
      cancelado: () => estado.cancelar,
      aoProgresso: (p) => emitir("soulia:progresso", p),
    });
    return { ...r, ...estadoSouliaIa() };
  } finally {
    controle = null;
  }
}

let cacheDesempenho: { chave: string; valor: unknown } | null = null;

/** Painel de desempenho a partir da memória; guarda o resultado até a memória mudar. */
export function desempenhoSouliaIa() {
  const db = banco();
  const r = resumoDaMemoria(db);
  const chave = `${r.conversas}|${r.mensagens}|${r.ultimaSincronizacao}|${new Date().toISOString().slice(0, 10)}`;
  if (cacheDesempenho?.chave === chave) return cacheDesempenho.valor;
  const conversas = lerConversas(db);
  const valor =
    conversas.length === 0 ? null : calcularDesempenho(analisar(conversas));
  cacheDesempenho = { chave, valor };
  return valor;
}

export function cancelarSouliaIa() {
  if (controle) controle.cancelar = true;
  return true;
}

export function esquecerSouliaIa() {
  if (controle) throw new Error("Espere a sincronização terminar ou cancele.");
  esquecerTudo(banco());
  return estadoSouliaIa();
}

function gravar(nome: string, conteudo: string) {
  const pasta = pastaSaida();
  fs.mkdirSync(pasta, { recursive: true });
  const alvo = path.join(pasta, nome);
  fs.writeFileSync(alvo, conteudo, "utf8");
  return alvo;
}

function resumirAnalise(a: Analise) {
  return {
    conversas: a.conversas,
    semRespostaPct: a.semRespostaPct,
    medianaEsperaMin: a.espera.medianaMin,
    p90EsperaMin: a.espera.p90Min,
    ate5minPct: a.espera.ate5minPct,
    medianaPalavras: a.estilo.medianaPalavras,
    comEmojiPct: a.estilo.comEmojiPct,
    exemplos: a.exemplos.length,
    positivas: a.positivas,
  };
}

/** Gera planilha (.xlsx se o motor existir, sempre CSV), padrão de atendimento, exemplos e prompt. */
export async function exportarSouliaIa(emitir: Emitir) {
  const db = banco();
  const conversas = lerConversas(db);
  if (conversas.length === 0)
    throw new Error("A memória está vazia. Sincronize com o uTalk primeiro.");
  const a = analisar(conversas);
  const abas = montarAbas(conversas, lerEventos(db), a);
  const padrao = gerarPadraoMd(a);

  const arquivos: string[] = [];
  for (const aba of abas)
    arquivos.push(
      gravar(
        `${aba.nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")}.csv`,
        paraCsv(aba),
      ),
    );
  arquivos.push(gravar("padrao-de-atendimento.md", padrao));
  arquivos.push(gravar("exemplos.jsonl", gerarExemplosJsonl(a.exemplos)));
  arquivos.push(
    gravar("prompt-refinar-padrao.md", gerarPromptRefino(conversas, a)),
  );

  let xlsx: string | null = null;
  let avisoXlsx: string | null = null;
  const temporario = path.join(os.tmpdir(), `soulia-${Date.now()}.json`);
  try {
    fs.writeFileSync(temporario, JSON.stringify({ abas }), "utf8");
    const saida = path.join(pastaSaida(), "memoria-soul-ia.xlsx");
    await chamarMotor(
      "soulia_planilha",
      { entrada: temporario, saida },
      emitir,
    );
    xlsx = saida;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    avisoXlsx = /openpyxl/i.test(msg)
      ? "Faltam as bibliotecas de planilha do motor; gerei só os arquivos CSV (o Excel abre direto)."
      : `Não consegui gerar o .xlsx (${msg}); gerei só os arquivos CSV.`;
  } finally {
    fs.rmSync(temporario, { force: true });
  }
  return {
    pasta: pastaSaida(),
    xlsx,
    avisoXlsx,
    arquivos: arquivos.map((x) => path.basename(x)),
    analise: resumirAnalise(a),
    padrao,
  };
}

export async function abrirPastaSouliaIa() {
  const pasta = pastaSaida();
  fs.mkdirSync(pasta, { recursive: true });
  const erro = await shell.openPath(pasta);
  if (erro) throw new Error(erro);
  return null;
}
