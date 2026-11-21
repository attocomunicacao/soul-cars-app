/**
 * Testes (Vitest) da máscara de dados pessoais antes do texto sair para o modelo (Groq ou Ollama):
 * `mascarar` e `mascararConversa` em src/shared/lead-profile.ts.
 *
 * Além de CPF e data de nascimento, agora também telefone, e-mail, CEP e endereço com número.
 * O mais importante é o outro lado: preço, quilometragem, ano, placa e motor NÃO podem ser mascarados,
 * senão a IA perde o que precisa para atender.
 */
import { describe, expect, it } from "vitest";
import { mascarar, mascararConversa } from "../src/shared/lead-profile";

describe("telefone", () => {
  it.each([
    ["me chama no (11) 99999-8888", "me chama no [telefone informado]"],
    ["meu zap 11 99999-8888", "meu zap [telefone informado]"],
    ["11999998888 é o meu", "[telefone informado] é o meu"],
    ["+55 11 99999-8888", "[telefone informado]"],
    ["55 (11) 99999 8888", "[telefone informado]"],
    ["99999-8888", "[telefone informado]"],
    ["fixo (11) 3333-4444", "fixo [telefone informado]"],
    ["fixo 11 3333-4444", "fixo [telefone informado]"],
  ])("mascara %s", (entrada, esperado) => {
    expect(mascarar(entrada)).toBe(esperado);
  });

  it.each([
    "o preço é R$ 45.900",
    "R$ 45.900,00 à vista",
    "entrada de 10000",
    "tem 80.000 km rodados",
    "rodou 123456 km",
    "Gol 2019 2020",
    "Civic 2019-2020",
    "ano 2018/2019",
    "placa ABC1D23",
    "motor 1.0 flex",
    "tem 5 portas e 4 lugares",
    "quero ver sábado às 14:30",
    "visita dia 12/12 às 10h",
    "fiat argo 2022 1.3",
  ])("não mexe em %s", (texto) => {
    expect(mascarar(texto)).toBe(texto);
  });

  it("um telefone no meio da frase não leva o resto junto", () => {
    expect(mascarar("é o 11 99999-8888 e o carro é o Argo 2022")).toBe(
      "é o [telefone informado] e o carro é o Argo 2022",
    );
  });
});

describe("e-mail", () => {
  it.each([
    [
      "meu email é joao.silva+loja@gmail.com ok",
      "meu email é [e-mail informado] ok",
    ],
    ["maria_99@empresa.com.br", "[e-mail informado]"],
  ])("mascara %s", (entrada, esperado) => {
    expect(mascarar(entrada)).toBe(esperado);
  });

  it("não confunde arroba solta", () => {
    expect(mascarar("me segue @soulcars")).toBe("me segue @soulcars");
  });
});

describe("CEP e endereço", () => {
  it.each([
    ["moro na Rua das Flores, 123", "moro na [endereço informado]"],
    ["Av. Paulista, nº 1578 apto 4", "[endereço informado] apto 4"],
    ["rua 25 de Março, 45", "[endereço informado]"],
    ["Travessa Alegria nº 12", "[endereço informado]"],
    ["meu cep é 01310-100", "meu cep é [CEP informado]"],
    ["cep 01310100", "cep [CEP informado]"],
  ])("mascara %s", (entrada, esperado) => {
    expect(mascarar(entrada)).toBe(esperado);
  });

  it.each([
    "moro na região da Mooca",
    "perto da Avenida Paulista",
    "fica na rua de trás",
    "quero o carro de R$ 100.000",
    "tenho 25 anos",
  ])("não mexe em %s (região e bairro são dados do atendimento)", (texto) => {
    expect(mascarar(texto)).toBe(texto);
  });
});

describe("continua mascarando CPF e nascimento", () => {
  it("CPF com pontuação e data de nascimento por extenso", () => {
    expect(mascarar("cpf 827.948.293-48")).toBe("cpf [CPF informado]");
    expect(mascarar("12/12/2000")).toBe("[data de nascimento informada]");
  });

  it("11 dígitos logo depois do pedido do CPF são CPF, não telefone", () => {
    const m = mascararConversa([
      { role: "assistant", content: "Qual é o seu CPF?" },
      { role: "user", content: "82794829348" },
    ]);
    expect(m[1].content).toBe("[CPF informado]");
  });
});

describe("mascararConversa", () => {
  it("mascara todos os dados pessoais numa conversa, nos dois lados", () => {
    const m = mascararConversa([
      { role: "user", content: "Oi, sou o João, meu zap (11) 99999-8888" },
      { role: "assistant", content: "Prazer! Me passa seu e-mail?" },
      { role: "user", content: "joao@gmail.com, moro na Rua A, 10" },
    ]);
    expect(m.map((x) => x.content)).toEqual([
      "Oi, sou o João, meu zap [telefone informado]",
      "Prazer! Me passa seu e-mail?",
      "[e-mail informado], moro na [endereço informado]",
    ]);
  });
});
