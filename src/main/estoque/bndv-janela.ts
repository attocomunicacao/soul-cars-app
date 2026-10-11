/**
 * Janela do BNDV para o usuário entrar (ou conferir o login) quando quiser.
 *
 * Usa a mesma sessão (`persist:bndv`) da atualização do Estoque: o login feito aqui
 * vale para o botão Atualizar BNDV. Só existe uma janela por vez; clicar de novo
 * apenas traz a que já está aberta para a frente. A página é remota, então roda sem
 * Node, sem preload e em sandbox.
 */
import { BrowserWindow } from "electron";
import * as caminhos from "../caminhos";

let aberta: BrowserWindow | null = null;

export function abrirJanelaBndv(pai?: BrowserWindow | null) {
  if (aberta && !aberta.isDestroyed()) {
    if (aberta.isMinimized()) aberta.restore();
    aberta.show();
    aberta.focus();
    return { jaAberta: true };
  }

  const janela = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "BNDV — entrar",
    autoHideMenuBar: true,
    parent: pai ?? undefined,
    webPreferences: {
      partition: "persist:bndv",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  aberta = janela;
  janela.on("closed", () => {
    if (aberta === janela) aberta = null;
  });
  // Logins com janela extra (ex.: "entrar com Google") continuam na mesma janela.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:/.test(url)) void janela.loadURL(url).catch(() => {});
    return { action: "deny" };
  });
  void janela.loadURL(caminhos.URL_BNDV).catch(() => {
    // Sem internet ou site fora do ar: a própria página de erro do navegador aparece.
  });
  return { jaAberta: false };
}

/** Fecha a janela de login (usado ao sair do app). */
export function fecharJanelaBndv() {
  if (aberta && !aberta.isDestroyed()) aberta.destroy();
  aberta = null;
}
