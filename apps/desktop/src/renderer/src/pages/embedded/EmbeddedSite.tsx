/**
 * Área de um site embutido (CRM uTalk, Meta Ads): reserva o espaço na janela e
 * pede ao main para posicionar a WebContentsView sobre ele.
 */
import { textoDoErro } from "../../app/components";
import { useEffect, useRef } from "react";
import { invoke } from "../../lib/desktop-bridge";

/**
 * Área de um site embutido (CRM da Umbler uTalk ou Meta Ads). A página em si é uma vista nativa do Electron, colocada
 * pelo processo principal sobre este retângulo; aqui só medimos o espaço e avisamos.
 */
export function EmbeddedSite({
  id,
  aoErro,
  pausada,
}: {
  id: "crm" | "meta";
  aoErro: (mensagem: string) => void;
  /** Verdadeiro enquanto algo do app (as Configurações) precisa ficar por cima: a vista nativa se esconde. */
  pausada?: boolean;
}) {
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el || pausada) return;
    let quadro = 0;
    const enviar = () => {
      const r = el.getBoundingClientRect();
      invoke("embutida_mostrar", {
        id,
        x: r.left,
        y: r.top,
        largura: r.width,
        altura: r.height,
      }).catch((e) => aoErro(textoDoErro(e)));
    };
    const agendar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(enviar);
    };
    enviar();
    const observador = new ResizeObserver(agendar);
    observador.observe(el);
    window.addEventListener("resize", agendar);
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", agendar);
      invoke("embutida_esconder").catch(() => {});
    };
  }, [id, aoErro, pausada]);

  const nome = { crm: "CRM", meta: "Meta Ads" }[id];
  // O texto fica por baixo da vista nativa: aparece só enquanto o site ainda não abriu.
  return (
    <div ref={area} className="crm-area" aria-label={nome}>
      <span role="status">Abrindo {nome}…</span>
    </div>
  );
}
