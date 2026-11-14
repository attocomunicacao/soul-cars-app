/**
 * Processo principal do Soul Cars Launcher.
 *
 * Responsabilidades:
 *  - abrir a janela do Launcher (sandbox, sem Node na interface);
 *  - responder aos comandos da interface (lista fechada em `CANAIS`);
 *  - ler o catálogo (manifest.json da última GitHub Release);
 *  - instalar/atualizar/abrir os apps e atualizar o próprio Launcher.
 *
 * Os apps instalados rodam como processos independentes: fechar o Launcher não
 * fecha o Soul Cars.
 */
import {
  BrowserWindow,
  app,
  ipcMain,
  nativeTheme,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANAIS,
  type EstadoLauncher,
  type Preferencias,
  type Progresso,
} from "../shared/api";
import {
  chavePlataforma,
  situacaoDoApp,
  type Manifest,
} from "../shared/manifest";
import { appsDoCatalogo, verificarCatalogo } from "./catalog";
import { URL_PROJETO, pastaInstalacao, recurso } from "./config";
import {
  abrirApp,
  instalarApp,
  pastaParaMostrar,
  versaoInstalada,
} from "./installer";
import { ErroAoAbrir } from "./launch";
import { registrar } from "./log";
import { atualizarLauncher, novoLauncher } from "./self-update";
import { gravarEstado, lerEstado } from "./state";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const PLATAFORMA = chavePlataforma(process.platform, process.arch);

let janela: BrowserWindow | null = null;
let manifesto: Manifest | null = lerEstado().catalogo;
let erroCatalogo: string | null = null;

/** Monta tudo o que a interface precisa desenhar. */
function estadoAtual(): EstadoLauncher {
  const estado = lerEstado();
  return {
    versaoLauncher: app.getVersion(),
    plataforma: PLATAFORMA,
    erroCatalogo,
    verificadoEm: estado.verificadoEm,
    novoLauncher: novoLauncher(manifesto, PLATAFORMA),
    preferencias: estado.preferencias,
    pastaInstalacao: pastaInstalacao(),
    apps: appsDoCatalogo(manifesto).map((release) => {
      const instalada = versaoInstalada(release.id);
      return {
        release,
        instalada,
        situacao: situacaoDoApp(release, instalada, PLATAFORMA),
        pasta: instalada ? pastaParaMostrar(release.id) : null,
      };
    }),
  };
}

/** Relê o catálogo pela internet (ou o último guardado, se offline). */
async function verificar(): Promise<EstadoLauncher> {
  const resultado = await verificarCatalogo();
  manifesto = resultado.manifesto;
  erroCatalogo = resultado.erro;
  return estadoAtual();
}

/** Envia progresso de instalação para a interface. */
function avisar(p: Progresso) {
  if (janela && !janela.isDestroyed())
    janela.webContents.send(CANAIS.progresso, p);
}

/** Localiza um app do catálogo pelo id (lança erro legível se não existir). */
function releaseDe(appId: string) {
  const release = appsDoCatalogo(manifesto).find((a) => a.id === appId);
  if (!release) throw new Error("App desconhecido no catálogo.");
  return release;
}

/** Aceita comandos só da janela do próprio Launcher (arquivo local ou servidor de dev). */
function remetenteValido(evento: IpcMainInvokeEvent): boolean {
  const url = evento.senderFrame?.url ?? "";
  return (
    url.startsWith("file://") ||
    (!!process.env.ELECTRON_RENDERER_URL &&
      url.startsWith(process.env.ELECTRON_RENDERER_URL))
  );
}

/** Registra um comando IPC com a checagem de remetente. */
function comando<A extends unknown[], R>(
  canal: string,
  fn: (...args: A) => R | Promise<R>,
) {
  ipcMain.handle(canal, (evento, ...args) => {
    if (!remetenteValido(evento)) throw new Error("Remetente não autorizado.");
    return fn(...(args as A));
  });
}

/** Registra no log por que um app não abriu (com os detalhes técnicos da falha). */
function registrarFalhaAoAbrir(nome: string, erro: unknown) {
  const detalhe =
    erro instanceof ErroAoAbrir
      ? `${JSON.stringify(erro.falha)} bloqueadoPeloWindows=${erro.bloqueadoPeloWindows}`
      : String(erro);
  registrar(`Falha ao abrir ${nome}: ${detalhe}`);
}

function registrarComandos() {
  comando(CANAIS.estado, () => estadoAtual());
  comando(CANAIS.verificar, () => verificar());
  comando(CANAIS.instalar, async (appId: string) => {
    const release = releaseDe(String(appId));
    try {
      await instalarApp(release, PLATAFORMA, (etapa, fracao) =>
        avisar({ appId: release.id, etapa, fracao }),
      );
      avisar({ appId: release.id, etapa: "concluido" });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      registrar(
        `Falha ao instalar ${release.name} ${release.version}: ${mensagem}`,
      );
      avisar({ appId: release.id, etapa: "erro", mensagem });
      throw erro;
    }
    return estadoAtual();
  });
  comando(CANAIS.abrir, async (appId: string) => {
    const release = releaseDe(String(appId));
    let resultado;
    try {
      resultado = await abrirApp(release);
      registrar(
        resultado.versaoBloqueada
          ? `${release.name} ${resultado.versaoBloqueada} bloqueado pelo Windows; aberta a ${resultado.versaoAberta}.`
          : `${release.name} ${resultado.versaoAberta} aberto.`,
      );
    } catch (erro) {
      registrarFalhaAoAbrir(release.name, erro);
      // Erro simples: a interface recebe só a mensagem pronta para o usuário.
      throw new Error(erro instanceof Error ? erro.message : String(erro), {
        cause: erro,
      });
    }
    // Só fecha o Launcher depois que o app abriu de fato, e fica aberto quando precisou
    // usar a versão anterior (para o aviso aparecer).
    if (lerEstado().preferencias.fecharAoAbrir && !resultado.versaoBloqueada)
      app.quit();
    return resultado;
  });
  comando(CANAIS.abrirPasta, async (appId: string) => {
    await shell.openPath(pastaParaMostrar(String(appId)));
  });
  comando(CANAIS.atualizarLauncher, async () => {
    if (!manifesto) throw new Error("Catálogo ainda não carregado.");
    await atualizarLauncher(manifesto, PLATAFORMA, (fracao) =>
      avisar({ appId: "launcher", etapa: "baixando", fracao }),
    );
  });
  comando(CANAIS.salvarPreferencias, (p: Partial<Preferencias>) => {
    gravarEstado((e) => {
      if (typeof p?.fecharAoAbrir === "boolean")
        e.preferencias.fecharAoAbrir = p.fecharAoAbrir;
      if (typeof p?.verificarAoIniciar === "boolean")
        e.preferencias.verificarAoIniciar = p.verificarAoIniciar;
    });
    return estadoAtual();
  });
  comando(CANAIS.abrirLink, async (url: string) => {
    // Só links do próprio projeto no GitHub.
    if (String(url).startsWith(URL_PROJETO))
      await shell.openExternal(String(url));
  });
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 860,
    minHeight: 560,
    show: false,
    // Mesmo fundo do tema do Windows (claro ou escuro): evita o clarão ao abrir.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#000000" : "#f5f5f7",
    title: "Soul Cars Launcher",
    icon: recurso("icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(aqui, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  janela.once("ready-to-show", () => janela?.show());
  // Links externos nunca abrem dentro do Launcher.
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (e) => e.preventDefault());
  const dev = process.env.ELECTRON_RENDERER_URL;
  void (dev
    ? janela.loadURL(dev)
    : janela.loadFile(path.join(aqui, "../renderer/index.html")));
  janela.on("closed", () => (janela = null));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!janela) return criarJanela();
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  });
  void app.whenReady().then(() => {
    app.setAppUserModelId("com.soulcars.launcher");
    registrarComandos();
    criarJanela();
  });
  app.on("window-all-closed", () => app.quit());
}
