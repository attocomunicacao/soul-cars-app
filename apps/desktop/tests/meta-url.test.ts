/**
 * Testes (Vitest) de src/main/window/meta-url.ts: o endereço do Gerenciador de Anúncios embutido.
 * O ID da conta de anúncios vem da configuração do usuário (a mesma do painel Campanhas); nenhum ID
 * fica escrito no código, que é público.
 */
import { describe, expect, it } from "vitest";
import { urlDoGerenciadorMeta } from "../src/main/window/meta-url";

describe("urlDoGerenciadorMeta", () => {
  it("abre o Gerenciador na conta configurada (act_ e espaços são aceitos)", () => {
    for (const conta of ["act_123456789", "123456789", "  act_123456789  "])
      expect(urlDoGerenciadorMeta(conta), conta).toContain("&act=123456789");
  });

  it("sem conta configurada, abre o Gerenciador sem escolher conta", () => {
    for (const conta of [undefined, "", "   ", "act_"])
      expect(urlDoGerenciadorMeta(conta), String(conta)).not.toContain("act=");
  });

  it("só dígitos entram na URL (nada de texto do usuário vira parâmetro)", () => {
    const url = urlDoGerenciadorMeta("act_123&campaign_id=9<script>");
    expect(url).toContain("&act=1239");
    expect(url).not.toMatch(/script|campaign_id/);
    expect(urlDoGerenciadorMeta("abc")).not.toContain("act=");
  });

  it("recusa número absurdo de dígitos", () => {
    expect(urlDoGerenciadorMeta("1".repeat(40))).not.toContain("act=");
  });

  it("é sempre o endereço do Gerenciador, por https, sem campanha fixa", () => {
    const url = new URL(urlDoGerenciadorMeta("act_1"));
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("adsmanager.facebook.com");
    expect(url.searchParams.has("campaign_id")).toBe(false);
  });
});
