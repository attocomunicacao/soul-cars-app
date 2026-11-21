/**
 * Testes (Vitest) do id do runtime: o Launcher (src/main/runtime.ts) e o script do CI
 * (scripts/release/runtime-id.mjs) precisam calcular exatamente o mesmo valor, senão o
 * pacote de código nunca encontraria uma versão base compatível.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARQUIVOS_DO_RUNTIME, idDoRuntime } from "../src/main/runtime";
import {
  ARQUIVOS_DO_RUNTIME as ARQUIVOS_CI,
  idDoRuntime as idCi,
} from "../../../scripts/release/runtime-id.mjs";

/** Cria uma pasta de Electron fictícia com o conteúdo informado. */
function pastaFalsa(conteudo: string, omitir?: string): string {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-"));
  for (const nome of ARQUIVOS_DO_RUNTIME)
    if (nome !== omitir)
      fs.writeFileSync(path.join(pasta, nome), `${nome}:${conteudo}`);
  return pasta;
}

describe("id do runtime", () => {
  it("é igual no Launcher e no script do CI", () => {
    expect([...ARQUIVOS_CI]).toEqual([...ARQUIVOS_DO_RUNTIME]);
    const pasta = pastaFalsa("a");
    expect(idDoRuntime(pasta)).toMatch(/^[0-9a-f]{64}$/);
    expect(idCi(pasta)).toBe(idDoRuntime(pasta));
  });

  it("muda quando o Electron muda e ignora o resto da pasta", () => {
    const a = pastaFalsa("a");
    const b = pastaFalsa("b");
    fs.writeFileSync(path.join(a, "SoulCars.exe"), "qualquer coisa");
    expect(idDoRuntime(a)).not.toBe(idDoRuntime(b));
    expect(idDoRuntime(a)).toBe(idDoRuntime(pastaFalsa("a")));
  });

  it("devolve null quando falta um arquivo do Electron", () => {
    expect(idDoRuntime(pastaFalsa("a", "ffmpeg.dll"))).toBeNull();
  });
});
