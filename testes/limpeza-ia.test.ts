import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apagarArquivoDeSegredos,
  removerConfigIa,
} from "../src/main/limpeza-ia";

const CHAVE = "sk-ant-teste-1234567890";
let pasta: string;
beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "soul-limpeza-"));
});
afterEach(() => fs.rmSync(pasta, { recursive: true, force: true }));

function criarBanco(arquivo: string, comChave: boolean) {
  const db = new DatabaseSync(arquivo);
  db.exec("CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT)");
  db.prepare("INSERT INTO config VALUES (?, ?)").run(
    "campanha_modelo",
    "MODELO",
  );
  if (comChave) {
    db.prepare("INSERT INTO config VALUES (?, ?)").run(
      "anthropic_api_key",
      CHAVE,
    );
    db.prepare("INSERT INTO config VALUES (?, ?)").run("ia_modo_api", "1");
  }
  db.close();
}

describe("limpeza do antigo modo API", () => {
  it("apaga a chave do banco e dos backups, sem tocar no resto", () => {
    const principal = path.join(pasta, "soul.db");
    const backup = path.join(pasta, "soul-seg.db");
    criarBanco(principal, true);
    criarBanco(backup, true);

    expect(
      removerConfigIa([principal, backup, path.join(pasta, "nao.db")]),
    ).toBe(2);
    for (const arquivo of [principal, backup]) {
      const db = new DatabaseSync(arquivo);
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM config WHERE chave IN ('anthropic_api_key', 'ia_modo_api')",
          )
          .get(),
      ).toEqual({ n: 0 });
      expect(
        db
          .prepare("SELECT valor FROM config WHERE chave = 'campanha_modelo'")
          .get(),
      ).toEqual({ valor: "MODELO" });
      db.close();
      expect(fs.readFileSync(arquivo).includes(CHAVE)).toBe(false);
    }
    expect(removerConfigIa([principal, backup])).toBe(0);
  });

  it("não mexe em banco sem chave nem em arquivo que não é banco", () => {
    const limpo = path.join(pasta, "soul.db");
    criarBanco(limpo, false);
    const lixo = path.join(pasta, "estragado.db");
    fs.writeFileSync(lixo, "isto não é um banco");
    expect(removerConfigIa([limpo, lixo])).toBe(0);
  });

  it("apaga o arquivo de segredos da versão anterior", () => {
    const arquivo = path.join(pasta, "segredos.json");
    fs.writeFileSync(arquivo, "{}");
    apagarArquivoDeSegredos(pasta);
    expect(fs.existsSync(arquivo)).toBe(false);
    expect(() => apagarArquivoDeSegredos(pasta)).not.toThrow();
  });
});
