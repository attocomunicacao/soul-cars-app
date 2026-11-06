/**
 * Testes (Vitest) de src/renderer/src/lib/report-frame.ts (altura do iframe do relatório).
 */
import { describe, expect, it } from "vitest";
import {
  MENSAGEM_ALTURA,
  alturaDaMensagem,
  comAvisoDeAltura,
} from "../src/renderer/src/lib/report-frame";

describe("altura do relatório completo", () => {
  it("coloca o aviso de altura antes de </body>, uma vez só", () => {
    const html = "<html><body><h1>Oi</h1></body></html>";
    const r = comAvisoDeAltura(html);
    expect(r.match(/<script>/g)).toHaveLength(1);
    expect(r.indexOf("<script>")).toBeLessThan(r.indexOf("</body>"));
    expect(r).toContain(MENSAGEM_ALTURA);
    expect(r.endsWith("</body></html>")).toBe(true);
  });

  it("sem </body>, acrescenta no fim; sem relatório, só o aviso", () => {
    expect(
      comAvisoDeAltura("<h1>x</h1>").startsWith("<h1>x</h1><script>"),
    ).toBe(true);
    expect(comAvisoDeAltura("")).toContain("<script>");
  });

  it("não quebra se o texto do relatório tiver $& ou $1", () => {
    const html = "<body>R$& $1 total</body>";
    expect(comAvisoDeAltura(html)).toContain("R$& $1 total");
  });

  it("aceita só mensagens do relatório com altura válida", () => {
    expect(alturaDaMensagem({ tipo: MENSAGEM_ALTURA, altura: 1234.2 })).toBe(
      1234,
    );
    for (const ruim of [
      null,
      "x",
      {},
      { tipo: "outra", altura: 100 },
      { tipo: MENSAGEM_ALTURA, altura: -5 },
      { tipo: MENSAGEM_ALTURA, altura: NaN },
      { tipo: MENSAGEM_ALTURA, altura: "900" },
    ])
      expect(alturaDaMensagem(ruim)).toBeNull();
    expect(alturaDaMensagem({ tipo: MENSAGEM_ALTURA, altura: 9e9 })).toBe(
      200000,
    );
  });
});
