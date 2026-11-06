/**
 * Vitest do app desktop: regras de negócio (TypeScript) e testes de núcleo (.mjs).
 * Rode com `npm test -w apps/desktop` ou `npm test` na raiz.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.{ts,mjs}"], environment: "node" },
});
