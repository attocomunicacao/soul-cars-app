/**
 * Testes (Vitest) de src/shared/manifest.ts: validação do manifesto, comparação de
 * versões, situação do app no cartão e limpeza de versões antigas.
 */
import { describe, expect, it } from "vitest";
import {
  ManifestoInvalido,
  compararVersoes,
  lerManifesto,
  situacaoDoApp,
  versoesParaLimpar,
} from "../src/shared/manifest";

const SHA = "a".repeat(64);
const manifesto = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  generatedAt: "2026-11-05T12:00:00Z",
  launcher: {
    version: "1.0.0",
    notes: "",
    downloads: {
      "win32-x64": { url: "https://example.com/l.exe", sha256: SHA, size: 10 },
    },
  },
  apps: [
    {
      id: "soul-cars",
      name: "Soul Cars",
      tagline: "teste",
      version: "1.2.0",
      releasedAt: "2026-11-05",
      notes: "- novidade",
      executable: { win32: "SoulCars.exe" },
      downloads: {
        "win32-x64": {
          url: "https://example.com/a.zip",
          sha256: SHA,
          size: 99,
        },
      },
    },
  ],
  ...extra,
});

describe("lerManifesto", () => {
  it("aceita um manifesto válido", () => {
    const m = lerManifesto(manifesto());
    expect(m.apps[0].downloads["win32-x64"].size).toBe(99);
    expect(m.launcher.version).toBe("1.0.0");
  });

  it("recusa download sem https", () => {
    const m = manifesto();
    (m.apps[0].downloads["win32-x64"] as { url: string }).url =
      "http://example.com/a.zip";
    expect(() => lerManifesto(m)).toThrow(ManifestoInvalido);
  });

  it("recusa SHA-256 malformado e versão fora do padrão", () => {
    const m1 = manifesto();
    (m1.apps[0].downloads["win32-x64"] as { sha256: string }).sha256 = "xyz";
    expect(() => lerManifesto(m1)).toThrow(/sha256/);
    const m2 = manifesto();
    (m2.apps[0] as { version: string }).version = "1.2";
    expect(() => lerManifesto(m2)).toThrow(/version/);
  });

  it("recusa executável com caminho (não pode sair da pasta do app)", () => {
    const m = manifesto();
    m.apps[0].executable = { win32: "..\\..\\cmd.exe" };
    expect(() => lerManifesto(m)).toThrow(/executable/);
  });

  it("recusa schemaVersion desconhecido", () => {
    expect(() => lerManifesto(manifesto({ schemaVersion: 2 }))).toThrow(
      /schemaVersion/,
    );
  });
});

describe("compararVersoes", () => {
  it("ordena por major, minor e patch", () => {
    expect(compararVersoes("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compararVersoes("2.0.0", "2.0.0")).toBe(0);
    expect(compararVersoes("0.9.1", "1.0.0")).toBeLessThan(0);
  });
  it("pré-lançamento vem antes da final", () => {
    expect(compararVersoes("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
  });
});

describe("situacaoDoApp", () => {
  const release = lerManifesto(manifesto()).apps[0];
  it("decide instalar, atualizar, abrir ou indisponível", () => {
    expect(situacaoDoApp(release, null, "win32-x64")).toBe("nao-instalado");
    expect(situacaoDoApp(release, "1.1.0", "win32-x64")).toBe(
      "atualizacao-disponivel",
    );
    expect(situacaoDoApp(release, "1.2.0", "win32-x64")).toBe("atualizado");
    expect(situacaoDoApp(release, null, "linux-x64")).toBe("indisponivel");
    expect(situacaoDoApp(release, "1.0.0", "linux-x64")).toBe("atualizado");
  });
});

describe("versoesParaLimpar", () => {
  it("mantém a ativa e a anterior", () => {
    expect(
      versoesParaLimpar(["1.0.0", "1.1.0", "1.2.0", "0.9.0"], "1.2.0").sort(),
    ).toEqual(["0.9.0", "1.0.0"]);
  });
  it("não apaga nada com só duas versões", () => {
    expect(versoesParaLimpar(["1.0.0", "1.1.0"], "1.1.0")).toEqual([]);
  });
});

describe("urlPermitida", () => {
  it("http local só no modo de teste", () => {
    const m = manifesto();
    (m.apps[0].downloads["win32-x64"] as { url: string }).url =
      "http://127.0.0.1:8080/a.zip";
    expect(() => lerManifesto(m)).toThrow(/https/);
    expect(lerManifesto(m, { permitirHttpLocal: true }).apps[0].id).toBe(
      "soul-cars",
    );
    (m.apps[0].downloads["win32-x64"] as { url: string }).url =
      "http://example.com/a.zip";
    expect(() => lerManifesto(m, { permitirHttpLocal: true })).toThrow(/https/);
  });
});
