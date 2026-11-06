/**
 * Atualização do próprio Launcher.
 *
 * O manifesto traz a versão mais recente do Launcher e o instalador (NSIS). Quando a
 * versão é mais nova que a em execução, a interface mostra uma faixa "Nova versão do
 * Launcher". Ao confirmar, o instalador é baixado (SHA-256 conferido), executado em
 * modo silencioso e o Launcher fecha para ser substituído; o instalador o reabre.
 */
import { app } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { compararVersoes, type Manifest } from "../shared/manifest";
import { pastaDownloads } from "./config";
import { baixarVerificado } from "./download";

/** Nova versão do Launcher disponível no manifesto, ou null. */
export function novoLauncher(manifesto: Manifest | null, plataforma: string) {
  if (!manifesto) return null;
  const { version, notes, downloads } = manifesto.launcher;
  if (!downloads[plataforma]) return null;
  return compararVersoes(version, app.getVersion()) > 0
    ? { version, notes }
    : null;
}

/** Atualização em andamento: um segundo pedido espera a mesma, em vez de começar outra. */
let atualizacao: Promise<void> | null = null;

/** Baixa o instalador novo, executa em silêncio e encerra o Launcher atual. */
export function atualizarLauncher(
  manifesto: Manifest,
  plataforma: string,
  aoProgresso: (fracao: number) => void,
): Promise<void> {
  atualizacao ??= executarAtualizacao(manifesto, plataforma, aoProgresso).catch(
    (erro) => {
      atualizacao = null; // falhou: libera para tentar de novo
      throw erro;
    },
  );
  return atualizacao;
}

async function executarAtualizacao(
  manifesto: Manifest,
  plataforma: string,
  aoProgresso: (fracao: number) => void,
): Promise<void> {
  const download = manifesto.launcher.downloads[plataforma];
  if (!download)
    throw new Error("Não há instalador do Launcher para este sistema.");
  const destino = path.join(
    pastaDownloads(),
    `soul-cars-launcher-setup-${manifesto.launcher.version}.exe`,
  );
  await baixarVerificado(download, destino, aoProgresso);
  // O instalador só começa ~3 s depois, quando este Launcher já fechou: com o app aberto,
  // o NSIS silencioso não consegue substituir os arquivos.
  // /S = silencioso (NSIS one-click); --force-run reabre o Launcher ao terminar.
  spawn(
    process.env.ComSpec ?? "cmd.exe",
    [
      "/d",
      "/c",
      `ping -n 4 127.0.0.1 >nul & start "" "${destino}" /S --updated --force-run`,
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      windowsVerbatimArguments: true,
    },
  ).unref();
  app.quit();
}
