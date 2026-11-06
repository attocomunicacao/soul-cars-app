#!/usr/bin/env node
/**
 * Gera o manifest.json de uma release (lido pelo Soul Cars Launcher).
 *
 * Calcula o SHA-256 e o tamanho de cada pacote e monta os endereços de download a
 * partir de --base-url (na release do GitHub: .../releases/download/v<versão>/).
 *
 * Uso:
 *   node scripts/release/create-manifest.mjs \
 *     --version 1.0.0 \
 *     --app-zip apps/desktop/dist/soul-cars-desktop-1.0.0-win-x64.zip \
 *     --launcher-exe apps/launcher/dist/soul-cars-launcher-setup-1.0.0.exe \
 *     --base-url https://github.com/<dono>/<repo>/releases/download/v1.0.0/ \
 *     [--notes CHANGELOG-trecho.md] [--out dist/manifest.json]
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    version: { type: "string" },
    "app-zip": { type: "string" },
    "launcher-exe": { type: "string" },
    "base-url": { type: "string" },
    notes: { type: "string" },
    out: { type: "string", default: "manifest.json" },
  },
});

/** Interrompe com uma mensagem clara quando falta um argumento. */
function exigir(valor, nome) {
  if (!valor) {
    console.error(`Falta o argumento --${nome}.`);
    process.exit(1);
  }
  return valor;
}

const versao = exigir(a.version, "version").replace(/^v/, "");
const base = exigir(a["base-url"], "base-url").replace(/\/?$/, "/");

/** SHA-256, tamanho e endereço de um arquivo da release. */
function pacote(arquivo) {
  const dados = fs.readFileSync(arquivo);
  return {
    url: base + encodeURIComponent(path.basename(arquivo)),
    sha256: createHash("sha256").update(dados).digest("hex"),
    size: dados.length,
  };
}

/**
 * Tira a marcação Markdown das notas (negrito, código e links), deixando texto simples.
 * O Launcher 1.0.0 mostra as notas como texto puro; sem isto, "**" e "`" apareceriam na tela.
 * Os marcadores de lista ("- ") ficam: todas as versões do Launcher os tratam.
 */
function notasSemMarcacao(texto) {
  return texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_m, a, b) => a ?? b)
    .replace(/`([^`]+)`/g, "$1");
}

/** Notas da versão: o arquivo indicado (sem marcação) ou um texto padrão. */
const notas =
  a.notes && fs.existsSync(a.notes)
    ? notasSemMarcacao(fs.readFileSync(a.notes, "utf8").trim())
    : `Soul Cars ${versao}.`;

const manifesto = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  launcher: {
    version: versao,
    notes: notas,
    downloads: a["launcher-exe"]
      ? { "win32-x64": pacote(a["launcher-exe"]) }
      : {},
  },
  apps: [
    {
      id: "soul-cars",
      name: "Soul Cars",
      tagline:
        "Do estoque ao anúncio publicado: BNDV, ficha, fotos, vídeo, criativos, CRM e finanças.",
      version: versao,
      releasedAt: new Date().toISOString(),
      notes: notas,
      executable: { win32: "SoulCars.exe" },
      downloads: { "win32-x64": pacote(exigir(a["app-zip"], "app-zip")) },
    },
  ],
};

fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
fs.writeFileSync(a.out, JSON.stringify(manifesto, null, 2) + "\n");
console.log(`manifest.json gravado em ${a.out}`);
