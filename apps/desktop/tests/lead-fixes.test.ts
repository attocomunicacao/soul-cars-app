/**
 * Testes (Vitest) das correções do Pré-atendimento IA depois do teste de 19/11: CPF digitado errado,
 * entrada "nenhum"/"só o carro na troca", carro da ficha ("Somente" não é o Sorento), pergunta do
 * sistema anexada à resposta do modelo, fechamento da transferência e o texto do score. Dados fictícios.
 */
import { describe, expect, it } from "vitest";
import {
  FICHA_VAZIA,
  anexarPergunta,
  extrairDados,
  fecharTransferencia,
  fichaDaConversa,
  mascarar,
  mascararConversa,
  proximaPergunta,
  type FichaLead,
} from "../src/shared/lead-profile";
import {
  FINANCIAMENTO_ANTERIOR,
  LOJA_PADRAO,
  REGRAS_DE_ENCAMINHAMENTO,
  veiculoMencionado,
  type MensagemIa,
} from "../src/shared/pre-service";

const AGORA = new Date(2026, 10, 19);
const ia = (content: string): MensagemIa => ({ role: "assistant", content });
const cli = (content: string): MensagemIa => ({ role: "user", content });
const financiando: FichaLead = {
  ...FICHA_VAZIA,
  veiculo: "Jeep Renegade",
  regiao: "Osasco",
  pagamento: ["financiado"],
};

describe("CPF digitado errado", () => {
  it("é mascarado mesmo sem passar na validação", () => {
    expect(mascarar("meu cpf 827.948.293-48")).toBe("meu cpf [CPF informado]");
    // 11 dígitos soltos só são mascarados logo depois do pedido do CPF
    expect(mascarar("82794829348")).toBe("82794829348");
    const m = mascararConversa([ia("Qual é o seu CPF?"), cli("82794829348")]);
    expect(m[1].content).toBe("[CPF informado]");
  });

  it("vira cpfInvalido e a pergunta passa a pedir só a conferência", () => {
    const f = fichaDaConversa(
      [
        ia(
          "Consigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento.",
        ),
        cli("827.948.293-48"),
      ],
      financiando,
      AGORA,
    );
    expect(f.cpf).toBe("");
    expect(f.cpfInvalido).toBe(true);
    expect(proximaPergunta(f)?.frase).toBe(
      "Não consegui validar esse CPF. Pode conferir e me enviar de novo?",
    );
    // o CPF certo limpa o aviso
    const g = fichaDaConversa(
      [ia("Qual é o seu CPF?"), cli("829.948.293-48"), cli("529.982.247-25")],
      f,
      AGORA,
    );
    expect(g.cpf).toBe("52998224725");
    expect(g.cpfInvalido).toBe(false);
  });
});

describe("entrada sem dinheiro", () => {
  const pergunta = "Quanto você dispõe de entrada?";
  it("'nenhum' e 'só o carro na troca' viram sem entrada", () => {
    expect(extrairDados("Nenhum", pergunta, AGORA).entrada).toBe("sem entrada");
    expect(
      extrairDados("Somente o carro na troca", pergunta, AGORA).entrada,
    ).toBe("sem entrada (só o veículo na troca)");
    expect(
      extrairDados("Somente o carro", "Qual a região?", AGORA).entrada,
    ).toBe("");
  });
});

describe("carro da ficha", () => {
  const veiculos = [
    {
      id: "1",
      marca: "Kia",
      modelo: "Sorento",
      placa: "AAA1A11",
      preco: "74.900",
    },
    {
      id: "2",
      marca: "Nissan",
      modelo: "Kicks",
      placa: "BBB2B22",
      preco: "75.900",
    },
    {
      id: "3",
      marca: "Jeep",
      modelo: "Renegade",
      placa: "CCC3C33",
      preco: "66.900",
    },
  ];
  it("'Somente o carro na troca' não vira o Sorento", () => {
    const resposta = veiculoMencionado(
      veiculos,
      "Somente o carro na troca",
      "Quanto você dispõe de entrada?",
      "Jeep Renegade",
    );
    expect(resposta).toBeNull();
    // mesmo sem pergunta antes, só palavra exata troca o carro da ficha
    expect(
      veiculoMencionado(
        veiculos,
        "Somente o carro na troca",
        "",
        "Jeep Renegade",
      ),
    ).toBeNull();
  });
  it("palavra exata troca o carro; aproximação só preenche ficha vazia", () => {
    expect(
      veiculoMencionado(veiculos, "e o Kicks?", "", "Jeep Renegade")?.modelo,
    ).toBe("Kicks");
    expect(
      veiculoMencionado(veiculos, "Tenho interesse no Renagede", "", "")
        ?.modelo,
    ).toBe("Renegade");
    expect(
      veiculoMencionado(veiculos, "Renagede", "", "Nissan Kicks"),
    ).toBeNull();
  });
});

describe("pergunta do sistema", () => {
  it("tira as perguntas do modelo e anexa a pergunta certa", () => {
    const frase = "Para te atender melhor, em qual região você está?";
    expect(
      anexarPergunta(
        "O Renegade custa R$ 66.900. Quer ver fotos? Posso ajudar?",
        frase,
      ),
    ).toBe(`O Renegade custa R$ 66.900.\n\n${frase}`);
    expect(anexarPergunta("Qual o seu CPF?", frase)).toBe(frase);
  });
  it("ao transferir, tira perguntas e garante o aviso da ligação", () => {
    const f: FichaLead = { ...FICHA_VAZIA, horarioLigacao: "amanhã à tarde" };
    expect(fecharTransferencia("Anotado! Qual outro dado?", f)).toBe(
      "Anotado!\n\nCombinado! Um consultor vai te ligar (amanhã à tarde) para continuar o seu atendimento.",
    );
    expect(fecharTransferencia("Um consultor vai te ligar.", f)).toBe(
      "Um consultor vai te ligar.",
    );
  });
});

describe("análise de crédito com o nosso sistema", () => {
  it("a regra manda falar em nosso sistema e score, nunca em banco ou histórico", () => {
    expect(REGRAS_DE_ENCAMINHAMENTO).toContain("NOSSO SISTEMA");
    expect(REGRAS_DE_ENCAMINHAMENTO).toContain("score");
    expect(REGRAS_DE_ENCAMINHAMENTO).toMatch(
      /Nunca diga que é um processo dos bancos/,
    );
    expect(REGRAS_DE_ENCAMINHAMENTO).toMatch(/nunca use a palavra "histórico"/);
  });
  it("o texto padrão novo do financiamento não fala em bancos", () => {
    expect(LOJA_PADRAO.financiamento).toContain("nosso sistema");
    expect(LOJA_PADRAO.financiamento).toContain("score");
    expect(LOJA_PADRAO.financiamento).not.toMatch(/banco/i);
    expect(FINANCIAMENTO_ANTERIOR).toMatch(/bancos/);
  });
});

describe("pedidos de dados no financiamento", () => {
  it("só conta um pedido como ignorado quando o cliente não mandou nada do assunto", () => {
    const pedido =
      "Consigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento.";
    const f = fichaDaConversa(
      [
        ia(pedido),
        cli("Para que o CPF?"),
        ia(pedido),
        cli("827.948.293-48"), // CPF errado: está colaborando
        ia("Não consegui validar esse CPF. Pode conferir e me enviar de novo?"),
        cli("529.982.247-25"),
      ],
      financiando,
      AGORA,
    );
    expect(f.pedidos.cpf).toBe(1); // só a dúvida contou
    expect(f.cpf).toBe("52998224725");
  });
  it("a frase concorda com o que falta", () => {
    const base = { ...financiando, cnh: "sim" as const, entrada: "R$ 5.000" };
    expect(proximaPergunta({ ...base, cpf: "x" })?.frase).toBe(
      "Consigo fazer uma análise de crédito pra você: preciso da sua data de nascimento.",
    );
    expect(proximaPergunta({ ...base, nascimento: "x" })?.frase).toBe(
      "Consigo fazer uma análise de crédito pra você: preciso do seu CPF.",
    );
  });
});

describe("conversa real do teste de 19:35", () => {
  const veiculos = [
    {
      id: "1",
      marca: "Toyota",
      modelo: "Yaris Hatch",
      placa: "AAA1A11",
      preco: "70.000",
    },
    {
      id: "2",
      marca: "Jeep",
      modelo: "Renegade",
      placa: "BBB2B22",
      preco: "66.900",
    },
    {
      id: "3",
      marca: "Hyundai",
      modelo: "Tucson",
      placa: "CCC3C33",
      preco: "52.900",
    },
  ];
  const lista =
    "Temos 11 veículos disponíveis, como Hyundai Tucson, Jeep Renegade e Toyota Yaris.";

  it("sem carro confirmado a IA pergunta o carro, nunca a região", () => {
    const f = fichaDaConversa(
      [
        cli("Olá!"),
        ia("Olá! Como posso ajudar?"),
        cli("Quais carros vocês tem disponivel?"),
      ],
      FICHA_VAZIA,
      AGORA,
    );
    expect(proximaPergunta(f)?.campos).toEqual(["veiculo"]);
    expect(proximaPergunta(f)?.frase).toBe("Qual carro você tem interesse?");
  });

  it("'Yaris, falo da Zona Norte' dá o carro e a região na mesma mensagem", () => {
    const msg = "Tenho interesse no Yaris. Falo aqui da Zona Norte";
    const carro = veiculoMencionado(
      veiculos,
      msg,
      `${lista} Qual carro você tem interesse?`,
      "",
    );
    expect(carro?.modelo).toBe("Yaris Hatch");
    const f = fichaDaConversa(
      [ia(`${lista} Qual carro você tem interesse?`), cli(msg)],
      { ...FICHA_VAZIA, veiculo: "Toyota Yaris Hatch", mensagensCliente: 3 },
      AGORA,
    );
    expect(f.regiao).toBe("Zona Norte");
    expect(proximaPergunta(f)?.frase).toContain(
      "como você pretende adquirir".replace("como", "Como"),
    );
  });

  it("troca só com modelo/ano e entrada 'somente o Gol'", () => {
    const x = extrairDados(
      "Vou financiar e tenho um gol 2015 na troca.",
      "",
      AGORA,
    );
    expect(x.troca).toBe("gol 2015");
    expect(x.pagamento).toEqual(["financiado", "troca"]);
    expect(
      extrairDados("Tenho CNH sim. A entrada é somente o GOL 2015", "", AGORA)
        .entrada,
    ).toBe("sem entrada (só o veículo na troca)");
    expect(
      extrairDados("Tenho CNH sim. A entrada é somente o GOL 2015", "", AGORA)
        .cnh,
    ).toBe("sim");
  });

  it("o modelo não duplica a frase do sistema", () => {
    const frase =
      "Não consegui validar esse CPF. Pode conferir e me enviar de novo?";
    expect(anexarPergunta("Não consegui validar esse CPF.", frase)).toBe(frase);
    expect(
      anexarPergunta(
        "Entendido, vamos analisar o financiamento e a troca do seu Gol 2015. Consigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento.",
        "Consigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento. Você possui CNH? Quanto você dispõe de entrada?",
        ["cpf", "nascimento", "cnh", "entrada"],
      ),
    ).toBe(
      "Entendido, vamos analisar o financiamento e a troca do seu Gol 2015.\n\nConsigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento. Você possui CNH? Quanto você dispõe de entrada?",
    );
  });

  it("a data de nascimento é mascarada mesmo em mensagens seguidas do cliente", () => {
    const m = mascararConversa([
      ia(
        "Consigo fazer uma análise de crédito pra você: preciso do seu CPF e data de nascimento.",
      ),
      cli("829.948.293-48"),
      cli("12/12/2000"),
      ia("Não consegui validar esse CPF. Pode conferir e me enviar de novo?"),
      cli("passo aí dia 20/11/2026"),
    ]);
    expect(m[1].content).toBe("[CPF informado]");
    expect(m[2].content).toBe("[data de nascimento informada]");
    expect(m[4].content).toBe("passo aí dia 20/11/2026");
  });
});

describe("data de nascimento sempre mascarada", () => {
  it("com ano de 4 dígitos plausível mascara mesmo sem contexto; data de visita não", () => {
    expect(mascarar("12/12/2000")).toBe("[data de nascimento informada]");
    expect(mascarar("nasci em 03/05/1985")).toBe(
      "nasci em [data de nascimento informada]",
    );
    expect(mascarar("passo aí dia 20/11/2026")).toBe("passo aí dia 20/11/2026");
    expect(mascarar("dia 20/11/26")).toBe("dia 20/11/26"); // 2 dígitos só no contexto
  });
});
