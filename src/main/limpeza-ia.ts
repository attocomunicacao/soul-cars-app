/**
 * Limpeza de restos do antigo "modo API" (Anthropic).
 *
 * O app não usa mais nenhum serviço pago. Versões anteriores podiam ter guardado uma
 * chave no banco (`config`) ou num arquivo cifrado; na abertura, isso é apagado do
 * `soul.db`, dos backups e da pasta de dados, para nenhuma chave ficar esquecida.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const CHAVES_REMOVIDAS = ["anthropic_api_key", "ia_modo_api"] as const;

/** Apaga as chaves antigas de cada banco (compactando-o para não sobrar texto). Devolve quantos foram limpos. */
export function removerConfigIa(bancos: string[]): number {
  let limpos = 0;
  for (const arquivo of bancos) {
    if (!fs.existsSync(arquivo)) continue;
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(arquivo);
      const tabela = db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'config'",
        )
        .get();
      if (!tabela) continue;
      const apagar = db.prepare("DELETE FROM config WHERE chave = ?");
      let mudou = 0;
      for (const chave of CHAVES_REMOVIDAS)
        mudou += Number(apagar.run(chave).changes);
      if (!mudou) continue;
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.exec("VACUUM");
      limpos++;
    } catch {
      // Um backup ilegível não pode impedir o app de abrir.
    } finally {
      db?.close();
    }
  }
  return limpos;
}

/** Remove o arquivo de segredos cifrados da versão anterior, se existir. */
export function apagarArquivoDeSegredos(pastaDados: string) {
  fs.rmSync(path.join(pastaDados, "segredos.json"), { force: true });
}
