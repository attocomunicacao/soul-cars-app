/**
 * Prepara o smoke do Instagram: empacota (esbuild) os módulos do main usados pelo teste
 * em `.tmp/instagram-smoke.cjs`, para rodar sem o build completo.
 */
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(raiz, ".tmp"), { recursive: true });
require("esbuild").buildSync({
  stdin: {
    contents:
      'export * from "./src/main/studio/instagram"; export { executar, banco } from "./src/main/studio/database"; export { gerarHtml } from "./src/main/inventory/report";',
    resolveDir: raiz,
    sourcefile: "instagram-smoke.ts",
  },
  outfile: path.join(raiz, ".tmp", "instagram-smoke.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
