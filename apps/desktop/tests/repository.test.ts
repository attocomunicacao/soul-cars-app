/**
 * Testes (Vitest) de src/main/studio/repository.ts (consultas do banco do Studio).
 */
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { MIGRACOES } from "../src/main/studio/schema";
import * as repo from "../src/main/studio/repository";

let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  for (const m of MIGRACOES)
    for (const comando of m.sql.split(";"))
      if (comando.trim()) db.exec(comando);
});

describe("veículos", () => {
  it("cria, busca e atualiza só as colunas permitidas", () => {
    const id = repo.criarVeiculo(db, {
      nome: "  Fiesta  ",
      placa: " abc1d23 ",
      preco: 48900,
    });
    const v = repo.obterVeiculo(db, id) as Record<string, unknown>;
    expect(v).toMatchObject({ nome: "Fiesta", placa: "ABC1D23", preco: 48900 });
    expect(Object.getPrototypeOf(v)).toBe(Object.prototype);

    repo.atualizarVeiculo(db, id, {
      cor: "Prata",
      km: null,
      criado_em: "2000-01-01",
    });
    expect(repo.obterVeiculo(db, id)).toMatchObject({ cor: "Prata", km: null });
    expect(
      (repo.obterVeiculo(db, id) as { criado_em: string }).criado_em,
    ).not.toBe("2000-01-01");

    expect(repo.listarVeiculos(db, "abc1").length).toBe(1);
    expect(repo.listarVeiculos(db, "zzz").length).toBe(0);
    expect(repo.listarVeiculos(db).length).toBe(1);
    expect(repo.obterVeiculo(db, 999)).toBeNull();
  });

  it("a busca trata o texto como dado, nunca como SQL", () => {
    repo.criarVeiculo(db, { nome: "Toro" });
    expect(repo.listarVeiculos(db, "'; DROP TABLE veiculos; --")).toEqual([]);
    expect(repo.listarVeiculos(db).length).toBe(1);
  });
});

describe("anúncios", () => {
  it("registra, filtra, pausa e remove", () => {
    const base = {
      estoque_id: 1177428,
      modelo: "ECOSPORT",
      campanha: "[VENDA] ECOSPORT",
      criado_dia: "2026-10-11",
    };
    const a = repo.registrarAnuncio(db, { ...base, veiculo_id: 1 });
    repo.registrarAnuncio(db, { ...base, veiculo_id: 2 });
    expect(repo.listarAnuncios(db).length).toBe(2);
    expect(repo.listarAnuncios(db, 1).length).toBe(1);
    repo.marcarAnuncioPausado(db, a, "2026-10-12");
    expect(repo.listarAnuncios(db, 1)[0].pausado_dia).toBe("2026-10-12");
    repo.removerAnuncio(db, a);
    expect(repo.listarAnuncios(db, 1)).toEqual([]);
  });
});

describe("configuração, loja e relatórios", () => {
  it("guarda, troca e apaga valores", () => {
    expect(repo.obterConfig(db, "campanha_modelo")).toBeNull();
    repo.salvarConfig(db, "campanha_modelo", "A");
    repo.salvarConfig(db, "campanha_modelo", "B");
    expect(repo.obterConfig(db, "campanha_modelo")).toBe("B");
    repo.salvarConfig(db, "campanha_modelo", null);
    expect(repo.obterConfig(db, "campanha_modelo")).toBeNull();
  });

  it("loja volta com as quatro chaves", () => {
    repo.salvarLoja(db, {
      contato: "11 9",
      horario: "8h",
      loja: "Soul",
      endereco: "Rua X",
    });
    expect(repo.obterLoja(db)).toEqual({
      contato: "11 9",
      horario: "8h",
      loja: "Soul",
      endereco: "Rua X",
    });
  });

  it("relatórios: salva, lista do mais novo e exclui", () => {
    const r = {
      tipo: "meta",
      arquivo: "a.xlsx",
      inicio: "1",
      fim: "2",
      dados: "{}",
    };
    const a = repo.salvarRelatorio(db, r);
    const b = repo.salvarRelatorio(db, { ...r, arquivo: "b.xlsx" });
    expect(repo.listarRelatorios(db).map((x) => x.id)).toEqual([b, a]);
    expect(repo.listarRelatorios(db, 1).length).toBe(1);
    repo.excluirRelatorio(db, a);
    expect(repo.listarRelatorios(db).length).toBe(1);
  });
});

describe("saúde do banco", () => {
  it("confere e copia", () => {
    expect(repo.conferirBanco(db)).toBe("ok");
  });
});
