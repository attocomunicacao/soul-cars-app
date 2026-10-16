import { describe, expect, it } from "vitest";
import { aplicarLinha } from "../src/renderer/src/AndamentoVideo";

describe("andamento do vídeo", () => {
  it("a primeira linha de progresso abre a geração", () => {
    const a = aplicarLinha(null, "PROGRESSO 12 Renderizando o vídeo", 1000);
    expect(a).toMatchObject({
      pct: 12,
      etapa: "Renderizando o vídeo",
      inicio: 1000,
    });
  });

  it("a barra nunca anda para trás dentro da mesma geração", () => {
    let a = aplicarLinha(null, "PROGRESSO 40 Renderizando o vídeo", 1000);
    a = aplicarLinha(a, "PROGRESSO 35 Renderizando o vídeo", 2000);
    expect(a?.pct).toBe(40);
    expect(a?.inicio).toBe(1000);
  });

  it("PRONTO encerra com o tempo informado e o arquivo", () => {
    let a = aplicarLinha(null, "PROGRESSO 99 Conferindo o arquivo final", 1000);
    a = aplicarLinha(a, "PRONTO em 171s: C:/pasta/VIDEO_FORD.mp4", 5000);
    expect(a).toMatchObject({
      pct: 100,
      fim: 1000 + 171_000,
      arquivo: "C:/pasta/VIDEO_FORD.mp4",
    });
  });

  it("depois de pronto, um novo progresso começa uma geração nova", () => {
    let a = aplicarLinha(null, "PROGRESSO 99 x", 1000);
    a = aplicarLinha(a, "PRONTO em 10s: a.mp4", 2000);
    a = aplicarLinha(a, "PROGRESSO 5 Gerando a versão leve", 9000);
    expect(a).toMatchObject({ pct: 5, inicio: 9000 });
    expect(a?.fim).toBeUndefined();
    expect(a?.detalhes).toEqual([]);
  });

  it("outras linhas vão para os detalhes, limitadas a 40", () => {
    let a = aplicarLinha(null, "PROGRESSO 10 x", 0);
    for (let i = 0; i < 60; i++) a = aplicarLinha(a, `linha ${i}`, 0);
    expect(a?.detalhes).toHaveLength(40);
    expect(a?.detalhes.at(-1)).toBe("linha 59");
    expect(a?.pct).toBe(10);
  });
});
