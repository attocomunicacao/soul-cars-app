/**
 * Teste de ponta a ponta do Launcher (Electron real), também usado para o print do README.
 *
 *   1. serve um feed local (manifest.json + zip do app) em http://127.0.0.1;
 *   2. abre o Launcher com SOUL_CARS_FEED_URL apontando para ele e pastas temporárias;
 *   3. clica em INSTALAR, espera o "ABRIR" e confere SoulCars.exe na pasta da versão;
 *   4. salva docs/assets/screenshots/00-launcher.png.
 *
 * Pré-requisitos: `npm run package:desktop` e `npm run build -w apps/launcher`.
 * Uso: npx electron apps/launcher/scripts/e2e-install.cjs
 */
const { app } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "../../..");
const versao = require(path.join(RAIZ, "apps/desktop/package.json")).version;
const zip = path.join(RAIZ, `apps/desktop/dist/soul-cars-desktop-${versao}-win-x64.zip`);
if (!fs.existsSync(zip)) {
  console.error("Gere o pacote antes: npm run package:desktop");
  process.exit(1);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "soul-launcher-e2e-"));
const feed = path.join(temp, "feed");
fs.mkdirSync(feed);
process.env.LOCALAPPDATA = path.join(temp, "local");
app.setPath("userData", path.join(temp, "launcher-data"));
app.setVersion(require("../package.json").version);

const servidor = http.createServer((req, res) => {
  const nome = decodeURIComponent((req.url ?? "/").slice(1));
  const arquivo = nome === "manifest.json" ? path.join(feed, nome) : nome === path.basename(zip) ? zip : null;
  if (!arquivo) return res.writeHead(404).end();
  res.writeHead(200, { "content-length": fs.statSync(arquivo).size });
  fs.createReadStream(arquivo).pipe(res);
});

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const limite = setTimeout(() => {
  console.error("E2E: tempo excedido");
  app.exit(1);
}, 300_000);

servidor.listen(0, "127.0.0.1", () => {
  const base = `http://127.0.0.1:${servidor.address().port}/`;
  const notas = path.join(feed, "notes.md");
  fs.writeFileSync(
    notas,
    "- Launcher: instale, atualize e abra o Soul Cars com um clique\n- Pacotes conferidos por SHA-256\n- Estrutura reorganizada em apps/launcher, apps/desktop e apps/engine",
  );
  execFileSync(process.execPath.includes("electron") ? "node" : process.execPath, [
    path.join(RAIZ, "scripts/release/create-manifest.mjs"),
    "--version", versao, "--app-zip", zip, "--base-url", base,
    "--notes", notas, "--out", path.join(feed, "manifest.json"),
  ]);
  process.env.SOUL_CARS_FEED_URL = base + "manifest.json";

  app.on("browser-window-created", (_e, w) => {
    w.webContents.once("did-finish-load", async () => {
      try {
        w.setContentSize(1200, 760);
        const js = (c) => w.webContents.executeJavaScript(c);
        const botao = async (texto, segundos) => {
          for (let i = 0; i < segundos * 2; i++) {
            const achou = await js(`!![...document.querySelectorAll('.app-card button')].find(b=>b.textContent.startsWith(${JSON.stringify(texto)})&&!b.disabled)`);
            if (achou) return;
            await esperar(500);
          }
          throw new Error(`Botão "${texto}" não apareceu`);
        };
        await botao("INSTALAR", 30);
        await js(`[...document.querySelectorAll('.app-card button')].find(b=>b.textContent==='INSTALAR').click()`);
        await botao("ABRIR", 240);
        const exe = path.join(process.env.LOCALAPPDATA, "SoulCars", "apps", "soul-cars", versao, "SoulCars.exe");
        if (!fs.existsSync(exe)) throw new Error("SoulCars.exe não foi instalado em " + exe);
        await js(`document.querySelector('.notes')?.setAttribute('open','')`);
        await js(`document.getElementById('status').textContent='Catálogo verificado agora'`);
        await esperar(600);
        const saida = path.join(RAIZ, "docs/assets/screenshots");
        fs.mkdirSync(saida, { recursive: true });
        fs.writeFileSync(path.join(saida, "00-launcher.png"), (await w.webContents.capturePage()).toPNG());
        console.log("E2E LAUNCHER OK", exe.replace(temp, "<temp>"));
        clearTimeout(limite);
        servidor.close();
        app.exit(0);
      } catch (e) {
        console.error(e);
        app.exit(1);
      }
    });
  });
  import("../out/main/index.js");
});
