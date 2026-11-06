/**
 * Testes (Vitest) de src/shared/ad-ai-prompt.ts (prompt pronto e validação do JSON).
 */
import { describe, expect, it } from "vitest";
import {
  equipamentosDaFicha,
  extrairJson,
  montarPrompt,
  validarResposta,
  type FichaIA,
} from "../src/shared/ad-ai-prompt";

const ficha: FichaIA = {
  nome: "FIAT TORO",
  ano: "2020",
  versao: "1.8 16V",
  cambio: "Automático",
  combustivel: "Flex",
  seguranca: "Airbag duplo\nFreios ABS\nControle de estabilidade",
  conforto: "Ar-condicionado digital\nDireção elétrica\nVidros elétricos",
  infotenimento:
    "Central multimídia\nBluetooth\nTeto solar [OPCIONAL — confirmar no veículo]",
};

const texto = (destaques: string[], extra: object = {}) => ({
  chamada: "Uma Toro pronta para a família.",
  destaques,
  cta: "📲 Chame no WhatsApp",
  ...extra,
});

function respostaValida() {
  return {
    textos: [
      texto(["Airbag duplo", "Freios ABS", "Bluetooth"]),
      texto([
        "Ar-condicionado digital",
        "Direção elétrica",
        "Central multimídia",
      ]),
      texto(["Controle de estabilidade", "Vidros elétricos", "Airbag duplo"]),
      texto(["Freios ABS", "Bluetooth", "Direção elétrica"]),
      texto(["Central multimídia", "Airbag duplo", "Vidros elétricos"]),
    ],
    titulos: [
      "FIAT TORO 2020 AUTOMÁTICA",
      "TORO PRONTA PARA ENTREGA",
      "TORO COMPLETA",
      "OPORTUNIDADE TORO",
      "VENHA CONHECER",
    ],
    whatsapp: "Oi! Vi a Toro e quero saber mais.",
  };
}

const json = (o: unknown) => JSON.stringify(o);

describe("montarPrompt", () => {
  it("inclui regras, formato, loja e equipamentos da ficha", () => {
    const p = montarPrompt(ficha, "Soul Cars Veículos");
    expect(p).toContain("Soul Cars Veículos");
    expect(p).toContain("COPIADOS LITERALMENTE");
    expect(p).toContain("exatamente 5 itens");
    expect(p).toContain("Freios ABS");
    expect(p).toContain("OPCIONAL");
  });
  it("nunca leva preço, km nem cor para o prompt", () => {
    const p = montarPrompt(
      { ...ficha, preco: 99999, km: 12345, cor: "PRETA" } as FichaIA,
      "Loja",
    );
    expect(p).not.toContain("99999");
    expect(p).not.toContain("12345");
    expect(p).not.toContain("PRETA");
  });
  it("lista equipamentos de segurança, conforto e infotenimento", () => {
    expect(equipamentosDaFicha(ficha)).toHaveLength(9);
  });
});

describe("extrairJson", () => {
  it("aceita bloco de código e texto solto em volta", () => {
    const o = { a: 1 };
    expect(extrairJson("```json\n" + json(o) + "\n```")).toEqual(o);
    expect(extrairJson("Aqui está:\n" + json(o) + "\nPronto!")).toEqual(o);
  });
  it("falha com mensagem clara", () => {
    expect(() => extrairJson("")).toThrow(/Cole a resposta/);
    expect(() => extrairJson("sem json")).toThrow(/JSON válido/);
  });
});

describe("validarResposta", () => {
  it("aceita uma resposta correta", () => {
    const r = validarResposta(json(respostaValida()), ficha);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.textos.textos).toHaveLength(5);
      expect(r.avisos).toEqual([]);
    }
  });
  it("rejeita JSON quebrado", () => {
    const r = validarResposta("{ textos: [", ficha);
    expect(r).toMatchObject({ ok: false });
  });
  it("rejeita quantidade errada de textos e títulos", () => {
    const o = respostaValida();
    o.textos.pop();
    o.titulos.pop();
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.join("\n")).toContain('"textos" deve ter exatamente 5');
      expect(r.erros.join("\n")).toContain('"titulos" deve ter exatamente 5');
    }
  });
  it("rejeita destaque inventado", () => {
    const o = respostaValida();
    o.textos[0].destaques[0] = "Piloto automático";
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toContain("não está copiado literalmente");
  });
  it("rejeita destaque opcional", () => {
    const o = respostaValida();
    o.textos[1].destaques[0] = "Teto solar [OPCIONAL — confirmar no veículo]";
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toContain("opcional");
  });
  it("rejeita número errado de destaques", () => {
    const o = respostaValida();
    o.textos[2].destaques = ["Airbag duplo"];
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(false);
  });
  it("ignora maiúsculas e marcador de lista ao comparar destaques", () => {
    const o = respostaValida();
    o.textos[0].destaques = ["airbag DUPLO", "- Freios ABS", "Bluetooth"];
    expect(validarResposta(json(o), ficha).ok).toBe(true);
  });
  it("aceita menos de 3 destaques se a lista da ficha for menor", () => {
    const curta: FichaIA = {
      ...ficha,
      seguranca: "Airbag duplo",
      conforto: "",
      infotenimento: "",
    };
    const o = respostaValida();
    o.textos.forEach((t) => (t.destaques = ["Airbag duplo"]));
    expect(validarResposta(json(o), curta).ok).toBe(true);
  });
  it("exige CTA começando com 📲", () => {
    const o = respostaValida();
    o.textos[3].cta = "Chame no WhatsApp";
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toContain("📲");
  });
  it("exige títulos em maiúsculas e com até 40 caracteres", () => {
    const o = respostaValida();
    o.titulos[0] = "Toro Automática";
    o.titulos[1] = "A".repeat(41);
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.join("\n")).toContain("MAIÚSCULAS");
      expect(r.erros.join("\n")).toContain("41 caracteres");
    }
  });
  it("exige a frase de WhatsApp", () => {
    const o = { ...respostaValida(), whatsapp: "  " };
    expect(validarResposta(json(o), ficha).ok).toBe(false);
  });
  it("avisa, sem bloquear, quando poucos títulos citam o modelo", () => {
    const o = respostaValida();
    o.titulos = [
      "OPORTUNIDADE",
      "VENHA CONHECER",
      "ECONOMIA",
      "FIAT TORO 2020",
      "COMPLETA",
    ];
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avisos[0]).toContain("modelo");
  });
  it("avisa quando a chamada cita preço", () => {
    const o = respostaValida();
    o.textos[0].chamada = "Por apenas R$ 99.000!";
    const r = validarResposta(json(o), ficha);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avisos.join("")).toContain("preço");
  });
});
