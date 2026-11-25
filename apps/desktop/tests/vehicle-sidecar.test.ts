/** Testes do sidecar do veículo (ponte entre computadores pelo Drive) e das cópias de conflito. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copiasDeConflito } from "../src/shared/drive-conflicts";
import { ehTemporario } from "../src/shared/intake-rules";
import {
  CAMPOS_SIDECAR,
  NOME_SIDECAR,
  lerSidecar,
  montarSidecar,
  sidecarEhNovo,
} from "../src/shared/vehicle-sidecar";
import { MIGRACOES } from "../src/main/studio/schema";
import * as repo from "../src/main/studio/repository";
import { aplicarSidecar, gravarSidecar } from "../src/main/studio/sidecar";

describe("regras do sidecar", () => {
  it("não leva o caminho da pasta nem o DES.md", () => {
    expect(CAMPOS_SIDECAR).not.toContain("pasta");
    expect(CAMPOS_SIDECAR).not.toContain("des_md");
    expect(CAMPOS_SIDECAR).toContain("preco");
  });

  it("monta e lê de volta", () => {
    const s = montarSidecar(
      { preco: 50000, cor: "Prata", pasta: "C:\\x", nome: null },
      "PC-LOJA",
      new Date("2026-11-25T12:00:00Z"),
    );
    expect(s.campos).toMatchObject({ preco: 50000, cor: "Prata", nome: null });
    expect(s.campos).not.toHaveProperty("pasta");
    expect(lerSidecar(JSON.stringify(s))).toEqual(s);
  });

  it("recusa JSON inválido, formato diferente e data ruim", () => {
    expect(lerSidecar("{")).toBeNull();
    expect(lerSidecar(JSON.stringify({ formato: 2 }))).toBeNull();
    expect(
      lerSidecar(
        JSON.stringify({ formato: 1, atualizadoEm: "ontem", campos: {} }),
      ),
    ).toBeNull();
  });

  it("descarta campos desconhecidos e de tipo errado", () => {
    const s = lerSidecar(
      JSON.stringify({
        formato: 1,
        atualizadoEm: "2026-11-25T12:00:00Z",
        campos: { cor: "Preto", preco: { x: 1 }, id: 99, pasta: "C:\\evil" },
      }),
    );
    expect(s?.campos).toEqual({ cor: "Preto" });
  });

  it("só aplica o que é mais novo que o marcador", () => {
    const s = montarSidecar({}, "A", new Date("2026-11-25T12:00:00Z"));
    expect(sidecarEhNovo(s, null)).toBe(true);
    expect(sidecarEhNovo(s, "2026-11-25T11:00:00.000Z")).toBe(true);
    expect(sidecarEhNovo(s, s.atualizadoEm)).toBe(false);
    expect(sidecarEhNovo(s, "2026-11-25T13:00:00.000Z")).toBe(false);
  });
});

describe("sidecar no disco entre dois bancos", () => {
  let pasta: string;
  const novoBanco = () => {
    const db = new DatabaseSync(":memory:");
    for (const m of MIGRACOES)
      for (const c of m.sql.split(";")) if (c.trim()) db.exec(c);
    return db;
  };

  beforeEach(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "soul-sidecar-"));
  });
  afterEach(() => fs.rmSync(pasta, { recursive: true, force: true }));

  it("a edição do PC X aparece no PC Y, e o eco volta sem efeito", () => {
    const x = novoBanco();
    const idX = repo.criarVeiculo(x, { nome: "Ka", preco: 40000 });
    repo.atualizarVeiculo(x, idX, { pasta, preco: 45000, cor: "Prata" });
    expect(gravarSidecar(x, idX, new Date("2026-11-25T12:00:00Z"))).toBe(true);
    expect(fs.existsSync(path.join(pasta, NOME_SIDECAR))).toBe(true);

    // PC Y: mesma pasta (via Drive), banco próprio.
    const y = novoBanco();
    const idY = repo.criarVeiculo(y, { nome: "Ka", preco: 40000 });
    repo.atualizarVeiculo(y, idY, { pasta });
    expect(aplicarSidecar(y, idY)).toBe(true);
    expect(repo.obterVeiculo(y, idY)).toMatchObject({
      preco: 45000,
      cor: "Prata",
      pasta,
    });
    // Segunda leitura: nada novo.
    expect(aplicarSidecar(y, idY)).toBe(false);
    // O PC X não reaplica o que ele mesmo gravou.
    expect(aplicarSidecar(x, idX)).toBe(false);
  });

  it("sem pasta no disco não grava nem aplica", () => {
    const db = novoBanco();
    const id = repo.criarVeiculo(db, { nome: "Uno" });
    expect(gravarSidecar(db, id)).toBe(false);
    repo.atualizarVeiculo(db, id, { pasta: path.join(pasta, "nao-existe") });
    expect(gravarSidecar(db, id)).toBe(false);
    expect(aplicarSidecar(db, id)).toBe(false);
  });

  it("ignora sidecar corrompido", () => {
    const db = novoBanco();
    const id = repo.criarVeiculo(db, { nome: "Uno" });
    repo.atualizarVeiculo(db, id, { pasta });
    fs.writeFileSync(path.join(pasta, NOME_SIDECAR), "{ meio cortado");
    expect(aplicarSidecar(db, id)).toBe(false);
  });
});

describe("cópias de conflito e temporários do Drive", () => {
  it("aponta ' (1)' só quando o original existe", () => {
    expect(
      copiasDeConflito(["1.jpg", "1 (1).jpg", "2 (1).jpg", "3.jpg"]),
    ).toEqual(["1 (1).jpg"]);
    expect(copiasDeConflito(["DOC.pdf", "doc (2).PDF"])).toEqual([
      "doc (2).PDF",
    ]);
    expect(copiasDeConflito(["foto (1).jpg"])).toEqual([]);
  });

  it("trata os temporários do Drive como temporários", () => {
    expect(ehTemporario("1.jpg.tmp.drivedownload")).toBe(true);
    expect(ehTemporario("1.jpg.driveupload")).toBe(true);
    expect(ehTemporario("1.jpg")).toBe(false);
  });
});
