/**
 * Gera os prints do README com dados 100% fictícios (modo demonstração).
 *
 * Roda no Electron real, com banco e estoque temporários:
 *   1. grava CSVs do BNDV de mentira (veículos em estoque e vendidos nos últimos meses);
 *   2. desenha ilustrações de carro em SVG (nenhuma foto real) e grava em FOTOS/;
 *   3. cria as pastas e fichas com o mesmo `sincronizar` do app;
 *   4. abre o app, navega pelas telas e salva PNGs em docs/assets/screenshots/.
 *
 * Uso: npm run screenshots (na raiz) — exige `npm run build -w apps/desktop` antes.
 */
process.env.SOUL_SEM_SPLASH = "1";
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SAIDA = path.resolve(__dirname, "../../../docs/assets/screenshots");
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-demo-"));
app.setPath("userData", raiz);
// Versão do app (o Electron rodando um script avulso informaria a própria versão).
app.setVersion(require("../package.json").version);
// Captura de tela estável em qualquer máquina (inclusive CI sem GPU).
app.disableHardwareAcceleration();
fs.writeFileSync(
  path.join(raiz, "config.json"),
  JSON.stringify({
    raizDados: raiz,
    pastaMotor: path.resolve(__dirname, "../../engine"),
  }),
);
// Banco vazio válido: evita importar qualquer banco de uma instalação anterior.
const { DatabaseSync } = require("node:sqlite");
new DatabaseSync(path.join(raiz, "soul.db")).close();

// ------------------------------------------------------------------ dados fictícios
const hoje = new Date();
const diasAtras = (n) =>
  new Date(hoje.getTime() - n * 864e5).toISOString().slice(0, 19);
/** [marca, modelo, versão, ano, km, cor, câmbio, custo, tabela, dias em estoque, vendido há (dias) | null, cor do desenho] */
const FROTA = [
  [
    "Toyota",
    "Corolla",
    "XEi 2.0 Flex",
    "2022",
    "38400",
    "Prata",
    "Automático",
    98000,
    124900,
    21,
    null,
    "#b9bcc2",
  ],
  [
    "Jeep",
    "Compass",
    "Longitude T270",
    "2023",
    "22100",
    "Preto",
    "Automático",
    128000,
    159900,
    9,
    null,
    "#2b2b2e",
  ],
  [
    "Volkswagen",
    "T-Cross",
    "Highline 250 TSI",
    "2022",
    "41750",
    "Branco",
    "Automático",
    96000,
    119900,
    33,
    null,
    "#eeeeea",
  ],
  [
    "Honda",
    "Civic",
    "Touring 1.5 Turbo",
    "2021",
    "52300",
    "Cinza",
    "CVT",
    112000,
    139900,
    46,
    null,
    "#6d7077",
  ],
  [
    "Hyundai",
    "Creta",
    "Platinum 1.0 TGDI",
    "2023",
    "18900",
    "Azul",
    "Automático",
    104000,
    129900,
    5,
    null,
    "#2f4f86",
  ],
  [
    "Fiat",
    "Pulse",
    "Impetus 1.0 Turbo",
    "2022",
    "29800",
    "Vermelho",
    "CVT",
    79000,
    99900,
    14,
    null,
    "#a3262a",
  ],
  [
    "Chevrolet",
    "Tracker",
    "Premier 1.2 Turbo",
    "2022",
    "35600",
    "Branco",
    "Automático",
    92000,
    117900,
    27,
    null,
    "#f1f0ec",
  ],
  [
    "Nissan",
    "Kicks",
    "Advance 1.6",
    "2021",
    "47200",
    "Grafite",
    "CVT",
    76000,
    96900,
    60,
    12,
    "#4a4c52",
  ],
  [
    "Renault",
    "Duster",
    "Iconic 1.3 TCe",
    "2022",
    "31900",
    "Laranja",
    "CVT",
    82000,
    104900,
    70,
    25,
    "#c9682b",
  ],
  [
    "Toyota",
    "Hilux",
    "SRV 2.8 4x4",
    "2021",
    "68000",
    "Prata",
    "Automático",
    189000,
    229900,
    95,
    41,
    "#a9adb3",
  ],
  [
    "Volkswagen",
    "Nivus",
    "Highline 200 TSI",
    "2023",
    "15400",
    "Azul",
    "Automático",
    98000,
    121900,
    80,
    63,
    "#3c5f8f",
  ],
  [
    "Jeep",
    "Renegade",
    "Sport 1.3 T270",
    "2022",
    "36200",
    "Verde",
    "Automático",
    89000,
    112900,
    120,
    90,
    "#3e5b45",
  ],
  [
    "Honda",
    "HR-V",
    "EXL 1.5",
    "2022",
    "28700",
    "Branco",
    "CVT",
    118000,
    143900,
    150,
    128,
    "#f3f2ee",
  ],
];
const veiculos = [
  "idVehicle;vehicleNumber;plate;vin;envelopeNumber;brand;model;dateRegister;purchasePrice;salePrice;consigned;blocked;active;status;buyer;km;anoModelo;anoFab;cor;cambio;combustivel;versao",
];
const vendas = ["idVehicle;date;price;customer"];
FROTA.forEach(
  (
    [marca, modelo, versao, ano, km, cor, cambio, custo, tabela, dias, vendido],
    i,
  ) => {
    const id = String(9001 + i);
    const placa = `SCD${i}A${String(10 + i).padStart(2, "0")}`;
    veiculos.push(
      [
        id,
        i + 1,
        placa,
        `DEMO${id}`,
        "",
        marca,
        modelo,
        diasAtras(dias),
        custo,
        tabela,
        "0",
        "false",
        "true",
        vendido == null ? "DISPONÍVEL ESTOQUE" : "VENDIDO",
        "",
        km,
        ano,
        String(Number(ano) - 1),
        cor,
        cambio,
        "Flex",
        versao,
      ]
        .map((v) => `"${v}"`)
        .join(";"),
    );
    if (vendido != null)
      vendas.push(
        [
          id,
          diasAtras(vendido),
          Math.round(tabela * 0.97),
          "Cliente demonstração",
        ]
          .map((v) => `"${v}"`)
          .join(";"),
      );
  },
);
fs.mkdirSync(path.join(raiz, "dados"), { recursive: true });
fs.writeFileSync(
  path.join(raiz, "dados", "bndv_veiculos.csv"),
  "﻿" + veiculos.join("\n"),
);
fs.writeFileSync(
  path.join(raiz, "dados", "bndv_vendas.csv"),
  "﻿" + vendas.join("\n"),
);

/** Ilustração genérica de um carro (SVG desenhado aqui, sem nenhuma foto real). */
const desenho = (
  corCarro,
  angulo,
) => `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2724"/><stop offset="1" stop-color="#121110"/></linearGradient>
<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset=".5" stop-color="${corCarro}"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#f)"/><ellipse cx="600" cy="640" rx="470" ry="40" fill="#000" opacity=".55"/>
<g transform="translate(600 420) scale(${angulo}) translate(-600 -420)">
<path d="M170 560 C170 470 230 450 330 430 L450 330 C480 305 520 295 560 295 L760 295 C810 295 850 315 880 345 L960 430 C1040 445 1060 470 1060 560 Z" fill="${corCarro}"/>
<path d="M170 560 C170 470 230 450 330 430 L450 330 C480 305 520 295 560 295 L760 295 C810 295 850 315 880 345 L960 430 C1040 445 1060 470 1060 560 Z" fill="url(#c)"/>
<path d="M470 345 L560 318 L700 318 L700 425 L380 425 Z M725 318 L790 318 C820 318 845 330 865 350 L925 425 L725 425 Z" fill="#1d2a33" opacity=".9"/>
<circle cx="350" cy="565" r="78" fill="#111"/><circle cx="350" cy="565" r="42" fill="#7a7468"/><circle cx="880" cy="565" r="78" fill="#111"/><circle cx="880" cy="565" r="42" fill="#7a7468"/>
<rect x="1010" y="470" width="45" height="18" rx="6" fill="#f6e7c4"/><rect x="175" y="478" width="40" height="16" rx="6" fill="#b3261e"/></g>
<text x="600" y="90" text-anchor="middle" fill="#d9b07a" font-family="Segoe UI" font-size="28" letter-spacing="6">SOUL CARS · DEMO</text></svg></body></html>`;

/**
 * Captura a janela com novas tentativas: logo depois de carregar ou trocar de tela, o
 * Chromium às vezes ainda não desenhou o quadro e devolve "UnknownVizError".
 */
async function capturarTela(janela, tentativas = 6) {
  for (let i = 1; ; i++) {
    try {
      janela.webContents.invalidate();
      const imagem = await janela.webContents.capturePage();
      if (!imagem.isEmpty()) return imagem;
      throw new Error("captura vazia");
    } catch (erro) {
      if (i >= tentativas) throw erro;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

async function renderizarFotos() {
  const janela = new BrowserWindow({
    show: true,
    width: 1200,
    height: 800,
    frame: false,
    useContentSize: true,
  });
  const pastaFotos = path.join(raiz, ".fotos-demo");
  fs.mkdirSync(pastaFotos, { recursive: true });
  for (const [i, carro] of FROTA.entries()) {
    for (const [n, escala] of [
      [1, 1],
      [2, 0.92],
      [3, 0.85],
    ]) {
      await janela.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(desenho(carro[11], escala)),
      );
      await new Promise((r) => setTimeout(r, 500));
      const png = (await capturarTela(janela)).toPNG();
      fs.writeFileSync(path.join(pastaFotos, `${i}-${n}.png`), png);
      process.stdout.write(".");
    }
  }
  janela.destroy();
  return pastaFotos;
}

/** Cria pastas e fichas com o código do próprio app (empacotado na hora com esbuild). */
function sincronizarPastas() {
  const destino = path.join(raiz, "sync-demo.cjs");
  require("esbuild").buildSync({
    stdin: {
      contents:
        'export { sincronizar } from "./src/main/inventory/folder-sync";',
      resolveDir: path.resolve(__dirname, ".."),
      sourcefile: "sync-demo.ts",
    },
    outfile: destino,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
  });
  require(destino).sincronizar(() => {}, true);
}

/** Copia as ilustrações para FOTOS/ de cada pasta de veículo. */
function distribuirFotos(pastaFotos) {
  const estoque = path.join(raiz, "ESTOQUE");
  for (const nome of fs.readdirSync(estoque)) {
    const id = Number(nome.split("_")[0]) - 9001;
    if (!(id >= 0)) continue;
    const fotos = path.join(estoque, nome, "FOTOS");
    fs.mkdirSync(fotos, { recursive: true });
    for (const n of [1, 2, 3])
      fs.copyFileSync(
        path.join(pastaFotos, `${id}-${n}.png`),
        path.join(fotos, `${n}.png`),
      );
  }
}

// ------------------------------------------------------------------ navegação e prints
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function clicar(w, texto, seletor = "button") {
  const ok = await w.webContents.executeJavaScript(
    `(()=>{const b=[...document.querySelectorAll(${JSON.stringify(seletor)})].find(e=>e.textContent.includes(${JSON.stringify(texto)}));if(b){b.click();return true}return false})()`,
  );
  if (!ok) throw new Error(`Não achei "${texto}"`);
  await esperar(1200);
}
/** Caminho neutro exibido nos prints no lugar da pasta temporária (que tem o nome do usuário). */
const CAMINHO_EXIBIDO = ["C:", "Users", "loja", "Documents", "SOUL Cars"].join(
  path.sep,
);
async function salvar(w, nome) {
  await w.webContents
    .executeJavaScript(`(()=>{const de=${JSON.stringify(raiz)},para=${JSON.stringify(CAMINHO_EXIBIDO)};
    const it=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);for(let n;(n=it.nextNode());)if(n.nodeValue.includes(de))n.nodeValue=n.nodeValue.split(de).join(para);
    for(const i of document.querySelectorAll('input'))if(i.value.includes(de))i.value=i.value.split(de).join(para);
    window.scrollTo(0,0);document.querySelector('main')?.scrollTo(0,0);})()`);
  await esperar(300);
  const img = await capturarTela(w);
  fs.writeFileSync(path.join(SAIDA, nome), img.toPNG());
  console.log("print:", nome);
}

async function capturar(w) {
  console.log("página carregada");
  w.show();
  w.setContentSize(1440, 900);
  await esperar(2500);
  await salvar(w, "01-inventory.png");
  await clicar(w, "Estoque", ".metric-link");
  await esperar(1500);
  await salvar(w, "02-showcase.png");
  await clicar(w, "Voltar ao estoque");
  await clicar(w, "Abrir relatório completo");
  await esperar(2500);
  await salvar(w, "03-full-report.png");
  await clicar(w, "Voltar ao estoque");
  await clicar(w, "Abrir ficha");
  await esperar(1500);
  await salvar(w, "04-vehicle-sheet.png");
  await clicar(w, "Produção");
  await esperar(1500);
  await salvar(w, "05-production.png");
}

const limite = setTimeout(() => {
  console.error("SCREENSHOTS: tempo excedido");
  app.exit(1);
}, 240_000);

app
  .whenReady()
  .then(async () => {
    fs.mkdirSync(SAIDA, { recursive: true });
    // Sem isto, fechar a janela das ilustrações (a única aberta) encerraria o app.
    app.on("window-all-closed", () => {});
    console.log("desenhando ilustrações…");
    const pastaFotos = await renderizarFotos();
    console.log("criando pastas…");
    sincronizarPastas();
    distribuirFotos(pastaFotos);
    console.log("abrindo o app…");
    app.on("browser-window-created", (_e, w) => {
      console.log("janela criada");
      w.webContents.on("did-fail-load", (_ev, c, d, u) =>
        console.log("falhou", c, d, u),
      );
      w.webContents.on("dom-ready", () =>
        console.log("dom-ready", w.webContents.getURL()),
      );
      w.webContents.setBackgroundThrottling(false);
      w.webContents.once("did-finish-load", () => {
        capturar(w)
          .then(() => {
            clearTimeout(limite);
            app.exit(0);
          })
          .catch((e) => {
            console.error(e);
            app.exit(1);
          });
      });
    });
    await import("../out/main/index.js");
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
