import { describe, expect, it } from "vitest";
import { versaoDoTitulo } from "../src/renderer/src/lib/cnw-banco";

describe("versaoDoTitulo", () => {
  it("tira o modelo e fica com o motor/versão", () => {
    expect(versaoDoTitulo("GLA 250 Sport 2.0 Turbo", "GLA 250")).toBe(
      "Sport 2.0 Turbo",
    );
  });
  it("tira também a marca que vem antes do modelo", () => {
    expect(
      versaoDoTitulo("Mercedes-Benz GLA 250 Sport 2.0 Turbo", "GLA 250"),
    ).toBe("Sport 2.0 Turbo");
  });
  it("sem o modelo no título, usa o título inteiro", () => {
    expect(versaoDoTitulo("Argo Drive 1.0", "Cronos")).toBe("Argo Drive 1.0");
  });
  it("título igual ao modelo não vira texto vazio", () => {
    expect(versaoDoTitulo("GLA 250", "GLA 250")).toBe("GLA 250");
  });
});
