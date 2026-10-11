import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  gerarDes,
  importarFicha,
  parseNumber,
  sugerirNome,
  termoBusca,
  type FichaDes,
} from "../src/renderer/src/lib/des";

const loja = {
  contato: "11965952083",
  horario:
    "Segunda a sexta, das 8h às 17h\nAos sábados, das 8h às 16h\nE aos domingos, somente com horário marcado.",
  loja: "Soul Cars Veículos",
  endereco: "Av. São Miguel, 8999 - Vila Norma, São Paulo/SP",
};

const fiesta: FichaDes = {
  nome: "FORD FIESTA",
  ano: "2016",
  marca_modelo: "FORD/FIESTA HA 1.5L SB",
  cor: "BRANCA",
  combustivel: "Flex",
  preco: 48900,
  km: 84000,
  versao: "S 1.5 16V",
  configuracao: "HATCHBACK",
  lugares: "5",
  portas: "4",
  cambio: "MANUAL DE 5 MARCHAS",
  direcao: "ELÉTRICA",
  seguranca:
    "Freios ABS\nAlarme antifurto perimétrico\nFaróis com refletores duplos\nTravamento central das portas\nISOFIX para fixação de cadeira infantil\nAirbags frontais\nAlarme antifurto volumétrico\nLimpador e lavador do vidro traseiro\nDesembaçador do vidro traseiro",
  conforto:
    "Ar-condicionado\nAr quente\nBanco do motorista com ajuste de altura\nAjuste do volante em profundidade\nControle elétrico dos vidros dianteiros\nBanco traseiro rebatível\nLuz no porta-malas\nAlças de segurança no teto\nZonas de ar-condicionado: 1\nDireção assistida\nAjuste do volante em altura\nCintos de segurança com ajuste de altura\nAjuste elétrico dos retrovisores\nDestravamento interno/remoto do porta-malas\nDestravamento interno da tampa de combustível",
  infotenimento:
    "Rádio FM\nConexão Bluetooth\nComputador de bordo\nTermômetro do líquido de arrefecimento\nPorta USB\nTomada de 12 volts\nConta-giros",
};

const fixture = readFileSync(
  new URL("./fixtures/DES.md", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

describe("DES.md", () => {
  it("gera exatamente o mesmo arquivo do sistema antigo", () => {
    // O sistema antigo nomeava as campanhas com [VENDA]; hoje o padrão é [LEAD].
    expect(gerarDes(fiesta, loja, null, "[VENDA]")).toBe(fixture);
  });

  it("usa [LEAD] no nome da campanha por padrão", () => {
    const md = gerarDes(fiesta, loja);
    expect(md).toContain(
      "## NOME DA CAMPANHA\n\n[LEAD] FORD FIESTA 2016\n\n[LEAD] FORD FIESTA 2016",
    );
    expect(md).not.toContain("[VENDA]");
  });

  it("reimporta os dados técnicos e equipamentos do próprio DES.md", () => {
    const back = importarFicha(fixture);
    for (const k of [
      "versao",
      "configuracao",
      "lugares",
      "portas",
      "cambio",
      "direcao",
      "seguranca",
      "conforto",
      "infotenimento",
    ] as const)
      expect(back[k]).toBe(fiesta[k]);
  });

  it("textos da IA entram no formato sem alterar os fatos da ficha", () => {
    const ia = {
      textos: Array.from({ length: 5 }, (_, i) => ({
        chamada: `Chamada ${i + 1}`,
        destaques: ["Freios ABS", "Airbags frontais"],
        cta: "📲 Chama já!",
      })),
      titulos: ["T1", "T2", "T3", "T4", "T5"],
      whatsapp: "Olá! Separei este carro para você.",
    };
    const md = gerarDes(fiesta, loja, ia);
    expect(md).toContain(
      "## 1. TEXTO PRINCIPAL\n\n🚗 FORD FIESTA S 1.5 16V MANUAL 2016\n\nChamada 1\n\n💰 R$ 48.900,00",
    );
    expect(md).toContain("🔹 Freios ABS\n🔹 Airbags frontais\n\n📲 Chama já!");
    expect(md).toContain("## TÍTULOS\n\nT1\n\nT2\n\nT3\n\nT4\n\nT5\n");
    expect(md).toContain(
      "## MENSAGEM PARA O WHATSAPP\n\nOlá! Separei este carro para você.\n\nFORD FIESTA S 1.5 16V MANUAL 2016.",
    );
    // Seções fora da parte criativa continuam idênticas.
    const semAnuncio = (s: string) => s.split("# ANUNCIO")[0];
    expect(semAnuncio(md)).toBe(semAnuncio(fixture));
  });

  it("interpreta números brasileiros", () => {
    expect(parseNumber("R$ 48.900,00")).toBe(48900);
    expect(parseNumber("84.000", true)).toBe(84000);
    expect(parseNumber("84.000,5", true)).toBeNull();
    expect(sugerirNome("I/FORD FIESTA HA 1.5L SB")).toBe("FORD FIESTA");
  });
});

describe("busca da ficha técnica", () => {
  it("junta nome comercial, modelo do CRLV e ano, sem repetir palavras", () => {
    expect(termoBusca("MERCEDES BENZ", "I/M.BENZ GLA250", "2016")).toBe(
      "MERCEDES BENZ GLA 250 2016",
    );
    expect(termoBusca("FORD FIESTA", "FORD/FIESTA HA 1.5L SB", "2016")).toBe(
      "FORD FIESTA HA 1.5L SB 2016",
    );
    expect(termoBusca("FIAT CRONOS", "", "2024")).toBe("FIAT CRONOS 2024");
  });
});
