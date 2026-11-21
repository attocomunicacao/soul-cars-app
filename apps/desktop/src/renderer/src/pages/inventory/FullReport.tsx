/**
 * Relatório completo do estoque (Estoque › Abrir relatório completo).
 *
 * O HTML vem pronto do processo principal (`relatorio_abrir`, gerado em
 * `main/inventory/report.ts`) e é mostrado num iframe em sandbox. A página do
 * relatório avisa a própria altura por `postMessage`: o iframe cresce e só a
 * página do app rola (sem barra de rolagem dupla). Se o aviso não chegar em
 * 2,5 s, o quadro volta a rolar por dentro para nada ficar preso.
 *
 * O botão "Exportar PDF" pede ao main o PDF em A4 (`relatorio_pdf`).
 */
import { useEffect, useRef, useState } from "react";
import { invoke } from "../../lib/desktop-bridge";
import { alturaDaMensagem, comAvisoDeAltura } from "../../lib/report-frame";

type Props = {
  /** HTML completo do relatório. */
  html: string;
  /** Mostra um erro de operação no aviso do app. */
  aoErro: (mensagem: string) => void;
};

export function FullReport({ html, aoErro }: Props) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = useState<number | null>(null);
  const [semAltura, setSemAltura] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [avisoPdf, setAvisoPdf] = useState("");

  // A página do relatório informa a altura; só aceitamos mensagens do próprio iframe.
  useEffect(() => {
    const aoReceber = (e: MessageEvent) => {
      if (e.source !== quadro.current?.contentWindow) return;
      const valor = alturaDaMensagem(e.data);
      if (valor) setAltura(valor);
    };
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, []);

  // Um relatório novo zera a altura conhecida.
  useEffect(() => {
    setAltura(null);
  }, [html]);

  // Sem aviso de altura em 2,5 s: o quadro rola por dentro.
  useEffect(() => {
    setSemAltura(false);
    if (altura) return;
    const t = setTimeout(() => setSemAltura(true), 2500);
    return () => clearTimeout(t);
  }, [altura, html]);

  function gerarPdf() {
    setGerandoPdf(true);
    setAvisoPdf("");
    aoErro("");
    invoke<{ cancelado: boolean; caminho?: string }>("relatorio_pdf")
      .then((r) => {
        if (!r.cancelado) setAvisoPdf("PDF salvo e aberto.");
      })
      .catch((e) => aoErro(String(e)))
      .finally(() => setGerandoPdf(false));
  }

  return (
    <section className="panel">
      <div className="actions">
        <h2>Relatório completo</h2>
        <button
          className="primary"
          disabled={gerandoPdf}
          title="Gera o relatório inteiro em PDF, em folhas A4, pronto para imprimir"
          onClick={gerarPdf}
        >
          {gerandoPdf ? "Gerando PDF…" : "Exportar PDF"}
        </button>
      </div>
      {avisoPdf && <p role="status">{avisoPdf}</p>}
      <iframe
        ref={quadro}
        className="relatorio-completo"
        title="Relatório completo do estoque"
        sandbox="allow-scripts"
        scrolling={semAltura ? "yes" : "no"}
        style={
          altura
            ? { height: altura }
            : semAltura
              ? { height: "calc(100vh - 220px)" }
              : undefined
        }
        srcDoc={comAvisoDeAltura(html)}
      />
    </section>
  );
}
