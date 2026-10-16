import { useEffect, useRef, useState } from "react";
import { invoke } from "./lib/desktop";
import { Barras } from "./VisaoCrm";

type Desempenho = {
  conversas: number;
  conversasComLead: number;
  semRespostaPct: number;
  medianaEsperaMin: number | null;
  ate5minPct: number;
  ate1hPct: number;
  porDia: { dia: string; conversas: number; semResposta: number }[];
  faixasEspera: { rotulo: string; conversas: number }[];
  porFaixaDoDia: {
    faixa: string;
    conversas: number;
    medianaMin: number | null;
  }[];
  porAtendente: {
    atendente: string;
    conversas: number;
    medianaMin: number | null;
  }[];
  mapaHorario: number[][];
  anuncios: { nome: string; conversas: number }[];
  positivas: number;
  positivasEsperaMin: number | null;
  demaisEsperaMin: number | null;
};

const minutos = (m: number | null) =>
  m === null
    ? "—"
    : m < 90
      ? `${Math.round(m)} min`
      : `${(m / 60).toFixed(1)} h`;
const numero = (n: number) => n.toLocaleString("pt-BR");
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LARGURA = 720;
const ALTURA = 170;
const MARGEM = { topo: 10, base: 22, esquerda: 34, direita: 8 };

/** Linha de conversas por dia (tendência) com a linha tracejada das que ficaram sem resposta nossa. */
function LinhaPorDia({ dados }: { dados: Desempenho["porDia"] }) {
  const maximo = Math.max(1, ...dados.map((d) => d.conversas));
  const teto = Math.ceil(maximo / 5) * 5 || 5;
  const largura = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const altura = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (i: number) =>
    MARGEM.esquerda +
    (dados.length > 1 ? (i / (dados.length - 1)) * largura : 0);
  const y = (v: number) => MARGEM.topo + altura - (v / teto) * altura;
  const linha = (f: (d: Desempenho["porDia"][number]) => number) =>
    dados.map((d, i) => `${x(i).toFixed(1)},${y(f(d)).toFixed(1)}`).join(" ");
  const area = `${x(0)},${y(0)} ${linha((d) => d.conversas)} ${x(dados.length - 1)},${y(0)}`;
  const total = dados.reduce((s, d) => s + d.conversas, 0);
  return (
    <svg
      className="grafico-linha"
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={`Conversas novas por dia: ${total} nos últimos ${dados.length} dias`}
    >
      {[0, teto / 2, teto].map((v) => (
        <g key={v}>
          <line
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={y(v)}
            y2={y(v)}
            className="grafico-grade"
          />
          <text
            x={MARGEM.esquerda - 6}
            y={y(v) + 4}
            className="grafico-texto"
            textAnchor="end"
          >
            {v}
          </text>
        </g>
      ))}
      <polygon points={area} className="grafico-area" />
      <polyline points={linha((d) => d.conversas)} className="grafico-total" />
      <polyline points={linha((d) => d.semResposta)} className="grafico-sem" />
      {[0, Math.floor((dados.length - 1) / 2), dados.length - 1].map((i) => (
        <text
          key={i}
          x={x(i)}
          y={ALTURA - 6}
          className="grafico-texto"
          textAnchor={
            i === 0 ? "start" : i === dados.length - 1 ? "end" : "middle"
          }
        >
          {diaCurto(dados[i].dia)}
        </text>
      ))}
      {dados.map((d, i) => (
        <rect
          key={d.dia}
          x={x(i) - largura / dados.length / 2}
          y={MARGEM.topo}
          width={largura / dados.length}
          height={altura}
          className="grafico-alvo"
        >
          <title>
            {`${diaCurto(d.dia)}: ${d.conversas} conversas, ${d.semResposta} sem resposta nossa`}
          </title>
        </rect>
      ))}
    </svg>
  );
}

/** Mapa de calor: em que dia da semana e hora os leads começam a conversa. */
function MapaCalor({ mapa }: { mapa: number[][] }) {
  const maximo = Math.max(1, ...mapa.flat());
  return (
    <div
      className="mapa-calor"
      role="img"
      aria-label="Conversas por dia da semana e hora"
    >
      <span />
      {Array.from({ length: 24 }, (_, h) => (
        <small key={h} className="mapa-hora">
          {h % 3 === 0 ? `${h}h` : ""}
        </small>
      ))}
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <MapaLinha
          key={d}
          rotulo={DIAS_SEMANA[d]}
          valores={mapa[d]}
          maximo={maximo}
        />
      ))}
    </div>
  );
}

function MapaLinha({
  rotulo,
  valores,
  maximo,
}: {
  rotulo: string;
  valores: number[];
  maximo: number;
}) {
  return (
    <>
      <small className="mapa-dia">{rotulo}</small>
      {valores.map((v, h) => (
        <span
          key={h}
          className="mapa-celula"
          style={{ opacity: v === 0 ? 0.06 : 0.15 + 0.85 * (v / maximo) }}
          title={`${rotulo}, ${h}h: ${v} conversas`}
        />
      ))}
    </>
  );
}

/** Carrega o desempenho da memória da Soul IA: `undefined` enquanto calcula, `null` se não há memória. */
export function useDesempenho(aoErro: (mensagem: string) => void) {
  const [dados, setDados] = useState<Desempenho | null | undefined>(undefined);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    invoke<Desempenho | null>("soulia_desempenho")
      .then((d) => {
        if (vivo.current) setDados(d);
      })
      .catch((e) => {
        if (vivo.current) {
          setDados(null);
          aoErro(String(e instanceof Error ? e.message : e));
        }
      });
    return () => {
      vivo.current = false;
    };
  }, [aoErro]);

  return dados;
}

function semanas(porDia: Desempenho["porDia"]) {
  const soma = (v: Desempenho["porDia"]) =>
    v.reduce((t, d) => t + d.conversas, 0);
  const atual = soma(porDia.slice(-7));
  const anterior = soma(porDia.slice(-14, -7));
  const delta =
    anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;
  return { atual, delta };
}

/** Indicadores de atendimento, no mesmo formato dos cartões de leads. */
export function CartoesDesempenho({ dados }: { dados: Desempenho }) {
  const { atual, delta } = semanas(dados.porDia);
  return (
    <div className="grupo-kpi">
      <h3 className="rotulo-grupo">Atendimento</h3>
      <div className="cartoes-crm">
        <div className="cartao-crm">
          <b>
            {numero(atual)}
            {delta !== null && (
              <small className={delta >= 0 ? "delta bom" : "delta ruim"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </small>
            )}
          </b>
          <span>conversas nos últimos 7 dias</span>
        </div>
        <div className={`cartao-crm ${dados.ate5minPct >= 50 ? "bom" : ""}`}>
          <b>{minutos(dados.medianaEsperaMin)}</b>
          <span>1ª resposta (mediana)</span>
        </div>
        <div className="cartao-crm">
          <b>{dados.ate5minPct}%</b>
          <span>respondidos em até 5 min</span>
        </div>
        <div className="cartao-crm">
          <b>{dados.ate1hPct}%</b>
          <span>respondidos em até 1 h</span>
        </div>
        <div
          className={`cartao-crm ${dados.semRespostaPct > 10 ? "alerta" : ""}`}
        >
          <b>{dados.semRespostaPct}%</b>
          <span>nunca receberam resposta nossa</span>
        </div>
      </div>
    </div>
  );
}

/** Gráficos de desempenho; o que o painel já mostra (totais, etapas) não se repete aqui. */
export function PaineisDesempenho({ dados }: { dados: Desempenho }) {
  return (
    <>
      <section className="panel">
        <h2>Conversas novas por dia</h2>
        <p className="dica-crm">
          Últimos 30 dias. A linha tracejada são conversas em que o lead
          escreveu e ninguém nosso respondeu.
        </p>
        <LinhaPorDia dados={dados.porDia} />
      </section>

      <div className="grade-crm">
        <section className="panel">
          <h2>Quanto o lead espera</h2>
          <p className="dica-crm">
            Tempo até a 1ª resposta de uma pessoa nossa. Leads com etiqueta
            positiva foram atendidos em {minutos(dados.positivasEsperaMin)}{" "}
            (mediana); os demais, em {minutos(dados.demaisEsperaMin)}.
          </p>
          <Barras
            itens={dados.faixasEspera.map((f) => ({
              rotulo: f.rotulo,
              valor: f.conversas,
            }))}
          />
        </section>
        <section className="panel">
          <h2>Por horário em que o lead escreveu</h2>
          <p className="dica-crm">Mediana da espera em cada faixa do dia.</p>
          <Barras
            itens={dados.porFaixaDoDia.map((f) => ({
              rotulo: f.faixa,
              valor: Math.round(f.medianaMin ?? 0),
              extra: `min · ${numero(f.conversas)} conv.`,
            }))}
          />
        </section>
      </div>

      <section className="panel">
        <h2>Quando os leads escrevem</h2>
        <p className="dica-crm">
          Conversas iniciadas por dia da semana e hora (horário de Brasília);
          quanto mais escuro, mais conversas. Serve para escalar quem atende.
        </p>
        <MapaCalor mapa={dados.mapaHorario} />
      </section>

      <div className="grade-crm">
        <section className="panel">
          <h2>Por atendente</h2>
          <p className="dica-crm">
            Conversas respondidas e mediana da 1ª resposta.
          </p>
          <Barras
            itens={dados.porAtendente.map((a) => ({
              rotulo: a.atendente,
              valor: a.conversas,
              extra: `· ${minutos(a.medianaMin)}`,
            }))}
          />
        </section>
        <section className="panel">
          <h2>Anúncios que mais trazem conversa</h2>
          <p className="dica-crm">Origem registrada no uTalk.</p>
          {dados.anuncios.length === 0 ? (
            <p>Nenhuma conversa com anúncio de origem na memória.</p>
          ) : (
            <Barras
              itens={dados.anuncios.map((a) => ({
                rotulo: a.nome,
                valor: a.conversas,
              }))}
            />
          )}
        </section>
      </div>
    </>
  );
}

/** Aviso quando ainda não há memória para calcular o desempenho. */
export function SemMemoria({ irParaMemoria }: { irParaMemoria: () => void }) {
  return (
    <section className="panel">
      <h2>Desempenho do atendimento</h2>
      <p className="dica-crm">
        Rapidez de resposta, conversas por dia, atendentes e anúncios vêm da
        memória da Soul IA. Crie a memória para ver esses gráficos aqui.
      </p>
      <button className="primary" onClick={irParaMemoria}>
        Ir para a memória
      </button>
    </section>
  );
}
