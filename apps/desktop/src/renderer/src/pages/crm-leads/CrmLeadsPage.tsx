/**
 * Página CRM · Leads (vinda do Soul APP): leads do uTalk em quatro visões — Painel (números,
 * leads por carro, funil por status, entrada por dia, desempenho por SDR e carro × status),
 * Kanban por status, lista de Leads (com CSV) e Atividade (o que mudou a cada atualização).
 *
 * A leitura roda no main (`crm_leads_atualizar`); esta página pede uma atualização ao abrir
 * e depois no intervalo escolhido, e para o timer ao sair.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NENHUM,
  PERDIDO,
  acoesPorSdr,
  categoria,
  contarPor,
  ehAgendado,
  filtrarLeads,
  inicioDoPeriodo,
  nomeDeAgendamento,
  seriePorDia,
  statusDoLead,
  type ConfigLeads,
  type EventoCrm,
  type FiltrosLeads,
  type LeadCrm,
  type PeriodoLeads,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { Barras, Linha, Mini } from "../../app/charts";
import {
  Avatar,
  Gaveta,
  Kpi,
  Segmentado,
  Vazio,
  baixarCsv,
  fmt,
  ha,
} from "../../app/components";
import { Icon } from "../../app/icons";
import { invoke, openUrl } from "../../lib/desktop-bridge";

type Dados = {
  snapshot: SnapshotCrm | null;
  events: EventoCrm[];
  config: ConfigLeads;
  conectado: boolean;
  organizacao: { id: string; nome: string } | null;
};
type Visao = "painel" | "kanban" | "leads" | "atividade";

const VISOES = [
  ["painel", "Painel"],
  ["kanban", "Kanban"],
  ["leads", "Leads"],
  ["atividade", "Atividade"],
] as const;
const PERIODOS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["90", "90 dias"],
  ["all", "Tudo"],
] as const;

/** Cores das etiquetas do uTalk (suaves, legíveis nos dois temas). */
const COR_ETIQUETA: Record<string, string> = {
  Blue: "#5b9be6",
  Skyblue: "#5fb8e8",
  Cyan: "#3fb8c9",
  Aquamarine: "#3fc2a8",
  Green: "#45b46f",
  Kiwi: "#8fbf4a",
  Gold: "#d2a462",
  Amber: "#e0a040",
  Tangerine: "#e0884a",
  Chocolate: "#b07a3a",
  Salmon: "#e58a8a",
  Tomato: "#e0604f",
  Rose: "#e06080",
  Pink: "#d86aa8",
  Magenta: "#c46ad0",
  Violet: "#9a84e8",
  Grape: "#8a6ad8",
  Gray: "#9a9389",
  Silver: "#b8b2a8",
  Umblerito: "#6f9fd8",
};

export function CrmLeadsPage({
  aoErro,
  abrirConfiguracoes,
}: {
  aoErro: (m: string) => void;
  abrirConfiguracoes: () => void;
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [visao, setVisao] = useState<Visao>("painel");
  const [filtros, setFiltros] = useState<FiltrosLeads>({
    period: "30",
    car: "",
    member: "",
    search: "",
  });
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<LeadCrm | null>(null);
  const [, setRelogio] = useState(0);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      setDados(await invoke<Dados>("crm_leads_atualizar"));
      setErro("");
    } catch (e) {
      setErro(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setAtualizando(false);
    }
  }, []);

  // Primeiro mostra a última leitura guardada, depois busca a nova.
  useEffect(() => {
    let vivo = true;
    invoke<Dados>("crm_leads_dados")
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        if (d.conectado) void atualizar();
      })
      .catch((e) => aoErro(String(e)));
    return () => {
      vivo = false;
    };
  }, [atualizar, aoErro]);

  // Atualização automática e relógio do "há x min" (limpos ao sair da página).
  const intervalo = dados?.config.intervalSec ?? 60;
  const conectado = !!dados?.conectado;
  useEffect(() => {
    if (!conectado) return;
    const t = setInterval(() => void atualizar(), intervalo * 1000);
    const r = setInterval(() => setRelogio((n) => n + 1), 15_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [conectado, intervalo, atualizar]);

  const snap = dados?.snapshot ?? null;
  const cfg = dados?.config;
  const leads = useMemo(
    () => (snap && cfg ? filtrarLeads(snap.leads, filtros, cfg) : []),
    [snap, cfg, filtros],
  );

  if (!dados) return <p className="empty">Carregando…</p>;

  const cabecalho = (
    <div className="page-head">
      <div>
        <p className="eyebrow">CRM · uTalk</p>
        <h1>Leads</h1>
        <p>
          {snap
            ? `${fmt.int(leads.length)} de ${fmt.int(snap.leads.length)} leads${cfg!.windowDays > 0 ? ` · contatos ativos nos últimos ${cfg!.windowDays} dias` : ""}`
            : "Painel, Kanban e atividade dos leads do uTalk."}
        </p>
      </div>
      <div className="actions">
        {snap && (
          <span
            className={`pilula ${erro ? "erro" : atualizando ? "sync" : "ok"}`}
          >
            <i />
            {erro
              ? "Erro ao atualizar"
              : atualizando
                ? "Atualizando…"
                : `Atualizado ${ha(snap.fetchedAt)}`}
          </span>
        )}
        <button
          disabled={!dados.conectado || atualizando}
          onClick={() => void atualizar()}
        >
          <Icon nome="recarregar" />
          Atualizar
        </button>
      </div>
    </div>
  );

  if (!dados.conectado && !snap)
    return (
      <section>
        {cabecalho}
        <div className="panel">
          <Vazio
            titulo="Conecte o uTalk para ver os leads"
            acao={
              <button className="primary" onClick={abrirConfiguracoes}>
                Abrir Conexões
              </button>
            }
          >
            Cole o token pessoal do uTalk em Configurações › Conexões. Se você
            usava o Soul APP, dá para importar tudo de lá com um clique.
          </Vazio>
        </div>
      </section>
    );

  return (
    <section>
      {cabecalho}
      {erro && (
        <div role="alert" className="notice error com-fechar">
          <span>{erro}</span>
          <button className="plain small" onClick={abrirConfiguracoes}>
            Conexões
          </button>
        </div>
      )}
      <div className="filtros">
        <Segmentado
          rotulo="Visão"
          opcoes={VISOES}
          valor={visao}
          aoMudar={setVisao}
        />
        {visao !== "atividade" && snap && (
          <>
            <Segmentado
              pequeno
              rotulo="Período de entrada"
              opcoes={PERIODOS}
              valor={filtros.period}
              aoMudar={(p) =>
                setFiltros({ ...filtros, period: p as PeriodoLeads })
              }
            />
            <label className="campo-inline">
              Carro
              <select
                value={filtros.car}
                onChange={(e) =>
                  setFiltros({ ...filtros, car: e.target.value })
                }
              >
                <option value="">Todos</option>
                {snap.tags
                  .filter((t) => categoria(cfg!, t.id) === "car")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                <option value={NENHUM}>(sem carro)</option>
              </select>
            </label>
            <label className="campo-inline">
              SDR
              <select
                value={filtros.member}
                onChange={(e) =>
                  setFiltros({ ...filtros, member: e.target.value })
                }
              >
                <option value="">Todos</option>
                {snap.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value={NENHUM}>(sem SDR)</option>
              </select>
            </label>
            <label className="search">
              <Icon nome="busca" />
              <input
                aria-label="Buscar lead"
                placeholder="Nome ou telefone"
                value={filtros.search}
                onChange={(e) =>
                  setFiltros({ ...filtros, search: e.target.value })
                }
              />
            </label>
          </>
        )}
      </div>
      {!snap ? (
        <div className="panel">
          <Vazio
            titulo={
              atualizando ? "Buscando os leads no uTalk…" : "Ainda sem leitura"
            }
          >
            A primeira busca pode levar 1 a 2 minutos, conforme o número de
            atendimentos.
          </Vazio>
        </div>
      ) : visao === "painel" ? (
        <Painel
          snap={snap}
          cfg={cfg!}
          leads={leads}
          filtros={filtros}
          setFiltros={setFiltros}
        />
      ) : visao === "kanban" ? (
        <Kanban snap={snap} cfg={cfg!} leads={leads} abrir={setAberto} />
      ) : visao === "leads" ? (
        <ListaLeads snap={snap} cfg={cfg!} leads={leads} abrir={setAberto} />
      ) : (
        <Atividade eventos={dados.events} intervalo={intervalo} />
      )}
      {aberto && snap && (
        <DetalheLead
          lead={aberto}
          snap={snap}
          cfg={cfg!}
          fechar={() => setAberto(null)}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------------ ajudantes
const mapaEtiquetas = (s: SnapshotCrm) => new Map(s.tags.map((t) => [t.id, t]));
const mapaSdr = (s: SnapshotCrm) =>
  new Map(s.members.map((m) => [m.id, m.name]));
const etiquetasDeStatus = (s: SnapshotCrm, cfg: ConfigLeads) => {
  const m = mapaEtiquetas(s);
  return cfg.statusOrder
    .map((id) => m.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t);
};

function Etiquetas({
  lead,
  snap,
  cfg,
  so,
}: {
  lead: LeadCrm;
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  so?: "car" | "status";
}) {
  const m = mapaEtiquetas(snap);
  const lista = lead.tagIds
    .map((id) => m.get(id))
    .filter(
      (t): t is NonNullable<typeof t> =>
        !!t &&
        categoria(cfg, t.id) !== "ignore" &&
        (!so || categoria(cfg, t.id) === so),
    );
  if (!lista.length)
    return (
      <span className="hint">
        {so === "car" ? "sem carro" : so === "status" ? "sem status" : "—"}
      </span>
    );
  return (
    <span className="etiquetas">
      {lista.map((t) =>
        categoria(cfg, t.id) === "car" ? (
          <span key={t.id} className="etiqueta carro">
            {t.name}
          </span>
        ) : (
          <span key={t.id} className="etiqueta">
            <i
              style={{ background: COR_ETIQUETA[t.color ?? ""] ?? "#9a9389" }}
            />
            {t.emoji}
            {t.name}
          </span>
        ),
      )}
    </span>
  );
}

// ------------------------------------------------------------------ Painel
function Painel({
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
        <div className="tabela-rolavel">
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
          <div className="tabela-rolavel">
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

// ------------------------------------------------------------------ Kanban
function Kanban({
  snap,
  cfg,
  leads,
  abrir,
}: {
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  leads: LeadCrm[];
  abrir: (l: LeadCrm) => void;
}) {
  const colunas = [
    ...etiquetasDeStatus(snap, cfg).map((t) => ({
      id: t.id,
      nome: `${t.emoji ?? ""} ${t.name}`.trim(),
      cor: COR_ETIQUETA[t.color ?? ""] ?? "#9a9389",
    })),
    { id: NENHUM, nome: "Sem status", cor: "var(--faint)" },
  ];
  const grupos = new Map<string, LeadCrm[]>(colunas.map((c) => [c.id, []]));
  for (const l of leads) grupos.get(statusDoLead(l, cfg.statusOrder))?.push(l);
  const sdr = mapaSdr(snap);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const LIMITE = 150;
  if (colunas.length === 1)
    return (
      <div className="panel">
        <Vazio titulo="Nenhuma etiqueta de status">
          As colunas do Kanban são as etiquetas de status do uTalk. Ajuste quais
          etiquetas são status em Configurações › CRM · Leads.
        </Vazio>
      </div>
    );
  return (
    <div className="kanban">
      {colunas.map((c) => {
        const ls = (grupos.get(c.id) ?? []).sort(
          (a, b) => Date.parse(b.lastActive) - Date.parse(a.lastActive),
        );
        return (
          <div key={c.id} className="kanban-coluna">
            <div className="kanban-topo">
              <i style={{ background: c.cor }} />
              <span>{c.nome}</span>
              <b>{ls.length}</b>
            </div>
            <div className="kanban-cartoes">
              {ls.slice(0, LIMITE).map((l) => {
                const nomeSdr = l.memberId ? sdr.get(l.memberId) : "";
                return (
                  <button
                    key={l.id}
                    className="kanban-cartao"
                    onClick={() => abrir(l)}
                  >
                    <span className="kanban-nome">
                      {l.name}
                      {Date.parse(l.createdAt) >= hoje.getTime() && (
                        <em>Novo</em>
                      )}
                    </span>
                    <Etiquetas lead={l} snap={snap} cfg={cfg} so="car" />
                    {l.waiting && (
                      <span className="etiqueta atencao">
                        Aguardando resposta
                      </span>
                    )}
                    <span className="kanban-rodape">
                      <span>{nomeSdr ? nomeSdr.split(" ")[0] : "sem SDR"}</span>
                      <span>{fmt.data(l.lastActive)}</span>
                    </span>
                  </button>
                );
              })}
              {ls.length > LIMITE && (
                <p className="hint">
                  +{ls.length - LIMITE} leads (use os filtros)
                </p>
              )}
              {!ls.length && <p className="hint">nenhum lead</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Leads
type ColunaOrdem = "name" | "car" | "status" | "member" | "lastActive";

function ListaLeads({
  snap,
  cfg,
  leads,
  abrir,
}: {
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  leads: LeadCrm[];
  abrir: (l: LeadCrm) => void;
}) {
  const [ordem, setOrdem] = useState<{ k: ColunaOrdem; dir: 1 | -1 }>({
    k: "lastActive",
    dir: -1,
  });
  const etiq = mapaEtiquetas(snap);
  const sdr = mapaSdr(snap);
  const linha = (l: LeadCrm) => {
    const st = statusDoLead(l, cfg.statusOrder);
    return {
      name: l.name,
      car: l.tagIds
        .filter((t) => categoria(cfg, t) === "car")
        .map((t) => etiq.get(t)?.name)
        .filter(Boolean)
        .join(", "),
      status: st === NENHUM ? "" : (etiq.get(st)?.name ?? ""),
      member: l.memberId ? (sdr.get(l.memberId) ?? "") : "",
      lastActive: l.lastActive,
    };
  };
  const linhas = leads
    .map((l) => ({ l, r: linha(l) }))
    .sort((a, b) => {
      const x = a.r[ordem.k];
      const y = b.r[ordem.k];
      return (
        (ordem.k === "lastActive"
          ? Date.parse(x) - Date.parse(y)
          : x.localeCompare(y, "pt-BR")) * ordem.dir
      );
    });
  const cab = (k: ColunaOrdem, r: string) => (
    <th>
      <button
        className="ordenar"
        onClick={() =>
          setOrdem({ k, dir: ordem.k === k ? (-ordem.dir as 1 | -1) : 1 })
        }
      >
        {r}
        {ordem.k === k ? (ordem.dir > 0 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const exportar = () =>
    baixarCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Lead",
        "Telefone",
        "Carro",
        "Status",
        "SDR",
        "Criado em",
        "Última atividade",
      ],
      ...linhas.map(({ l, r }) => [
        r.name,
        l.phone,
        r.car,
        r.status,
        r.member,
        fmt.data(l.createdAt),
        fmt.data(l.lastActive),
      ]),
    ]);
  return (
    <div className="panel">
      <div className="actions">
        <h2>
          Leads{" "}
          <span className="vitrine-total">· {fmt.int(linhas.length)}</span>
        </h2>
        <button onClick={exportar} disabled={!linhas.length}>
          Exportar CSV
        </button>
      </div>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              {cab("name", "Lead")}
              {cab("car", "Carro")}
              {cab("status", "Status")}
              {cab("member", "SDR")}
              {cab("lastActive", "Última atividade")}
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 500).map(({ l, r }) => (
              <tr
                key={l.id}
                className="clicavel"
                tabIndex={0}
                onClick={() => abrir(l)}
                onKeyDown={(e) => e.key === "Enter" && abrir(l)}
              >
                <td>
                  <span className="quem">
                    <Avatar nome={l.name} />
                    <span>
                      {l.name}
                      <small>{l.phone}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <Etiquetas lead={l} snap={snap} cfg={cfg} so="car" />
                </td>
                <td>
                  <Etiquetas lead={l} snap={snap} cfg={cfg} so="status" />
                </td>
                <td>{r.member || <span className="hint">—</span>}</td>
                <td className="num">{fmt.data(l.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length > 500 && (
        <p className="hint">
          Mostrando 500 de {fmt.int(linhas.length)}. Use os filtros ou exporte o
          CSV.
        </p>
      )}
      {!linhas.length && <Vazio titulo="Nenhum lead com esses filtros" />}
    </div>
  );
}

// ------------------------------------------------------------------ Atividade
const FILTROS_ATIVIDADE = [
  ["", "Tudo"],
  ["novo", "Novos leads"],
  ["tag", "Etiquetas"],
  ["sdr", "Troca de SDR"],
] as const;

function Atividade({
  eventos,
  intervalo,
}: {
  eventos: EventoCrm[];
  intervalo: number;
}) {
  const [f, setF] = useState<(typeof FILTROS_ATIVIDADE)[number][0]>("");
  const lista = eventos.filter(
    (e) => !f || (f === "tag" ? e.type.startsWith("tag") : e.type === f),
  );
  return (
    <div className="panel">
      <div className="actions">
        <h2>Atividade</h2>
        <Segmentado
          pequeno
          rotulo="Tipo de evento"
          opcoes={FILTROS_ATIVIDADE}
          valor={f}
          aoMudar={setF}
        />
      </div>
      <p className="dica-crm">
        {fmt.int(lista.length)} eventos · confere o uTalk a cada {intervalo} s
        enquanto esta página está aberta.
      </p>
      {lista.length ? (
        <ul className="feed">
          {lista.slice(0, 300).map((e, i) => (
            <li
              key={i}
              className={
                e.type === "novo"
                  ? "novo"
                  : e.type === "sdr"
                    ? "sdr"
                    : e.type === "tag+"
                      ? "mais"
                      : "menos"
              }
            >
              <b aria-hidden="true">
                {e.type === "novo"
                  ? "★"
                  : e.type === "sdr"
                    ? "↻"
                    : e.type === "tag+"
                      ? "+"
                      : "−"}
              </b>
              <span>
                {e.text}
                {e.tags?.length ? ` · ${e.tags.join(", ")}` : ""}
              </span>
              <time>{fmt.data(e.at)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio titulo="Nada mudou ainda">
          Novos leads, troca de etiqueta e troca de SDR aparecem aqui a cada
          atualização.
        </Vazio>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Detalhe
function DetalheLead({
  lead: l,
  snap,
  cfg,
  fechar,
}: {
  lead: LeadCrm;
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  fechar: () => void;
}) {
  const sdr = mapaSdr(snap);
  const digitos = l.phone.replace(/\D/g, "");
  return (
    <Gaveta titulo={`Lead ${l.name}`} fechar={fechar}>
      <Avatar nome={l.name} />
      <h2>{l.name}</h2>
      <p className="hint">
        {l.chatOpen ? "Atendimento aberto" : "Atendimento fechado"}
        {l.waiting ? " · aguardando resposta" : ""}
      </p>
      <Etiquetas lead={l} snap={snap} cfg={cfg} />
      {digitos && (
        <p>
          <button
            className="primary"
            onClick={() => void openUrl(`https://wa.me/${digitos}`)}
          >
            Abrir no WhatsApp
          </button>
        </p>
      )}
      <dl className="ficha-lead">
        <dt>Telefone</dt>
        <dd>{l.phone || "—"}</dd>
        <dt>E-mail</dt>
        <dd>{l.email || "—"}</dd>
        <dt>SDR</dt>
        <dd>{(l.memberId && sdr.get(l.memberId)) || "—"}</dd>
        <dt>Setor</dt>
        <dd>{l.sector || "—"}</dd>
        <dt>Criado em</dt>
        <dd>{fmt.data(l.createdAt)}</dd>
        <dt>Última atividade</dt>
        <dd>{fmt.data(l.lastActive)}</dd>
        <dt>Atendimentos</dt>
        <dd>{l.totalChats}</dd>
      </dl>
      {l.actions.length > 0 && (
        <>
          <h3>Ações dos SDRs</h3>
          <ul className="linha-tempo">
            {[...l.actions]
              .reverse()
              .slice(0, 30)
              .map((a, i) => (
                <li key={i}>
                  <time>{fmt.data(a.at)}</time>
                  {sdr.get(a.memberId) ?? "SDR"} acionou <b>{a.title}</b>
                  {a.trigger && a.trigger !== a.title ? ` → ${a.trigger}` : ""}
                </li>
              ))}
          </ul>
        </>
      )}
    </Gaveta>
  );
}
