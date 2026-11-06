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

/** Baixa o instalador novo, executa em silêncio e encerra o Launcher atual. */
export async function atualizarLauncher(
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
  // /S = silencioso (NSIS one-click); --force-run reabre o Launcher ao terminar.
  spawn(destino, ["/S", "--updated", "--force-run"], {
    detached: true,
    stdio: "ignore",
  }).unref();
  setTimeout(() => app.quit(), 300);
}
