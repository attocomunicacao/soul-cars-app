import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { it, expect, vi, afterAll } from "vitest";
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-legado-"));
const antigo = path.join(raiz, "com.soulcars.studio");
const novo = path.join(raiz, "novo");
vi.mock("electron", () => ({ app: { getPath: () => raiz } }));
vi.mock("../src/main/caminhos", () => ({
  userData: () => novo,
  BANCO: () => path.join(novo, "soul.db"),
  PASTA_VEICULOS: () => path.join(novo, "veiculos"),
  gravarConfig: () => {},
}));
import { importarLegado } from "../src/main/studio/legado";
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true }));
it("importa dados no WAL e fotos sem alterar o banco antigo nem substituir banco novo", async () => {
  fs.mkdirSync(antigo, { recursive: true });
  const db = new DatabaseSync(path.join(antigo, "soul.db"));
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE veiculos(id INTEGER PRIMARY KEY,nome TEXT); INSERT INTO veiculos VALUES(7,'LEGADO')",
  );
  const foto = path.join(antigo, "veiculos", "7", "fotos");
  fs.mkdirSync(foto, { recursive: true });
  fs.writeFileSync(path.join(foto, "main.png"), "foto");
  try {
    await importarLegado();
    const copia = new DatabaseSync(path.join(novo, "soul.db"));
    try {
      expect(
        copia.prepare("SELECT nome FROM veiculos WHERE id=7").get().nome,
      ).toBe("LEGADO");
      copia.exec("UPDATE veiculos SET nome='NOVO'");
    } finally {
      copia.close();
    }
    expect(
      fs.readFileSync(
        path.join(novo, "veiculos", "7", "fotos", "main.png"),
        "utf8",
      ),
    ).toBe("foto");
    expect(db.prepare("SELECT nome FROM veiculos WHERE id=7").get().nome).toBe(
      "LEGADO",
    );
    await importarLegado();
    const segunda = new DatabaseSync(path.join(novo, "soul.db"));
    try {
      expect(
        segunda.prepare("SELECT nome FROM veiculos WHERE id=7").get().nome,
      ).toBe("NOVO");
    } finally {
      segunda.close();
    }
  } finally {
    db.close();
  }
});
