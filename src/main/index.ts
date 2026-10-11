/**
 * Processo principal: abre a janela e liga os comandos.
 *
 * O trabalho de verdade está nos módulos:
 *   estoque/   extração do BNDV, pastas e fichas, balanço, relatório
 *   studio/    banco, arquivos do veículo, motor Python
 *   ipc.ts     a lista de comandos que a interface pode pedir
 */
import { BrowserWindow, app, shell, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as caminhos from "./caminhos";
import {
  definirJanela,
  iniciarEntrada,
  pararEntrada,
  registrarIpc,
} from "./ipc";
import { reiniciarMotor } from "./studio/motor";
import { importarLegado } from "./studio/legado";
import { apagarArquivoDeSegredos, removerConfigIa } from "./limpeza-ia";
import { fecharJanelaBndv } from "./estoque/bndv-janela";
import { mostrarSplash, type Splash } from "./splash";
import { encerrarInstagram } from "./studio/instagram";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** O app não usa serviço pago: apaga qualquer chave que versões antigas tenham guardado. */
function limparRestosDoModoApi() {
  let backups: string[] = [];
  try {
    backups = fs
      .readdirSync(caminhos.PASTA_BACKUPS())
      .filter((n) => n.endsWith(".db"))
      .map((n) => path.join(caminhos.PASTA_BACKUPS(), n));
  } catch {
    /* sem backups ainda */
  }
  removerConfigIa([caminhos.BANCO(), ...backups]);
  apagarArquivoDeSegredos(caminhos.userData());
}

function criarJanela(splash: Splash | null) {
  const janela = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#f5f3ef",
    title: "SOUL Cars",
    icon: caminhos.recurso("icone.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(aqui, "../preload/index.cjs"),
      additionalArguments: [`--soul-versao=${app.getVersion()}`],
      // A interface não tem Node: tudo passa pela ponte do preload.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });

  definirJanela(janela);
  janela.on("closed", encerrarInstagram);
  // Com tela de carregamento, ela decide o momento (tempo mínimo) de mostrar a janela.
  janela.once("ready-to-show", () =>
    splash ? splash.revelar(janela) : janela.show(),
  );

  // Link externo abre no navegador do sistema, não numa janela do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (evento, url) => {
    if (url !== janela.webContents.getURL()) evento.preventDefault();
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const carregada = devUrl
    ? janela.loadURL(devUrl)
    : janela.loadFile(path.join(aqui, "../renderer/index.html"));
  carregada.catch((erro) => dialog.showErrorBox("SOUL Cars", String(erro)));

  return janela;
}

// Uma instância só: duas janelas gravando no mesmo soul.db não combina.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [janela] = BrowserWindow.getAllWindows();
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });

  let splash: Splash | null = null;
  app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId("com.soulcars.app");
      // Primeira coisa: a tela de carregamento, antes do banco e da interface.
      splash = mostrarSplash();
      await importarLegado();
      limparRestosDoModoApi();
      registrarIpc();
      criarJanela(splash);
      iniciarEntrada();

      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) criarJanela(null);
      });
    })
    .catch((erro) => {
      splash?.fechar();
      dialog.showErrorBox("SOUL Cars", String(erro));
      app.quit();
    });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", pararEntrada);
  app.on("before-quit", reiniciarMotor);
  app.on("before-quit", encerrarInstagram);
  app.on("before-quit", fecharJanelaBndv);
}
