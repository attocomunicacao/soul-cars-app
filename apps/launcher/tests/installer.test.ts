/**
 * Testes (Vitest) da troca da pasta da versão em src/main/installer.ts (`colocarNoLugar`):
 * a versão que já existe nunca é apagada antes de a nova estar no lugar, e volta se a troca falha.
 * O Electron é simulado.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-instalador-"));
process.env.LOCALAPPDATA = raiz;
vi.mock("electron", () => ({
  app: { getPath: () => raiz, isPackaged: false, getAppPath: () => raiz },
}));

const { colocarNoLugar } = await import("../src/main/installer");

/** Cria uma pasta de versão com um arquivo que identifica o conteúdo. */
function pasta(nome: string, conteudo: string) {
  const dir = path.join(raiz, `${nome}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "versao.txt"), conteudo);
  return dir;
}
const ler = (dir: string) =>
  fs.readFileSync(path.join(dir, "versao.txt"), "utf8");

describe("colocarNoLugar", () => {
  it("instala quando ainda não existe a pasta final", async () => {
    const nova = pasta("nova", "nova");
    const final = path.join(raiz, "final-1");
    await colocarNoLugar(nova, final);
    expect(ler(final)).toBe("nova");
    expect(fs.existsSync(nova)).toBe(false);
  });

  it("substitui a versão existente e não deixa a pasta .antiga", async () => {
    const nova = pasta("nova", "nova");
    const final = pasta("final", "antiga");
    await colocarNoLugar(nova, final);
    expect(ler(final)).toBe("nova");
    expect(fs.existsSync(`${final}.antiga`)).toBe(false);
  });

  it("se a troca falha, a versão que já existia volta ao lugar", async () => {
    const final = pasta("final", "antiga");
    const inexistente = path.join(raiz, "nao-existe.extraindo");
    await expect(colocarNoLugar(inexistente, final)).rejects.toThrow();
    expect(ler(final)).toBe("antiga");
    expect(fs.existsSync(`${final}.antiga`)).toBe(false);
  });

  it("limpa um .antiga deixado por uma instalação interrompida", async () => {
    const nova = pasta("nova", "nova");
    const final = path.join(raiz, "final-resto");
    fs.mkdirSync(`${final}.antiga`);
    fs.writeFileSync(path.join(`${final}.antiga`, "lixo.txt"), "x");
    await colocarNoLugar(nova, final);
    expect(ler(final)).toBe("nova");
    expect(fs.existsSync(`${final}.antiga`)).toBe(false);
  });
});
