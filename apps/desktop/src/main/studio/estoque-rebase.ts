/**
 * Reaponta os veículos do banco para a nova pasta ESTOQUE (ex.: a pasta do Google Drive).
 *
 * Só troca o prefixo do caminho em `veiculos.pasta` e `estoque_pastas.caminho`; não move,
 * copia nem apaga nenhuma pasta no disco. O histórico de `entrada_arquivos` fica como está.
 * Não importa `electron`: recebe o banco pronto.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  mesmoCaminho,
  rebasearCaminhoEstoque,
} from "../../shared/estoque-rebase";

export type ResultadoRebase = {
  /** Linhas cujo caminho foi trocado. */
  atualizados: number;
  /** Caminhos que não foram trocados porque a nova pasta já pertence a outro registro. */
  conflitos: string[];
};

/** Troca o prefixo dos caminhos de uma coluna; tudo ou nada, dentro de uma transação. */
function rebasearTabela(
  db: DatabaseSync,
  tabela: "veiculos" | "estoque_pastas",
  coluna: "pasta" | "caminho",
  novaRaiz: string,
  resultado: ResultadoRebase,
) {
  const linhas = db
    .prepare(
      `SELECT ${coluna} AS valor FROM ${tabela} WHERE ${coluna} IS NOT NULL`,
    )
    .all() as { valor: string }[];
  const existentes = new Set(linhas.map((l) => l.valor.toLowerCase()));
  const trocar = db.prepare(
    `UPDATE ${tabela} SET ${coluna} = ?1 WHERE ${coluna} = ?2`,
  );
  for (const { valor } of linhas) {
    const novo = rebasearCaminhoEstoque(valor, novaRaiz);
    if (!novo || mesmoCaminho(novo, valor)) continue;
    if (existentes.has(novo.toLowerCase())) {
      resultado.conflitos.push(valor);
      continue;
    }
    trocar.run(novo, valor);
    existentes.delete(valor.toLowerCase());
    existentes.add(novo.toLowerCase());
    resultado.atualizados += 1;
  }
}

/** Reaponta os veículos para `novaRaiz` (pasta ESTOQUE). Devolve o que foi trocado e o que ficou. */
export function rebasearBanco(
  db: DatabaseSync,
  novaRaiz: string,
): ResultadoRebase {
  const resultado: ResultadoRebase = { atualizados: 0, conflitos: [] };
  db.exec("BEGIN IMMEDIATE");
  try {
    rebasearTabela(db, "veiculos", "pasta", novaRaiz, resultado);
    rebasearTabela(db, "estoque_pastas", "caminho", novaRaiz, resultado);
    db.exec("COMMIT");
  } catch (erro) {
    db.exec("ROLLBACK");
    throw erro;
  }
  return resultado;
}
