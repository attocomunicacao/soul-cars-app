/**
 * Sites embutidos na janela principal: CRM (Umbler uTalk), BNDV e Meta Ads.
 *
 * Em vez de abrir uma janela à parte, uma vista (`WebContentsView`) é colocada sobre a
 * área de conteúdo da janela, no retângulo que a interface informa. Cada site tem sessão
 * própria e persistente, então o login permanece. O BNDV usa a mesma sessão
 * (`persist:bndv`) do botão Atualizar BNDV: entrar aqui vale para a atualização.
 * As páginas são remotas: sem Node, sem preload e em sandbox.
 */
import { BrowserWindow, WebContentsView, shell } from "electron";
import * as caminhos from "./caminhos";

export type IdEmbutida = "crm" | "bndv" | "meta";

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
  bndv: {
    url: () => caminhos.URL_BNDV,
    sessao: "persist:bndv",
    hosts: /(^|\.)(bndv\.com\.br|google\.com|microsoftonline\.com)$/i,
  },
  meta: {
    url: () =>
      "https://adsmanager.facebook.com/adsmanager/manage/all?nav_source=comet&nav_entry_point=comet_bookmark&campaign_id=415838275119884&placement=bkmk_admgr&extra_1=campaign&act=340363905178843",
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
  const embutida = { vista, pai: janela, carregada: false };
  janela.once("closed", () => abertas.delete(id));
  return embutida;
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
