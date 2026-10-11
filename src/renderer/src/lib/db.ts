import Database from "./desktop";
import { invoke } from "./desktop";
import { idEstoque } from "./estoque-parse";
import type { Loja } from "./des";

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

/** Colunas que a interface pode alterar (lista fechada: evita SQL com nomes arbitrários). */
export const EDITAVEIS = [
  "nome",
  "ano",
  "versao",
  "cambio",
  "combustivel",
  "preco",
  "km",
  "placa",
  "status",
  "marca_modelo",
  "cor",
  "renavam",
  "chassi",
  "configuracao",
  "lugares",
  "portas",
  "direcao",
  "seguranca",
  "conforto",
  "infotenimento",
  "des_md",
  "des_base",
  "des_ia",
  "pasta",
  "ajustes",
] as const satisfies readonly (keyof Veiculo)[];
export type Editavel = (typeof EDITAVEIS)[number];

let connection: Promise<Database> | null = null;
const db = () => (connection ??= Database.load("sqlite:soul.db"));

export async function listarVeiculos(busca = ""): Promise<Veiculo[]> {
  const termo = `%${busca.trim()}%`;
  const rows = await (
    await db()
  ).select<Veiculo[]>(
    `SELECT * FROM veiculos
     WHERE nome LIKE $1 OR IFNULL(versao, '') LIKE $1 OR IFNULL(placa, '') LIKE $1 OR IFNULL(marca_modelo, '') LIKE $1 OR IFNULL(pasta, '') LIKE $1
     ORDER BY atualizado_em DESC`,
    [termo],
  );
  return rows
    .map(comIdEstoque)
    .sort((a, b) => (b.estoque_id ?? 0) - (a.estoque_id ?? 0));
}

function comIdEstoque(v: Veiculo): Veiculo {
  return { ...v, estoque_id: idEstoque(v.pasta?.split(/[\\/]/).pop() ?? "") };
}

export async function obterVeiculo(id: number): Promise<Veiculo | null> {
  const rows = await (
    await db()
  ).select<Veiculo[]>(`SELECT * FROM veiculos WHERE id = $1`, [id]);
  return rows[0] ? comIdEstoque(rows[0]) : null;
}

export async function criarVeiculo(v: NovoVeiculo): Promise<number> {
  const result = await (
    await db()
  ).execute(
    `INSERT INTO veiculos (nome, ano, versao, cambio, preco, km, placa) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      v.nome.trim(),
      v.ano ?? null,
      v.versao ?? null,
      v.cambio ?? null,
      v.preco ?? null,
      v.km ?? null,
      v.placa?.trim().toUpperCase() || null,
    ],
  );
  return Number(result.lastInsertId);
}

export async function atualizarVeiculo(
  id: number,
  patch: Partial<Pick<Veiculo, Editavel>>,
): Promise<void> {
  const cols = EDITAVEIS.filter((c) => c in patch);
  if (!cols.length) return;
  const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  await (
    await db()
  ).execute(
    `UPDATE veiculos SET ${sets}, atualizado_em = datetime('now', 'localtime') WHERE id = $${cols.length + 1}`,
    [...cols.map((c) => patch[c] ?? null), id],
  );
}

export async function excluirVeiculo(id: number): Promise<void> {
  await (await db()).execute(`DELETE FROM veiculos WHERE id = $1`, [id]);
}

export async function resumo() {
  const [row] = await (
    await db()
  ).select<
    { total: number; rascunho: number; criativos: number; publicado: number }[]
  >(
    `SELECT COUNT(*) AS total,
            SUM(status = 'rascunho')  AS rascunho,
            SUM(status = 'criativos') AS criativos,
            SUM(status = 'publicado') AS publicado
     FROM veiculos`,
  );
  return {
    total: row?.total ?? 0,
    rascunho: row?.rascunho ?? 0,
    criativos: row?.criativos ?? 0,
    publicado: row?.publicado ?? 0,
  };
}

export async function obterConfig(chave: string): Promise<string | null> {
  const rows = await (
    await db()
  ).select<{ valor: string }[]>(`SELECT valor FROM config WHERE chave = $1`, [
    chave,
  ]);
  return rows[0]?.valor ?? null;
}

export async function salvarConfig(
  chave: string,
  valor: string | null,
): Promise<void> {
  const conn = await db();
  if (valor === null)
    await conn.execute(`DELETE FROM config WHERE chave = $1`, [chave]);
  else
    await conn.execute(
      `INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      [chave, valor],
    );
}

export type SituacaoPasta = {
  caminho: string;
  situacao: "importada" | "ignorada" | "erro";
  detalhe: string | null;
  veiculo_id: number | null;
  atualizado: string;
};

export async function pastasAvaliadas(): Promise<SituacaoPasta[]> {
  return (await db()).select<SituacaoPasta[]>(
    `SELECT * FROM estoque_pastas ORDER BY atualizado DESC`,
  );
}

export async function marcarPasta(
  caminho: string,
  situacao: SituacaoPasta["situacao"],
  detalhe: string | null,
  veiculoId: number | null,
) {
  await (
    await db()
  ).execute(
    `INSERT INTO estoque_pastas (caminho, situacao, detalhe, veiculo_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT(caminho) DO UPDATE SET situacao = excluded.situacao, detalhe = excluded.detalhe,
       veiculo_id = excluded.veiculo_id, atualizado = datetime('now', 'localtime')`,
    [caminho, situacao, detalhe, veiculoId],
  );
}

export async function esquecerPasta(caminho: string) {
  await (
    await db()
  ).execute(`DELETE FROM estoque_pastas WHERE caminho = $1`, [caminho]);
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

export async function salvarRelatorio(
  tipo: string,
  arquivo: string,
  inicio: string,
  fim: string,
  dados: unknown,
): Promise<number> {
  const r = await (
    await db()
  ).execute(
    `INSERT INTO relatorios (tipo, arquivo, inicio, fim, dados) VALUES ($1, $2, $3, $4, $5)`,
    [tipo, arquivo, inicio, fim, JSON.stringify(dados)],
  );
  return Number(r.lastInsertId);
}

export async function listarRelatorios(limite = 50): Promise<RelatorioSalvo[]> {
  return (await db()).select<RelatorioSalvo[]>(
    `SELECT * FROM relatorios ORDER BY id DESC LIMIT $1`,
    [limite],
  );
}

export async function excluirRelatorio(id: number) {
  await (await db()).execute(`DELETE FROM relatorios WHERE id = $1`, [id]);
}

export async function obterLoja(): Promise<Loja> {
  const rows = await (
    await db()
  ).select<{ chave: string; valor: string }[]>(
    `SELECT chave, valor FROM config`,
  );
  const m = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  return {
    contato: m.contato ?? "",
    horario: m.horario ?? "",
    loja: m.loja ?? "",
    endereco: m.endereco ?? "",
  };
}

export async function salvarLoja(loja: Loja): Promise<void> {
  const conn = await db();
  for (const [chave, valor] of Object.entries(loja))
    await conn.execute(
      `INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      [chave, valor],
    );
}

// ---- Saúde do banco ----
/**
 * Confere o banco e guarda um backup do dia. O nome do arquivo usa o dia da semana,
 * então sobram sempre os últimos 7 dias sem precisar limpar nada.
 * Devolve o aviso quando o banco está corrompido (o app mostra na tela).
 */
export async function manutencaoBanco(): Promise<{
  ok: boolean;
  detalhe: string;
  backup: string | null;
}> {
  const conn = await db();
  let detalhe = "ok";
  try {
    const linhas = await conn.select<{ quick_check: string }[]>(
      "PRAGMA quick_check(3)",
    );
    detalhe = linhas.map((l) => Object.values(l)[0]).join("; ") || "ok";
  } catch (e) {
    detalhe = String(e);
  }
  if (detalhe !== "ok") {
    return { ok: false, detalhe, backup: null };
  }
  try {
    const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
    const nome = `soul-${dias[new Date().getDay()]}.db`;
    const caminho = await invoke<string>("banco_backup_preparar", { nome });
    await conn.execute(`VACUUM INTO '${caminho.replace(/'/g, "''")}'`);
    return { ok: true, detalhe, backup: caminho };
  } catch (e) {
    return { ok: true, detalhe: `backup falhou: ${e}`, backup: null };
  }
}
