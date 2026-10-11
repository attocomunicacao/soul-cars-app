import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  criarSegredos,
  migrarChaveDoBanco,
  type Cofre,
} from "../src/main/segredos";

// Cofre de mentira: inverte os bytes, o bastante para provar que o texto não fica claro.
const cofre = (disponivel = true): Cofre => ({
  disponivel: () => disponivel,
  cifrar: (t) => Buffer.from(t, "utf8").reverse(),
  decifrar: (d) => Buffer.from(d).reverse().toString("utf8"),
});

let pasta: string;
beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "soul-segredos-"));
});
afterEach(() => fs.rmSync(pasta, { recursive: true, force: true }));

const CHAVE = "sk-ant-teste-1234567890";

function criarBanco(arquivo: string, comChave: boolean) {
  const db = new DatabaseSync(arquivo);
  db.exec("CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT)");
  db.prepare("INSERT INTO config VALUES (?, ?)").run(
    "campanha_modelo",
    "MODELO",
  );
  if (comChave)
    db.prepare("INSERT INTO config VALUES (?, ?)").run(
      "anthropic_api_key",
      CHAVE,
    );
  db.close();
}

describe("segredos", () => {
  it("guarda cifrado, devolve só pelo main e apaga", () => {
    const arquivo = path.join(pasta, "segredos.json");
    const s = criarSegredos(arquivo, cofre());
    expect(s.existe("anthropic_api_key")).toBe(false);
    s.definir("anthropic_api_key", `  ${CHAVE} `);
    expect(s.existe("anthropic_api_key")).toBe(true);
    expect(s.obter("anthropic_api_key")).toBe(CHAVE);
    expect(fs.readFileSync(arquivo, "utf8")).not.toContain(CHAVE);
    s.definir("anthropic_api_key", null);
    expect(s.existe("anthropic_api_key")).toBe(false);
  });

  it("recusa nomes desconhecidos e cofre indisponível", () => {
    const arquivo = path.join(pasta, "segredos.json");
    expect(() => criarSegredos(arquivo, cofre()).definir("outro", "x")).toThrow(
      /desconhecido/,
    );
    expect(() =>
      criarSegredos(arquivo, cofre(false)).definir("anthropic_api_key", CHAVE),
    ).toThrow(/cofre/);
    expect(fs.existsSync(arquivo)).toBe(false);
  });

  it("migra a chave do banco e dos backups sem deixar texto claro", () => {
    const principal = path.join(pasta, "soul.db");
    const backup = path.join(pasta, "soul-seg.db");
    criarBanco(principal, true);
    criarBanco(backup, true);
    const s = criarSegredos(path.join(pasta, "segredos.json"), cofre());

    expect(
      migrarChaveDoBanco(s, [principal, backup, path.join(pasta, "nao.db")]),
    ).toBe(2);
    expect(s.obter("anthropic_api_key")).toBe(CHAVE);
    for (const arquivo of [principal, backup]) {
      const db = new DatabaseSync(arquivo);
      expect(
        db
          .prepare("SELECT 1 FROM config WHERE chave = 'anthropic_api_key'")
          .get(),
      ).toBeUndefined();
      // As outras configurações continuam.
      expect(
        db
          .prepare("SELECT valor FROM config WHERE chave = 'campanha_modelo'")
          .get(),
      ).toEqual({ valor: "MODELO" });
      db.close();
      expect(fs.readFileSync(arquivo).includes(CHAVE)).toBe(false);
    }
    // Rodar de novo não faz nada.
    expect(migrarChaveDoBanco(s, [principal, backup])).toBe(0);
  });

  it("não mexe em banco sem chave nem sobrescreve a chave já protegida", () => {
    const principal = path.join(pasta, "soul.db");
    criarBanco(principal, false);
    const s = criarSegredos(path.join(pasta, "segredos.json"), cofre());
    s.definir("anthropic_api_key", "nova-chave");
    expect(migrarChaveDoBanco(s, [principal])).toBe(0);

    const antigo = path.join(pasta, "soul-dom.db");
    criarBanco(antigo, true);
    expect(migrarChaveDoBanco(s, [antigo])).toBe(1);
    expect(s.obter("anthropic_api_key")).toBe("nova-chave");
  });
});
