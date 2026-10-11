import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, afterAll } from "vitest";
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-nucleo-"));
vi.mock("../src/main/caminhos", () => ({
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
  ficha,
} from "../src/main/estoque/sync";
import { dadosBndv } from "../src/main/estoque/balanco";
import {
  dentro,
  nomeSeguro,
  renomearFotos,
  statusProducao,
  documentoNaPasta,
  previaFotos,
  copiarComoDoc,
} from "../src/main/studio/arquivos";
import {
  executar,
  selecionar as consultar,
  banco,
} from "../src/main/studio/banco";
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
  it("cria as seis migrações e aceita placeholders repetidos", () => {
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
      6,
    );
    expect(r.lastInsertId).toBeGreaterThan(0);
  });
});
