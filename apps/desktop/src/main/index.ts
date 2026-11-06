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
import * as caminhos from "./core/paths";
import {
  definirJanela,
  iniciarEntrada,
  pararEntrada,
  registrarIpc,
} from "./ipc/commands";
import { reiniciarMotor } from "./studio/engine-bridge";
import { importarLegado } from "./studio/legacy-import";
import {
  apagarArquivoDeSegredos,
  removerConfigIa,
} from "./core/legacy-ai-cleanup";
import { fecharEmbutidas } from "./window/embedded-sites";
import { mostrarSplash, type Splash } from "./window/splash";
import { iniciarDiagnostico, registrar } from "./core/diagnostics";
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
    icon: caminhos.recurso("icon.ico"),
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
  // Vigia: se a janela não chegar a ficar pronta, mostra mesmo assim em vez de o app "não abrir".
  const vigia = setTimeout(() => {
    if (janela.isDestroyed() || janela.isVisible()) return;
    registrar(
      "A janela principal não ficou pronta em 15 s; mostrando mesmo assim.",
    );
    janela.show();
    splash?.fechar();
  }, 15_000);
  janela.once("show", () => {
    clearTimeout(vigia);
    registrar("Janela principal visível.");
  });
  janela.webContents.on("did-fail-load", (_e, codigo, descricao, url) =>
    registrar(`Falha ao carregar ${url}: ${descricao} (${codigo})`),
  );
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
  iniciarDiagnostico();
  // Clicar no atalho de novo: traz a janela do app; se não houver nenhuma visível (processo
  // "preso" sem janela), mostra ou recria uma, em vez de não fazer nada.
  app.on("second-instance", () => {
    const janelas = BrowserWindow.getAllWindows().filter(
      (j) => !j.isDestroyed(),
    );
    const visivel = janelas.find((j) => j.isVisible());
    if (visivel) {
      if (visivel.isMinimized()) visivel.restore();
      visivel.focus();
    } else if (janelas.length) {
      registrar(
        "Segundo clique no atalho com o app sem janela visível: mostrando.",
      );
      janelas[janelas.length - 1].show();
    } else if (app.isReady()) {
      registrar("Segundo clique no atalho sem nenhuma janela: abrindo outra.");
      criarJanela(null);
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
  // Ao fechar, o app precisa sair mesmo se algum encerramento travar (senão fica um processo
  // invisível que impede o atalho de abrir de novo).
  app.on("before-quit", () => {
    setTimeout(() => {
      registrar("O encerramento demorou mais de 5 s; saindo à força.");
      app.exit(0);
    }, 5000).unref();
  });
  app.on("before-quit", pararEntrada);
  app.on("before-quit", reiniciarMotor);
  app.on("before-quit", encerrarInstagram);
  app.on("before-quit", fecharEmbutidas);
}
