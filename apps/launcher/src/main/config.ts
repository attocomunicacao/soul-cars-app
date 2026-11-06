/**
 * Configuração fixa do Launcher: de onde vem o catálogo e onde os apps são instalados.
 *
 * O catálogo é o `manifest.json` anexado à GitHub Release mais recente. O endereço
 * `releases/latest/download/<arquivo>` sempre aponta para a última release publicada,
 * sem usar a API do GitHub (sem limite de requisições e sem token).
 *
 * Para testar com um manifesto local, defina a variável de ambiente
 * SOUL_CARS_FEED_URL (aceita https:// ou file://).
 */
import { app } from "electron";
import path from "node:path";

/** Repositório público com as releases (dono/nome). */
export const REPOSITORIO = "attocomunicacao/soul-cars-app";

/** Página do projeto (link "Sobre" e "Notas da versão"). */
export const URL_PROJETO = `https://github.com/${REPOSITORIO}`;

/** Manifesto da release mais recente. */
export const URL_MANIFESTO =
  process.env.SOUL_CARS_FEED_URL ??
  `${URL_PROJETO}/releases/latest/download/manifest.json`;

/** Feed alternativo definido para testes: libera downloads de http://127.0.0.1. */
export const FEED_DE_TESTE = !!process.env.SOUL_CARS_FEED_URL;

/** Tempo máximo para ler o manifesto antes de usar o último catálogo guardado. */
export const TEMPO_LIMITE_MANIFESTO_MS = 15_000;

/**
 * Pasta raiz das instalações: %LOCALAPPDATA%\SoulCars (sem exigir administrador).
 * Cada app fica em apps/<id>/<versão>/, lado a lado, para atualizar sem apagar a
 * versão em uso e permitir voltar à anterior.
 */
export function pastaInstalacao(): string {
  const base =
    process.env.LOCALAPPDATA ??
    path.join(app.getPath("appData"), "..", "Local");
  return path.join(base, "SoulCars");
}

/** Pasta de um app instalado (todas as versões). */
export const pastaDoApp = (id: string) =>
  path.join(pastaInstalacao(), "apps", id);

/** Pasta de uma versão específica de um app. */
export const pastaDaVersao = (id: string, versao: string) =>
  path.join(pastaDoApp(id), versao);

/** Downloads em andamento (arquivos .part) e instaladores do Launcher. */
export const pastaDownloads = () => path.join(pastaInstalacao(), "downloads");

/** Estado do Launcher: versões instaladas, preferências e último catálogo válido. */
export const arquivoEstado = () =>
  path.join(app.getPath("userData"), "launcher-state.json");

/** Ícone da janela (empacotado em resources/). */
export function recurso(nome: string): string {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.resolve(app.getAppPath(), "resources");
  return path.join(base, nome);
}
