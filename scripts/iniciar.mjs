// Abre o SOUL Cars sem terminal: compila só se o código mudou e inicia o Electron em segundo plano.
// Chamado por scripts/iniciar.cmd (que o atalho executa de forma oculta). Erros vão para .tmp/iniciar.log.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaLog = path.join(raiz, ".tmp");
const arquivoLog = path.join(pastaLog, "iniciar.log");

function registrar(texto) {
  fs.mkdirSync(pastaLog, { recursive: true });
  fs.appendFileSync(
    arquivoLog,
    `[${new Date().toLocaleString("pt-BR")}] ${texto}\n`,
  );
}

function falhar(texto) {
  registrar(`ERRO: ${texto}`);
  process.exit(1);
}

/** Data de modificação mais recente de um arquivo ou de tudo dentro de uma pasta. */
function maisRecente(alvo) {
  let achado = 0;
  let stat;
  try {
    stat = fs.statSync(alvo);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.mtimeMs;
  for (const nome of fs.readdirSync(alvo))
    achado = Math.max(achado, maisRecente(path.join(alvo, nome)));
  return achado;
}

try {
  fs.rmSync(arquivoLog, { force: true });
  if (!fs.existsSync(path.join(raiz, "node_modules", "electron"))) {
    falhar(
      "Dependências não instaladas. Execute scripts\\instalar.cmd uma vez.",
    );
  }

  const gerados = [
    "out/main/index.js",
    "out/preload/index.cjs",
    "out/renderer/index.html",
  ].map((p) => path.join(raiz, p));
  const geradoEm = Math.min(
    ...gerados.map((p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0)),
  );
  const codigoEm = Math.max(
    ...["src", "package.json", "electron.vite.config.ts"].map((p) =>
      maisRecente(path.join(raiz, p)),
    ),
  );

  if (geradoEm === 0 || codigoEm > geradoEm) {
    registrar("Código novo: compilando antes de abrir.");
    const build = spawnSync(
      process.execPath,
      [
        path.join(
          raiz,
          "node_modules",
          "electron-vite",
          "bin",
          "electron-vite.js",
        ),
        "build",
      ],
      { cwd: raiz, encoding: "utf8", windowsHide: true },
    );
    if (build.status !== 0)
      falhar(`A compilação falhou.\n${build.stdout}\n${build.stderr}`);
  }

  const electron = createRequire(import.meta.url)(
    path.join(raiz, "node_modules", "electron"),
  );
  const filho = spawn(electron, ["."], {
    cwd: raiz,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  filho.on("error", (erro) =>
    falhar(`Não consegui abrir o Electron: ${erro.message}`),
  );
  filho.unref();
  // Dá um instante para um erro imediato de abertura aparecer antes de sair.
  setTimeout(() => process.exit(0), 600);
} catch (erro) {
  falhar(String(erro?.stack ?? erro));
}
