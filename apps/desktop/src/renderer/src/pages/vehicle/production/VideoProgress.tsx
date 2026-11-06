/**
 * Andamento da geração de vídeo, montado a partir das linhas `video:log` do motor.
 */
import { useEffect, useState } from "react";

/** Andamento de uma geração de vídeo, montado a partir das linhas `video:log` do motor. */
export type Andamento = {
  pct: number;
  etapa: string;
  inicio: number;
  fim?: number;
  arquivo?: string;
  /** Linhas que não são de progresso (codificador, tamanhos…), para o painel de detalhes. */
  detalhes: string[];
};

const PROGRESSO = /^PROGRESSO\s+(\d{1,3})\s*(.*)$/;
const PRONTO = /^PRONTO em (\d+)s:\s*(.*)$/;

/**
 * Atualiza o andamento com uma linha nova. `PROGRESSO n texto` move a barra; `PRONTO em Ns: arquivo`
 * encerra. Depois de pronto, o próximo PROGRESSO começa uma geração nova.
 */
export function aplicarLinha(
  atual: Andamento | null,
  linha: string,
  agora = Date.now(),
): Andamento | null {
  const prog = PROGRESSO.exec(linha);
  if (prog) {
    const pct = Math.min(100, Number(prog[1]));
    const novo = !atual || atual.fim !== undefined;
    return {
      detalhes: novo ? [] : atual.detalhes,
      inicio: novo ? agora : atual.inicio,
      // A barra nunca anda para trás dentro da mesma geração.
      pct: novo ? pct : Math.max(atual.pct, pct),
      etapa: prog[2].trim() || (novo ? "Iniciando" : atual.etapa),
    };
  }
  const pronto = PRONTO.exec(linha);
  if (pronto) {
    const base = atual ?? { detalhes: [], inicio: agora, pct: 0, etapa: "" };
    return {
      ...base,
      pct: 100,
      etapa: "Vídeo pronto",
      fim: base.inicio + Number(pronto[1]) * 1000,
      arquivo: pronto[2].trim(),
    };
  }
  if (!atual)
    return { detalhes: [linha], inicio: agora, pct: 0, etapa: "Iniciando" };
  return { ...atual, detalhes: [...atual.detalhes.slice(-39), linha] };
}

const tempo = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60
    ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`
    : `${s} s`;
};

/** Barra de andamento do vídeo: etapa, porcentagem, tempo decorrido e tempo restante estimado. */
export function VideoProgress({ andamento }: { andamento: Andamento | null }) {
  const [agora, setAgora] = useState(Date.now());
  const rodando = !!andamento && andamento.fim === undefined;
  useEffect(() => {
    if (!rodando) return;
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [rodando]);
  if (!andamento) return null;

  const decorrido = (andamento.fim ?? agora) - andamento.inicio;
  const restante =
    rodando && andamento.pct >= 3 && decorrido >= 5000
      ? (decorrido * (100 - andamento.pct)) / andamento.pct
      : null;
  const pronto = andamento.fim !== undefined;
  const nomeArquivo = andamento.arquivo?.split(/[\\/]/).pop();

  return (
    <section
      className={pronto ? "andamento pronto" : "andamento"}
      aria-live="polite"
    >
      <div className="andamento-topo">
        <div>
          <strong>
            {pronto ? "✓ Vídeo pronto" : andamento.etapa || "Gerando o vídeo"}
          </strong>
          {pronto && nomeArquivo && <small>{nomeArquivo}</small>}
          {!pronto && <small>Não feche o app até terminar.</small>}
        </div>
        <span className="andamento-pct">{andamento.pct}%</span>
      </div>
      <div
        className="andamento-trilho"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={andamento.pct}
        aria-label="Andamento do vídeo"
      >
        <div
          className="andamento-barra"
          style={{ width: `${andamento.pct}%` }}
        />
      </div>
      <div className="andamento-rodape">
        <span>
          {pronto ? "Levou" : "Decorrido"} {tempo(decorrido)}
        </span>
        {restante !== null && <span>Falta cerca de {tempo(restante)}</span>}
      </div>
      {andamento.detalhes.length > 0 && (
        <details>
          <summary>Detalhes</summary>
          <pre>{andamento.detalhes.join("\n")}</pre>
        </details>
      )}
    </section>
  );
}
