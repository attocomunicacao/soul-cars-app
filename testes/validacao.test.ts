import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  criarEsquemas,
  EXTENSOES_EXECUTAVEIS,
  METODOS_DO_MOTOR,
} from "../src/main/ipc-esquemas";
import { validarChamada } from "../src/main/validacao";

const raiz = path.join(os.tmpdir(), "soul-validacao", "dados");
const interno = path.join(os.tmpdir(), "soul-validacao", "interno");
const esquemas = criarEsquemas({
  raizes: () => [raiz, interno],
  raizesAbrir: () => [raiz, interno],
});
const chamar = (
  comando: string,
  args: unknown = {},
  cab: unknown = {},
  corpo: Uint8Array | null = null,
) => validarChamada(comando, esquemas[comando], args, cab, corpo);

describe("cobertura dos esquemas", () => {
  it("todo comando de ipc.ts tem esquema, e só eles", () => {
    const fonte = fs.readFileSync("src/main/ipc.ts", "utf8");
    const bloco = fonte.slice(
      fonte.indexOf("const COMANDOS"),
      fonte.indexOf("const ESQUEMAS"),
    );
    const comandos = [...bloco.matchAll(/^ {2}([a-z_]+): (?:\(|async)/gm)].map(
      (m) => m[1],
    );
    expect(comandos.length).toBeGreaterThan(50);
    expect(comandos.filter((c) => !esquemas[c])).toEqual([]);
    expect(Object.keys(esquemas).filter((c) => !comandos.includes(c))).toEqual(
      [],
    );
  });

  it("os métodos do motor conferem com engine/main.py", () => {
    const py = fs.readFileSync("engine/main.py", "utf8");
    const metodos = [...py.matchAll(/^ {4}"([a-z_]+)": [a-z_]+,$/gm)].map(
      (m) => m[1],
    );
    expect([...METODOS_DO_MOTOR].sort()).toEqual(metodos.sort());
  });
});

describe("validação de argumentos", () => {
  it("descarta campos a mais e exige os obrigatórios", () => {
    const v = chamar("instagram_plano", { id: 7, intruso: "x" });
    expect(v.args).toEqual({ id: 7 });
    expect(() => chamar("instagram_plano", {})).toThrow(/id/);
    expect(() => chamar("instagram_plano", { id: -1.5 })).toThrow(/id/);
    expect(() => chamar("instagram_plano", { id: "7; DROP" })).toThrow(/id/);
    expect(() => chamar("instagram_plano", [])).toThrow(/objeto/);
  });

  it("aceita args nulos quando o comando não pede nada", () => {
    expect(chamar("motor_estado", null).args).toEqual({});
    expect(chamar("motor_estado", undefined).args).toEqual({});
  });

  it("limita o motor aos métodos conhecidos", () => {
    expect(() => chamar("engine_call", { method: "os.system" })).toThrow(
      /method/,
    );
    expect(chamar("engine_call", { method: "ping" }).args).toEqual({
      method: "ping",
    });
  });

  it("só aceita pastas dentro das raízes autorizadas", () => {
    const boa = path.join(raiz, "ESTOQUE", "123_FORD_FIESTA_ABC1D23");
    expect(chamar("producao_status", { pasta: boa }).args.pasta).toBe(boa);
    for (const ruim of [
      path.join(os.tmpdir(), "outra"),
      path.join(raiz, "..", "..", "Windows"),
      path.join(raiz, "..", "dados-vizinha"),
      "relativo/ESTOQUE",
    ])
      expect(() => chamar("producao_status", { pasta: ruim })).toThrow();
  });

  it("valida os cabeçalhos e exige o arquivo", () => {
    const pasta = path.join(raiz, "ESTOQUE", "1_X");
    const cab = { "x-pasta": pasta, "x-nome": "DES.md" };
    expect(() => chamar("producao_gravar", {}, cab, null)).toThrow(/arquivo/);
    expect(() =>
      chamar(
        "producao_gravar",
        {},
        { ...cab, "x-pasta": "C:/Windows" },
        new Uint8Array(1),
      ),
    ).toThrow();
    expect(
      chamar("producao_gravar", {}, cab, new Uint8Array(3)).corpo,
    ).toBeInstanceOf(Uint8Array);
    // Comandos sem arquivo nunca recebem corpo.
    expect(chamar("motor_estado", {}, {}, new Uint8Array(3)).corpo).toBeNull();
  });

  it("criativo sem destino é permitido; com destino fora da raiz, não", () => {
    const base = { "x-pasta": "carro", "x-nome": "a.png" };
    const corpo = new Uint8Array(1);
    expect(() =>
      chamar("criativo_salvar", {}, { ...base, "x-destino": "" }, corpo),
    ).not.toThrow();
    expect(() =>
      chamar(
        "criativo_salvar",
        {},
        { ...base, "x-destino": "C:/Users" },
        corpo,
      ),
    ).toThrow();
  });

  it("não existe mais SQL livre; as operações do banco são nomeadas", () => {
    expect(esquemas.sql_select).toBeUndefined();
    expect(esquemas.sql_execute).toBeUndefined();
    expect(
      Object.keys(esquemas).filter((c) => c.startsWith("db_")).length,
    ).toBeGreaterThan(10);
  });

  it("valida os comandos do banco", () => {
    // Só as colunas editáveis passam; chave presente sem valor vira NULL.
    const r = chamar("db_veiculo_atualizar", {
      id: 3,
      patch: {
        nome: "Fiesta",
        preco: 48900,
        ano: undefined,
        id: 99,
        "x; DROP TABLE veiculos": 1,
      },
    });
    expect(r.args).toEqual({
      id: 3,
      patch: { nome: "Fiesta", preco: 48900, ano: null },
    });
    expect(() =>
      chamar("db_veiculo_atualizar", { id: 3, patch: { status: "hackeado" } }),
    ).toThrow(/status/);
    expect(() =>
      chamar("db_veiculo_atualizar", { id: "3", patch: {} }),
    ).toThrow(/id/);
    expect(() =>
      chamar("db_veiculo_atualizar", { id: 3, patch: { nome: { a: 1 } } }),
    ).toThrow(/nome/);
    expect(
      chamar("db_veiculo_criar", { veiculo: { nome: "Toro", extra: 1 } }).args,
    ).toEqual({
      veiculo: { nome: "Toro" },
    });
    for (const chave of [
      "campanha_modelo",
      "ia_modo_api",
      "estoque_leitura:" + raiz + "/ESTOQUE/1_X",
    ])
      expect(() => chamar("db_config_obter", { chave })).not.toThrow();
    for (const chave of [
      "anthropic_api_key",
      "Maiuscula",
      "x y",
      "",
      "sqlite_master;--",
    ])
      expect(() => chamar("db_config_obter", { chave })).toThrow();
    expect(() =>
      chamar("db_config_salvar", { chave: "campanha_modelo", valor: 5 }),
    ).toThrow(/valor/);
    expect(
      chamar("db_config_salvar", { chave: "campanha_modelo", valor: null })
        .args,
    ).toEqual({
      chave: "campanha_modelo",
    });
  });

  it("documento precisa ser PDF; balanço só aceita números", () => {
    const pasta = path.join(raiz, "ESTOQUE", "1_X");
    expect(() =>
      chamar("producao_doc_copiar", { pasta, origem: "C:/x/a.exe" }),
    ).toThrow(/PDF/);
    expect(() =>
      chamar("producao_doc_copiar", { pasta, origem: "C:/x/a.PDF" }),
    ).not.toThrow();
    expect(() =>
      chamar("balanco_salvar", { contas: { Caixa: { Banco: "muito" } } }),
    ).toThrow(/contas/);
    expect(
      chamar("balanco_salvar", { contas: { Caixa: { Banco: 10 } } }).args,
    ).toEqual({ contas: { Caixa: { Banco: 10 } } });
  });

  it("não há mais nada de IA paga: sem comandos de segredo e sem o método gerar_textos", () => {
    expect(esquemas.segredo_definir).toBeUndefined();
    expect(esquemas.segredo_existe).toBeUndefined();
    expect(() => chamar("engine_call", { method: "gerar_textos" })).toThrow(
      /method/,
    );
    expect(() =>
      chamar("db_config_salvar", { chave: "anthropic_api_key", valor: "x" }),
    ).toThrow(/chave/);
  });

  it("config só aceita os campos permitidos", () => {
    const r = chamar("config_gravar", {
      patch: { raizDados: "C:/Dados", legadoImportado: "falso" },
    });
    expect(r.args).toEqual({ patch: { raizDados: "C:/Dados" } });
  });

  it("não deixa abrir executáveis", () => {
    for (const nome of ["a.exe", "b.BAT", "c.ps1", "d.lnk", "e.js"])
      expect(EXTENSOES_EXECUTAVEIS.test(nome)).toBe(true);
    for (const nome of ["a.mp4", "b.png", "c.pdf", "pasta"])
      expect(EXTENSOES_EXECUTAVEIS.test(nome)).toBe(false);
  });
});
