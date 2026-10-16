import { useEffect, useRef } from "react";
import { invoke } from "./lib/desktop";

/**
 * Área de um site embutido (CRM da Umbler uTalk, BNDV ou Meta Ads). A página em si é uma vista nativa do Electron, colocada
 * pelo processo principal sobre este retângulo; aqui só medimos o espaço e avisamos.
 */
export function Embutida({
  id,
  aoErro,
}: {
  id: "crm" | "bndv" | "meta";
  aoErro: (mensagem: string) => void;
}) {
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    let quadro = 0;
    const enviar = () => {
      const r = el.getBoundingClientRect();
      invoke("embutida_mostrar", {
        id,
        x: r.left,
        y: r.top,
        largura: r.width,
        altura: r.height,
      }).catch((e) => aoErro(String(e)));
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
  }, [id, aoErro]);

  return (
    <div
      ref={area}
      className="crm-area"
      aria-label={{ crm: "CRM", bndv: "BNDV", meta: "Meta Ads" }[id]}
    />
  );
}
