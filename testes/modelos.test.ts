import path from "node:path";
import { describe, expect, it } from "vitest";
import { pastaDeModelos } from "../src/main/studio/modelos";

describe("pasta dos modelos de recorte", () => {
  const dados = path.join("C:/Users/x/AppData/Roaming", "soul-cars-app");
  const home = "C:/Users/x";

  it("reaproveita ~/.rembg quando já tem modelos", () => {
    const r = pastaDeModelos(
      dados,
      home,
      (c) => c === path.join(home, ".rembg", "models"),
    );
    expect(r).toBe(path.join(home, ".rembg"));
  });

  it("sem modelos prévios, guarda nos dados do app", () => {
    expect(pastaDeModelos(dados, home, () => false)).toBe(
      path.join(dados, "modelos", "rembg"),
    );
  });
});
