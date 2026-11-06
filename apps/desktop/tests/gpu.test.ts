/**
 * Testes (Vitest) de src/main/core/gpu.ts (reabrir sem aceleração de vídeo).
 */
import { describe, expect, it } from "vitest";
import { ARGUMENTO_SEM_GPU, pedeReabrirSemGpu } from "../src/main/core/gpu";

describe("reabrir sem GPU", () => {
  const args = ["electron.exe", "."];

  it("reabre quando a GPU quebra de verdade, uma vez só", () => {
    expect(pedeReabrirSemGpu("GPU", "crashed", args, false)).toBe(true);
    expect(pedeReabrirSemGpu("GPU", "launch-failed", args, false)).toBe(true);
    expect(
      pedeReabrirSemGpu("GPU", "crashed", [...args, ARGUMENTO_SEM_GPU], false),
    ).toBe(false);
  });

  it("não reabre para outros processos, para saída normal nem enquanto o app fecha", () => {
    expect(pedeReabrirSemGpu("Utility", "crashed", args, false)).toBe(false);
    expect(pedeReabrirSemGpu("GPU", "clean-exit", args, false)).toBe(false);
    expect(pedeReabrirSemGpu("GPU", "killed", args, false)).toBe(false);
    expect(pedeReabrirSemGpu("GPU", "crashed", args, true)).toBe(false);
  });
});
