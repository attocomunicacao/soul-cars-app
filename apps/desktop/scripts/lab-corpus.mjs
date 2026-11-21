/**
 * Atualiza a lista em Markdown dos cenários do Laboratório (docs/ai/lab-cenarios.md) a partir de
 * src/shared/lab-corpus.ts. Roda o teste `lab-lista` com LAB_ATUALIZAR=1, que reescreve o arquivo.
 */
import { spawnSync } from "node:child_process";

const r = spawnSync(
  process.execPath,
  ["../../node_modules/vitest/vitest.mjs", "run", "tests/lab-lista.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, LAB_ATUALIZAR: "1" },
  },
);
process.exit(r.status ?? 1);
