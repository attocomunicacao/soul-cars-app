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
  pastaBackups: () => path.join(interno, "backups"),
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

  it("bloqueia SQL perigoso e backup fora da pasta de backups", () => {
    expect(() => chamar("sql_select", { sql: "SELECT 1" })).not.toThrow();
    expect(() =>
      chamar("sql_execute", { sql: "ATTACH DATABASE 'x.db' AS x" }),
    ).toThrow(/não permitido/);
    expect(() =>
      chamar("sql_select", { sql: "SELECT load_extension('a')" }),
    ).toThrow(/não permitido/);
    const ok = path.join(interno, "backups", "soul-seg.db").replace(/'/g, "''");
    expect(() =>
      chamar("sql_execute", { sql: `VACUUM INTO '${ok}'` }),
    ).not.toThrow();
    expect(() =>
      chamar("sql_execute", { sql: "VACUUM INTO 'C:/Users/x/roubado.db'" }),
    ).toThrow(/backups/);
    expect(() => chamar("sql_execute", { sql: "VACUUM INTO ?" })).toThrow();
    expect(() =>
      chamar("sql_select", { sql: "SELECT ?", values: [{ a: 1 }] }),
    ).toThrow(/values/);
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

  it("o segredo só aceita texto e config só os campos permitidos", () => {
    expect(() => chamar("segredo_definir", { nome: "x", valor: 12 })).toThrow();
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
