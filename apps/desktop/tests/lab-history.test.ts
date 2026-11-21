/**
 * Testes da análise do histórico do uTalk (dados 100% fictícios): anonimização, ranking de perguntas,
 * repetição em sequência, privacidade (frases raras não saem) e agrupamento rápido no histórico inteiro.
 */
import { describe, expect, it } from "vitest";
import {
  agrupar,
  analisarHistorico,
  anonimizar,
  cenariosDoHistorico,
  relatorioMarkdown,
} from "../src/main/lab/history-analysis";
import type { ConversaLida } from "../src/main/soul-ai/memory";
import { similaridade, tokens } from "../src/shared/pre-service-guard";

const msg = (
  id: string,
  origem: "lead" | "vendedor",
  texto: string,
  min: number,
) => ({
  id,
  em: new Date(Date.UTC(2026, 0, 1, 12, min)).toISOString(),
  origem,
  tipo: "Text",
  texto,
  privada: false,
  atendente: null,
});

const conversa = (
  id: string,
  mensagens: ConversaLida["mensagens"],
): ConversaLida => ({
  id,
  contatoId: "c" + id,
  nome: "Fulano de Tal",
  telefone: "11999990000",
  criadaEm: null,
  eventoEm: null,
  aberta: false,
  fechadaEm: null,
  setor: null,
  atendente: null,
  canal: null,
  etiquetas: [],
  anuncio: null,
  mensagens,
});

describe("anonimizar", () => {
  it("remove CPF, telefone, e-mail e link", () => {
    const t = anonimizar(
      "cpf 529.982.247-25 tel (11) 98888-7777 a@b.com https://x.com/y",
    );
    expect(t).not.toMatch(/529|98888|a@b|x\.com/);
  });
});

describe("analisarHistorico", () => {
  const dez = Array.from({ length: 4 }, (_, i) =>
    conversa(String(i), [
      msg(`a${i}`, "lead", "Qual o valor da entrada?", 0),
      msg(
        `b${i}`,
        "vendedor",
        "Depende do carro e da análise, posso te explicar melhor.",
        2,
      ),
      msg(
        `c${i}`,
        "vendedor",
        "Depende do carro e da análise, posso te explicar melhor.",
        3,
      ),
    ]),
  );

  it("conta mensagens, repetição em sequência e resposta mediana", () => {
    const a = analisarHistorico(dez);
    expect(a.conversas).toBe(4);
    expect(a.mensagens).toBe(12);
    expect(a.conversasComRepeticao).toBe(4);
    expect(a.repeticoesSeguidas).toBe(4);
    expect(a.respostaMedianaMin).toBe(2);
  });

  it("lista só o que se repete (privacidade)", () => {
    const a = analisarHistorico([
      ...dez,
      conversa("x", [msg("z", "lead", "Frase única do cliente raro?", 0)]),
    ]);
    expect(a.perguntasFrequentes[0].texto).toContain("entrada");
    expect(a.perguntasFrequentes[0].vezes).toBe(4);
    expect(JSON.stringify(a)).not.toContain("raro");
    expect(JSON.stringify(a)).not.toContain("Fulano");
  });

  it("gera relatório e cenários", () => {
    const a = analisarHistorico(dez);
    expect(relatorioMarkdown(a)).toContain("Perguntas mais frequentes");
    expect(cenariosDoHistorico(a)[0].origem).toBe("historico");
  });
});

describe("agrupar", () => {
  /** Versão original (compara com todos os grupos): referência do resultado esperado. */
  const referencia = (textos: string[], minimo: number, limite: number) => {
    const grupos: { texto: string; vezes: number }[] = [];
    for (const t of textos) {
      if (tokens(t).length < 2) continue;
      const g = grupos.find((x) => similaridade(x.texto, t) >= 0.7);
      if (g) g.vezes++;
      else grupos.push({ texto: t, vezes: 1 });
    }
    return grupos
      .filter((g) => g.vezes >= minimo)
      .sort((a, b) => b.vezes - a.vezes)
      .slice(0, limite);
  };

  // Gerador determinístico de frases fictícias, com muitas quase-iguais.
  const frases = (n: number, semente = 7) => {
    const vocab =
      "oi bom dia carro valor entrada parcela troca financia aceita cartao vista onde fica loja horario sabado km ano preco foto video ainda disponivel tem quero ver".split(
        " ",
      );
    let x = semente;
    const r = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    return Array.from({ length: n }, () => {
      const k = 2 + Math.floor(r() * 7);
      return Array.from(
        { length: k },
        () => vocab[Math.floor(r() * vocab.length)],
      ).join(" ");
    });
  };

  it("dá o mesmo resultado da comparação com todos os grupos", () => {
    for (const semente of [1, 2, 3]) {
      const textos = frases(400, semente);
      expect(agrupar(textos, 1, 1e9)).toEqual(referencia(textos, 1, 1e9));
      expect(agrupar(textos, 3, 20)).toEqual(referencia(textos, 3, 20));
    }
  });

  it("aguenta o histórico inteiro sem travar (100 mil mensagens)", () => {
    const textos = frases(100_000, 11);
    const inicio = Date.now();
    agrupar(textos, 3, 40);
    expect(Date.now() - inicio).toBeLessThan(5000);
  });
});
