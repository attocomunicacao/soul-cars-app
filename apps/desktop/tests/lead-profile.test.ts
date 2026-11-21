/**
 * Testes (Vitest) da ficha do lead do Pré-atendimento IA (src/shared/lead-profile.ts): extração de
 * CPF, nascimento, entrada, região, forma de aquisição, CNH e horário da ligação; ordem da
 * qualificação; regras de transferência; nota do SDR e máscara. CPF de teste público e válido
 * (529.982.247-25); nenhum dado real.
 */
import { describe, expect, it } from "vitest";
import {
  FICHA_VAZIA,
  avisoDeColeta,
  blocoFicha,
  coletaAtiva,
  coletaCompleta,
  cpfValido,
  extrairDados,
  fichaCompativel,
  fichaDaConversa,
  mascarar,
  mascararConversa,
  motivoDaTransferencia,
  pediuHumano,
  pendentes,
  podeTransferir,
  proximaPergunta,
  resumoParaSdr,
  rotulos,
  type FichaLead,
} from "../src/shared/lead-profile";
import {
  LOJA_PADRAO,
  PERSONA_PADRAO,
  RESPOSTAS_PADRAO,
  interpretarResposta,
  montarMensagens,
} from "../src/shared/pre-service";
import type { MensagemIa } from "../src/shared/pre-service";

const AGORA = new Date(2026, 10, 19);
const CPF = "529.982.247-25";
const ia = (content: string): MensagemIa => ({ role: "assistant", content });
const cli = (content: string): MensagemIa => ({ role: "user", content });
/** Ficha de um lead que já demonstrou interesse num carro (a coleta está ativa). */
const interessado: FichaLead = { ...FICHA_VAZIA, veiculo: "Jeep Renegade" };

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
    const n = (t: string) => extrairDados(t, "", AGORA).nascimento;
    expect(n("nasci em 15/03/1990")).toBe("15/03/1990");
    expect(n("15/03/90")).toBe("15/03/1990");
    expect(n("32/13/1990")).toBe("");
    expect(n("10/10/2015")).toBe("");
  });

  it("entende a entrada de vários jeitos", () => {
    const e = (t: string, antes = "") => extrairDados(t, antes, AGORA).entrada;
    expect(e("tenho 10 mil de entrada")).toBe("R$ 10.000");
    expect(e("entrada de 15.000")).toBe("R$ 15.000");
    expect(e("dou 20k de entrada")).toBe("R$ 20.000");
    expect(e("sem entrada")).toBe("sem entrada");
    expect(e("10 mil")).toBe(""); // sem a IA ter perguntado, não é entrada
    expect(e("10 mil", "Quanto você dispõe de entrada?")).toBe("R$ 10.000");
    expect(e("R$10.000,00", "Quanto você dispõe de entrada?")).toBe(
      "R$ 10.000",
    );
    expect(e("meu carro é 2019", "Quanto você dispõe de entrada?")).toBe("");
  });
});

describe("região, forma de aquisição, CNH e horário", () => {
  const regiao = "Para te atender melhor, em qual região você está?";
  const cnh = "Você possui CNH?";
  const horario = "Qual o melhor dia e horário para essa ligação?";

  it("região: dita na frase ou como resposta curta à pergunta da IA", () => {
    expect(extrairDados("moro em Osasco", "", AGORA).regiao).toBe("Osasco");
    expect(extrairDados("Zona Leste, Tatuapé", regiao, AGORA).regiao).toBe(
      "Zona Leste, Tatuapé",
    );
    expect(extrairDados("Zona Leste", "", AGORA).regiao).toBe(""); // sem pergunta, não vale
    expect(extrairDados("estou em dúvida", "", AGORA).regiao).toBe("");
    expect(extrairDados("qual o preço?", regiao, AGORA).regiao).toBe("");
  });

  it("forma de aquisição pode ter várias opções", () => {
    expect(
      extrairDados("quero financiar e dar meu Gol na troca", "", AGORA)
        .pagamento,
    ).toEqual(["financiado", "troca"]);
    expect(extrairDados("pago à vista no pix", "", AGORA).pagamento).toEqual([
      "a vista",
    ]);
    expect(
      extrairDados("posso passar no cartão?", "", AGORA).pagamento,
    ).toEqual(["cartao"]);
  });

  it("CNH: dita ou como sim/não depois da pergunta", () => {
    expect(extrairDados("tenho cnh B", "", AGORA).cnh).toBe("sim");
    expect(extrairDados("não tenho habilitação", "", AGORA).cnh).toBe("nao");
    expect(extrairDados("sim", cnh, AGORA).cnh).toBe("sim");
    expect(extrairDados("não", cnh, AGORA).cnh).toBe("nao");
    expect(extrairDados("sim", "Quer ver fotos?", AGORA).cnh).toBe("");
  });

  it("horário da ligação: resposta à pergunta ou frase com 'ligar'", () => {
    expect(extrairDados("amanhã depois das 14h", horario, AGORA).horario).toBe(
      "amanhã depois das 14h",
    );
    expect(extrairDados("pode ligar hoje à tarde", "", AGORA).horario).toBe(
      "pode ligar hoje à tarde",
    );
    expect(extrairDados("amanhã", "", AGORA).horario).toBe("");
  });
});

describe("ordem da qualificação", () => {
  it("sem interesse ainda, a coleta não começa e a IA pode transferir", () => {
    const f = fichaDaConversa([cli("Oi")], FICHA_VAZIA, AGORA);
    expect(coletaAtiva(f)).toBe(false);
    expect(pendentes(f)).toEqual([]);
    expect(avisoDeColeta(f)).toBe("");
    expect(podeTransferir(f)).toBe(true);
    expect(coletaCompleta(f)).toBe(false);
  });

  it("segue região → pagamento → (financiado) dados e entrada → horário", () => {
    let c: MensagemIa[] = [cli("Tenho interesse no Renegade")];
    let f = fichaDaConversa(c, interessado, AGORA);
    expect(proximaPergunta(f)?.frase).toContain("em qual região");
    expect(podeTransferir(f)).toBe(false);

    c = [...c, ia(proximaPergunta(f)!.frase), cli("Osasco")];
    f = fichaDaConversa(c, interessado, AGORA);
    expect(f.regiao).toBe("Osasco");
    expect(proximaPergunta(f)?.frase).toContain("à vista, financiado, cartão");

    c = [
      ...c,
      ia(proximaPergunta(f)!.frase),
      cli("financiado, com meu Gol 2015 na troca"),
    ];
    f = fichaDaConversa(c, interessado, AGORA);
    expect(f.pagamento).toEqual(["financiado", "troca"]);
    expect(rotulos(pendentes(f))).toEqual([
      "CPF",
      "data de nascimento",
      "CNH",
      "entrada",
      "melhor horário para a ligação",
    ]);
    // uma pergunta por mensagem: primeiro o CPF (com o motivo, na frase do usuário)
    expect(proximaPergunta(f)?.campos).toEqual(["cpf"]);
    expect(proximaPergunta(f)?.frase).toBe(
      "Consigo fazer uma análise de crédito pra você. Para começar, qual é o seu CPF?",
    );

    c = [
      ...c,
      ia(proximaPergunta(f)!.frase),
      cli(`cpf ${CPF}, nasci em 15/03/1990, tenho cnh e 10 mil de entrada`),
    ];
    f = fichaDaConversa(c, interessado, AGORA);
    expect(f.cnh).toBe("sim");
    expect(f.entrada).toBe("R$ 10.000");
    expect(rotulos(pendentes(f))).toEqual(["melhor horário para a ligação"]);
    expect(proximaPergunta(f)?.frase).toContain("Um consultor vai te ligar");
    expect(coletaCompleta(f)).toBe(false);

    c = [...c, ia(proximaPergunta(f)!.frase), cli("amanhã depois das 14h")];
    f = fichaDaConversa(c, interessado, AGORA);
    expect(f.horarioLigacao).toBe("amanhã depois das 14h");
    expect(coletaCompleta(f)).toBe(true);
    expect(podeTransferir(f)).toBe(true);
    expect(avisoDeColeta(f)).toContain("inclua [TRANSFERIR]");
    expect(avisoDeColeta(f)).toContain("amanhã depois das 14h");
    // idempotente: rodar de novo com as mesmas mensagens não muda nada
    expect(fichaDaConversa(c, f, AGORA)).toEqual(f);
  });

  it("à vista pula os dados do financiamento", () => {
    const f = fichaDaConversa(
      [
        ia("Para te atender melhor, em qual região você está?"),
        cli("Moro em Barueri e pago à vista"),
      ],
      interessado,
      AGORA,
    );
    expect(rotulos(pendentes(f))).toEqual(["melhor horário para a ligação"]);
  });

  it("o aviso deixa a pergunta para o sistema, bloqueia a transferência e não oferece visita", () => {
    const f = fichaDaConversa([cli("Quero o Renegade")], interessado, AGORA);
    const aviso = avisoDeColeta(f);
    expect(aviso).toContain("NÃO inclua [TRANSFERIR]");
    expect(aviso).toContain("NÃO ofereça nem agende visita");
    expect(aviso).toContain("SEM fazer perguntas");
    expect(aviso).toContain("o sistema acrescenta");
  });

  it("item perguntado 3 vezes sem resposta é dispensado", () => {
    const pergunta = "Para te atender melhor, em qual região você está?";
    const f = fichaDaConversa(
      [
        cli("Quero o Renegade"),
        ia(pergunta),
        cli("ok"),
        ia(pergunta),
        cli("hum"),
        ia(pergunta),
        cli("tá"),
      ],
      interessado,
      AGORA,
    );
    expect(pendentes(f)).not.toContain("regiao");
    expect(blocoFicha(f)).toContain("Não responderam");
  });

  it("pode transferir se o cliente recusa ou pede para falar com alguém", () => {
    const f = fichaDaConversa([cli("Quero o Renegade")], interessado, AGORA);
    expect(podeTransferir(f)).toBe(false);
    expect(podeTransferir(f, { pediuHumano: true })).toBe(true);
    expect(pediuHumano("Quero falar com um vendedor")).toBe(true);
    expect(pediuHumano("Pode me ligar?")).toBe(true);
    expect(pediuHumano("Quanto custa?")).toBe(false);
    const recusa = fichaDaConversa(
      [cli("Quero o Renegade"), cli("não quero passar meu cpf por aqui")],
      interessado,
      AGORA,
    );
    expect(recusa.recusou).toBe(true);
    expect(podeTransferir(recusa)).toBe(true);
    expect(avisoDeColeta(recusa)).toContain("inclua [TRANSFERIR]");
  });

  it("explica o motivo da transferência na nota", () => {
    const f = fichaDaConversa([cli("Quero o Renegade")], interessado, AGORA);
    expect(motivoDaTransferencia(f, { pediuHumano: true })).toContain("pediu");
    expect(motivoDaTransferencia({ ...f, recusou: true })).toContain(
      "não passar",
    );
    expect(motivoDaTransferencia(FICHA_VAZIA)).toBe(
      "a IA encaminhou o atendimento",
    );
  });

  it("[TRANSFERIR] é bloqueado quando a opção pede", () => {
    const conversa = [cli("Quero o Renegade")];
    expect(interpretarResposta("Ok! [TRANSFERIR]", conversa).transferir).toBe(
      true,
    );
    expect(
      interpretarResposta("Ok! [TRANSFERIR]", conversa, {
        bloquearTransferencia: true,
      }).transferir,
    ).toBe(false);
  });
});

describe("compatibilidade, prompt, máscara e nota", () => {
  const completa: FichaLead = {
    ...interessado,
    regiao: "Osasco",
    pagamento: ["financiado", "troca"],
    troca: "Gol 2015",
    entrada: "R$ 10.000",
    cpf: "enc:abc",
    nascimento: "enc:def",
    cnh: "sim",
    horarioLigacao: "amanhã depois das 14h",
  };

  it("fichas salvas por versões anteriores continuam valendo", () => {
    const f = fichaCompativel({
      veiculo: "Kicks",
      formaPagamento: "financiamento",
      entrada: "R$ 5.000",
      tentativasDados: 3,
    });
    expect(f.pagamento).toEqual(["financiado"]);
    expect(f.pedidos).toEqual({});
    expect(f.veiculo).toBe("Kicks");
  });

  it("o prompt mostra o que já sabemos sem expor CPF nem nascimento", () => {
    const bloco = blocoFicha(completa);
    expect(bloco).toContain("Região: Osasco");
    expect(bloco).toContain("Forma de aquisição: financiado, veículo na troca");
    expect(bloco).toContain("CPF: informado");
    expect(bloco).toContain("CNH: possui");
    expect(bloco).not.toContain("enc:");
    const sistema = montarMensagens({
      persona: PERSONA_PADRAO,
      loja: LOJA_PADRAO,
      config: { nomeAgente: "Sofia" } as never,
      veiculos: [],
      respostas: [],
      exemplos: [],
      reais: [],
      conversa: [cli("Oi")],
      nomeLead: "Ana",
      ficha: completa,
    }).mensagens[0].content;
    expect(sistema).toContain("O QUE JÁ SABEMOS DO LEAD");
    expect(sistema).toContain("LIGAÇÃO");
    expect(sistema).not.toContain("agendar uma visita");
  });

  it("a saudação rápida só entra na primeira mensagem da IA", () => {
    const monta = (conversa: MensagemIa[]) =>
      montarMensagens({
        persona: PERSONA_PADRAO,
        loja: LOJA_PADRAO,
        config: { nomeAgente: "Sofia" } as never,
        veiculos: [],
        respostas: RESPOSTAS_PADRAO,
        exemplos: [],
        reais: [],
        conversa,
        nomeLead: "Ana",
      }).usados.respostas;
    expect(monta([cli("Bom dia")])).toContain("Saudação follow-up");
    expect(monta([ia("Oi, Ana!"), cli("Bom dia")])).not.toContain(
      "Saudação follow-up",
    );
  });

  it("mascara CPF sempre e datas só quando falam de nascimento", () => {
    expect(mascarar(`cpf ${CPF}`)).toBe("cpf [CPF informado]");
    expect(mascarar("passo na loja dia 20/11/2026")).toBe(
      "passo na loja dia 20/11/2026",
    );
    const m = mascararConversa([
      ia("Qual sua data de nascimento?"),
      cli("15/03/1990"),
      cli("ligue dia 20/11/2026"),
    ]);
    expect(m[1].content).toBe("[data de nascimento informada]");
    expect(m[2].content).toBe("ligue dia 20/11/2026");
  });

  it("a nota do SDR traz tudo, o motivo e o próximo passo; o painel não traz CPF", () => {
    const nota = resumoParaSdr(completa, {
      nome: "Ana",
      motivo: "dados completos",
      cpfPlano: "52998224725",
      nascimentoPlano: "15/03/1990",
    });
    for (const trecho of [
      "NOTA DO CLIENTE",
      "Carro de interesse: Jeep Renegade",
      "Região: Osasco",
      "Forma de aquisição: financiado, veículo na troca",
      "Veículo na troca: Gol 2015",
      "Entrada: R$ 10.000",
      `CPF: ${CPF}`,
      "Nascimento: 15/03/1990",
      "CNH: possui",
      "Melhor horário para a ligação: amanhã depois das 14h",
      "Motivo da transferência: dados completos",
      "ligar para o cliente e, depois da ligação, agendar a visita",
    ])
      expect(nota).toContain(trecho);
    const painel = resumoParaSdr(completa, { nome: "Ana" });
    expect(painel).toContain("CPF: informado no chat");
    expect(painel).toContain("Nascimento: informado no chat");
    expect(painel).not.toContain(CPF);
  });

  it("a nota é gerada mesmo sem dados e lista o que não foi informado", () => {
    const nota = resumoParaSdr(FICHA_VAZIA, {
      nome: "Ana",
      motivo: "o cliente pediu para falar com a equipe",
    });
    expect(nota).toContain("Lead: Ana");
    expect(nota).toContain(
      "Não informado: carro de interesse, região, forma de pagamento",
    );
    expect(nota).toContain("Motivo da transferência: o cliente pediu");
  });
});
