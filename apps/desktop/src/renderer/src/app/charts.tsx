/**
 * Gráficos leves em SVG/CSS para as páginas de dados (sem biblioteca externa): barras
 * horizontais, colunas por dia (uma ou duas séries), linha com área e minigráfico. As cores
 * vêm dos tokens de dados (`--dado-1`, `--dado-meta`, `--dado-crm`), que funcionam nos
 * dois temas. Todo gráfico tem `aria-label` e os valores também aparecem em texto.
 */
import type { ReactNode } from "react";

/** Item de barra horizontal. */
export type ItemBarra = {
  chave: string;
  rotulo: ReactNode;
  valor: number;
  /** Texto à direita (padrão: o valor). */
  texto?: string;
  apagado?: boolean;
};

/** Barras horizontais (maior valor = barra cheia). Clique opcional por item. */
export function Barras({
  itens,
  rotulo,
  aoClicar,
  selecionado,
  log,
}: {
  itens: ItemBarra[];
  rotulo: string;
  aoClicar?: (chave: string) => void;
  selecionado?: string;
  /** Escala logarítmica (funis com etapas de tamanhos muito diferentes). */
  log?: boolean;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const largura = (v: number) =>
    v <= 0
      ? 0
      : log
        ? 6 + 94 * (Math.log10(v + 1) / Math.log10(max + 1))
        : Math.max(2, (v / max) * 100);
  return (
    <ul className="barras" aria-label={rotulo}>
      {itens.map((i) => (
        <li
          key={i.chave}
          className={`${aoClicar ? "clicavel" : ""}${selecionado === i.chave ? " ativo" : ""}`}
          onClick={aoClicar ? () => aoClicar(i.chave) : undefined}
        >
          <span className="barra-nome">{i.rotulo}</span>
          <span className="barra-trilho">
            <span
              className={`barra-cheia${i.apagado ? " apagada" : ""}`}
              style={{ width: `${largura(i.valor)}%` }}
            />
          </span>
          <span className="barra-numero">
            {i.texto ?? i.valor.toLocaleString("pt-BR")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Série de um gráfico por dia. */
export type Serie = { nome: string; cor: string; valores: (number | null)[] };

const ALTURA = 180;
const MARGEM = { topo: 12, base: 24, esq: 44, dir: 8 };

function escala(series: Serie[]) {
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.valores.map((v) => v ?? 0)),
  );
  const passo = Math.pow(10, Math.floor(Math.log10(max)));
  const topo = Math.ceil(max / passo) * passo;
  return { topo, marcas: [0, topo / 2, topo] };
}

const abreviar = (v: number) =>
  v >= 1e6
    ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v >= 1e3
      ? `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
      : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Colunas por dia (uma ou duas séries lado a lado), com eixo e dicas ao passar o mouse. */
export function Colunas({
  dias,
  series,
  rotulo,
  formato = abreviar,
  largura = 640,
}: {
  dias: string[];
  series: Serie[];
  rotulo: string;
  formato?: (v: number) => string;
  /** Largura do desenho: 640 em meia coluna, 1280 em largura total (texto sem esticar). */
  largura?: number;
}) {
  const { topo, marcas } = escala(series);
  const w = (largura - MARGEM.esq - MARGEM.dir) / Math.max(1, dias.length);
  const y = (v: number) =>
    MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.base) * (1 - v / topo);
  const larguraBarra = Math.max(2, Math.min(18, (w * 0.8) / series.length));
  const cada = Math.max(1, Math.ceil(dias.length / 10));
  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} role="img" aria-label={rotulo}>
        {marcas.map((m) => (
          <g key={m}>
            <line
              className="grade"
              x1={MARGEM.esq}
              x2={largura - MARGEM.dir}
              y1={y(m)}
              y2={y(m)}
            />
            <text
              className="eixo"
              x={MARGEM.esq - 6}
              y={y(m) + 4}
              textAnchor="end"
            >
              {abreviar(m)}
            </text>
          </g>
        ))}
        {dias.map((d, i) => {
          const x0 =
            MARGEM.esq + i * w + (w - larguraBarra * series.length) / 2;
          return (
            <g key={d}>
              {series.map((s, j) => {
                const v = s.valores[i] ?? 0;
                return (
                  <rect
                    key={s.nome}
                    x={x0 + j * larguraBarra}
                    y={y(v)}
                    width={larguraBarra - 1}
                    height={Math.max(0, ALTURA - MARGEM.base - y(v))}
                    rx={2}
                    fill={s.cor}
                  >
                    <title>{`${d.slice(8, 10)}/${d.slice(5, 7)} · ${s.nome}: ${formato(v)}`}</title>
                  </rect>
                );
              })}
              {i % cada === 0 && (
                <text
                  className="eixo"
                  x={MARGEM.esq + i * w + w / 2}
                  y={ALTURA - 6}
                  textAnchor="middle"
                >
                  {`${d.slice(8, 10)}/${d.slice(5, 7)}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && <Legenda series={series} />}
    </figure>
  );
}

/** Linha com área por dia (valores nulos são pulados). */
export function Linha({
  dias,
  serie,
  rotulo,
  formato = abreviar,
  referencia,
  largura = 640,
}: {
  dias: string[];
  serie: Serie;
  rotulo: string;
  formato?: (v: number) => string;
  /** Linha tracejada de referência (meta ou média). */
  referencia?: { valor: number; rotulo: string };
  /** Largura do desenho: 640 em meia coluna, 1280 em largura total. */
  largura?: number;
}) {
  const { topo, marcas } = escala([
    { ...serie, valores: [...serie.valores, referencia?.valor ?? 0] },
  ]);
  const passo =
    (largura - MARGEM.esq - MARGEM.dir) / Math.max(1, dias.length - 1);
  const x = (i: number) => MARGEM.esq + i * passo;
  const y = (v: number) =>
    MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.base) * (1 - v / topo);
  const pts = serie.valores
    .map((v, i) => (v == null ? null : ([x(i), y(v)] as const)))
    .filter((p): p is readonly [number, number] => !!p);
  const linha = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join("");
  const area = pts.length
    ? `${linha}L${pts[pts.length - 1][0]},${ALTURA - MARGEM.base}L${pts[0][0]},${ALTURA - MARGEM.base}Z`
    : "";
  const cada = Math.max(1, Math.ceil(dias.length / 10));
  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} role="img" aria-label={rotulo}>
        {marcas.map((m) => (
          <g key={m}>
            <line
              className="grade"
              x1={MARGEM.esq}
              x2={largura - MARGEM.dir}
              y1={y(m)}
              y2={y(m)}
            />
            <text
              className="eixo"
              x={MARGEM.esq - 6}
              y={y(m) + 4}
              textAnchor="end"
            >
              {abreviar(m)}
            </text>
          </g>
        ))}
        {referencia && (
          <g>
            <line
              className="referencia"
              x1={MARGEM.esq}
              x2={largura - MARGEM.dir}
              y1={y(referencia.valor)}
              y2={y(referencia.valor)}
            />
            <text
              className="eixo"
              x={largura - MARGEM.dir}
              y={y(referencia.valor) - 4}
              textAnchor="end"
            >
              {referencia.rotulo}
            </text>
          </g>
        )}
        <path d={area} fill={serie.cor} opacity={0.12} />
        <path
          d={linha}
          fill="none"
          stroke={serie.cor}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {serie.valores.map((v, i) =>
          v == null ? null : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={dias.length > 31 ? 0 : 2.5}
              fill={serie.cor}
            >
              <title>{`${dias[i].slice(8, 10)}/${dias[i].slice(5, 7)}: ${formato(v)}`}</title>
            </circle>
          ),
        )}
        {dias.map((d, i) =>
          i % cada === 0 ? (
            <text
              key={d}
              className="eixo"
              x={x(i)}
              y={ALTURA - 6}
              textAnchor="middle"
            >
              {`${d.slice(8, 10)}/${d.slice(5, 7)}`}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

/** Legenda das séries. */
export function Legenda({ series }: { series: Pick<Serie, "nome" | "cor">[] }) {
  return (
    <figcaption className="legenda">
      {series.map((s) => (
        <span key={s.nome}>
          <i style={{ background: s.cor }} />
          {s.nome}
        </span>
      ))}
    </figcaption>
  );
}

/** Minigráfico de linha (dentro de cartões de número). */
export function Mini({
  valores,
  cor,
}: {
  valores: (number | null)[];
  cor: string;
}) {
  const v = valores.map((x) => x ?? 0);
  if (v.length < 2) return null;
  const max = Math.max(...v, 1);
  const min = Math.min(...v, 0);
  const pts = v
    .map(
      (x, i) =>
        `${((i / (v.length - 1)) * 100).toFixed(1)},${(28 - ((x - min) / (max - min || 1)) * 26).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      className="mini"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={cor}
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Lista de dias (AAAA-MM-DD) de `desde` até `ate`, inclusive. */
export function diasEntre(desde: string, ate: string) {
  const saida: string[] = [];
  const d = new Date(`${desde}T12:00:00`);
  const fim = new Date(`${ate}T12:00:00`);
  for (let i = 0; d <= fim && i < 400; i++) {
    saida.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return saida;
}
