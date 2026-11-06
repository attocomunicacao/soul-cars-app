/**
 * Importação única do banco do Studio anterior (Tauri) para o `soul.db`, por snapshot
 * consistente (inclui registros no WAL). A origem é aberta só para leitura.
 */
import { app } from "electron";
import { DatabaseSync, backup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import * as caminhos from "../core/paths";

// Importação única: snapshot consistente, inclusive registros ainda no WAL.
// A origem é aberta somente para leitura e nunca é substituída.
export async function importarLegado() {
  if (fs.existsSync(caminhos.BANCO())) return;
  const origem = path.join(app.getPath("appData"), "com.soulcars.studio");
  const arquivo = path.join(origem, "soul.db");
  if (!fs.existsSync(arquivo)) return;
  fs.mkdirSync(caminhos.userData(), { recursive: true });
  const temporario = caminhos.BANCO() + ".importando";
  const db = new DatabaseSync(arquivo, { readOnly: true });
  try {
    const check = db.prepare("PRAGMA quick_check").get();
    if (!check || Object.values(check)[0] !== "ok")
      throw new Error(
        "O banco antigo precisa ser reparado antes da importação.",
      );
    await backup(db, temporario);
    const fotos = path.join(origem, "veiculos");
    if (fs.existsSync(fotos))
      fs.cpSync(fotos, caminhos.PASTA_VEICULOS(), {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
    fs.renameSync(temporario, caminhos.BANCO());
    caminhos.gravarConfig({ legadoImportado: arquivo });
  } finally {
    db.close();
  }
}
