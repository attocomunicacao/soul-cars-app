/**
 * Consultas do banco do Studio, uma função por operação.
 *
 * A interface não escreve SQL: ela chama os comandos `db_*` (ipc.ts), que
 * caem aqui. Cada função recebe a conexão para poder ser testada com um
 * banco em memória.
 */
import type { DatabaseSync } from "node:sqlite";
import { EDITAVEIS } from "../../shared/vehicle";

type Valor = string | number | null;
type Linha = Record<string, unknown>;

/** O node:sqlite devolve objetos de protótipo nulo; o IPC precisa de objetos comuns. */
const copiar = (linhas: Linha[]) => linhas.map((l) => ({ ...l }));

const todas = (db: DatabaseSync, sql: string, ...args: Valor[]) =>
  copiar(db.prepare(sql).all(...args) as Linha[]);

// ------------------------------------------------------------- veículos
export function listarVeiculos(db: DatabaseSync, busca = "") {
  const termo = `%${busca.trim()}%`;
  return todas(
    db,
    `SELECT * FROM veiculos
     WHERE nome LIKE ?1 OR IFNULL(versao, '') LIKE ?1 OR IFNULL(placa, '') LIKE ?1 OR IFNULL(marca_modelo, '') LIKE ?1 OR IFNULL(pasta, '') LIKE ?1
     ORDER BY atualizado_em DESC`,
    termo,
  );
}

export function obterVeiculo(db: DatabaseSync, id: number) {
  return todas(db, "SELECT * FROM veiculos WHERE id = ?", id)[0] ?? null;
}

export function criarVeiculo(
  db: DatabaseSync,
  v: {
    nome: string;
    ano?: Valor;
    versao?: Valor;
    cambio?: Valor;
    preco?: Valor;
    km?: Valor;
    placa?: Valor;
  },
) {
  const placa = typeof v.placa === "string" ? v.placa.trim().toUpperCase() : "";
  const r = db
    .prepare(
      `INSERT INTO veiculos (nome, ano, versao, cambio, preco, km, placa) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      v.nome.trim(),
      v.ano ?? null,
      v.versao ?? null,
      v.cambio ?? null,
      v.preco ?? null,
      v.km ?? null,
      placa || null,
    );
  return Number(r.lastInsertRowid);
}

/** Só as colunas de `EDITAVEIS` entram; o resto é ignorado. */
export function atualizarVeiculo(
  db: DatabaseSync,
  id: number,
  patch: Record<string, Valor | undefined>,
) {
  const colunas = EDITAVEIS.filter((c) => c in patch);
  if (!colunas.length) return;
  const sets = colunas.map((c) => `${c} = ?`).join(", ");
  db.prepare(
    `UPDATE veiculos SET ${sets}, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
  ).run(...colunas.map((c) => patch[c] ?? null), id);
}

// ------------------------------------------------------------- anúncios
export function listarAnuncios(db: DatabaseSync, veiculoId?: number) {
  return veiculoId == null
    ? todas(db, "SELECT * FROM anuncios ORDER BY id DESC")
    : todas(
        db,
        "SELECT * FROM anuncios WHERE veiculo_id = ? ORDER BY id DESC",
        veiculoId,
      );
}

export function registrarAnuncio(
  db: DatabaseSync,
  a: {
    veiculo_id: number;
    estoque_id: number | null;
    modelo: string;
    campanha: string;
    criado_dia: string;
  },
) {
  const r = db
    .prepare(
      `INSERT INTO anuncios (veiculo_id, estoque_id, modelo, campanha, criado_dia) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(a.veiculo_id, a.estoque_id, a.modelo, a.campanha, a.criado_dia);
  return Number(r.lastInsertRowid);
}

export function marcarAnuncioPausado(
  db: DatabaseSync,
  id: number,
  dia: string,
) {
  db.prepare("UPDATE anuncios SET pausado_dia = ? WHERE id = ?").run(dia, id);
}

export function removerAnuncio(db: DatabaseSync, id: number) {
  db.prepare("DELETE FROM anuncios WHERE id = ?").run(id);
}

// ------------------------------------------------------------- configuração
export function obterConfig(db: DatabaseSync, chave: string) {
  const linha = db
    .prepare("SELECT valor FROM config WHERE chave = ?")
    .get(chave) as { valor: string } | undefined;
  return linha?.valor ?? null;
}

export function salvarConfig(
  db: DatabaseSync,
  chave: string,
  valor: string | null,
) {
  if (valor === null)
    db.prepare("DELETE FROM config WHERE chave = ?").run(chave);
  else
    db.prepare(
      `INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    ).run(chave, valor);
}

export const CHAVES_DA_LOJA = [
  "contato",
  "horario",
  "loja",
  "endereco",
] as const;

export function obterLoja(db: DatabaseSync) {
  const loja: Record<string, string> = {};
  for (const chave of CHAVES_DA_LOJA)
    loja[chave] = obterConfig(db, chave) ?? "";
  return loja;
}

export function salvarLoja(db: DatabaseSync, loja: Record<string, string>) {
  for (const chave of CHAVES_DA_LOJA)
    salvarConfig(db, chave, loja[chave] ?? "");
}

// ------------------------------------------------------------- relatórios
export function salvarRelatorio(
  db: DatabaseSync,
  r: {
    tipo: string;
    arquivo: string;
    inicio: string;
    fim: string;
    dados: string;
  },
) {
  const x = db
    .prepare(
      `INSERT INTO relatorios (tipo, arquivo, inicio, fim, dados) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(r.tipo, r.arquivo, r.inicio, r.fim, r.dados);
  return Number(x.lastInsertRowid);
}

export function listarRelatorios(db: DatabaseSync, limite = 50) {
  return todas(db, "SELECT * FROM relatorios ORDER BY id DESC LIMIT ?", limite);
}

export function excluirRelatorio(db: DatabaseSync, id: number) {
  db.prepare("DELETE FROM relatorios WHERE id = ?").run(id);
}

// ------------------------------------------------------------- saúde
/** Resultado do `PRAGMA quick_check`: "ok" ou a descrição do problema. */
export function conferirBanco(db: DatabaseSync) {
  try {
    const linhas = db.prepare("PRAGMA quick_check(3)").all() as Linha[];
    return linhas.map((l) => Object.values(l)[0]).join("; ") || "ok";
  } catch (erro) {
    return String(erro);
  }
}

/** Copia o banco para `destino` (arquivo novo, escolhido pelo main). */
export function copiarBanco(db: DatabaseSync, destino: string) {
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
}
