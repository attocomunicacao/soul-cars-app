/**
 * Vitest do app desktop: regras de negócio (TypeScript) e testes de núcleo (.mjs).
 * Rode com `npm test -w apps/desktop` ou `npm test` na raiz.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,mjs}"],
    environment: "node",
    // Relatório com `npm run test:coverage`. Sem meta mínima ainda: primeiro medir a linha de base.
    coverage: {
      provider: "v8",
      reportsDirectory: ".tmp/coverage",
      include: ["src/main/**", "src/shared/**", "src/renderer/src/lib/**"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
