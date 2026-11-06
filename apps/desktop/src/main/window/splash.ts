/**
 * Tela de carregamento: aparece assim que o app abre e some quando a janela principal
 * está pronta. Minimalista de propósito: a marca, um fio de luz dourado e uma palavra.
 *
 * É HTML local sem Node, sem preload e em sandbox. Fica no mínimo `MINIMO_MS` na tela
 * para não piscar quando o app abre rápido.
 */
import { BrowserWindow } from "electron";
import fs from "node:fs";
import * as caminhos from "../core/paths";

const MINIMO_MS = 1200;

/**
 * A animação é o próprio indicador de carregamento, então não é desligada pela opção
 * "reduzir movimento" do sistema (que deixava a tela parada). É lenta e discreta.
 */
function html(logo: string) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
  @property --giro { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; background: #131110; cursor: default; user-select: none; }
  body {
    display: grid; place-items: center;
    background: radial-gradient(120% 90% at 50% 38%, #1f1b16 0%, #131110 62%);
    font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
    border: 1px solid rgba(210, 171, 85, 0.14);
    -webkit-app-region: drag;
  }
  main { display: grid; justify-items: center; gap: 34px; animation: entrar 800ms cubic-bezier(.2,.7,.2,1) both; }
  /* Um feixe dourado percorre a borda da marca, em volta, sem parar. */
  .marca {
    padding: 2.5px; border-radius: 27px;
    background: conic-gradient(from var(--giro), rgba(210,171,85,.10) 0deg, rgba(210,171,85,.10) 130deg, #d2ab55 350deg, #f3dfa6 360deg);
    box-shadow: 0 18px 48px rgba(0,0,0,.55), 0 0 64px rgba(210,171,85,.10);
    animation: girar 2.4s linear infinite;
  }
  img { width: 96px; height: 96px; border-radius: 24px; display: block; }
  .vazio { width: 96px; height: 96px; border-radius: 24px; background: #1b1916; }
  p { font-size: 10.5px; letter-spacing: .34em; text-transform: uppercase; color: #9a9080; padding-left: .34em; }
  p i { font-style: normal; opacity: .2; animation: ponto 1.4s ease-in-out infinite; }
  p i:nth-child(2) { animation-delay: .2s; } p i:nth-child(3) { animation-delay: .4s; }
  @keyframes entrar { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
  @keyframes girar { to { --giro: 360deg; } }
  @keyframes ponto { 0%, 100% { opacity: .2; } 40% { opacity: 1; } }
</style></head><body>
  <main><div class="marca">${logo ? `<img alt="" src="${logo}">` : '<div class="vazio"></div>'}</div><p>Carregando<i>.</i><i>.</i><i>.</i></p></main>
</body></html>`;
}

export type Splash = {
  /** Mostra a janela principal e fecha a tela de carregamento (respeitando o tempo mínimo). */
  revelar(principal: BrowserWindow): void;
  fechar(): void;
};

/** Sem tela de carregamento (testes automáticos): `revelar` só mostra a janela. */
const SEM_SPLASH: Splash = {
  revelar: (principal) => principal.show(),
  fechar: () => {},
};

export function mostrarSplash(): Splash {
  if (process.env.SOUL_SEM_SPLASH === "1") return SEM_SPLASH;

  let logo = "";
  try {
    logo =
      "data:image/jpeg;base64," +
      fs.readFileSync(caminhos.recurso("soul-logo.jpg")).toString("base64");
  } catch {
    /* sem logo: a tela continua válida, só com o fio de luz */
  }

  const inicio = Date.now();
  const janela = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    title: "SOUL Cars",
    backgroundColor: "#131110",
    icon: caminhos.recurso("icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  janela.setMenuBarVisibility(false);
  janela.once("ready-to-show", () => janela.show());
  void janela
    .loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html(logo)))
    .catch(() => janela.destroy());

  let encerrada = false;
  const fechar = () => {
    if (encerrada) return;
    encerrada = true;
    if (!janela.isDestroyed()) janela.destroy();
  };
  return {
    fechar,
    revelar(principal) {
      const esperar = Math.max(0, MINIMO_MS - (Date.now() - inicio));
      setTimeout(() => {
        if (!principal.isDestroyed()) {
          principal.show();
          principal.focus();
        }
        // A principal já está por cima: a tela de carregamento sai logo depois.
        setTimeout(fechar, 150);
      }, esperar);
    },
  };
}
