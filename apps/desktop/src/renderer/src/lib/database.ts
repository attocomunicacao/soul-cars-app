/**
 * Acesso ao banco do Studio pela interface: cada função chama um comando `db_*` do IPC
 * (o SQL fica em `main/studio/repository.ts`). Tipos Veiculo, Loja e configuração.
 */
import { invoke } from "./desktop-bridge";
import { EDITAVEIS } from "../../../shared/vehicle";
import { idEstoque } from "./inventory-parse";
import type { Loja } from "./description-generator";

export type Status = "rascunho" | "criativos" | "publicado";

export type Veiculo = {
  id: number;
  estoque_id: number | null;
  nome: string;
  ano: string | null;
  versao: string | null;
  cambio: string | null;
  combustivel: string | null;
  preco: number | null;
  km: number | null;
  placa: string | null;
  status: Status;
  marca_modelo: string | null;
  cor: string | null;
  renavam: string | null;
  chassi: string | null;
  configuracao: string | null;
  lugares: string | null;
  portas: string | null;
  direcao: string | null;
  seguranca: string | null;
  conforto: string | null;
  infotenimento: string | null;
  des_md: string | null;
  des_base: string | null;
  des_ia: string | null;
  pasta: string | null;
  ajustes: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type NovoVeiculo = Pick<Veiculo, "nome"> &
  Partial<
    Pick<Veiculo, "ano" | "versao" | "cambio" | "preco" | "km" | "placa">
  >;

export { EDITAVEIS };
// Garante que a lista compartilhada só tem colunas que existem em Veiculo.
EDITAVEIS satisfies readonly (keyof Veiculo)[];
export type Editavel = (typeof EDITAVEIS)[number];

// O banco vive no processo principal: aqui só se pedem operações nomeadas (db_*).

function comIdEstoque(v: Veiculo): Veiculo {
  return { ...v, estoque_id: idEstoque(v.pasta?.split(/[\\/]/).pop() ?? "") };
}

export async function listarVeiculos(busca = ""): Promise<Veiculo[]> {
  const rows = await invoke<Veiculo[]>("db_veiculos_listar", { busca });
  return rows
    .map(comIdEstoque)
    .sort((a, b) => (b.estoque_id ?? 0) - (a.estoque_id ?? 0));
}

export async function obterVeiculo(id: number): Promise<Veiculo | null> {
  const v = await invoke<Veiculo | null>("db_veiculo_obter", { id });
  return v ? comIdEstoque(v) : null;
}

export function criarVeiculo(v: NovoVeiculo): Promise<number> {
  return invoke<number>("db_veiculo_criar", { veiculo: v });
}

export async function atualizarVeiculo(
  id: number,
  patch: Partial<Pick<Veiculo, Editavel>>,
): Promise<void> {
  if (!EDITAVEIS.some((c) => c in patch)) return;
  await invoke("db_veiculo_atualizar", { id, patch });
}

export type Anuncio = {
  id: number;
  veiculo_id: number;
  estoque_id: number | null;
  modelo: string;
  campanha: string;
  criado_dia: string;
  pausado_dia: string | null;
  registrado: string;
};

/** Anúncios registrados (mais recentes primeiro); `veiculoId` filtra por veículo. */
export function listarAnuncios(veiculoId?: number): Promise<Anuncio[]> {
  return invoke<Anuncio[]>("db_anuncios_listar", { veiculoId });
}

export function registrarAnuncio(anuncio: {
  veiculo_id: number;
  estoque_id: number | null;
  modelo: string;
  campanha: string;
  criado_dia: string;
}): Promise<number> {
  return invoke<number>("db_anuncio_registrar", { anuncio });
}

export async function marcarAnuncioPausado(id: number, dia: string) {
  await invoke("db_anuncio_pausar", { id, dia });
}

export async function removerAnuncio(id: number) {
  await invoke("db_anuncio_remover", { id });
}

export function obterConfig(chave: string): Promise<string | null> {
  return invoke<string | null>("db_config_obter", { chave });
}

export async function salvarConfig(
  chave: string,
  valor: string | null,
): Promise<void> {
  await invoke("db_config_salvar", { chave, valor });
}

export type RelatorioSalvo = {
  id: number;
  tipo: string;
  arquivo: string;
  inicio: string;
  fim: string;
  dados: string;
  criado_em: string;
};

export function salvarRelatorio(
  tipo: string,
  arquivo: string,
  inicio: string,
  fim: string,
  dados: unknown,
): Promise<number> {
  return invoke<number>("db_relatorio_salvar", {
    relatorio: { tipo, arquivo, inicio, fim, dados: JSON.stringify(dados) },
  });
}

export function listarRelatorios(limite = 50): Promise<RelatorioSalvo[]> {
  return invoke<RelatorioSalvo[]>("db_relatorios_listar", { limite });
}

export async function excluirRelatorio(id: number) {
  await invoke("db_relatorio_excluir", { id });
}

export function obterLoja(): Promise<Loja> {
  return invoke<Loja>("db_loja_obter");
}

export async function salvarLoja(loja: Loja): Promise<void> {
  await invoke("db_loja_salvar", { loja });
}

// ---- Saúde do banco ----
/**
 * Confere o banco e guarda um backup do dia (feito no processo principal).
 * Devolve o aviso quando o banco está corrompido (o app mostra na tela).
 */
export function manutencaoBanco(): Promise<{
  ok: boolean;
  detalhe: string;
  backup: string | null;
}> {
  return invoke("db_manutencao");
}
