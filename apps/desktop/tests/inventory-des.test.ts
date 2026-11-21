/**
 * Testes (Vitest) do DES.md como fonte dos dados do carro na leitura do ESTOQUE
 * (src/renderer/src/lib/inventory-parse.ts).
 */
import { describe, expect, it } from "vitest";
import { lerDesExistente } from "../src/renderer/src/lib/inventory-parse";

/** Recorte do DES.md real (formato gerado a partir do DOC.md). */
const DES = `# DESCRIÇÃO - EXTRAÍDA DO DOC.MD

## MARCA / MODELO / VERSÃO
JEEP/RENEGADE SPORT AT

## QUILOMETRAGEM
68.000

## VALOR
R$66.900,00

---

# DESCRIÇÃO - [CARROS NA WEB](https://www.carrosnaweb.com.br/)

## MOTOR
Sport 1.8 AT

## ANO
2017

## CONFIGURAÇÃO
SUV

## CÂMBIO
Automático de 6 marchas

---

# ANUNCIO

## CARROSSEL

**TITULO**
Jeep Renegade 2017

**SUBTITULO**
Sport 1.8 AT

**VALOR DE VENDA**
66.900

**ANO**
2017
`;

describe("DES.md", () => {
  it("é a fonte de nome, versão, ano, preço e km", () => {
    const d = lerDesExistente(DES);
    expect(d.nome).toBe("Jeep Renegade");
    expect(d.versao).toBe("Sport 1.8 AT");
    expect(d.ano).toBe("2017");
    expect(d.preco).toBe(66900);
    expect(d.km).toBe(68000);
    expect(d.marca_modelo).toBe("JEEP/RENEGADE SPORT AT");
  });
  it("aceita quebras de linha do Windows", () => {
    const d = lerDesExistente(DES.replace(/\n/g, "\r\n"));
    expect(d.ano).toBe("2017");
    expect(d.preco).toBe(66900);
  });
  it("sem carrossel, mantém ano/versão/preço (o nome fica o da pasta)", () => {
    const d = lerDesExistente(DES.split("# ANUNCIO")[0]);
    expect(d.nome).toBeUndefined();
    expect(d.ano).toBe("2017");
    expect(d.versao).toBe("Sport 1.8 AT");
    expect(d.preco).toBe(66900);
  });
  it("título repetido fora do # ANUNCIO não duplica o ano", () => {
    const d = lerDesExistente(DES.replace("# ANUNCIO\n", ""));
    expect(d.ano).toBe("2017");
    expect(d.nome).toBe("Jeep Renegade");
  });
});
