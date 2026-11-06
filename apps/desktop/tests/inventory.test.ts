/**
 * Testes (Vitest) de src/renderer/src/lib/inventory-parse.ts (leitura das pastas do estoque; dados reais opcionais).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  distribuirFotos,
  idEstoque,
  lerInfoBndv,
  lerDesExistente,
  lerNomePasta,
} from "../src/renderer/src/lib/inventory-parse";

const ESTOQUE = process.env.SOUL_ESTOQUE ?? "tests/fixtures/estoque-opcional";

describe("estoque", () => {
  it("identifica o ID BNDV e mantém a placa fora do modelo", () => {
    expect(idEstoque("1555244_CHEVROLET_CORSA_SEDAN_KHR2I22")).toBe(1555244);
    expect(idEstoque("1177428_FORD_ECOSPORT_FCM7D90")).toBe(1177428);
    expect(idEstoque("sem_id")).toBeNull();
    expect(lerNomePasta("1555244_CHEVROLET_CORSA_SEDAN_KHR2I22")).toEqual({
      modelo: "CHEVROLET CORSA SEDAN",
      placa: "KHR2I22",
    });
  });
  it("lê somente dados de anúncio de INFO.md e não usa valor de compra como preço", () => {
    const info = lerInfoBndv(
      "| **Marca / modelo** | Chevrolet Corsa Sedan |\n| **Placa** | KHR2I22 |\n| **Chassi** | ABC |\n| **Preço de tabela** | — |\n| **Valor de compra** | R$ 14.000,00 |",
    );
    expect(info).toMatchObject({
      nome: "Chevrolet Corsa Sedan",
      placa: "KHR2I22",
      chassi: "ABC",
    });
    expect(info.preco).toBeUndefined();
    expect(lerInfoBndv("| **Preço de tabela** | R$ 25.900,00 |").preco).toBe(
      25900,
    );
  });
  it("lê modelo e placa do nome da pasta", () => {
    expect(lerNomePasta("01_FIESTA_PJR1A63")).toEqual({
      modelo: "FIESTA",
      placa: "PJR1A63",
    });
    expect(lerNomePasta("03_TCROSS_QWZ4F59")).toEqual({
      modelo: "TCROSS",
      placa: "QWZ4F59",
    });
    expect(lerNomePasta("HB20 SENSE")).toEqual({
      modelo: "HB20 SENSE",
      placa: null,
    });
  });

  it("distribui as fotos no padrão 1.jpeg / 1_t.png / 2-4", () => {
    const fotos = [
      "F/1.jpeg",
      "F/1_t.png",
      "F/2.jpeg",
      "F/3.jpeg",
      "F/4.jpeg",
      "F/10.jpeg",
    ];
    expect(distribuirFotos(fotos)).toEqual({
      original: "F/1.jpeg",
      recorte: "F/1_t.png",
      left: "F/2.jpeg",
      center: "F/3.jpeg",
      right: "F/4.jpeg",
    });
    expect(distribuirFotos(["F/1.jpeg", "F/2.jpeg"]).recorte).toBeNull();
  });

  it.skipIf(!existsSync(ESTOQUE))("lê os DES.md reais do estoque", () => {
    const pastas = readdirSync(ESTOQUE).filter((n) =>
      existsSync(join(ESTOQUE, n, "DES.md")),
    );
    expect(pastas.length).toBeGreaterThan(0);
    for (const nome of pastas) {
      const d = lerDesExistente(
        readFileSync(join(ESTOQUE, nome, "DES.md"), "utf8"),
      );
      console.log(nome, {
        nome: d.nome,
        ano: d.ano,
        preco: d.preco,
        km: d.km,
        motor: d.versao,
        cambio: d.cambio,
        equip: (d.conforto ?? "").split("\n").length,
      });
      expect(d.nome, nome).toBeTruthy();
      expect(d.preco, nome).toBeGreaterThan(0);
      expect(d.km, nome).not.toBeNull();
    }
    const fiesta = lerDesExistente(
      readFileSync(join(ESTOQUE, "01_FIESTA_PJR1A63", "DES.md"), "utf8"),
    );
    expect(fiesta).toMatchObject({
      nome: "FORD FIESTA",
      ano: "2016",
      versao: "S 1.5",
      cambio: "MANUAL DE 5 MARCHAS",
      km: 84000,
    });
  });
});
