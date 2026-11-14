/**
 * Testes (Vitest) de src/main/disk.ts: renomear a pasta da versão tolera travas curtas
 * (antivírus) e desiste com mensagem clara quando a trava persiste.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fsSemAsar, renomearComPaciencia } from "../src/main/disk";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "soul-disk-"));

describe("renomearComPaciencia", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renomeia de primeira quando nada segura a pasta", async () => {
    const raiz = temp();
    fs.mkdirSync(path.join(raiz, "1.0.10.extraindo"));
    await renomearComPaciencia(
      path.join(raiz, "1.0.10.extraindo"),
      path.join(raiz, "1.0.10"),
    );
    expect(fs.existsSync(path.join(raiz, "1.0.10"))).toBe(true);
  });

  it("tenta de novo enquanto o Windows devolve EPERM", async () => {
    const original = fsSemAsar.renameSync;
    let chamadas = 0;
    vi.spyOn(fsSemAsar, "renameSync").mockImplementation((de, para) => {
      chamadas++;
      if (chamadas < 3)
        throw Object.assign(new Error("ocupado"), { code: "EPERM" });
      original(de, para);
    });
    const raiz = temp();
    fs.mkdirSync(path.join(raiz, "a"));
    await renomearComPaciencia(
      path.join(raiz, "a"),
      path.join(raiz, "b"),
      5,
      1,
    );
    expect(chamadas).toBe(3);
    expect(fs.existsSync(path.join(raiz, "b"))).toBe(true);
  });

  it("desiste com mensagem clara se a trava não sai", async () => {
    vi.spyOn(fsSemAsar, "renameSync").mockImplementation(() => {
      throw Object.assign(new Error("ocupado"), { code: "EPERM" });
    });
    await expect(renomearComPaciencia("x", "y", 3, 1)).rejects.toThrow(
      /não deixou terminar a instalação \(EPERM\)/,
    );
  });

  it("não insiste em erros que não são de trava", async () => {
    vi.spyOn(fsSemAsar, "renameSync").mockImplementation(() => {
      throw Object.assign(new Error("sumiu"), { code: "ENOENT" });
    });
    await expect(renomearComPaciencia("x", "y", 5, 1)).rejects.toThrow("sumiu");
  });
});
