/**
 * Banco SQLite do Studio.
 *
 * Usa o `node:sqlite` que já vem dentro do Electron — nenhum módulo nativo
 * para compilar, então `npm install` nunca precisa de Visual Studio nem de
 * Python. O arquivo fica em `%APPDATA%\soul-cars-app\soul.db`.
 *
 * A interface não escreve SQL: ela chama os comandos `db_*` (ipc.ts), que
 * usam as consultas de `repositorio.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as caminhos from "../core/paths";
import { MIGRACOES } from "./schema";
import * as repositorio from "./repository";

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

/** Nome do backup do dia: sobram sempre os últimos 7 dias sem precisar limpar nada. */
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

/**
 * Confere o banco e guarda a cópia do dia em `backups/`.
 * Devolve o aviso quando o banco está corrompido (o app mostra na tela).
 */
export function manutencao(agora = new Date()) {
  const db = banco();
  const detalhe = repositorio.conferirBanco(db);
  if (detalhe !== "ok") return { ok: false, detalhe, backup: null };
  try {
    fs.mkdirSync(caminhos.PASTA_BACKUPS(), { recursive: true });
    const destino = path.join(
      caminhos.PASTA_BACKUPS(),
      `soul-${DIAS[agora.getDay()]}.db`,
    );
    fs.rmSync(destino, { force: true });
    repositorio.copiarBanco(db, destino);
    return { ok: true, detalhe, backup: destino.replace(/\\/g, "/") };
  } catch (erro) {
    return { ok: true, detalhe: `backup falhou: ${erro}`, backup: null };
  }
}
