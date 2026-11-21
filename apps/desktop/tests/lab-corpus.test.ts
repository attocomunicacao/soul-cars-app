/**
 * Valida o corpus do Laboratório da IA (antes de entregar a lista ao usuário): ids únicos, sem
 * cenários duplicados, sem espaços/palavras repetidas por descuido, CPFs de teste válidos, turnos
 * preenchidos, categorias cobertas e determinismo do gerador de variações.
 */
import { describe, expect, it } from "vitest";
import {
  CPF_TESTE,
  CPF_TESTE_2,
  cenariosBase,
  categorias,
  corpusCompleto,
  listaEmMarkdown,
  variacoes,
} from "../src/shared/lab-corpus";
import { cpfValido } from "../src/shared/lead-profile";
import { palavraRepetida } from "../src/shared/pre-service-guard";

describe("corpus do laboratório", () => {
  const base = cenariosBase();

  it("tem volume e categorias suficientes", () => {
    expect(base.length).toBeGreaterThanOrEqual(230);
    expect(categorias(base).length).toBeGreaterThanOrEqual(20);
    expect(variacoes().length).toBeGreaterThan(300);
  });

  it("ids únicos em todo o corpus", () => {
    const ids = corpusCompleto().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sem cenários duplicados (mesmas mensagens, ignorando caixa)", () => {
    const vistos = new Map<string, string>();
    const repetidos: string[] = [];
    for (const c of corpusCompleto()) {
      const chave = c.turnos.map((t) => t.trim().toLowerCase()).join("|");
      const outro = vistos.get(chave);
      if (outro) repetidos.push(`${c.id} = ${outro}`);
      else vistos.set(chave, c.id);
    }
    expect(repetidos).toEqual([]);
  });

  it("turnos preenchidos, sem espaços nas pontas nem em dobro", () => {
    for (const c of corpusCompleto()) {
      expect(c.turnos.length, c.id).toBeGreaterThan(0);
      for (const t of c.turnos) {
        expect(t.trim(), c.id).not.toBe("");
        expect(t, c.id).toBe(t.trim());
        expect(t, c.id).not.toMatch(/ {2,}/);
      }
    }
  });

  it("sem palavra repetida por descuido nos cenários escritos à mão", () => {
    for (const c of base)
      for (const t of c.turnos)
        expect(palavraRepetida(t), `${c.id}: ${t}`).toBeNull();
  });

  it("CPFs de teste são válidos e os inválidos são só os de propósito", () => {
    expect(cpfValido(CPF_TESTE.replace(/\D/g, ""))).toBe(true);
    expect(cpfValido(CPF_TESTE_2.replace(/\D/g, ""))).toBe(true);
    expect(cpfValido("12345678900")).toBe(false);
  });

  it("não traz dado real: nenhum telefone ou e-mail", () => {
    for (const c of corpusCompleto())
      for (const t of c.turnos) {
        expect(
          t.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, ""),
          c.id,
        ).not.toMatch(/\(?\d{2}\)?\s?9?\d{4}-\d{4}/);
        expect(t, c.id).not.toMatch(/@\w+\./);
      }
  });

  it("variações são determinísticas", () => {
    const a = variacoes().map((c) => c.titulo);
    const b = variacoes().map((c) => c.titulo);
    expect(a).toEqual(b);
  });

  it("lista em Markdown numera todos os cenários", () => {
    const md = listaEmMarkdown(base);
    expect(md).toContain(`${base.length}. `);
    expect(md).toContain("## saudacao");
  });
});
