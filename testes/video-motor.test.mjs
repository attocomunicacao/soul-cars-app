import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Motor de mentira: uma pasta com main.py e um `spawn` falso, para testar a trava de
// "um vídeo por vez" e o cancelamento sem Python, ffmpeg nem Electron.
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-video-motor-"));
fs.writeFileSync(path.join(raiz, "main.py"), "");
Object.defineProperty(process, "resourcesPath", {
  value: raiz,
  configurable: true,
});

const filhos = [];
let comportamento = "normal";
vi.mock("node:child_process", () => ({
  spawn: vi.fn((comando, args) => {
    if (comportamento === "lanca") throw new Error("spawn inválido");
    const filho = new EventEmitter();
    filho.stdout = new EventEmitter();
    filho.stderr = new EventEmitter();
    filho.pid = 4242;
    filho.kill = vi.fn();
    filho.comando = comando;
    filho.args = args;
    filhos.push(filho);
    return filho;
  }),
}));
vi.mock("electron", () => ({ app: { getAppPath: () => raiz } }));
vi.mock("../src/main/caminhos", () => ({
  lerConfig: () => ({ pastaMotor: raiz }),
  userData: () => raiz,
  raizDados: () => raiz,
}));

import {
  cancelarVideo,
  gerarVideo,
  gerarVideoLeve,
  videoEmExecucao,
} from "../src/main/studio/motor";

const emitir = () => {};
const iniciarLeve = () =>
  gerarVideoLeve({ pasta: "pasta", python: "python-falso" }, emitir);
const ultimo = () => filhos.at(-1);
const taskkills = () => filhos.filter((f) => f.comando === "taskkill");

beforeEach(() => {
  comportamento = "normal";
});
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true }));

describe("vídeo no motor", () => {
  it("roda o leve.py e entrega o caminho da última linha", async () => {
    const p = iniciarLeve();
    const filho = ultimo();
    expect(filho.args[1]).toMatch(/leve\.py$/);
    expect(videoEmExecucao()).toBe(true);
    filho.stdout.emit(
      "data",
      Buffer.from("PROGRESSO 50 x\nPRONTO em 3s: C:\\a\\b.mp4\n"),
    );
    filho.emit("close", 0);
    expect((await p).caminho).toBe("C:\\a\\b.mp4");
    expect(videoEmExecucao()).toBe(false);
  });

  it("recusa um segundo vídeo enquanto o primeiro roda, e libera ao terminar", async () => {
    const p = iniciarLeve();
    expect(() =>
      gerarVideo(
        {
          pasta: "p",
          veiculo: "v",
          motor: "m",
          preco: "r",
          python: "python-falso",
        },
        emitir,
      ),
    ).toThrow(/Já há um vídeo/);
    ultimo().emit("close", 0);
    await p;
    const outro = iniciarLeve();
    ultimo().emit("close", 0);
    await outro;
  });

  it("se o spawn lançar exceção, a trava não fica presa", async () => {
    comportamento = "lanca";
    expect(() => iniciarLeve()).toThrow(/spawn inválido/);
    expect(videoEmExecucao()).toBe(false);
    comportamento = "normal";
    const p = iniciarLeve();
    ultimo().emit("close", 0);
    await p;
  });

  it("erro ao abrir o processo também libera a trava", async () => {
    const p = iniciarLeve();
    ultimo().emit("error", new Error("ENOENT"));
    await expect(p).rejects.toThrow(/ENOENT/);
    expect(videoEmExecucao()).toBe(false);
  });

  it("falha do script vira a última linha como mensagem", async () => {
    const p = iniciarLeve();
    ultimo().stderr.emit("data", Buffer.from("ERRO: sem vídeo\n"));
    ultimo().emit("close", 1);
    await expect(p).rejects.toThrow("ERRO: sem vídeo");
    expect(videoEmExecucao()).toBe(false);
  });

  it("cancelar derruba o processo e libera a trava", async () => {
    expect(cancelarVideo()).toBe(false); // nada em execução
    const p = iniciarLeve();
    const filho = ultimo();
    expect(cancelarVideo()).toBe(true);
    // Windows: taskkill /T mata a árvore (Python e ffmpeg); outros sistemas: SIGTERM.
    if (process.platform === "win32") {
      const tk = taskkills().at(-1);
      expect(tk.args).toEqual(["/pid", "4242", "/t", "/f"]);
    } else expect(filho.kill).toHaveBeenCalledWith("SIGTERM");
    filho.emit("close", 1);
    await expect(p).rejects.toThrow(/cancelada/);
    expect(videoEmExecucao()).toBe(false);
    expect(cancelarVideo()).toBe(false);
  });
});
