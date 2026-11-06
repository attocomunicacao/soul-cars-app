/**
 * Testes (Vitest) de regras de núcleo do main (estoque, balanço e pastas).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, afterAll } from "vitest";
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-nucleo-"));
vi.mock("../src/main/core/paths", () => ({
  userData: () => raiz,
  BANCO: () => path.join(raiz, "soul.db"),
  PASTA_BACKUPS: () => path.join(raiz, "backups"),
  PASTA_VEICULOS: () => path.join(raiz, "veiculos"),
  BALANCO_JSON: () => path.join(raiz, "balanco.json"),
  CSV_VEICULOS: () => path.join(raiz, "veiculos.csv"),
  CSV_VENDAS: () => path.join(raiz, "vendas.csv"),
  garantir: () => {},
}));
import {
  selecionar,
  lerCsv,
  ehConsignado,
} from "../src/main/inventory/folder-sync";
import { dadosBndv } from "../src/main/inventory/balance";
import { ultimasVendas } from "../src/main/inventory/sales";
import {
  dentro,
  nomeSeguro,
  renomearFotos,
  statusProducao,
  documentoNaPasta,
  previaFotos,
  copiarComoDoc,
} from "../src/main/studio/files";
import {
  executar,
  selecionar as consultar,
  banco,
} from "../src/main/studio/database";
afterAll(() => {
  banco().close();
  fs.rmSync(raiz, { recursive: true, force: true });
});
describe("núcleo migrado", () => {
  it("detecta CRLV com nome livre, anexa como DOC e lista fotos sem duplicar recortes", () => {
    const pasta = path.join(raiz, "producao");
    fs.mkdirSync(path.join(pasta, "FOTOS"), { recursive: true });
    fs.writeFileSync(path.join(pasta, "crlv-original.pdf"), "pdf");
    fs.writeFileSync(path.join(pasta, "FOTOS", "frente.jpg"), "foto");
    fs.writeFileSync(
      path.join(pasta, "FOTOS", "frente_sem_fundo.png"),
      "recorte",
    );
    fs.writeFileSync(path.join(pasta, "bruto.MOV"), "video");
    fs.writeFileSync(path.join(pasta, "VIDEO_CARRO.mp4"), "final");
    expect(statusProducao(pasta).doc_pdf).toBe(true);
    expect(statusProducao(pasta).video_bruto).toBe(
      path.join(pasta, "bruto.MOV"),
    );
    expect(previaFotos(pasta).map((f) => f.nome)).toEqual(["frente.jpg"]);
    expect(previaFotos(pasta)[0].miniatura).toMatch(
      /^data:image\/jpeg;base64,/,
    );
    copiarComoDoc(pasta, documentoNaPasta(pasta).caminho);
    expect(documentoNaPasta(pasta).nome).toBe("DOC.pdf");
    expect(fs.readFileSync(path.join(pasta, "crlv-original.pdf"), "utf8")).toBe(
      "pdf",
    );
  });
  it("conserva cadastro ativo diante da duplicata cancelada", () => {
    const r = selecionar([
      { idVehicle: "1", active: "false", plate: "ABC1D23" },
      { idVehicle: "2", active: "true", plate: "ABC1D23" },
    ]);
    expect(r.escolhidos.map((v) => v.idVehicle)).toEqual(["2"]);
  });
  it("aceita consignado true e exclui custo do patrimônio", () => {
    for (const v of ["true", "True", "1", "sim"])
      expect(ehConsignado({ consigned: v })).toBe(true);
    fs.writeFileSync(
      path.join(raiz, "veiculos.csv"),
      "idVehicle;active;plate;consigned;purchasePrice;salePrice;dateRegister\n1;true;ABC1D23;true;10000;15000;2026-01-01",
    );
    fs.writeFileSync(path.join(raiz, "vendas.csv"), "idVehicle;date;price");
    expect(dadosBndv().estoqueCusto).toBe(0);
    expect(dadosBndv().estoquePotencial).toBe(15000);
  });
  it("lê CSV com BOM, delimitador e quebras dentro de aspas", () => {
    const csv = path.join(raiz, "teste.csv");
    fs.writeFileSync(csv, '\ufeffnome;texto\r\n"A;B";"linha 1\nlinha ""2"""');
    expect(lerCsv(csv)).toEqual([{ nome: "A;B", texto: 'linha 1\nlinha "2"' }]);
  });
  it("impede nomes e caminhos fora da pasta", () => {
    expect(() => nomeSeguro("../x.png")).toThrow();
    expect(() => dentro(raiz, path.join(raiz, "..", "fora"))).toThrow();
  });
  it("troca a ordem das fotos sem perder originais nem recortes", () => {
    const pasta = path.join(raiz, "carro");
    const fotos = path.join(pasta, "FOTOS");
    fs.mkdirSync(fotos, { recursive: true });
    for (const [nome, valor] of [
      ["1.jpg", "a"],
      ["2.jpg", "b"],
      ["1_sem_fundo.png", "recorte"],
    ])
      fs.writeFileSync(path.join(fotos, nome), valor);
    renomearFotos(pasta, ["2.jpg", "1.jpg"]);
    expect(fs.readFileSync(path.join(fotos, "1.jpg"), "utf8")).toBe("b");
    expect(fs.readFileSync(path.join(fotos, "2.jpg"), "utf8")).toBe("a");
    expect(fs.readFileSync(path.join(fotos, "2_sem_fundo.png"), "utf8")).toBe(
      "recorte",
    );
  });
  it("a versão leve em ANUNCIO não vira vídeo bruto e aparece com os tamanhos", () => {
    const pasta = path.join(raiz, "leve");
    fs.mkdirSync(path.join(pasta, "ANUNCIO"), { recursive: true });
    fs.mkdirSync(path.join(pasta, "VIDEO"), { recursive: true });
    fs.writeFileSync(path.join(pasta, "VIDEO", "bruto.MOV"), "video");
    fs.writeFileSync(path.join(pasta, "VIDEO_JEEP.mp4"), "x".repeat(1000));
    expect(statusProducao(pasta).video_leve).toBeNull();
    fs.writeFileSync(
      path.join(pasta, "ANUNCIO", "ANUNCIO_JEEP.mp4"),
      "x".repeat(200),
    );
    fs.writeFileSync(
      path.join(pasta, "ANUNCIO", "ANUNCIO_JEEP.parcial.mp4"),
      "incompleto",
    );
    const s = statusProducao(pasta);
    expect(s.video_bruto).toBe(path.join(pasta, "VIDEO", "bruto.MOV"));
    expect(s.video_final).toBe(path.join(pasta, "VIDEO_JEEP.mp4"));
    expect(s.video_leve).toBe(path.join(pasta, "ANUNCIO", "ANUNCIO_JEEP.mp4"));
    expect([s.video_final_bytes, s.video_leve_bytes]).toEqual([1000, 200]);
    expect(s.criativos).toEqual([]);
  });
  it("lê a última venda de cada veículo do CSV do BNDV e informa quando ele foi gravado", () => {
    fs.rmSync(path.join(raiz, "vendas.csv"), { force: true });
    expect(ultimasVendas()).toEqual({ vendas: {}, atualizadoEm: null });
    fs.writeFileSync(
      path.join(raiz, "vendas.csv"),
      "﻿idSale;date;idVehicle;plate\r\n" +
        '"1";"2026-10-08T00:00:00.000";"500";"AAA1A11"\r\n' +
        '"2";"2026-10-09T00:00:00.000";"500";"AAA1A11"\r\n' +
        '"3";"2026-10-01T00:00:00.000";"600";"BBB2B22"\r\n',
    );
    const r = ultimasVendas();
    expect(r.vendas).toEqual({
      500: "2026-10-09T00:00:00.000",
      600: "2026-10-01T00:00:00.000",
    });
    expect(Date.now() - Date.parse(r.atualizadoEm)).toBeLessThan(60_000);
  });
  it("guarda anúncios sem depender do veículo existir", () => {
    executar(
      "INSERT INTO anuncios(veiculo_id,estoque_id,modelo,campanha,criado_dia) VALUES($1,$2,$3,$4,$5)",
      [99, 500, "Jeep", "[VENDA] JEEP", "2026-10-05"],
    );
    expect(
      consultar(
        "SELECT modelo, pausado_dia FROM anuncios WHERE estoque_id=$1",
        [500],
      ),
    ).toEqual([{ modelo: "Jeep", pausado_dia: null }]);
  });
  it("cria as sete migrações e aceita placeholders repetidos", () => {
    const r = executar("INSERT INTO veiculos(nome,placa) VALUES($1,$2)", [
      "FIESTA",
      "ABC1D23",
    ]);
    expect(
      consultar("SELECT nome FROM veiculos WHERE nome=$1 OR placa=$1", [
        "FIESTA",
      ]),
    ).toEqual([{ nome: "FIESTA" }]);
    expect(consultar("SELECT count(*) AS n FROM studio_migracoes")[0].n).toBe(
      7,
    );
    expect(r.lastInsertId).toBeGreaterThan(0);
  });
});
