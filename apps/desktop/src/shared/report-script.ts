/**
 * Script que a página do relatório completo injeta em si mesma para avisar a própria altura ao app
 * (o relatório roda num iframe sem acesso ao app). Fica aqui, num módulo sem dependências, porque
 * duas partes precisam do MESMO texto: o renderer, que o insere no HTML, e o build, que calcula o hash
 * SHA-256 liberado na política de segurança de conteúdo (`main/core/csp.ts`). Mudar o texto muda o hash
 * sozinho; um teste confere que os dois continuam iguais.
 */

/** Tipo da mensagem que o relatório manda ao app com a altura da página. */
export const MENSAGEM_ALTURA = "soul:relatorio-altura";

/** Corpo do script (o que vai entre `<script>` e `</script>`). */
export const CORPO_DO_SCRIPT_DE_ALTURA = `(function(){
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
})();`;
