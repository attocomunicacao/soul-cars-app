/**
 * Confere os links relativos dos arquivos Markdown do repositório (`[texto](caminho)`): o arquivo
 * apontado precisa existir. Ignora endereços externos (http, https, mailto) e âncoras (#...).
 * Sai com código 1 e lista cada link quebrado; é rodado no CI para a documentação não apodrecer.
 *
 * Uso: node scripts/docs/check-links.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const IGNORAR = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "release-tmp",
  ".venv",
]);

/** Todos os .md do repositório, sem as pastas geradas. */
function listarMarkdown(pasta, saida = []) {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const caminho = path.join(pasta, e.name);
    if (e.isDirectory()) listarMarkdown(caminho, saida);
    else if (e.name.endsWith(".md")) saida.push(caminho);
  }
  return saida;
}

const quebrados = [];
for (const arquivo of listarMarkdown(RAIZ)) {
  const texto = fs.readFileSync(arquivo, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of texto.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const alvo = m[1].split("#")[0];
    if (!alvo || /^(https?:|mailto:|tel:)/i.test(alvo)) continue;
    // `../../releases/latest` só funciona no site do GitHub (relativo à URL do repositório).
    if (/^(\.\.\/)+releases(\/|$)/.test(alvo)) continue;
    const resolvido = path.resolve(
      path.dirname(arquivo),
      decodeURIComponent(alvo),
    );
    if (!fs.existsSync(resolvido))
      quebrados.push(`${path.relative(RAIZ, arquivo)} -> ${m[1]}`);
  }
}

if (quebrados.length) {
  console.error(`Links quebrados (${quebrados.length}):`);
  for (const q of quebrados) console.error("  " + q);
  process.exit(1);
}
console.log("Links dos .md conferidos: nenhum quebrado.");
