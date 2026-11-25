/** Testes da troca de pasta ESTOQUE (vínculo com o Google Drive) com dados fictícios. */
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  mesmoCaminho,
  rebasearCaminhoEstoque,
} from "../src/shared/estoque-rebase";
import { rebasearBanco } from "../src/main/studio/estoque-rebase";

const NOVA = "G:\\Meu Drive\\ESTOQUE";

describe("rebasearCaminhoEstoque", () => {
  it("troca o prefixo e mantém o nome da pasta do veículo", () => {
    expect(
      rebasearCaminhoEstoque("C:\\Dados\\ESTOQUE\\111_FORD_KA_ABC1D23", NOVA),
    ).toBe("G:\\Meu Drive\\ESTOQUE\\111_FORD_KA_ABC1D23");
  });
  it("aceita barras normais e barra final", () => {
    expect(
      rebasearCaminhoEstoque("C:/x/ESTOQUE/222_FIAT_UNO_XYZ9A87/", NOVA),
    ).toBe("G:\\Meu Drive\\ESTOQUE\\222_FIAT_UNO_XYZ9A87");
  });
  it("recusa caminho vazio ou raiz de disco", () => {
    expect(rebasearCaminhoEstoque("", NOVA)).toBeNull();
    expect(rebasearCaminhoEstoque("C:\\", NOVA)).toBeNull();
  });
});

describe("mesmoCaminho", () => {
  it("ignora maiúsculas, tipo de barra e barra final", () => {
    expect(
      mesmoCaminho("g:/meu drive/estoque/", "G:\\Meu Drive\\ESTOQUE"),
    ).toBe(true);
    expect(mesmoCaminho("G:\\a", "G:\\b")).toBe(false);
  });
});

describe("rebasearBanco", () => {
  function banco() {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE veiculos (id INTEGER PRIMARY KEY, pasta TEXT);
      CREATE UNIQUE INDEX idx_pasta ON veiculos (pasta) WHERE pasta IS NOT NULL;
      CREATE TABLE estoque_pastas (caminho TEXT PRIMARY KEY, situacao TEXT NOT NULL);
    `);
    return db;
  }

  it("reaponta veículos e pastas do estoque, sem tocar em quem não tem pasta", () => {
    const db = banco();
    db.exec(`
      INSERT INTO veiculos (pasta) VALUES ('C:\\Loja\\ESTOQUE\\1_FORD_KA_AAA1A11'), (NULL);
      INSERT INTO estoque_pastas VALUES ('C:\\Loja\\ESTOQUE\\1_FORD_KA_AAA1A11', 'ok');
    `);
    const r = rebasearBanco(db, NOVA);
    expect(r).toEqual({ atualizados: 2, conflitos: [] });
    expect(db.prepare("SELECT pasta FROM veiculos ORDER BY id").all()).toEqual([
      { pasta: "G:\\Meu Drive\\ESTOQUE\\1_FORD_KA_AAA1A11" },
      { pasta: null },
    ]);
  });

  it("é idempotente e não mexe no que já está na nova raiz", () => {
    const db = banco();
    db.exec(
      `INSERT INTO veiculos (pasta) VALUES ('G:\\Meu Drive\\ESTOQUE\\2_FIAT_UNO_BBB2B22')`,
    );
    expect(rebasearBanco(db, NOVA).atualizados).toBe(0);
  });

  it("não sobrescreve quando a nova pasta já pertence a outro registro", () => {
    const db = banco();
    db.exec(`
      INSERT INTO veiculos (pasta) VALUES
        ('C:\\Loja\\ESTOQUE\\3_VW_GOL_CCC3C33'),
        ('G:\\Meu Drive\\ESTOQUE\\3_VW_GOL_CCC3C33');
    `);
    const r = rebasearBanco(db, NOVA);
    expect(r.atualizados).toBe(0);
    expect(r.conflitos).toEqual(["C:\\Loja\\ESTOQUE\\3_VW_GOL_CCC3C33"]);
  });
});
