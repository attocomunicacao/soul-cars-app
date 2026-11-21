/**
 * Testes (Vitest) das notas da versão: src/shared/release-notes.ts (como o Launcher desenha)
 * e scripts/release/create-manifest.mjs (notas gravadas sem marcação no manifest.json).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { linhasDasNotas, trechosDaLinha } from "../src/shared/release-notes";

describe("linhasDasNotas", () => {
  it("tira marcadores de lista e linhas vazias", () => {
    expect(linhasDasNotas("- um\n\n* dois\n  + três\nquatro")).toEqual([
      "um",
      "dois",
      "três",
      "quatro",
    ]);
  });
});

describe("trechosDaLinha", () => {
  it("separa negrito, código e texto comum", () => {
    expect(
      trechosDaLinha("Novo **Soul Cars Launcher**: veja `apps/launcher`"),
    ).toEqual([
      { texto: "Novo ", estilo: "normal" },
      { texto: "Soul Cars Launcher", estilo: "negrito" },
      { texto: ": veja ", estilo: "normal" },
      { texto: "apps/launcher", estilo: "codigo" },
    ]);
  });

  it("links ficam só com o rótulo; marcação sem par fica como texto", () => {
    expect(trechosDaLinha("[Docs](https://x.y) e 2 * 3")).toEqual([
      { texto: "Docs e 2 * 3", estilo: "normal" },
    ]);
  });
});

describe("create-manifest.mjs", () => {
  it("grava as notas sem ** nem crases (Launcher 1.0.0 mostra texto puro)", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-notas-"));
    try {
      const zip = path.join(pasta, "app.zip");
      fs.writeFileSync(zip, "pacote");
      const notas = path.join(pasta, "notas.md");
      fs.writeFileSync(
        notas,
        "- Novo **Launcher** em `apps/launcher`\n- [Docs](https://x.y)",
      );
      const saida = path.join(pasta, "manifest.json");
      execFileSync(process.execPath, [
        path.resolve(__dirname, "../../../scripts/release/create-manifest.mjs"),
        "--version",
        "1.0.1",
        "--app-zip",
        zip,
        "--base-url",
        "https://example.com/v1.0.1/",
        "--notes",
        notas,
        "--out",
        saida,
      ]);
      const m = JSON.parse(fs.readFileSync(saida, "utf8"));
      expect(m.apps[0].notes).toBe("- Novo Launcher em apps/launcher\n- Docs");
      expect(m.launcher.notes).toBe(m.apps[0].notes);
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true });
    }
  });
});
