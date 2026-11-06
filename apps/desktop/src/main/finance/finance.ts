/**
 * Finanças: a planilha mensal (uma aba por mês) fica no disco do usuário e é apenas
 * vinculada ao app — o arquivo nunca é copiado nem alterado por aqui. Edições são feitas
 * no Excel (botão "Abrir planilha"); o app relê e mostra totais e vencimentos.
 * O "pago" de cada conta fica no config.json, sem tocar na planilha.
 */
import { shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import * as caminhos from "../core/paths";
import { chamarMotor, type Emitir } from "../studio/engine-bridge";

type Pagos = Record<string, boolean>;

function caminhoVinculado(): string | null {
  const c = caminhos.lerConfig().planilhaFinancas;
  return typeof c === "string" && c ? c : null;
}

export function estadoFinancas() {
  const caminho = caminhoVinculado();
  return {
    caminho,
    nome: caminho ? path.basename(caminho) : null,
    existe: !!caminho && fs.existsSync(caminho),
  };
}

export function vincularFinancas(origem: string) {
  const alvo = path.resolve(origem);
  if (!/\.xlsx$/i.test(alvo)) throw new Error("Escolha um arquivo .xlsx.");
  if (!fs.existsSync(alvo)) throw new Error("Arquivo não encontrado.");
  caminhos.gravarConfig({ planilhaFinancas: alvo });
  return estadoFinancas();
}

export function desvincularFinancas() {
  caminhos.gravarConfig({ planilhaFinancas: "" });
  return estadoFinancas();
}

/** Conteúdo da planilha em base64 (a interface lê as abas) e os "pagos". */
export function lerFinancas() {
  const caminho = caminhoVinculado();
  if (!caminho) throw new Error("Nenhuma planilha vinculada.");
  let dados: Buffer;
  try {
    dados = fs.readFileSync(caminho);
  } catch {
    throw new Error(
      "Não foi possível ler a planilha. Ela está aberta em outro programa ou foi movida?",
    );
  }
  const pagos = (caminhos.lerConfig().financasPagos ?? {}) as Pagos;
  return {
    ...estadoFinancas(),
    modificado: fs.statSync(caminho).mtimeMs / 1000,
    base64: dados.toString("base64"),
    pagos,
  };
}

export function marcarPagos(chaves: string[], pago: boolean) {
  const atual = { ...((caminhos.lerConfig().financasPagos ?? {}) as Pagos) };
  for (const chave of chaves) {
    if (pago) atual[chave] = true;
    else delete atual[chave];
  }
  caminhos.gravarConfig({ financasPagos: atual });
  return atual;
}

/**
 * Grava edições na planilha pelo motor (openpyxl): células, linhas novas, exclusões e totais.
 * `lidoEm` (segundos) é o horário do arquivo na última leitura; se mudou, o motor recusa.
 */
export async function editarFinancas(
  operacoes: unknown,
  lidoEm: unknown,
  emitir: Emitir,
) {
  const caminho = caminhoVinculado();
  if (!caminho) throw new Error("Nenhuma planilha vinculada.");
  try {
    await chamarMotor(
      "planilha_aplicar",
      { caminho, operacoes, lido_em: lidoEm },
      emitir,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/openpyxl/i.test(msg))
      throw new Error(
        "Falta a biblioteca de planilhas do motor. Atualize as bibliotecas do motor (docs/architecture/python-engine.md) e tente de novo.",
        { cause: e },
      );
    throw e;
  }
  return lerFinancas();
}

/** Abre a planilha vinculada no programa padrão (Excel). Só o arquivo vinculado, nunca um caminho da tela. */
export async function abrirFinancas() {
  const caminho = caminhoVinculado();
  if (!caminho || !fs.existsSync(caminho))
    throw new Error("A planilha vinculada não está no lugar. Vincule de novo.");
  const erro = await shell.openPath(caminho);
  if (erro) throw new Error(erro);
  return null;
}
