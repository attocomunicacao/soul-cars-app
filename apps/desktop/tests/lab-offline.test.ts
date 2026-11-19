/**
 * Roda o corpus INTEIRO do Laboratório sem modelo (respostas roteirizadas) e exige zero falhas de
 * pipeline: nenhuma repetição, tag vazada, CPF em claro, frase duplicada ou pergunta repetida.
 * Qualquer cenário que falhar aqui é bug do sistema (não do modelo).
 */
import { describe, expect, it } from "vitest";
import { modeloRoteirizado, rodarLote } from "../src/main/lab/runner";
import { corpusCompleto } from "../src/shared/lab-corpus";

describe("corpus completo no modo offline", () => {
  it("não produz nenhuma falha de pipeline", async () => {
    const resultados = await rodarLote(corpusCompleto(), {
      gerar: modeloRoteirizado(),
    });
    const ruins = resultados
      .filter((r) => r.falhas.length)
      .map((r) => `${r.id}: ${r.falhas.join(" | ")}`);
    expect(ruins).toEqual([]);
  });
});
