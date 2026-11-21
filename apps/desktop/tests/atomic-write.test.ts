/**
 * Testes (Vitest) de src/main/core/atomic-write.ts: gravação atômica (temporário + renomear).
 * O ponto principal é a interrupção: se a gravação ou a troca falha no meio, o arquivo antigo
 * continua inteiro e nenhum temporário fica para trás.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gravarAtomico } from "../src/main/core/atomic-write";

let pasta = "";
beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "soul-atomico-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(pasta, { recursive: true, force: true });
});
const sobras = () => fs.readdirSync(pasta).filter((n) => n.endsWith(".tmp"));

describe("gravarAtomico", () => {
  it("cria o arquivo e a pasta que faltam", () => {
    const alvo = path.join(pasta, "a", "b", "config.json");
    gravarAtomico(alvo, '{"ok":true}');
    expect(fs.readFileSync(alvo, "utf8")).toBe('{"ok":true}');
    expect(sobras()).toEqual([]);
  });

  it("substitui o conteúdo anterior por inteiro", () => {
    const alvo = path.join(pasta, "estado.json");
    fs.writeFileSync(alvo, "x".repeat(5000));
    gravarAtomico(alvo, "novo");
    expect(fs.readFileSync(alvo, "utf8")).toBe("novo");
    expect(sobras()).toEqual([]);
  });

  it("preserva acentos (UTF-8)", () => {
    const alvo = path.join(pasta, "a.json");
    gravarAtomico(alvo, '{"nome":"João Ação"}');
    expect(JSON.parse(fs.readFileSync(alvo, "utf8")).nome).toBe("João Ação");
  });

  it("falha ao escrever o temporário: o arquivo antigo fica intacto e nada sobra", () => {
    const alvo = path.join(pasta, "estado.json");
    fs.writeFileSync(alvo, "ANTIGO");
    const escrever = fs.writeFileSync;
    vi.spyOn(fs, "writeFileSync").mockImplementation(((
      arq: fs.PathOrFileDescriptor,
      dados: never,
      op?: never,
    ) => {
      if (String(arq).endsWith(".tmp")) {
        // grava só um pedaço e "cai", como num disco cheio ou desligamento
        escrever(arq, "PARC");
        throw new Error("disco cheio");
      }
      return escrever(arq, dados, op);
    }) as typeof fs.writeFileSync);
    expect(() => gravarAtomico(alvo, "NOVO COMPLETO")).toThrow("disco cheio");
    expect(fs.readFileSync(alvo, "utf8")).toBe("ANTIGO");
    expect(sobras()).toEqual([]);
  });

  it("falha na troca (renomear): o arquivo antigo fica intacto e o temporário é removido", () => {
    const alvo = path.join(pasta, "estado.json");
    fs.writeFileSync(alvo, "ANTIGO");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw Object.assign(new Error("sem permissão"), { code: "EXDEV" });
    });
    expect(() => gravarAtomico(alvo, "NOVO")).toThrow("sem permissão");
    expect(fs.readFileSync(alvo, "utf8")).toBe("ANTIGO");
    expect(sobras()).toEqual([]);
  });

  it("tenta de novo quando o antivírus segura o destino por instantes (EBUSY)", () => {
    const alvo = path.join(pasta, "estado.json");
    fs.writeFileSync(alvo, "ANTIGO");
    const renomear = fs.renameSync;
    let tentativas = 0;
    vi.spyOn(fs, "renameSync").mockImplementation(((
      de: fs.PathLike,
      para: fs.PathLike,
    ) => {
      if (++tentativas < 3)
        throw Object.assign(new Error("ocupado"), { code: "EBUSY" });
      return renomear(de, para);
    }) as typeof fs.renameSync);
    gravarAtomico(alvo, "NOVO");
    expect(tentativas).toBe(3);
    expect(fs.readFileSync(alvo, "utf8")).toBe("NOVO");
    expect(sobras()).toEqual([]);
  });

  it("desiste depois de poucas tentativas e preserva o antigo", () => {
    const alvo = path.join(pasta, "estado.json");
    fs.writeFileSync(alvo, "ANTIGO");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw Object.assign(new Error("ocupado"), { code: "EBUSY" });
    });
    expect(() => gravarAtomico(alvo, "NOVO")).toThrow("ocupado");
    expect(fs.readFileSync(alvo, "utf8")).toBe("ANTIGO");
    expect(sobras()).toEqual([]);
  });
});
