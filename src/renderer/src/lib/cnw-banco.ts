import { obterConfig, salvarConfig, type Veiculo } from "./db";
import { buscarWeb, fichaWeb, type BuscaWeb, type FichaWeb } from "./engine";

/**
 * Banco local de fichas da consulta na web (qualquer fonte).
 *
 * Tudo o que já foi lido do site fica guardado no banco do app (tabela config). Na próxima vez
 * que o mesmo modelo/ano ou a mesma versão for pedido, a resposta vem daqui: não depende do
 * site estar no ar e não gera consulta nova (que poderia causar bloqueio).
 */

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const anoDe = (ano?: string | null) =>
  /(?<!\d)((?:19|20)\d{2})(?!\d)/.exec(ano ?? "")?.[1] ?? "";

const chaveBusca = (nome: string, ano?: string | null) =>
  `web_busca:${normalizar(nome)}|${anoDe(ano)}`;
const chaveFicha = (codigo: string) => `web_ficha:${codigo}`;

async function lerBanco<T>(chave: string): Promise<T | null> {
  try {
    const bruto = await obterConfig(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null; // banco ilegível: segue para o site, sem travar
  }
}

async function gravarBanco(chave: string, valor: unknown) {
  try {
    await salvarConfig(chave, JSON.stringify(valor));
  } catch {
    // guardar é um extra: falhar aqui não pode atrapalhar o resultado
  }
}

export type Origem = "banco" | "site";

/** Versões do modelo/ano: primeiro o banco local; só então o site (e guarda o que vier). */
export async function buscarCnwComBanco(
  nome: string,
  ano?: string | null,
): Promise<{ busca: BuscaWeb; origem: Origem }> {
  const chave = chaveBusca(nome, ano);
  const guardada = await lerBanco<BuscaWeb>(chave);
  if (guardada?.versoes?.length) return { busca: guardada, origem: "banco" };
  const busca = await buscarWeb(nome, ano);
  await gravarBanco(chave, busca);
  return { busca, origem: "site" };
}

/** Ficha de uma versão: primeiro o banco local; só então o site (e guarda o que vier). */
export async function fichaCnwComBanco(
  codigo: string,
): Promise<{ ficha: FichaWeb; origem: Origem }> {
  const chave = chaveFicha(codigo);
  const guardada = await lerBanco<FichaWeb>(chave);
  if (guardada?.tecnicos) return { ficha: guardada, origem: "banco" };
  const ficha = await fichaWeb(codigo);
  await gravarBanco(chave, ficha);
  return { ficha, origem: "site" };
}

/** Guarda também uma ficha tirada de outra via (ex.: escolhida depois de colar), para reuso. */
export const guardarFichaCnw = (codigo: string, ficha: FichaWeb) =>
  gravarBanco(chaveFicha(codigo), ficha);

/** Campos da ficha que só um catálogo ou a pessoa preenchem. */
export const CAMPOS_A_CONFIRMAR: [keyof Veiculo, string][] = [
  ["versao", "Motor / versão"],
  ["km", "Quilometragem"],
  ["cambio", "Câmbio"],
  ["configuracao", "Configuração"],
  ["lugares", "Lugares"],
  ["portas", "Portas"],
  ["direcao", "Direção"],
  ["seguranca", "Segurança"],
  ["conforto", "Conforto"],
  ["infotenimento", "Infotenimento"],
];

const preenchido = (v: unknown) =>
  v != null && String(v).trim() !== "" && v !== 0;

/** Resumo do que veio de cada lugar e do que ainda precisa ser conferido. */
export function origemDaFicha(v: Veiculo) {
  const lista = (campos: [keyof Veiculo, string][]) =>
    campos.filter(([k]) => preenchido(v[k])).map(([, rotulo]) => rotulo);
  return {
    crlv: lista([
      ["marca_modelo", "Marca / modelo CRLV"],
      ["placa", "Placa"],
      ["ano", "Ano"],
      ["combustivel", "Combustível"],
      ["cor", "Cor"],
      ["renavam", "Renavam"],
      ["chassi", "Chassi"],
    ]),
    bndv: lista([
      ["nome", "Nome comercial"],
      ["preco", "Preço"],
    ]),
    confirmar: CAMPOS_A_CONFIRMAR.filter(([k]) => !preenchido(v[k])).map(
      ([, rotulo]) => rotulo,
    ),
  };
}

/**
 * Motor / versão a partir do título da versão escolhida: tira o que vem antes do modelo
 * ("Mercedes-Benz GLA 250 Sport 2.0" -> "Sport 2.0"). Sem o modelo no título, devolve o título todo.
 */
export function versaoDoTitulo(titulo: string, modelo: string): string {
  const limpo = titulo.replace(/\s+/g, " ").trim();
  const alvo = modelo.replace(/\s+/g, " ").trim().toLowerCase();
  const i = alvo ? limpo.toLowerCase().indexOf(alvo) : -1;
  const resto = i >= 0 ? limpo.slice(i + alvo.length).trim() : limpo;
  return resto || limpo;
}
