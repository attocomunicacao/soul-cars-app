/**
 * Testes da análise do histórico do uTalk (dados 100% fictícios): anonimização, ranking de perguntas,
 * repetição em sequência e privacidade (frases raras não saem).
 */
import { describe, expect, it } from "vitest";
import {
  analisarHistorico,
  anonimizar,
  cenariosDoHistorico,
  relatorioMarkdown,
} from "../src/main/lab/history-analysis";
import type { ConversaLida } from "../src/main/soul-ai/memory";

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
