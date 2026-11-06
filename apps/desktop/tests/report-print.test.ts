/**
 * Testes (Vitest) de src/main/inventory/report-print.ts (estilo A4 do relatório).
 */
import { describe, expect, it } from "vitest";
import {
  ESTILO_IMPRESSAO,
  RODAPE_PDF,
  comEstiloDeImpressao,
  nomeDoPdf,
} from "../src/main/inventory/report-print";

describe("impressão do relatório em A4", () => {
  it("acrescenta o estilo no fim, sem mexer no conteúdo", () => {
    const html = "<!doctype html><html><style>h1{}</style><h1>Oi</h1></html>";
    const r = comEstiloDeImpressao(html);
    expect(r.startsWith(html)).toBe(true);
    expect(r.endsWith(ESTILO_IMPRESSAO)).toBe(true);
    expect(r.match(/@page/g)).toHaveLength(1);
  });

  it("define página A4, cabeçalho de tabela repetido e esconde filtros e setas", () => {
    expect(ESTILO_IMPRESSAO).toContain("size: A4");
    expect(ESTILO_IMPRESSAO).toContain(
      "thead { display: table-header-group; }",
    );
    expect(ESTILO_IMPRESSAO).toMatch(
      /\.busca, \.mes-navegacao button \{ display: none/,
    );
    expect(ESTILO_IMPRESSAO).toContain(
      "section:has(#tb) { break-inside: auto; }",
    );
  });

  it("sugere um nome de arquivo com a data local", () => {
    expect(nomeDoPdf(new Date(2026, 9, 11))).toBe(
      "Relatorio-SOUL-Cars-2026-10-11.pdf",
    );
    expect(nomeDoPdf(new Date(2026, 0, 5))).toBe(
      "Relatorio-SOUL-Cars-2026-01-05.pdf",
    );
  });

  it("o rodapé usa os campos de página do Chromium", () => {
    expect(RODAPE_PDF).toContain('class="pageNumber"');
    expect(RODAPE_PDF).toContain('class="totalPages"');
  });
});
