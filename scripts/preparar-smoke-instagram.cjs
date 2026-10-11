const fs = require("node:fs");
const path = require("node:path");
const raiz = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(raiz, ".tmp"), { recursive: true });
require("esbuild").buildSync({
  stdin: {
    contents:
      'export * from "./src/main/studio/instagram"; export { executar, banco } from "./src/main/studio/banco"; export { gerarHtml } from "./src/main/estoque/relatorio";',
    resolveDir: raiz,
    sourcefile: "instagram-smoke.ts",
  },
  outfile: path.join(raiz, ".tmp", "instagram-smoke.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
