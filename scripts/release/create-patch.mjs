#!/usr/bin/env node
/**
 * Gera o pacote só de código de uma release (a pasta `resources` do app empacotado) e
 * imprime o id do runtime (Electron) a que ele se aplica.
 *
 * Uso: node scripts/release/create-patch.mjs --unpacked apps/desktop/dist/win-unpacked \
 *        --out apps/desktop/dist/soul-cars-desktop-1.0.7-patch.zip
 * Saída (última linha): runtime=<sha256>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { idDoRuntime } from "./runtime-id.mjs";

const { values: a } = parseArgs({
  options: { unpacked: { type: "string" }, out: { type: "string" } },
});
if (!a.unpacked || !a.out) {
  console.error("Uso: create-patch.mjs --unpacked <pasta> --out <arquivo.zip>");
  process.exit(1);
}
const pasta = path.resolve(a.unpacked);
const saida = path.resolve(a.out);
const runtime = idDoRuntime(pasta);
if (!runtime || !fs.existsSync(path.join(pasta, "resources", "app.asar"))) {
  console.error(
    `Pasta inválida: faltam arquivos do Electron ou resources/app.asar em ${pasta}.`,
  );
  process.exit(1);
}
fs.rmSync(saida, { force: true });
// bsdtar (tar.exe do Windows) cria .zip com -a. Caminho completo: o "tar" do Git Bash é o GNU tar.
const tar =
  process.platform === "win32"
    ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
    : "tar";
const r = spawnSync(tar, ["-a", "-cf", saida, "-C", pasta, "resources"], {
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`patch gravado em ${a.out}`);
console.log(`runtime=${runtime}`);
