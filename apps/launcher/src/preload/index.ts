/**
 * Ponte segura do Launcher: expõe só os métodos de `LauncherApi` em `window.launcher`.
 * A interface não tem Node nem acesso a disco; tudo passa por aqui.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CANAIS, type LauncherApi, type Progresso } from "../shared/api";

const api: LauncherApi = {
  estado: () => ipcRenderer.invoke(CANAIS.estado),
  verificar: () => ipcRenderer.invoke(CANAIS.verificar),
  instalar: (appId) => ipcRenderer.invoke(CANAIS.instalar, appId),
  abrir: (appId) => ipcRenderer.invoke(CANAIS.abrir, appId),
  abrirPasta: (appId) => ipcRenderer.invoke(CANAIS.abrirPasta, appId),
  atualizarLauncher: () => ipcRenderer.invoke(CANAIS.atualizarLauncher),
  salvarPreferencias: (p) => ipcRenderer.invoke(CANAIS.salvarPreferencias, p),
  abrirLink: (url) => ipcRenderer.invoke(CANAIS.abrirLink, url),
  aoProgresso: (fn) => {
    const ouvinte = (_e: IpcRendererEvent, p: Progresso) => fn(p);
    ipcRenderer.on(CANAIS.progresso, ouvinte);
    return () => ipcRenderer.removeListener(CANAIS.progresso, ouvinte);
  },
};

contextBridge.exposeInMainWorld("launcher", api);
