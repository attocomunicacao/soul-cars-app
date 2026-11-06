/**
 * Diagnóstico de abertura: registro em arquivo e proteção contra "o app abre e some".
 *
 * - `app.log` (na pasta de dados do app, no máximo ~200 KB) guarda o que aconteceu ao abrir e erros
 *   que, sem terminal, ninguém veria.
 * - Se o processo de vídeo (GPU) do Chromium quebrar, o app se reabre uma vez sem aceleração de vídeo.
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ARGUMENTO_SEM_GPU, pedeReabrirSemGpu } from "./gpu";

const LIMITE = 200 * 1024;
export const arquivoDoLog = () => path.join(app.getPath("userData"), "app.log");

/** Anota uma linha com data e hora. Nunca lança erro. */
export function registrar(texto: string) {
  try {
    const arquivo = arquivoDoLog();
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).size > LIMITE) {
      // Guarda só a metade final, para o arquivo não crescer sem fim.
      const texto_ = fs.readFileSync(arquivo, "utf8");
      fs.writeFileSync(arquivo, texto_.slice(texto_.length / 2), "utf8");
    }
    fs.appendFileSync(
      arquivo,
      `[${new Date().toLocaleString("pt-BR")}] ${texto}\n`,
      "utf8",
    );
  } catch {
    /* log é só ajuda: nunca derruba o app */
  }
}

let saindo = false;

/** Chamar antes de `app.whenReady()`. */
export function iniciarDiagnostico() {
  registrar(
    `Abrindo SOUL Cars ${app.getVersion()} (Electron ${process.versions.electron}, ${process.argv.slice(1).join(" ") || "sem argumentos"})`,
  );
  if (process.argv.includes(ARGUMENTO_SEM_GPU)) {
    app.disableHardwareAcceleration();
    registrar("Aceleração de vídeo desligada (reabertura após queda da GPU).");
  }
  app.on("before-quit", () => {
    saindo = true;
  });
  process.on("uncaughtException", (erro) =>
    registrar(`Erro não tratado: ${erro.stack ?? erro}`),
  );
  process.on("unhandledRejection", (motivo) =>
    registrar(
      `Promessa rejeitada: ${motivo instanceof Error ? (motivo.stack ?? motivo) : String(motivo)}`,
    ),
  );
  app.on("render-process-gone", (_e, _conteudo, detalhes) =>
    registrar(`Tela caiu: ${detalhes.reason} (código ${detalhes.exitCode})`),
  );
  app.on("child-process-gone", (_e, detalhes) => {
    registrar(
      `Processo ${detalhes.type} caiu: ${detalhes.reason} (código ${detalhes.exitCode})`,
    );
    if (
      pedeReabrirSemGpu(detalhes.type, detalhes.reason, process.argv, saindo)
    ) {
      registrar("Reabrindo o app sem aceleração de vídeo.");
      app.relaunch({ args: [...process.argv.slice(1), ARGUMENTO_SEM_GPU] });
      app.exit(0);
    }
  });
}
