import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  comoRegistros,
  lerXlsx,
  serialParaIso,
} from "../src/renderer/src/lib/xlsx";
import { gerarXlsx } from "./helpers/xlsx-fixture";

const REAL = process.env.SOUL_XLSX ?? "testes/fixtures/planilha-opcional.xlsx";

describe("xlsx", () => {
  it("lê strings compartilhadas, números, vazios, datas e acentos", async () => {
    const buf = await gerarXlsx([
      ["Nome da campanha", "Dia", "Valor gasto (BRL)", "Resultados"],
      ["[VENDA] FIAT CRONOS 2024 & cia <ok>", { data: "2026-08-01" }, 12.34, 5],
      ["", { data: "2026-08-02" }, 0, null],
    ]);
    const [aba] = await lerXlsx(buf);
    expect(aba.nome).toBe("Raw Data Report");
    const { cabecalho, registros } = comoRegistros(aba);
    expect(cabecalho).toEqual([
      "Nome da campanha",
      "Dia",
      "Valor gasto (BRL)",
      "Resultados",
    ]);
    expect(registros[0]).toEqual({
      "Nome da campanha": "[VENDA] FIAT CRONOS 2024 & cia <ok>",
      Dia: "2026-08-01",
      "Valor gasto (BRL)": 12.34,
      Resultados: 5,
    });
    expect(registros[1]["Nome da campanha"]).toBeNull();
    expect(registros[1].Resultados).toBeNull();
  });

  it("converte serial do Excel", () => {
    expect(serialParaIso(46235)).toBe("2026-08-01");
  });

  it("rejeita arquivo que não é xlsx", async () => {
    await expect(
      lerXlsx(new TextEncoder().encode("isto não é zip").buffer as ArrayBuffer),
    ).rejects.toThrow(/não é uma planilha/);
  });

  it.skipIf(!existsSync(REAL))(
    "abre uma planilha real salva pelo Excel",
    async () => {
      const b = readFileSync(REAL);
      const abas = await lerXlsx(
        b.buffer.slice(
          b.byteOffset,
          b.byteOffset + b.byteLength,
        ) as ArrayBuffer,
      );
      expect(abas.length).toBeGreaterThan(0);
      const preenchidas = abas.map((a) => ({
        nome: a.nome,
        linhas: a.linhas.length,
        celulas: a.linhas.flat().filter((c) => c !== null).length,
      }));
      console.log(preenchidas);
      expect(preenchidas.some((a) => a.celulas > 0)).toBe(true);
    },
  );
});
