/**
 * Testes do guarda anti-duplicação e do pipeline de pós-processamento do Pré-atendimento IA:
 * frases repetidas, quase-repetição, palavras em dobro, CPF em claro e decisões de transferência.
 */
import { describe, expect, it } from "vitest";
import {
  achados,
  cpfEmClaro,
  deduplicarFrases,
  guardarTexto,
  limpar,
  palavraRepetida,
  removerJaDito,
  respostaRepetida,
  similaridade,
} from "../src/shared/pre-service-guard";
import { deveOmitir, posProcessar } from "../src/shared/pre-service-pipeline";
import { FICHA_VAZIA } from "../src/shared/lead-profile";

describe("guarda de saída", () => {
  it("remove frase repetida dentro da mesma resposta", () => {
    const t =
      "O Civic está disponível. Posso ajudar com mais algo? O Civic está disponível.";
    expect(deduplicarFrases(t)).toBe(
      "O Civic está disponível. Posso ajudar com mais algo?",
    );
  });

  it("não mexe em linhas de lista", () => {
    const t = "Temos 2 veículos:\n- Onix 2020\n- Onix 2020";
    expect(deduplicarFrases(t)).toBe(t);
  });

  it("remove frase longa já dita nas últimas respostas", () => {
    const antes = [
      "O Civic 2018 tem 84.000 km e está com todas as revisões feitas.",
    ];
    const novo =
      "O Civic 2018 tem 84.000 km e está com todas as revisões feitas. Ele aceita troca.";
    expect(removerJaDito(novo, antes)).toBe("Ele aceita troca.");
  });

  it("mantém frases curtas repetidas", () => {
    expect(removerJaDito("Certo! Combinado.", ["Certo! Combinado."])).toBe(
      "Certo! Combinado.",
    );
  });

  it("detecta resposta quase igual", () => {
    const a = "Sim, o Corolla 2019 ainda está disponível para você.";
    const b = "Sim! O Corolla 2019 ainda está disponível pra você.";
    expect(similaridade(a, b)).toBeGreaterThan(0.6);
    expect(respostaRepetida(a, [a])).toBe(true);
    expect(respostaRepetida("Qual é a sua região?", [a])).toBe(false);
  });

  it("acha palavra repetida e limpa", () => {
    expect(palavraRepetida("Vou verificar de de novo")).toBe("de");
    expect(palavraRepetida("Muito muito bom")).toBeNull();
    expect(limpar("Olá!!  Tudo   bem ?  Vamos de de novo")).toBe(
      "Olá! Tudo bem? Vamos de novo",
    );
  });

  it("detecta CPF válido em claro e ignora número aleatório", () => {
    expect(cpfEmClaro("Seu CPF 529.982.247-25 foi anotado")).toBe(true);
    expect(cpfEmClaro("Ligue 11111111111")).toBe(false);
  });

  it("guardarTexto encadeia as limpezas", () => {
    const antes = [
      "Temos o Onix 2020 por R$ 79.900 com poucos quilômetros rodados.",
    ];
    const saida = guardarTexto(
      "Temos o Onix 2020 por R$ 79.900 com poucos quilômetros rodados. Quer saber mais?  Quer saber mais?",
      antes,
    );
    expect(saida).toBe("Quer saber mais?");
  });

  it("achados lista os problemas restantes", () => {
    expect(achados("Olá. Olá.")).toContain("frase-duplicada");
    expect(achados("Texto  com  espaço")).toContain("texto-sujo");
    expect(achados("Tudo certo por aqui.")).toEqual([]);
  });
});

describe("pipeline de pós-processamento", () => {
  const conversa = [{ role: "user" as const, content: "Quero ver o Onix" }];

  it("remove a repetição do modelo e devolve só o texto novo", () => {
    const anterior =
      "O Onix 2020 está disponível por R$ 79.900 e tem 40.000 km rodados.";
    const r = posProcessar({
      bruto: `${anterior} Ele tem ar-condicionado.`,
      conversa,
      veiculos: [],
      fotos: 0,
      anteriores: [anterior],
    });
    expect(r.texto).toBe("Ele tem ar-condicionado.");
  });

  it("não omite transferência nem envio de fotos", () => {
    const t = "Combinado! Um consultor vai te ligar.";
    expect(deveOmitir(t, [t], { transferir: true, fotos: 0 })).toBe(false);
    expect(deveOmitir(t, [t], { transferir: false, fotos: 3 })).toBe(false);
    expect(deveOmitir(t, [t], { transferir: false, fotos: 0 })).toBe(true);
  });

  it("encerrar sem ficha mantém o texto", () => {
    const r = posProcessar({
      bruto: "Obrigado pelo contato! [ENCERRAR]",
      conversa,
      ficha: { ...FICHA_VAZIA },
      veiculos: [],
      fotos: 0,
      anteriores: [],
    });
    expect(r.encerrar).toBe(true);
    expect(r.transferir).toBe(false);
  });
});
