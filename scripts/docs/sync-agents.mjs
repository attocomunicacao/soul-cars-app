/**
 * Mantém `AGENTS.md` idêntico ao `CLAUDE.md` (a regra do projeto: os dois têm exatamente o mesmo conteúdo).
 * `CLAUDE.md` é a fonte. Sem argumentos, regrava o `AGENTS.md`; com `--check`, só confere e sai com
 * código 1 se estiverem diferentes (usado no CI).
 *
 * Uso: node scripts/docs/sync-agents.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const fonte = fs.readFileSync(path.join(RAIZ, "CLAUDE.md"), "utf8");
const destino = path.join(RAIZ, "AGENTS.md");
const atual = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";

if (fonte === atual) {
  console.log("AGENTS.md já é idêntico ao CLAUDE.md.");
} else if (process.argv.includes("--check")) {
  console.error(
    "AGENTS.md difere do CLAUDE.md. Rode: node scripts/docs/sync-agents.mjs",
  );
  process.exit(1);
} else {
  fs.writeFileSync(destino, fonte, "utf8");
  console.log("AGENTS.md atualizado a partir do CLAUDE.md.");
}
