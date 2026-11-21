/**
 * Testes (Vitest) das regras puras do Pré-atendimento IA (src/shared/pre-service.ts): horário de
 * visita, pedido de foto, escolha do veículo, plano de fotos, tags do modelo e exemplos reais.
 * Veículos fictícios.
 */
import { describe, expect, it } from "vitest";
import {
  avisoDeHorario,
  extrairPares,
  fotosNumeradas,
  interpretarResposta,
  montarMensagens,
  voltouParaIa,
  CONFIG_PADRAO,
  LOJA_PADRAO,
  PERSONA_PADRAO,
  RESPOSTAS_PADRAO,
  parecido,
  pediuFoto,
  planoDeFotos,
  veiculoCitado,
  type ConversaCrm,
  type MensagemIa,
  type VeiculoIa,
  avisoDeEstoque,
} from "../src/shared/pre-service";

const lead = (content: string): MensagemIa => ({ role: "user", content });
const ia = (content: string): MensagemIa => ({ role: "assistant", content });

const ESTOQUE: VeiculoIa[] = [
  {
    id: "10",
    marca: "JEEP",
    modelo: "RENEGADE",
    placa: "AAA0A00",
    preco: "89900",
  },
  {
    id: "11",
    marca: "CHEVROLET",
    modelo: "CRUZE",
    placa: "BBB1B11",
    preco: "66900",
  },
  { id: "12", marca: "FIAT", modelo: "ARGO", placa: "CCC2C22", preco: "59900" },
  { id: "13", marca: "FIAT", modelo: "ARGO", placa: "DDD3D33", preco: "61900" },
];
const FOTOS: Record<string, string[]> = {
  "10": Array.from({ length: 10 }, (_, i) => `r/${i + 1}.jpeg`),
  "11": ["c/1.jpeg"],
};
const fotosDe = (id: string) => FOTOS[id] ?? [];

describe("horário de visita", () => {
  it("aceita até 16h em dia útil e até 15h no sábado", () => {
    expect(avisoDeHorario([lead("posso ir às 16h?")])).toBe("");
    expect(avisoDeHorario([lead("sábado 15h dá?")])).toBe("");
    expect(avisoDeHorario([lead("sábado às 15:30")])).toMatch(/15h/);
    expect(avisoDeHorario([lead("consigo 16:30")])).toMatch(
      /último horário de visita é 16h/,
    );
  });
  it("recusa antes das 8h e ignora domingo e números que não são hora", () => {
    expect(avisoDeHorario([lead("posso às 7h?")])).toMatch(
      /antes de a loja abrir/,
    );
    expect(avisoDeHorario([lead("domingo 18h")])).toBe("");
    expect(avisoDeHorario([lead("o carro tem 50 mil km")])).toBe("");
  });
  it("não transfere quando o horário não pode ser confirmado", () => {
    const conversa = [lead("vou às 17h")];
    const r = interpretarResposta("Combinado! [TRANSFERIR]", conversa);
    expect(r).toEqual({
      texto: "Combinado!",
      transferir: false,
      encerrar: false,
    });
    expect(
      interpretarResposta("<think>x</think>Até! [TRANSFERIR]", [
        lead("vou às 10h"),
      ]).transferir,
    ).toBe(true);
    expect(interpretarResposta("Desculpe. [ENCERRAR]", []).encerrar).toBe(true);
  });
});

describe("pedido de foto e escolha do veículo", () => {
  it("reconhece o pedido de foto", () => {
    expect(pediuFoto("manda as fotos?")).toBe(true);
    expect(pediuFoto("tem mais imagens dele")).toBe(true);
    expect(pediuFoto("quero ver por dentro")).toBe(true);
    expect(pediuFoto("qual o preço?")).toBe(false);
  });
  it("tolera erro de digitação e casa pelo preço", () => {
    expect(parecido("renagade", "renegade")).toBe(true);
    expect(parecido("argo", "agro")).toBe(false);
    const r = veiculoCitado(ESTOQUE, "foto do renagade");
    expect(r.tipo === "um" && r.veiculo.id).toBe("10");
    const p = veiculoCitado(ESTOQUE, "o de 66.900");
    expect(p.tipo === "um" && p.veiculo.id).toBe("11");
  });
  it("empate vira pergunta de qual veículo", () => {
    const r = veiculoCitado(ESTOQUE, "foto do argo");
    expect(r.tipo).toBe("varios");
  });
});

describe("plano de fotos", () => {
  it("envia até 6 e o 'mais fotos' continua de onde parou", () => {
    const conversa = [lead("manda fotos do renegade")];
    const p1 = planoDeFotos({ conversa, veiculos: ESTOQUE, fotosDe })!;
    expect(p1.fotos).toHaveLength(6);
    expect(p1.inicio).toBe(0);
    const p2 = planoDeFotos({
      conversa: [...conversa, ia("Segue 👇"), lead("tem mais fotos?")],
      veiculos: ESTOQUE,
      fotosDe,
      enviadas: { "10": 6 },
    })!;
    expect(p2.veiculo?.id).toBe("10");
    expect(p2.fotos).toEqual(["r/7.jpeg", "r/8.jpeg", "r/9.jpeg", "r/10.jpeg"]);
    expect(p2.inicio).toBe(6);
  });
  it("avisa quando já mandou todas ou não há fotos", () => {
    const todas = planoDeFotos({
      conversa: [lead("mais fotos do cruze")],
      veiculos: ESTOQUE,
      fotosDe,
      enviadas: { "11": 1 },
    })!;
    expect(todas.fotos).toEqual([]);
    expect(todas.nota).toMatch(/já enviamos todas/);
    const sem = planoDeFotos({
      conversa: [lead("foto do argo 59.900")],
      veiculos: ESTOQUE,
      fotosDe,
    })!;
    expect(sem.semFotos).toBe(true);
  });
  it("carro desconhecido pergunta em vez de chutar; continuação curta funciona", () => {
    const desconhecido = planoDeFotos({
      conversa: [lead("foto do corolla")],
      veiculos: ESTOQUE,
      fotosDe,
    })!;
    expect(desconhecido.veiculo).toBeNull();
    expect(desconhecido.nota).toMatch(/não identificamos/);
    const cont = planoDeFotos({
      conversa: [lead("manda foto"), ia("De qual carro?"), lead("o cruze")],
      veiculos: ESTOQUE,
      fotosDe,
    })!;
    expect(cont.veiculo?.id).toBe("11");
    expect(
      planoDeFotos({
        conversa: [lead("qual o preço?")],
        veiculos: ESTOQUE,
        fotosDe,
      }),
    ).toBeNull();
  });
  it("pedido genérico usa a conversa e as etiquetas", () => {
    const p = planoDeFotos({
      conversa: [lead("manda foto")],
      veiculos: ESTOQUE,
      fotosDe,
      etiquetas: ["Renegade"],
    })!;
    expect(p.veiculo?.id).toBe("10");
  });
  it("só usa fotos numeradas, em ordem", () => {
    expect(
      fotosNumeradas([
        "10.jpg",
        "2.jpeg",
        "1_sem_fundo.png",
        "1.png",
        "capa.jpg",
      ]),
    ).toEqual(["1.png", "2.jpeg", "10.jpg"]);
  });
});

describe("montagem do pedido ao modelo", () => {
  it("põe persona, estoque relevante, aviso de horário e a nota de fotos", () => {
    const { mensagens, usados } = montarMensagens({
      persona: PERSONA_PADRAO,
      loja: LOJA_PADRAO,
      config: CONFIG_PADRAO,
      veiculos: ESTOQUE,
      respostas: RESPOSTAS_PADRAO,
      exemplos: [
        {
          id: "e",
          pergunta: "o cruze aceita troca?",
          resposta: "Aceita sim!",
          origem: "correcao",
        },
      ],
      reais: [],
      conversa: [lead("o cruze está disponível? posso ir 17h")],
      nomeLead: "Fulano Teste",
      notaFotos: "FOTOS: nota",
    });
    expect(mensagens[0].content).toMatch(/Sofia/);
    expect(mensagens[0].content).toMatch(/CHEVROLET CRUZE · R\$ 66900/);
    expect(mensagens[0].content).toMatch(/último horário de visita é 16h/);
    expect(mensagens[0].content).toMatch(/FOTOS: nota/);
    // Privacidade: só o primeiro nome vai ao modelo externo, nunca o nome completo.
    expect(mensagens[0].content).toContain("Nome do lead: Fulano.");
    expect(mensagens[0].content).not.toContain("Teste.");
    expect(usados.exemplos).toBe(1);
    expect(mensagens.at(-1)?.content).toMatch(/posso ir 17h/);
  });
});

describe("exemplos reais do CRM", () => {
  const conv = (
    mensagens: ConversaCrm["mensagens"],
    extra: Partial<ConversaCrm> = {},
  ): ConversaCrm => ({
    id: "c1",
    direta: true,
    etiquetas: ["1 CALL"],
    mensagens,
    ...extra,
  });
  const m = (min: number, de: "lead" | "equipe" | "robo", texto: string) => ({
    em: min * 60_000,
    de,
    texto,
    tipo: "Text",
    privada: false,
  });
  it("junta mensagens seguidas do lead e da equipe (até 10 min)", () => {
    const pares = extrairPares([
      conv([
        m(0, "lead", "Ainda tem o Cruze?"),
        m(1, "lead", "Aceita troca?"),
        m(2, "equipe", "Temos sim! Aceitamos troca."),
        m(3, "equipe", "Quer agendar uma visita?"),
        m(30, "equipe", "Oi, conseguiu ver?"),
      ]),
    ]);
    expect(pares).toEqual([
      {
        conversa: "c1",
        pergunta: "Ainda tem o Cruze?\nAceita troca?",
        resposta: "Temos sim! Aceitamos troca.\nQuer agendar uma visita?",
      },
    ]);
  });
  it("descarta grupo, sem etiqueta, cumprimento, dado pessoal, robô e mensagens da IA", () => {
    const base = [
      m(0, "lead", "Qual o valor do Argo?"),
      m(1, "equipe", "R$ 59.900, aceita proposta."),
    ];
    expect(extrairPares([conv(base, { direta: false })])).toEqual([]);
    expect(extrairPares([conv(base, { etiquetas: [] })])).toEqual([]);
    expect(
      extrairPares([
        conv([m(0, "lead", "oi"), m(1, "equipe", "Olá, tudo bem?")]),
      ]),
    ).toEqual([]);
    expect(
      extrairPares([
        conv([
          m(0, "lead", "meu cpf 123.456.789-00"),
          m(1, "equipe", "Obrigado, recebido!"),
        ]),
      ]),
    ).toEqual([]);
    expect(
      extrairPares([
        conv([
          m(0, "lead", "Qual o valor?"),
          m(1, "robo", "Resposta automática aqui"),
        ]),
      ]),
    ).toEqual([]);
    expect(
      extrairPares([conv(base)], new Set(["R$ 59.900, aceita proposta."])),
    ).toEqual([]);
  });
});

describe("guardas do eval (carro fora do estoque e link de anúncio)", () => {
  const estoque = [
    {
      id: "1",
      marca: "Honda",
      modelo: "Civic EXL 2019",
      placa: "AAA1A11",
      preco: "R$ 109.900",
    },
    {
      id: "2",
      marca: "Chevrolet",
      modelo: "Onix LT 2022",
      placa: "BBB2B22",
      preco: "R$ 79.900",
    },
  ];
  const lead = (content: string) => [{ role: "user" as const, content }];

  it("avisa quando a marca pedida não está no estoque", () => {
    expect(
      avisoDeEstoque(estoque, lead("Vocês têm Jeep Compass 2023?")),
    ).toMatch(/NÃO está no ESTOQUE/);
  });
  it("não avisa quando o carro pedido está no estoque", () => {
    expect(avisoDeEstoque(estoque, lead("Quanto está o Honda Civic?"))).toBe(
      "",
    );
  });
  it("link de anúncio sozinho não transfere", () => {
    const conversa = lead("Vi esse https://instagram.com/p/abc ainda tem?");
    expect(
      interpretarResposta("Tem sim! [TRANSFERIR]", conversa).transferir,
    ).toBe(false);
  });
  it("link com pedido de vendedor ainda transfere", () => {
    const conversa = lead(
      "https://instagram.com/p/abc quero falar com um vendedor",
    );
    expect(
      interpretarResposta("Claro! [TRANSFERIR]", conversa).transferir,
    ).toBe(true);
  });
});

describe("conversa real: 'Jeep Renegade' e depois 'Me encaminha as fotos'", () => {
  it("usa o carro citado antes e envia as fotos", () => {
    const conversa = [
      lead("Quais carros estão disponíveis?"),
      ia("Qual modelo você tem em mente?"),
      lead("Jeep Renegade"),
      ia("Temos o Jeep Renegade disponível."),
      lead("Me encaminha as fotos"),
    ];
    const p = planoDeFotos({ conversa, veiculos: ESTOQUE, fotosDe })!;
    expect(p.veiculo?.id).toBe("10");
    expect(p.fotos).toHaveLength(6);
  });
  it("pergunta genérica recebe a lista do estoque", () => {
    const { mensagens } = montarMensagens({
      persona: PERSONA_PADRAO,
      loja: LOJA_PADRAO,
      config: CONFIG_PADRAO,
      veiculos: ESTOQUE,
      respostas: [],
      exemplos: [],
      reais: [],
      conversa: [lead("Quais carros estão disponíveis?")],
      nomeLead: "Fulano",
    });
    expect(mensagens[0].content).toMatch(/RENEGADE/);
    expect(mensagens[0].content).toMatch(/CRUZE/);
  });
});

describe("voltouParaIa", () => {
  it("lead com a equipe e etiqueta retirada volta quando a etiqueta reaparece", () => {
    expect(voltouParaIa({ status: "humano" })).toBe(true);
    expect(voltouParaIa({ status: "humano", gatilhoRetirado: true })).toBe(
      true,
    );
  });
  it("não volta se a IA nunca conseguiu tirar a etiqueta", () => {
    expect(voltouParaIa({ status: "humano", gatilhoRetirado: false })).toBe(
      false,
    );
  });
  it("encerrado (pediu para parar) e ativo não voltam por aqui", () => {
    expect(voltouParaIa({ status: "encerrado" })).toBe(false);
    expect(voltouParaIa({ status: "ativo" })).toBe(false);
  });
});
