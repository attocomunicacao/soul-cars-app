/**
 * O relatório completo é uma página inteira dentro de um iframe sem acesso ao app
 * (sandbox sem allow-same-origin). Para o iframe não ter uma segunda barra de
 * rolagem, a página avisa a própria altura e o app ajusta o iframe a ela.
 */
export const MENSAGEM_ALTURA = "soul:relatorio-altura";

const SCRIPT = `<script>(function(){
  var enviar = function () {
    var altura = Math.ceil(document.documentElement.offsetHeight);
    // Sem altura (janela escondida ou ainda sem layout), a página continua rolável por dentro.
    if (!(altura > 0)) return;
    document.documentElement.style.overflow = "hidden";
    parent.postMessage({ tipo: "${MENSAGEM_ALTURA}", altura: altura }, "*");
  };
  addEventListener("load", enviar);
  addEventListener("resize", enviar);
  if (window.ResizeObserver) new ResizeObserver(enviar).observe(document.documentElement);
  enviar();
})();</script>`;

/** Acrescenta o aviso de altura ao HTML do relatório. */
export function comAvisoDeAltura(html: string) {
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, () => SCRIPT + "</body>")
    : html + SCRIPT;
}

/** Altura válida enviada pela página (ou null se a mensagem não for dela). */
export function alturaDaMensagem(dados: unknown): number | null {
  if (typeof dados !== "object" || dados === null) return null;
  const { tipo, altura } = dados as { tipo?: unknown; altura?: unknown };
  if (tipo !== MENSAGEM_ALTURA) return null;
  return typeof altura === "number" && Number.isFinite(altura) && altura > 0
    ? Math.min(Math.round(altura), 200_000)
    : null;
}
