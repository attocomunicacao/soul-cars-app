/**
 * Gera o PDF (A4) do relatório completo.
 *
 * O HTML do relatório vai para um arquivo temporário e é aberto numa janela escondida, em sandbox
 * (sem Node, sem preload, sem navegação); de lá sai o PDF e o arquivo temporário é apagado.
 */
import { BrowserWindow, dialog, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as caminhos from "../core/paths";
import { gerarHtml } from "./report";
import { RODAPE_PDF, comEstiloDeImpressao, nomeDoPdf } from "./report-print";

export async function htmlParaPdf(html: string): Promise<Buffer> {
  const temporario = path.join(
    os.tmpdir(),
    `soul-relatorio-${process.pid}-${Date.now()}.html`,
  );
  fs.writeFileSync(temporario, html, "utf8");
  const janela = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (e) => e.preventDefault());
  try {
    await janela.loadFile(temporario);
    // Dá um instante para os scripts do relatório (janela de meses, contagem) rodarem.
    await new Promise((r) => setTimeout(r, 300));
    return await janela.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: RODAPE_PDF,
    });
  } finally {
    if (!janela.isDestroyed()) janela.destroy();
    fs.rmSync(temporario, { force: true });
  }
}

/** Pergunta onde salvar, gera o PDF e abre. Devolve o caminho, ou `cancelado`. */
export async function exportarRelatorioPdf(pai?: BrowserWindow | null) {
  const arquivo = gerarHtml();
  const html = comEstiloDeImpressao(fs.readFileSync(arquivo, "utf8"));
  const escolha = await dialog.showSaveDialog(
    pai ?? BrowserWindow.getAllWindows()[0],
    {
      title: "Salvar relatório em PDF",
      defaultPath: path.join(caminhos.DADOS(), nomeDoPdf()),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    },
  );
  if (escolha.canceled || !escolha.filePath)
    return { cancelado: true as const };
  const destino = /\.pdf$/i.test(escolha.filePath)
    ? escolha.filePath
    : escolha.filePath + ".pdf";
  fs.writeFileSync(destino, await htmlParaPdf(html));
  void shell.openPath(destino);
  return { cancelado: false as const, caminho: destino };
}
