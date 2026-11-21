/**
 * Garante que a lista em Markdown dos cenários (docs/ai/lab-cenarios.md) acompanha o corpus. Para
 * regenerar: `npm run lab:corpus` (define LAB_ATUALIZAR=1 e reescreve o arquivo).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listaEmMarkdown } from "../src/shared/lab-corpus";

const ARQUIVO = path.resolve(__dirname, "../../../docs/ai/lab-cenarios.md");

describe("lista de cenários em Markdown", () => {
  it("está atualizada com o corpus", () => {
    const esperado = listaEmMarkdown();
    if (process.env.LAB_ATUALIZAR) {
      fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
      fs.writeFileSync(ARQUIVO, esperado);
    }
    const atual = fs.existsSync(ARQUIVO)
      ? fs.readFileSync(ARQUIVO, "utf8").replace(/\r\n/g, "\n")
      : "";
    expect(atual, "rode `npm run lab:corpus` para atualizar").toBe(esperado);
  });
});
