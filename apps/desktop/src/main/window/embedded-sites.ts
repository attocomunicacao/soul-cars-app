/**
 * Sites embutidos na janela principal: CRM (Umbler uTalk) e Meta Ads.
 *
 * Em vez de abrir uma janela à parte, uma vista (`WebContentsView`) é colocada sobre a
 * área de conteúdo da janela, no retângulo que a interface informa. Cada site tem sessão
 * própria e persistente, então o login permanece.
 * As páginas são remotas: sem Node, sem preload e em sandbox.
 */
import { BrowserWindow, WebContentsView, shell } from "electron";
import * as caminhos from "../core/paths";
import { urlDoGerenciadorMeta } from "./meta-url";

export type IdEmbutida = "crm" | "meta";

export type Retangulo = {
  x: number;
  y: number;
  largura: number;
  altura: number;
};

const SITES: Record<
  IdEmbutida,
  { url: () => string; sessao: string; hosts: RegExp }
> = {
  crm: {
    url: () => "https://app-utalk.umbler.com/",
    sessao: "persist:utalk",
    hosts: /(^|\.)(umbler|google|microsoft|microsoftonline)\.com$/i,
  },
  meta: {
    // A conta vem da configuração do usuário (a mesma do painel Campanhas); nenhum ID fica no código.
    url: () => urlDoGerenciadorMeta(caminhos.lerConfig().metaConta as string),
    sessao: "persist:meta",
    hosts: /(^|\.)(facebook|meta|instagram|fbsbx)\.com$/i,
  },
};

type Embutida = {
  vista: WebContentsView;
  pai: BrowserWindow;
  carregada: boolean;
};
const abertas = new Map<IdEmbutida, Embutida>();

function criar(id: IdEmbutida, janela: BrowserWindow): Embutida {
  const site = SITES[id];
  const vista = new WebContentsView({
    webPreferences: {
      partition: site.sessao,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  // Logins ("Continuar com o Facebook") abrem um pop-up que devolve o resultado à página que o
  // abriu; por isso o pop-up precisa ser uma janela de verdade, na mesma sessão. Só os
  // endereços do próprio site entram assim; o resto vai ao navegador do sistema.
  vista.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || /^https:/.test(url)) {
      const permitido =
        url === "about:blank" || site.hosts.test(new URL(url).hostname);
      if (permitido)
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            parent: janela,
            width: 620,
            height: 760,
            autoHideMenuBar: true,
            title: "Entrar",
          },
        };
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  // A página só navega por http(s): file:, data:, javascript: e afins são barrados. Domínios de
  // outros sites seguem livres porque logins (SSO) passam por vários endereços.
  vista.webContents.on("will-navigate", (evento, url) => {
    if (!/^https?:/i.test(url)) evento.preventDefault();
  });
  // Câmera, microfone, notificações etc. só para páginas do próprio site; o resto é negado.
  vista.webContents.session.setPermissionRequestHandler(
    (_conteudo, _permissao, responder, detalhes) => {
      responder(hostPermitido(site.hosts, detalhes.requestingUrl));
    },
  );
  observarJanela(janela);
  return { vista, pai: janela, carregada: false };
}

/** Diz se o endereço é https de um host do site. */
function hostPermitido(hosts: RegExp, endereco: string) {
  try {
    const u = new URL(endereco);
    return u.protocol === "https:" && hosts.test(u.hostname);
  } catch {
    return false;
  }
}

const janelasObservadas = new WeakSet<BrowserWindow>();
/** Registra uma única vez por janela a limpeza das vistas ao fechar (evita um listener por criação). */
function observarJanela(janela: BrowserWindow) {
  if (janelasObservadas.has(janela)) return;
  janelasObservadas.add(janela);
  janela.once("closed", () => abertas.clear());
}

/** Mostra o site no retângulo informado e esconde o outro. */
export function mostrarEmbutida(
  id: IdEmbutida,
  janela: BrowserWindow,
  r: Retangulo,
) {
  if (janela.isDestroyed()) return;
  esconderEmbutidas(id);
  let e = abertas.get(id);
  if (!e || e.vista.webContents.isDestroyed() || e.pai !== janela) {
    e = criar(id, janela);
    abertas.set(id, e);
  }
  if (!janela.contentView.children.includes(e.vista))
    janela.contentView.addChildView(e.vista);
  e.vista.setBounds({
    x: Math.max(0, Math.round(r.x)),
    y: Math.max(0, Math.round(r.y)),
    width: Math.max(1, Math.round(r.largura)),
    height: Math.max(1, Math.round(r.altura)),
  });
  e.vista.setVisible(true);
  if (!e.carregada) {
    e.carregada = true;
    const atual = e;
    void e.vista.webContents.loadURL(SITES[id].url()).catch(() => {
      // Sem internet: a página de erro do navegador aparece; mostrar de novo tenta outra vez.
      atual.carregada = false;
    });
  }
}

/** Esconde os sites (a página continua carregada). `menos` mantém um à mostra. */
export function esconderEmbutidas(menos?: IdEmbutida) {
  for (const [id, e] of abertas)
    if (id !== menos && !e.vista.webContents.isDestroyed())
      e.vista.setVisible(false);
}

/** Libera as vistas ao sair do app. */
export function fecharEmbutidas() {
  for (const e of abertas.values()) {
    if (e.vista.webContents.isDestroyed()) continue;
    try {
      e.pai.contentView.removeChildView(e.vista);
    } catch {
      /* janela já fechada */
    }
    e.vista.webContents.close();
  }
  abertas.clear();
}
