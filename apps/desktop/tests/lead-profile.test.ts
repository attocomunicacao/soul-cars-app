/**
 * Testes (Vitest) da ficha do lead do Pré-atendimento IA (src/shared/lead-profile.ts): extração de
 * CPF, nascimento e entrada, coleta de dados do financiamento, máscara e resumo para o SDR.
 * CPF de teste público e válido (529.982.247-25); nenhum dado real.
 */
import { describe, expect, it } from "vitest";
import {
  FICHA_VAZIA,
  avisoDeFinanciamento,
  blocoFicha,
  cpfValido,
  extrairDados,
  faltando,
  fichaDaConversa,
  frasePedido,
  mascarar,
  mascararConversa,
  podeTransferir,
  resumoParaSdr,
} from "../src/shared/lead-profile";
import {
  LOJA_PADRAO,
  PERSONA_PADRAO,
  interpretarResposta,
  montarMensagens,
} from "../src/shared/pre-service";

const AGORA = new Date(2026, 10, 19);
const CPF = "529.982.247-25";

describe("CPF, nascimento e entrada", () => {
  it("valida os dígitos verificadores", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("12345678900")).toBe(false);
    expect(cpfValido("11951569193")).toBe(false); // telefone, não CPF
  });

  it("lê CPF com e sem pontuação e ignora número que não é CPF", () => {
    expect(extrairDados(`meu cpf é ${CPF}`, "", AGORA).cpf).toBe("52998224725");
    expect(extrairDados("cpf 52998224725", "", AGORA).cpf).toBe("52998224725");
    expect(extrairDados("liga 11951569193", "", AGORA).cpf).toBe("");
  });

  it("lê nascimento plausível e rejeita datas impossíveis ou de menor", () => {
    expect(extrairDados("nasci em 15/03/1990", "", AGORA).nascimento).toBe(
      "15/03/1990",
    );
    expect(extrairDados("15/03/90", "", AGORA).nascimento).toBe("15/03/1990");
    expect(extrairDados("32/13/1990", "", AGORA).nascimento).toBe("");
    expect(extrairDados("10/10/2015", "", AGORA).nascimento).toBe("");
  });

  it("entende a entrada de vários jeitos", () => {
    const e = (t: string, antes = "") => extrairDados(t, antes, AGORA).entrada;
    expect(e("tenho 10 mil de entrada")).toBe("R$ 10.000");
    expect(e("entrada de 15.000")).toBe("R$ 15.000");
    expect(e("dou 20k de entrada")).toBe("R$ 20.000");
    expect(e("sem entrada")).toBe("sem entrada");
    expect(e("10 mil")).toBe(""); // sem a IA ter perguntado, não é entrada
    expect(e("10 mil", "Quanto você dispõe de entrada?")).toBe("R$ 10.000");
    expect(
      e(`cpf ${CPF}, nasci 15/03/1990 e tenho 10 mil`, "e a entrada?"),
    ).toBe("R$ 10.000");
    expect(e("meu carro é 2019", "Quanto você dispõe de entrada?")).toBe("");
  });
});

describe("coleta de dados do financiamento", () => {
  const pergunta = frasePedido({
    ...FICHA_VAZIA,
    pediuFinanciamento: true,
  });

  it("a frase pede só o que falta", () => {
    expect(pergunta).toBe(
      "Consigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento. Quanto você dispõe de entrada?",
    );
    expect(
      frasePedido({ ...FICHA_VAZIA, pediuFinanciamento: true, cpf: "x" }),
    ).toBe(
      "Consigo fazer uma análise de crédito pra você: preciso da sua data de nascimento. Quanto você dispõe de entrada?",
    );
    expect(
      frasePedido({
        ...FICHA_VAZIA,
        pediuFinanciamento: true,
        nascimento: "01/01/1990",
        entrada: "R$ 5.000",
      }),
    ).toBe(
      "Consigo fazer uma análise de crédito pra você: preciso do seu CPF.",
    );
    expect(
      frasePedido({
        ...FICHA_VAZIA,
        pediuFinanciamento: true,
        cpf: "x",
        nascimento: "01/01/1990",
      }),
    ).toBe("Para a análise de crédito, quanto você dispõe de entrada?");
  });

  it("sem pedido de financiamento nada falta e a IA pode transferir", () => {
    const f = fichaDaConversa(
      [{ role: "user", content: "Quero ver o Kicks" }],
      FICHA_VAZIA,
      AGORA,
    );
    expect(faltando(f)).toEqual([]);
    expect(podeTransferir(f)).toBe(true);
    expect(avisoDeFinanciamento(f)).toBe("");
  });

  it("financiamento: bloqueia a transferência até ter CPF, nascimento e entrada", () => {
    const c1 = [{ role: "user" as const, content: "Vcs financiam?" }];
    const f1 = fichaDaConversa(c1, FICHA_VAZIA, AGORA);
    expect(f1.pediuFinanciamento).toBe(true);
    expect(faltando(f1)).toEqual(["CPF", "data de nascimento", "entrada"]);
    expect(podeTransferir(f1)).toBe(false);
    expect(avisoDeFinanciamento(f1)).toContain(
      "preciso do seu CPF e data de nascimento",
    );
    expect(avisoDeFinanciamento(f1)).toContain("NÃO inclua [TRANSFERIR]");

    const c2 = [
      ...c1,
      { role: "assistant" as const, content: pergunta },
      {
        role: "user" as const,
        content: `cpf ${CPF}, nasci em 15/03/1990 e tenho 10 mil`,
      },
    ];
    const f2 = fichaDaConversa(c2, FICHA_VAZIA, AGORA);
    expect(faltando(f2)).toEqual([]);
    expect(podeTransferir(f2)).toBe(true);
    expect(avisoDeFinanciamento(f2)).toContain("inclua [TRANSFERIR]");
    // idempotente: rodar de novo com as mesmas mensagens não muda nada
    expect(fichaDaConversa(c2, f2, AGORA)).toEqual(f2);
  });

  it("depois de pedir duas vezes ou se o cliente recusa, pode transferir", () => {
    const base = [
      { role: "user" as const, content: "Quero financiar" },
      { role: "assistant" as const, content: pergunta },
      { role: "user" as const, content: "depois" },
      { role: "assistant" as const, content: pergunta },
      { role: "user" as const, content: "agora não" },
    ];
    expect(podeTransferir(fichaDaConversa(base, FICHA_VAZIA, AGORA))).toBe(
      true,
    );
    const recusa = fichaDaConversa(
      [
        { role: "user", content: "Quero financiar" },
        { role: "user", content: "não quero passar meu cpf por aqui" },
      ],
      FICHA_VAZIA,
      AGORA,
    );
    expect(recusa.recusou).toBe(true);
    expect(podeTransferir(recusa)).toBe(true);
  });

  it("[TRANSFERIR] é bloqueado quando a opção pede", () => {
    const bruto = "Ok! [TRANSFERIR]";
    const conversa = [{ role: "user" as const, content: "Vcs financiam?" }];
    expect(interpretarResposta(bruto, conversa).transferir).toBe(true);
    expect(
      interpretarResposta(bruto, conversa, { bloquearTransferencia: true })
        .transferir,
    ).toBe(false);
  });
});

describe("ficha no prompt, máscara e resumo", () => {
  const ficha = {
    ...FICHA_VAZIA,
    veiculo: "Jeep Renegade",
    pediuFinanciamento: true,
    formaPagamento: "financiamento" as const,
    entrada: "R$ 10.000",
    cpf: "enc:abc",
    nascimento: "15/03/1990",
  };

  it("o prompt mostra o que já sabemos sem expor CPF nem nascimento", () => {
    const bloco = blocoFicha(ficha);
    expect(bloco).toContain("Carro de interesse: Jeep Renegade");
    expect(bloco).toContain("CPF: informado");
    expect(bloco).not.toContain("15/03/1990");
    const sistema = montarMensagens({
      persona: PERSONA_PADRAO,
      loja: LOJA_PADRAO,
      config: { nomeAgente: "Sofia" } as never,
      veiculos: [],
      respostas: [],
      exemplos: [],
      reais: [],
      conversa: [{ role: "user", content: "Oi" }],
      nomeLead: "Ana",
      ficha,
    }).mensagens[0].content;
    expect(sistema).toContain("O QUE JÁ SABEMOS DO LEAD");
    expect(sistema).not.toContain("15/03/1990");
  });

  it("mascara CPF sempre e datas só quando falam de nascimento", () => {
    expect(mascarar(`cpf ${CPF}`)).toBe("cpf [CPF informado]");
    expect(mascarar("passo na loja dia 20/11/2026")).toBe(
      "passo na loja dia 20/11/2026",
    );
    const m = mascararConversa([
      { role: "assistant", content: "Qual sua data de nascimento?" },
      { role: "user", content: "15/03/1990" },
      { role: "user", content: "visita em 20/11/2026" },
    ]);
    expect(m[1].content).toBe("[data de nascimento informada]");
    expect(m[2].content).toBe("visita em 20/11/2026");
  });

  it("o resumo do SDR leva o CPF completo só na nota privada", () => {
    const nota = resumoParaSdr(ficha, { nome: "Ana", cpfPlano: "52998224725" });
    expect(nota).toContain(`CPF: ${CPF}`);
    expect(nota).toContain("Nascimento: 15/03/1990");
    expect(nota).toContain("Entrada: R$ 10.000");
    const painel = resumoParaSdr(ficha, { nome: "Ana" });
    expect(painel).toContain("CPF: informado no chat");
    expect(painel).not.toContain(CPF);
  });
});
