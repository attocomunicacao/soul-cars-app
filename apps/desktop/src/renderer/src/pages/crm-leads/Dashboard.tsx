/**
 * Visão Painel do CRM · Leads: números do período, leads por carro, funil por status, entrada por dia, desempenho por SDR e carro × status.
 */
import {
  NENHUM,
  PERDIDO,
  acoesPorSdr,
  categoria,
  contarPor,
  ehAgendado,
  inicioDoPeriodo,
  nomeDeAgendamento,
  seriePorDia,
  statusDoLead,
  type ConfigLeads,
  type FiltrosLeads,
  type LeadCrm,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { Barras, Linha, Mini } from "../../app/charts";
import { Avatar, Kpi, fmt } from "../../app/components";
import { etiquetasDeStatus, mapaEtiquetas, mapaSdr } from "./lead-helpers";

// ------------------------------------------------------------------ Painel
export function Dashboard({
  snap,
  cfg,
  leads,
  filtros,
  setFiltros,
}: {
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  leads: LeadCrm[];
  filtros: FiltrosLeads;
  setFiltros: (f: FiltrosLeads) => void;
}) {
  const status = etiquetasDeStatus(snap, cfg);
  const etiq = mapaEtiquetas(snap);
  const porTag = contarPor(leads, (l) => l.tagIds);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const novosHoje = leads.filter(
    (l) => Date.parse(l.createdAt) >= hoje.getTime(),
  ).length;
  const ontem = leads.filter((l) => {
    const t = Date.parse(l.createdAt);
    return t >= hoje.getTime() - 864e5 && t < hoje.getTime();
  }).length;
  const temAgenda = status.some((t) => nomeDeAgendamento(t.name));
  const agendados = leads.filter((l) => ehAgendado(l, etiq, cfg)).length;
  const quente = status.find((t) => /quente/i.test(t.name));
  const diasSerie =
    filtros.period === "today" ? 7 : Math.min(30, Number(filtros.period) || 30);
  const inicio =
    inicioDoPeriodo(filtros.period) ??
    Math.min(
      ...leads.map((l) => Date.parse(l.createdAt)),
      Date.now() - 30 * 864e5,
    );
  const serie = seriePorDia(
    leads,
    Math.min(120, Math.max(2, Math.ceil((Date.now() - inicio) / 864e5))),
  );
  const semCarro = leads.filter(
    (l) => !l.tagIds.some((t) => categoria(cfg, t) === "car"),
  ).length;
  const carros = snap.tags
    .filter((t) => categoria(cfg, t.id) === "car")
    .map((t) => ({ t, n: porTag.get(t.id) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 14);
  const semStatus = leads.filter(
    (l) => statusDoLead(l, cfg.statusOrder) === NENHUM,
  ).length;
  const sdr = mapaSdr(snap);
  const porSdr = new Map<string, LeadCrm[]>();
  for (const l of leads) {
    const k = l.memberId ?? NENHUM;
    porSdr.set(k, [...(porSdr.get(k) ?? []), l]);
  }
  const acoes = acoesPorSdr(leads, inicioDoPeriodo(filtros.period) ?? 0);
  const linhasSdr = [...porSdr.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );
  const listaCarros = carros.map((c) => c.t);
  const celula = (carro: string | null, st: string) =>
    leads.filter(
      (l) =>
        (carro
          ? l.tagIds.includes(carro)
          : !l.tagIds.some((t) => categoria(cfg, t) === "car")) &&
        (st === NENHUM
          ? statusDoLead(l, cfg.statusOrder) === NENHUM
          : l.tagIds.includes(st)),
    ).length;
  const matriz = [
    ...listaCarros.map((c) => ({
      id: c.id,
      nome: c.name,
      vals: [...status.map((s) => celula(c.id, s.id)), celula(c.id, NENHUM)],
    })),
    ...(semCarro
      ? [
          {
            id: NENHUM,
            nome: "(sem carro)",
            vals: [
              ...status.map((s) => celula(null, s.id)),
              celula(null, NENHUM),
            ],
          },
        ]
      : []),
  ];
  const maxCel = Math.max(1, ...matriz.flatMap((r) => r.vals));
  const periodoTxt = {
    today: "hoje",
    "7": "nos últimos 7 dias",
    "30": "nos últimos 30 dias",
    "90": "nos últimos 90 dias",
    all: "no total",
  }[filtros.period];

  return (
    <div className="pilha">
      <div className="kpis">
        <Kpi
          destaque
          icone="leads"
          rotulo="Total de leads"
          valor={fmt.int(leads.length)}
          apoio={
            <>
              entraram {periodoTxt}
              <Mini
                valores={seriePorDia(leads, diasSerie).map((d) => d.valor)}
                cor="var(--dado-1)"
              />
            </>
          }
        />
        <Kpi
          icone="estrela"
          rotulo="Novos hoje"
          valor={fmt.int(novosHoje)}
          apoio={
            novosHoje || ontem ? (
              <>
                <span
                  className={`variacao ${novosHoje >= ontem ? "sobe" : "desce"}`}
                >
                  {novosHoje >= ontem ? "▲" : "▼"} {Math.abs(novosHoje - ontem)}
                </span>{" "}
                vs. ontem ({ontem})
              </>
            ) : (
              "nenhum lead hoje"
            )
          }
        />
        <Kpi
          icone="relogio"
          rotulo="Aguardando resposta"
          valor={fmt.int(leads.filter((l) => l.waiting).length)}
          apoio="atendimentos em espera"
        />
        {temAgenda && (
          <Kpi
            icone="calendario"
            rotulo="Taxa de agendamento"
            valor={fmt.pct(agendados, leads.length)}
            apoio={`${fmt.int(agendados)} agendados, confirmados ou vendidos`}
          />
        )}
        {quente && (
          <Kpi
            icone="chama"
            rotulo={quente.name}
            valor={fmt.int(porTag.get(quente.id) ?? 0)}
            apoio={`${fmt.pct(porTag.get(quente.id) ?? 0, leads.length)} dos leads`}
          />
        )}
      </div>
      <div className="duas-colunas">
        <div className="panel">
          <h2>Leads por carro</h2>
          <p className="dica-crm">Clique para filtrar.</p>
          <Barras
            rotulo="Leads por carro"
            itens={[
              ...carros.map((c) => ({
                chave: c.t.id,
                rotulo: c.t.name,
                valor: c.n,
              })),
              ...(semCarro
                ? [
                    {
                      chave: NENHUM,
                      rotulo: "(sem carro)",
                      valor: semCarro,
                      apagado: true,
                    },
                  ]
                : []),
            ]}
            selecionado={filtros.car}
            aoClicar={(k) =>
              setFiltros({ ...filtros, car: filtros.car === k ? "" : k })
            }
          />
        </div>
        <div className="panel">
          <h2>Funil por status</h2>
          <p className="dica-crm">Na ordem do atendimento.</p>
          <Barras
            rotulo="Leads por status"
            itens={[
              ...status.map((t) => ({
                chave: t.id,
                rotulo: t.name,
                valor: porTag.get(t.id) ?? 0,
                texto: `${fmt.int(porTag.get(t.id) ?? 0)} · ${fmt.pct(porTag.get(t.id) ?? 0, leads.length)}`,
                apagado: PERDIDO.test(t.name),
              })),
              {
                chave: NENHUM,
                rotulo: "Sem status",
                valor: semStatus,
                apagado: true,
              },
            ]}
          />
        </div>
      </div>
      <div className="panel">
        <div className="actions">
          <h2>Entrada por dia</h2>
          <span className="hint">{serie.length} dias</span>
        </div>
        <Linha
          largura={1280}
          rotulo="Leads novos por dia"
          dias={serie.map((d) => d.dia)}
          serie={{
            nome: "Leads",
            cor: "var(--dado-1)",
            valores: serie.map((d) => d.valor),
          }}
        />
      </div>
      <div className="panel">
        <h2>Desempenho por SDR</h2>
        <p className="dica-crm">
          Clique numa linha para filtrar o painel por SDR.
        </p>
        <div
          className="tabela-rolavel"
          tabIndex={0}
          role="region"
          aria-label="Tabela rolável"
        >
          <table>
            <thead>
              <tr>
                <th>SDR</th>
                <th className="n">Leads</th>
                <th className="n">Ações</th>
                <th className="n">Lig. não atend.</th>
                <th className="n">Lig. atend.</th>
                {status.map((t) => (
                  <th key={t.id} className="n">
                    {t.name}
                  </th>
                ))}
                <th className="n">Sem status</th>
                {temAgenda && <th className="n">% agend.</th>}
                <th className="n">Em espera</th>
              </tr>
            </thead>
            <tbody>
              {linhasSdr.map(([id, ls]) => {
                const c = contarPor(ls, (l) => l.tagIds);
                const a = acoes.get(id) ?? { total: 0, naoAtend: 0, atend: 0 };
                const nome =
                  id === NENHUM ? "(sem SDR)" : (sdr.get(id) ?? "SDR removido");
                return (
                  <tr
                    key={id}
                    className={`clicavel${filtros.member === id ? " ativo" : ""}`}
                    onClick={() =>
                      setFiltros({
                        ...filtros,
                        member: filtros.member === id ? "" : id,
                      })
                    }
                  >
                    <td>
                      <span className="quem">
                        <Avatar nome={nome} pequeno />
                        {nome}
                      </span>
                    </td>
                    <td className="n">
                      <b>{ls.length}</b>
                    </td>
                    <td className="n">{a.total}</td>
                    <td className="n">{a.naoAtend}</td>
                    <td className="n">{a.atend}</td>
                    {status.map((t) => (
                      <td key={t.id} className="n">
                        {c.get(t.id) ?? 0}
                      </td>
                    ))}
                    <td className="n">
                      {
                        ls.filter(
                          (l) => statusDoLead(l, cfg.statusOrder) === NENHUM,
                        ).length
                      }
                    </td>
                    {temAgenda && (
                      <td className="n">
                        {fmt.pct(
                          ls.filter((l) => ehAgendado(l, etiq, cfg)).length,
                          ls.length,
                        )}
                      </td>
                    )}
                    <td className="n">{ls.filter((l) => l.waiting).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {matriz.length > 0 && (
        <div className="panel">
          <h2>Carro × status</h2>
          <p className="dica-crm">
            Cor mais forte = mais leads. Clique para filtrar pelo carro.
          </p>
          <div
            className="tabela-rolavel"
            tabIndex={0}
            role="region"
            aria-label="Tabela rolável"
          >
            <table>
              <thead>
                <tr>
                  <th>Carro</th>
                  {status.map((t) => (
                    <th key={t.id} className="n">
                      {t.name}
                    </th>
                  ))}
                  <th className="n">Sem status</th>
                </tr>
              </thead>
              <tbody>
                {matriz.map((r) => (
                  <tr
                    key={r.id}
                    className="clicavel"
                    onClick={() => setFiltros({ ...filtros, car: r.id })}
                  >
                    <td>
                      {r.id === NENHUM ? (
                        <span className="hint">(sem carro)</span>
                      ) : (
                        <span className="etiqueta carro">{r.nome}</span>
                      )}
                    </td>
                    {r.vals.map((v, i) => (
                      <td key={i} className="n">
                        <span
                          className="calor"
                          style={
                            { "--calor": v / maxCel } as React.CSSProperties
                          }
                        >
                          {v}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
