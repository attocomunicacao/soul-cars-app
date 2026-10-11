/**
 * Banco SQLite do Studio.
 *
 * Usa o `node:sqlite` que já vem dentro do Electron — nenhum módulo nativo
 * para compilar, então `npm install` nunca precisa de Visual Studio nem de
 * Python. O arquivo fica em `%APPDATA%\soul-cars-app\soul.db`.
 *
 * A interface conversa com este módulo por `sql_select` / `sql_execute`,
 * exatamente como fazia com o serviço anterior, então o código de
 * `renderer/src/lib/db.ts` continua valendo sem mudanças.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as caminhos from "../caminhos";
import { MIGRACOES } from "./esquema";

let conexao: DatabaseSync | null = null;

export function banco(): DatabaseSync {
  if (conexao) return conexao;
  fs.mkdirSync(caminhos.userData(), { recursive: true });
  const db = new DatabaseSync(caminhos.BANCO());
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrar(db);
  conexao = db;
  return db;
}

function migrar(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS studio_migracoes(versao INTEGER PRIMARY KEY)",
  );
  const jaRodou = db.prepare("SELECT 1 FROM studio_migracoes WHERE versao = ?");
  const registrar = db.prepare("INSERT INTO studio_migracoes VALUES (?)");
  for (const m of MIGRACOES) {
    if (jaRodou.get(m.versao)) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const comando of m.sql.split(";")) {
        if (!comando.trim()) continue;
        try {
          db.exec(comando);
        } catch (erro) {
          // Compatibilidade com um soul.db já migrado pelo app antigo: colunas
          // e tabelas que existem não são erro, qualquer outra coisa é.
          const texto = String(erro);
          if (!/duplicate column name|already exists/i.test(texto)) throw erro;
        }
      }
      registrar.run(m.versao);
      db.exec("COMMIT");
    } catch (erro) {
      db.exec("ROLLBACK");
      throw erro;
    }
  }
}

/**
 * Converte `$1, $2…` em `?` posicionais, na ordem em que aparecem.
 *
 * As consultas de `db.ts` reaproveitam o mesmo `$1` em vários lugares
 * (a busca por nome, versão, placa…), então o mesmo valor pode entrar mais
 * de uma vez na lista final.
 */
export function traduzir(sql: string, valores: unknown[]): [string, unknown[]] {
  if (!/\$\d/.test(sql)) return [sql, valores];
  const usados: unknown[] = [];
  const traduzido = sql.replace(/\$(\d+)/g, (_, n: string) => {
    usados.push(valores[Number(n) - 1] ?? null);
    return "?";
  });
  return [traduzido, usados];
}

/** O node:sqlite só aceita null, número, string, bigint e Uint8Array. */
const comoValor = (v: unknown) => {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint")
    return v;
  if (v instanceof Uint8Array) return v;
  return String(v);
};

export function selecionar(sql: string, valores: unknown[] = []) {
  const [texto, args] = traduzir(sql, valores);
  // O node:sqlite devolve objetos com protótipo nulo; o IPC do Electron não
  // sabe serializar isso, então copiamos para objetos comuns.
  return banco()
    .prepare(texto)
    .all(...args.map(comoValor))
    .map((linha) => ({ ...linha }));
}

export function executar(sql: string, valores: unknown[] = []) {
  const [texto, args] = traduzir(sql, valores);
  const r = banco()
    .prepare(texto)
    .run(...args.map(comoValor));
  return {
    lastInsertId: Number(r.lastInsertRowid),
    rowsAffected: Number(r.changes),
  };
}

/**
 * Prepara o caminho do backup do dia e apaga o anterior.
 *
 * O nome usa o dia da semana, então sobram sempre os últimos 7 dias sem
 * precisar limpar nada. Quem copia é o `VACUUM INTO` disparado pela
 * interface.
 */
export function prepararBackup(nome: string) {
  if (path.basename(nome) !== nome || !nome.endsWith(".db"))
    throw new Error("Backup inválido.");
  fs.mkdirSync(caminhos.PASTA_BACKUPS(), { recursive: true });
  const destino = path.join(caminhos.PASTA_BACKUPS(), nome);
  fs.rmSync(destino, { force: true });
  return destino.replace(/\\/g, "/");
}
