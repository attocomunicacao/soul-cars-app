/** Vitest do Launcher: manifesto, versões e regras de instalação (sem Electron). */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
