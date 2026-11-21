/**
 * Testes (Vitest) da política de segurança de conteúdo (CSP) da janela principal (src/main/core/csp.ts).
 * A janela é a que tem a ponte para o disco: a política barra qualquer carga de fora do app e qualquer
 * script que não seja o próprio. O ponto frágil é o iframe do relatório, que herda a política e tem
 * um script inline: ele é liberado por hash, e o teste garante que o hash é o do script de verdade.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashDoScript, politicaDoRenderer } from "../src/main/core/csp";
import fs from "node:fs";
import { SCRIPT_DA_PAGINA_DO_RELATORIO } from "../src/shared/report-page-script";
import { CORPO_DO_SCRIPT_DE_ALTURA } from "../src/shared/report-script";

const diretiva = (politica: string, nome: string) =>
  politica
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(nome + " ")) ?? "";

describe("política do renderer", () => {
  const politica = politicaDoRenderer();

  it("scripts só do próprio app e do script do relatório (por hash), sem inline livre nem eval", () => {
    const scripts = diretiva(politica, "script-src");
    expect(scripts).toContain("'self'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(politica).not.toContain("'unsafe-eval'");
  });

  it("o script da página do relatório (busca, ordenação, meses) também é liberado por hash", () => {
    expect(SCRIPT_DA_PAGINA_DO_RELATORIO.length).toBeGreaterThan(500);
    expect(diretiva(politica, "script-src")).toContain(
      hashDoScript(SCRIPT_DA_PAGINA_DO_RELATORIO),
    );
  });

  it("o relatório monta o HTML com exatamente essa constante (se alguém voltar a colar o script inline, a CSP o barraria em silêncio)", () => {
    const fonte = fs.readFileSync("src/main/inventory/report.ts", "utf8");
    expect(fonte).toContain(
      "<script>${SCRIPT_DA_PAGINA_DO_RELATORIO}</script>",
    );
    // Nenhum outro <script> inline no HTML do relatório.
    expect(fonte.match(/<script>/g)).toHaveLength(1);
  });

  it("o hash liberado é o do script compartilhado do relatório", () => {
    expect(CORPO_DO_SCRIPT_DE_ALTURA.length).toBeGreaterThan(50);
    const esperado = `'sha256-${createHash("sha256").update(CORPO_DO_SCRIPT_DE_ALTURA, "utf8").digest("base64")}'`;
    expect(hashDoScript(CORPO_DO_SCRIPT_DE_ALTURA)).toBe(esperado);
    expect(diretiva(politica, "script-src")).toContain(esperado);
    // A outra ponta (o HTML do relatório injeta exatamente este texto) está em report-frame.test.ts.
  });

  it("nenhum endereço de fora é liberado: o app é local", () => {
    expect(politica).not.toMatch(/https?:/);
    expect(politica).not.toMatch(/(^|[\s;])\*(\s|;|$)/);
  });

  it("plugins, base e formulários desligados", () => {
    expect(diretiva(politica, "object-src")).toBe("object-src 'none'");
    expect(diretiva(politica, "base-uri")).toBe("base-uri 'none'");
    expect(diretiva(politica, "form-action")).toBe("form-action 'none'");
  });

  it("imagens e fontes aceitam o que o app gera (data: e blob:)", () => {
    expect(diretiva(politica, "img-src")).toMatch(/data:/);
    expect(diretiva(politica, "img-src")).toMatch(/blob:/);
    expect(diretiva(politica, "font-src")).toMatch(/data:/);
  });

  it("não tem quebra de linha nem aspas duplas (vai dentro de um atributo HTML)", () => {
    expect(politica).not.toMatch(/[\n\r"]/);
  });
});
