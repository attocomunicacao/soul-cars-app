/**
 * Ícones de linha do app (SVG inline, traço de 1,6 px no estilo dos símbolos do sistema).
 *
 * Substituem os emojis do menu, que mudavam de aparência a cada versão do Windows.
 * Cada ícone herda a cor do texto (`currentColor`) e é decorativo (`aria-hidden`):
 * o botão que o contém sempre tem rótulo próprio.
 */
import type { ReactElement } from "react";

/** Nomes dos ícones disponíveis. */
export type NomeIcone =
  | "estoque"
  | "crm"
  | "meta"
  | "leads"
  | "bndv"
  | "financas"
  | "studio"
  | "ajustes"
  | "menu"
  | "busca"
  | "pasta"
  | "recarregar"
  | "nuvem"
  | "fechar"
  | "voltar"
  | "seta"
  | "estrela"
  | "relogio"
  | "calendario"
  | "chama"
  | "funil"
  | "campanhas"
  | "conexoes";

const TRACOS: Record<NomeIcone, ReactElement> = {
  estoque: (
    <>
      <path d="M4 15.5V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v3.5" />
      <path d="M3 15.5h18v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-11v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M4 12h16M7 14.2h1.5M15.5 14.2H17" />
    </>
  ),
  crm: (
    <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.5A7.5 7.5 0 1 1 20 12Z" />
  ),
  meta: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  leads: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 2.5 5" />
    </>
  ),
  bndv: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 15v-3M12 15V9M16 15v-5" />
    </>
  ),
  financas: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  studio: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="m3.5 15 4.5-4 4 3.5 3-2.5 5.5 4.5" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
    </>
  ),
  menu: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  busca: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  pasta: (
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  ),
  recarregar: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  nuvem: (
    <>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.2 18.5z" />
      <path d="M12 11v5M9.8 13.8 12 16l2.2-2.2" />
    </>
  ),
  fechar: <path d="m6 6 12 12M18 6 6 18" />,
  voltar: <path d="M15 5.5 8.5 12l6.5 6.5" />,
  seta: <path d="M9 5.5 15.5 12 9 18.5" />,
  estrela: (
    <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.6l-4.7 2.7 1.1-5.2-3.9-3.6 5.2-.6z" />
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendario: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M9 14.5l2 2 4-4" />
    </>
  ),
  chama: (
    <path d="M12 20.5c3.6 0 6-2.4 6-5.8 0-3.2-2.3-5.2-3.4-8.2-.4 2-1.4 3.2-2.6 3.8.2-2.6-.8-4.8-2.8-6.3.2 3-2.2 4.9-3.4 7A6.4 6.4 0 0 0 6 14.7c0 3.4 2.4 5.8 6 5.8Z" />
  ),
  funil: <path d="M4 5h16l-6 7.5V18l-4 2v-7.5z" />,
  campanhas: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M21 19H3" />
    </>
  ),
  conexoes: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5" />
    </>
  ),
};

/** Desenha um ícone pelo nome (18 px, cor do texto). */
export function Icon({ nome }: { nome: NomeIcone }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACOS[nome]}
    </svg>
  );
}
