/**
 * Componentes de interface reaproveitados pelas páginas de dados (CRM · Leads, Meta Ads,
 * Funil): cartão de número, controle segmentado, selo de situação, lista de destaques,
 * gaveta lateral e estado vazio. Visual em DESIGN.md.
 */
import { useEffect, type ReactNode } from "react";
import { Icon, type NomeIcone } from "./icons";

/** Cartão de número (KPI): rótulo, valor grande e uma linha de apoio. */
export function Kpi({
  rotulo,
  valor,
  apoio,
  icone,
  destaque,
  titulo,
}: {
  rotulo: string;
  valor: ReactNode;
  apoio?: ReactNode;
  icone?: NomeIcone;
  destaque?: boolean;
  titulo?: string;
}) {
  return (
    <div className={`kpi${destaque ? " kpi-destaque" : ""}`} title={titulo}>
      <small>
        {icone && <Icon nome={icone} />}
        {rotulo}
      </small>
      <strong>{valor}</strong>
      {apoio != null && <span className="kpi-apoio">{apoio}</span>}
    </div>
  );
}

/** Variação "▲ 12,3%" com cor de bom/ruim (`subirEhBom` diz qual direção é boa). */
export function Variacao({
  valor,
  subirEhBom = true,
  sufixo = " vs. anterior",
}: {
  valor: number | null;
  subirEhBom?: boolean;
  sufixo?: string;
}) {
  if (valor == null) return <>sem comparação</>;
  const sobe = valor > 0;
  const neutro = Math.abs(valor) < 0.005;
  const classe = neutro ? "" : sobe === subirEhBom ? "sobe" : "desce";
  return (
    <>
      <span className={`variacao ${classe}`}>
        {sobe ? "▲" : "▼"}{" "}
        {(Math.abs(valor) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        %
      </span>
      {sufixo}
    </>
  );
}

/** Controle segmentado (abas ou períodos). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  pequeno,
}: {
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
  pequeno?: boolean;
}) {
  return (
    <nav
      className={`segmented${pequeno ? " pequeno" : ""}`}
      aria-label={rotulo}
    >
      {opcoes.map(([v, r]) => (
        <button
          key={v}
          className={v === valor ? "selected" : ""}
          aria-pressed={v === valor}
          onClick={() => aoMudar(v)}
        >
          {r}
        </button>
      ))}
    </nav>
  );
}

/** Tom de um destaque ou situação. */
export type Tom = "bom" | "atencao" | "ruim" | "info" | "neutro";

const ICONE_TOM: Record<Tom, string> = {
  bom: "✓",
  atencao: "!",
  ruim: "✕",
  info: "i",
  neutro: "•",
};

/** Selo colorido de situação ("Eficiente", "Caro"…), sempre com símbolo além da cor. */
export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span className={`selo-tom ${tom}`}>
      <b aria-hidden="true">{ICONE_TOM[tom]}</b>
      {children}
    </span>
  );
}

/** Texto com trechos em negrito marcados por **. */
export function Negrito({ texto }: { texto: string }) {
  return (
    <>{texto.split("**").map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))}</>
  );
}

/** Lista de destaques do diagnóstico. */
export function Destaques({
  itens,
  vazio = "Sem destaques para o período.",
}: {
  itens: { tom: Tom; texto: string }[];
  vazio?: string;
}) {
  if (!itens.length) return <p className="hint">{vazio}</p>;
  return (
    <ul className="destaques">
      {itens.map((d, i) => (
        <li key={i} className={d.tom}>
          <b aria-hidden="true">{ICONE_TOM[d.tom]}</b>
          <span>
            <Negrito texto={d.texto} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Gaveta lateral (detalhe de um lead). Fecha no X, no Esc ou clicando fora. */
export function Gaveta({
  titulo,
  fechar,
  children,
}: {
  titulo: string;
  fechar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  return (
    <div
      className="gaveta-fundo"
      onMouseDown={(e) => e.target === e.currentTarget && fechar()}
    >
      <aside
        className="gaveta"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <button
          className="icon-only gaveta-fechar"
          aria-label="Fechar"
          autoFocus
          onClick={fechar}
        >
          <Icon nome="fechar" />
        </button>
        {children}
      </aside>
    </div>
  );
}

/** Estado vazio com título, explicação e ação opcional. */
export function Vazio({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {acao}
    </div>
  );
}

/** "há 2 min" a partir de uma data ISO. */
export function ha(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000));
  if (s < 45) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/** Iniciais de um nome ("Ana Souza" → "AS"). */
export const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Avatar redondo com iniciais. */
export function Avatar({ nome, pequeno }: { nome: string; pequeno?: boolean }) {
  return (
    <span className={`avatar${pequeno ? " pequeno" : ""}`}>
      {iniciais(nome)}
    </span>
  );
}

const int = new Intl.NumberFormat("pt-BR");
const dec1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formatadores das páginas de dados. */
export const fmt = {
  int: (v: number) => int.format(v),
  dec1: (v: number) => dec1.format(v),
  moeda: (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? "—" : brl.format(v),
  pct: (a: number, b: number) =>
    b > 0 ? `${dec1.format((a / b) * 100)}%` : "—",
  data: (iso: string) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  diaMes: (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`,
  dataBR: (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`,
};

/** Baixa um CSV (separador ";" e BOM, para abrir certo no Excel). */
export function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const q = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(
    ["﻿" + linhas.map((l) => l.map(q).join(";")).join("\r\n")],
    {
      type: "text/csv;charset=utf-8",
    },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Mensagem de erro sem o prefixo técnico do Electron ("Error invoking remote method…"). */
export const textoDoErro = (e: unknown) =>
  String(e instanceof Error ? e.message : e)
    .replace(/^Error invoking remote method '[^']+': /, "")
    .replace(/^(Error: )+/, "");
