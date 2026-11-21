/**
 * Testes (Vitest) da reserva para o Smart App Control: quando o Windows bloqueia a versão
 * nova, o Launcher abre a anterior que já funcionou (src/main/installer.ts e
 * src/shared/manifest.ts). O Electron e a abertura real são simulados.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { versoesAlternativas, versoesParaLimpar } from "../src/shared/manifest";

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-reserva-"));
process.env.LOCALAPPDATA = raiz;
vi.mock("electron", () => ({
  app: { getPath: () => raiz, isPackaged: false, getAppPath: () => raiz },
}));

/** Versões que o "Windows" bloqueia neste teste. */
const bloqueadas = new Set<string>();
const abertas: string[] = [];
vi.mock("../src/main/launch", async (original) => {
  const real = await original<typeof import("../src/main/launch")>();
  return {
    ...real,
    abrirExecutavel: vi.fn(async (exe: string) => {
      const versao = path.basename(path.dirname(exe));
      if (bloqueadas.has(versao))
        throw new real.ErroAoAbrir(
          "O Windows bloqueou o Soul Cars (Smart App Control).",
          { tipo: "nao-iniciou", codigo: "UNKNOWN", mensagem: "spawn UNKNOWN" },
          true,
        );
      abertas.push(versao);
    }),
  };
});

const { abrirApp } = await import("../src/main/installer");
const { gravarEstado, lerEstado } = await import("../src/main/state");

const release = {
  id: "soul-cars",
  name: "Soul Cars",
  tagline: "",
  version: "1.0.4",
  releasedAt: "",
  notes: "",
  executable: { [process.platform]: "SoulCars.exe" },
  downloads: {},
};

/** Cria a pasta de uma versão "instalada" com o executável. */
function instalar(versao: string) {
  const pasta = path.join(raiz, "SoulCars", "apps", "soul-cars", versao);
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, "SoulCars.exe"), "");
}

beforeEach(() => {
  bloqueadas.clear();
  abertas.length = 0;
  for (const v of ["1.0.2", "1.0.3", "1.0.4"]) instalar(v);
  gravarEstado((e) => {
    e.instalados["soul-cars"] = {
      ativa: "1.0.4",
      versoes: ["1.0.3", "1.0.4"],
    };
  });
});

describe("abrir com reserva", () => {
  it("abre a versão ativa quando o Windows deixa, e lembra dela", async () => {
    await expect(abrirApp(release)).resolves.toEqual({ versaoAberta: "1.0.4" });
    expect(lerEstado().instalados["soul-cars"].ultimaQueAbriu).toBe("1.0.4");
  });

  it("versão nova bloqueada: abre a anterior e avisa qual foi bloqueada", async () => {
    bloqueadas.add("1.0.4");
    await expect(abrirApp(release)).resolves.toEqual({
      versaoAberta: "1.0.3",
      versaoBloqueada: "1.0.4",
    });
    expect(abertas).toEqual(["1.0.3"]);
    expect(lerEstado().instalados["soul-cars"].ultimaQueAbriu).toBe("1.0.3");
  });

  it("prefere a última que abriu, mesmo que não seja a mais nova", async () => {
    bloqueadas.add("1.0.4");
    gravarEstado((e) => {
      e.instalados["soul-cars"].versoes = ["1.0.2", "1.0.3", "1.0.4"];
      e.instalados["soul-cars"].ultimaQueAbriu = "1.0.2";
    });
    await expect(abrirApp(release)).resolves.toMatchObject({
      versaoAberta: "1.0.2",
    });
  });

  it("todas bloqueadas: devolve o erro original, com a mensagem do Smart App Control", async () => {
    bloqueadas.add("1.0.4");
    bloqueadas.add("1.0.3");
    await expect(abrirApp(release)).rejects.toThrow(/Smart App Control/);
  });
});

describe("regras da reserva", () => {
  it("a última que abriu vem primeiro entre as alternativas", () => {
    expect(
      versoesAlternativas(["1.0.2", "1.0.3", "1.0.4"], "1.0.4", "1.0.2"),
    ).toEqual(["1.0.2", "1.0.3"]);
    expect(versoesAlternativas(["1.0.2", "1.0.3", "1.0.4"], "1.0.4")).toEqual([
      "1.0.3",
      "1.0.2",
    ]);
  });

  it("a limpeza nunca apaga a última que abriu", () => {
    // Duas atualizações seguidas bloqueadas: 1.0.3 é a única que abre e fica guardada.
    expect(
      versoesParaLimpar(["1.0.3", "1.0.4", "1.0.5"], "1.0.5", 2, "1.0.3"),
    ).toEqual([]);
    expect(versoesParaLimpar(["1.0.3", "1.0.4", "1.0.5"], "1.0.5", 2)).toEqual([
      "1.0.3",
    ]);
  });
});
