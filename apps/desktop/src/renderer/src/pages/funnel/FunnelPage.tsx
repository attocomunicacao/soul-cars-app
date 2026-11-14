/**
 * Página Funil Meta Ads → CRM (vinda do Soul APP): do anúncio ao agendamento. Topo no Meta
 * (impressões, cliques, conversas), resto no uTalk (leads, calls, quentes/frios, agendados),
 * com custo por etapa, diagnóstico, tabelas por produto e por campanha, a lista dos leads
 * do período e as Regras (papel de cada etiqueta e produto de cada campanha).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SnapshotCrm } from "../../../../shared/crm-leads";
import {
  PAPEIS,
  PERIODOS_FUNIL,
  ROTULO_PAPEL,
  SEM_PRODUTO,
  calcularFunil,
  diagnosticar,
  etiquetasDeProduto,
  normalizar,
  produtoDaCampanha,
  type ConfigFunil,
  type Intervalo,
  type MetaFunil,
  type Papel,
  type PresetFunil,
  type TotaisCrm,
  type TotaisMeta,
} from "../../../../shared/funnel";
import { Colunas, Linha, diasEntre } from "../../app/charts";
import {
  Avatar,
  Destaques,
  Kpi,
  Segmentado,
  Vazio,
  fmt,
} from "../../app/components";
import { Icon } from "../../app/icons";
import { invoke } from "../../lib/desktop-bridge";

type Dados = {
  config: ConfigFunil;
  range: Intervalo;
  meta: MetaFunil | null;
  crm: SnapshotCrm | null;
  origemCrm: "crm" | "propria" | null;
  erros: { meta?: string; crm?: string };
  conexoes: { meta: boolean; crm: boolean };
};
type Visao = "funil" | "leads" | "regras";
const VISOES = [
  ["funil", "Funil completo"],
  ["leads", "Leads do funil"],
  ["regras", "Regras"],
] as const;
const ETAPAS = [
  ["", "Todas"],
  ["none", "Sem call"],
  ["call1", "Call 1"],
  ["call2", "Call 2"],
  ["call3", "Call 3"],
  ["quente", "Quentes"],
  ["frio", "Frios"],
  ["agendado", "Agendados"],
  ["desq", "Desq."],
] as const;
type Etapa = (typeof ETAPAS)[number][0];
const por = (gasto: number, n: number) =>
  n > 0 && gasto > 0 ? gasto / n : null;

export function FunnelPage({
  aoErro,
  abrirConfiguracoes,
}: {
  aoErro: (m: string) => void;
  abrirConfiguracoes: () => void;
}) {
  const [d, setD] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [visao, setVisao] = useState<Visao>("funil");
  const [produto, setProduto] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("");
  const [datas, setDatas] = useState({ since: "", until: "" });

  const carregar = useCallback(
    async (forcar = false) => {
      setCarregando(true);
      try {
        const r = await invoke<Dados>("funil_dados", { forcar });
        setD(r);
        setDatas(r.range);
      } catch (e) {
        aoErro(String(e));
      } finally {
        setCarregando(false);
      }
    },
    [aoErro],
  );

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 5 * 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const salvar = async (patch: Partial<ConfigFunil>) => {
    try {
      await invoke("funil_config_salvar", { patch });
      await carregar();
    } catch (e) {
      aoErro(String(e));
    }
  };

  const calc = useMemo(
    () => (d ? calcularFunil(d.meta, d.crm, d.config, d.range, produto) : null),
    [d, produto],
  );

  if (!d || !calc)
    return (
      <p className="empty">
        {carregando ? "Buscando Meta e uTalk…" : "Carregando…"}
      </p>
    );
  const produtos = etiquetasDeProduto(d.crm, d.config);
  const semConexao = !d.conexoes.meta && !d.conexoes.crm;

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Meta Ads → CRM</p>
          <h1>Funil</h1>
          <p>
            {fmt.dataBR(d.range.since)} a {fmt.dataBR(d.range.until)} · leads
            pela data de entrada no CRM
          </p>
        </div>
        <div className="actions">
          <span className="pilula-dupla">
            <span
              className={`pilula ${d.erros.meta ? "erro" : d.meta ? "ok" : ""}`}
            >
              <i />
              Meta
            </span>
            <span
              className={`pilula ${d.erros.crm ? "erro" : d.crm ? "ok" : ""}`}
              title={
                d.origemCrm === "crm"
                  ? "Leads do módulo CRM · Leads (sem busca a mais)"
                  : undefined
              }
            >
              <i />
              CRM{d.origemCrm === "crm" ? " · via Leads" : ""}
            </span>
          </span>
          <button disabled={carregando} onClick={() => void carregar(true)}>
            <Icon nome="recarregar" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
      {semConexao ? (
        <div className="panel">
          <Vazio
            titulo="Conecte o Meta e o uTalk"
            acao={
              <button className="primary" onClick={abrirConfiguracoes}>
                Abrir Conexões
              </button>
            }
          >
            O funil junta os números do Meta Ads (até as conversas) com os leads
            do uTalk (das calls ao agendamento).
          </Vazio>
        </div>
      ) : (
        <>
          {(["meta", "crm"] as const).map(
            (k) =>
              d.erros[k] && (
                <div key={k} role="alert" className="notice error com-fechar">
                  <span>
                    {k === "meta" ? "Meta Ads" : "CRM"}: {d.erros[k]}
                  </span>
                  <button className="plain small" onClick={abrirConfiguracoes}>
                    Conexões
                  </button>
                </div>
              ),
          )}
          <div className="filtros">
            <Segmentado
              rotulo="Visão"
              opcoes={VISOES}
              valor={visao}
              aoMudar={setVisao}
            />
            {visao !== "regras" && (
              <>
                <Segmentado
                  pequeno
                  rotulo="Período"
                  opcoes={PERIODOS_FUNIL}
                  valor={d.config.period.preset}
                  aoMudar={(p: PresetFunil) =>
                    p === "custom"
                      ? setD({
                          ...d,
                          config: {
                            ...d.config,
                            period: { ...d.config.period, preset: "custom" },
                          },
                        })
                      : void salvar({
                          period: { preset: p, since: "", until: "" },
                        })
                  }
                />
                {d.config.period.preset === "custom" && (
                  <span className="datas">
                    <input
                      type="date"
                      aria-label="Início"
                      value={datas.since}
                      onChange={(e) =>
                        setDatas({ ...datas, since: e.target.value })
                      }
                    />
                    <input
                      type="date"
                      aria-label="Fim"
                      value={datas.until}
                      onChange={(e) =>
                        setDatas({ ...datas, until: e.target.value })
                      }
                    />
                    <button
                      className="small"
                      disabled={
                        !datas.since ||
                        !datas.until ||
                        datas.since > datas.until
                      }
                      onClick={() =>
                        void salvar({ period: { preset: "custom", ...datas } })
                      }
                    >
                      Aplicar
                    </button>
                  </span>
                )}
                <label className="campo-inline">
                  Produto
                  <select
                    value={produto}
                    onChange={(e) => setProduto(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value={SEM_PRODUTO}>Sem produto</option>
                  </select>
                </label>
              </>
            )}
          </div>
          {visao === "funil" ? (
            <FunilCompleto
              d={d}
              m={calc.m}
              c={calc.c}
              produto={produto}
              setProduto={setProduto}
              verSemCall={() => {
                setEtapa("none");
                setVisao("leads");
              }}
            />
          ) : visao === "leads" ? (
            <LeadsDoFunil d={d} c={calc.c} etapa={etapa} setEtapa={setEtapa} />
          ) : (
            <Regras d={d} salvar={salvar} />
          )}
        </>
      )}
    </section>
  );
}

function FunilCompleto({
  d,
  m,
  c,
  produto,
  setProduto,
  verSemCall,
}: {
  d: Dados;
  m: TotaisMeta;
  c: TotaisCrm;
  produto: string;
  setProduto: (p: string) => void;
  verSemCall: () => void;
}) {
  const produtos = etiquetasDeProduto(d.crm, d.config);
  const porProduto = [
    ...produtos.map((p) => ({ id: p.id, nome: p.name })),
    { id: SEM_PRODUTO, nome: "Sem produto" },
  ]
    .map((p) => ({
      ...p,
      ...calcularFunil(d.meta, d.crm, d.config, d.range, p.id),
    }))
    .filter((r) => r.m.spend > 0 || r.c.leads > 0)
    .sort((a, b) => b.m.spend - a.m.spend);
  const destaques = diagnosticar(
    m,
    c,
    produto
      ? []
      : porProduto
          .filter((p) => p.id !== SEM_PRODUTO)
          .map((p) => ({
            nome: p.nome,
            spend: p.m.spend,
            agendado: p.c.agendado,
          })),
  );
  const topo = Math.max(m.impressions, c.leads, 1);
  const larg = (v: number) =>
    v > 0 ? 8 + 92 * (Math.log10(v + 1) / Math.log10(topo + 1)) : 4;
  const sp = m.spend;
  type Etapa = {
    nome: string;
    sub?: string;
    valor: number;
    fonte: "meta" | "crm";
    taxa?: string;
    base?: string;
    custo?: number | null;
    custoRot?: string;
    partes?: [number, string][];
  };
  const etapas: Etapa[] = [
    {
      nome: "Impressões",
      valor: m.impressions,
      fonte: "meta",
      custo: m.impressions ? (sp / m.impressions) * 1000 : null,
      custoRot: "CPM",
    },
    {
      nome: d.config.clickMetric === "clicks" ? "Cliques" : "Cliques no link",
      valor: m.clicks,
      fonte: "meta",
      taxa: fmt.pct(m.clicks, m.impressions),
      base: "CTR",
      custo: por(sp, m.clicks),
      custoRot: "por clique",
    },
    {
      nome: "Conversas iniciadas",
      sub: "mensagens recebidas",
      valor: m.conversations,
      fonte: "meta",
      taxa: fmt.pct(m.conversations, m.clicks),
      base: "dos cliques",
      custo: por(sp, m.conversations),
      custoRot: "por conversa",
    },
    {
      nome: "Leads no CRM",
      sub: "contatos criados",
      valor: c.leads,
      fonte: "crm",
      taxa: fmt.pct(c.leads, m.conversations),
      base: "das conversas",
      custo: por(sp, c.leads),
      custoRot: "por lead",
    },
    {
      nome: "Call 1",
      valor: c.call1,
      fonte: "crm",
      taxa: fmt.pct(c.call1, c.leads),
      base: "dos leads",
      custo: por(sp, c.call1),
      custoRot: "por call 1",
    },
    {
      nome: "Call 2",
      valor: c.call2,
      fonte: "crm",
      taxa: fmt.pct(c.call2, c.call1),
      base: "da call 1",
      custo: por(sp, c.call2),
      custoRot: "por call 2",
    },
    {
      nome: "Call 3",
      valor: c.call3,
      fonte: "crm",
      taxa: fmt.pct(c.call3, c.call2),
      base: "da call 2",
      custo: por(sp, c.call3),
      custoRot: "por call 3",
    },
    {
      nome: "Quente ou frio",
      sub: `${fmt.pct(c.quente, c.quente + c.frio)} quentes`,
      valor: c.quente + c.frio,
      fonte: "crm",
      taxa: fmt.pct(c.qualified, c.call1),
      base: "da call 1",
      custo: por(sp, c.quente),
      custoRot: "por quente",
      partes: [
        [c.quente, "Quente"],
        [c.frio, "Frio"],
      ],
    },
    {
      nome: "Agendado ou desq.",
      sub: `${fmt.pct(c.agendado, c.agendado + c.desq)} agendados`,
      valor: c.agendado + c.desq,
      fonte: "crm",
      taxa: fmt.pct(c.agendado, c.leads),
      base: "dos leads",
      custo: por(sp, c.agendado),
      custoRot: "por agendamento",
      partes: [
        [c.agendado, "Agendado"],
        [c.desq, "Desq."],
      ],
    },
  ];
  const dias = diasEntre(d.range.since, d.range.until);
  const campanhas = (d.meta?.campaigns ?? [])
    .map((camp) => {
      const a = { spend: 0, impressions: 0, clicks: 0, conv: 0 };
      for (const r of d.meta!.daily) {
        if (
          r.campaignId !== camp.id ||
          r.date < d.range.since ||
          r.date > d.range.until
        )
          continue;
        a.spend += r.spend;
        a.impressions += r.impressions;
        a.clicks += d.config.clickMetric === "clicks" ? r.clicks : r.linkClicks;
        a.conv += r.conversations;
      }
      return { camp, a, p: produtoDaCampanha(camp, produtos, d.config) };
    })
    .filter(
      (x) =>
        x.a.impressions > 0 &&
        (produto === "" || (produto === SEM_PRODUTO ? !x.p : x.p === produto)),
    )
    .sort((a, b) => b.a.spend - a.a.spend);
  const nomeProduto = new Map(produtos.map((p) => [p.id, p.name]));

  return (
    <div className="pilha">
      <div className="kpis seis">
        <Kpi
          destaque
          rotulo="Investimento"
          valor={fmt.moeda(m.spend)}
          apoio={`${fmt.int(m.impressions)} impressões`}
          titulo="Dado do Meta Ads"
        />
        <Kpi
          rotulo="Conversas iniciadas"
          valor={fmt.int(m.conversations)}
          apoio={`${fmt.moeda(por(sp, m.conversations))} por conversa`}
          titulo="Dado do Meta Ads"
        />
        <Kpi
          rotulo="Leads no CRM"
          valor={fmt.int(c.leads)}
          apoio={`${fmt.pct(c.leads, m.conversations)} das conversas`}
          titulo="Dado do CRM"
        />
        <Kpi
          rotulo="Fizeram call 1"
          valor={fmt.int(c.call1)}
          apoio={`${fmt.pct(c.call1, c.leads)} dos leads`}
          titulo="Dado do CRM"
        />
        <Kpi
          rotulo="Quentes"
          valor={fmt.int(c.quente)}
          apoio={`${fmt.pct(c.quente, c.qualified)} dos qualificados`}
          titulo="Dado do CRM"
        />
        <Kpi
          rotulo="Agendados"
          valor={fmt.int(c.agendado)}
          apoio={`${fmt.moeda(por(sp, c.agendado))} por agendamento`}
          titulo="Dado do CRM"
        />
      </div>
      <div className="duas-colunas larga-estreita">
        <div className="panel">
          <div className="actions">
            <h2>Funil completo</h2>
            <span className="hint">
              largura em escala log · % = conversão da etapa anterior
            </span>
          </div>
          <div className="funil">
            {etapas.map((e, i) => (
              <div key={e.nome}>
                {(i === 0 || etapas[i - 1].fonte !== e.fonte) && (
                  <p className={`funil-secao ${e.fonte}`}>
                    {e.fonte === "meta" ? "Meta Ads" : "CRM · uTalk"}
                  </p>
                )}
                <div className="funil-linha">
                  <span className="funil-nome">
                    {e.nome}
                    {e.sub && <small>{e.sub}</small>}
                  </span>
                  <span className="funil-trilho">
                    <span
                      className={`funil-barra ${e.fonte}`}
                      style={{ width: `${larg(e.valor)}%` }}
                    >
                      {e.partes && e.valor > 0
                        ? e.partes
                            .filter(([v]) => v > 0)
                            .map(([v, r], j) => (
                              <span
                                key={r}
                                className={`parte p${j}`}
                                style={{ flex: v }}
                                title={`${r}: ${fmt.int(v)}`}
                              >
                                {v / e.valor >= 0.35 && larg(e.valor) > 30
                                  ? `${r} ${fmt.int(v)}`
                                  : fmt.int(v)}
                              </span>
                            ))
                        : fmt.int(e.valor)}
                    </span>
                  </span>
                  <span className="funil-dados">
                    {e.taxa && (
                      <>
                        <b>{e.taxa}</b> {e.base}
                        <br />
                      </>
                    )}
                    {e.custo != null && `${fmt.moeda(e.custo)} ${e.custoRot}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Diagnóstico</h2>
          <Destaques
            itens={destaques}
            vazio="Sem dados ainda. Confira as conexões em Configurações."
          />
          {c.noCall > 0 && (
            <button className="plain" onClick={verSemCall}>
              Ver os {fmt.int(c.noCall)} leads sem call
            </button>
          )}
        </div>
      </div>
      <div className="duas-colunas">
        <div className="panel">
          <h2>Conversas × leads por dia</h2>
          <Colunas
            rotulo="Conversas do Meta e leads no CRM por dia"
            dias={dias}
            series={[
              {
                nome: "Conversas (Meta)",
                cor: "var(--dado-meta)",
                valores: dias.map((x) => m.byDay[x] ?? 0),
              },
              {
                nome: "Leads no CRM",
                cor: "var(--dado-crm)",
                valores: dias.map((x) => c.byDay[x]?.leads ?? 0),
              },
            ]}
          />
        </div>
        <div className="panel">
          <h2>Agendados por dia</h2>
          <Linha
            rotulo="Agendados por dia"
            dias={dias}
            serie={{
              nome: "Agendados",
              cor: "var(--dado-crm)",
              valores: dias.map((x) => c.byDay[x]?.agendado ?? 0),
            }}
          />
        </div>
      </div>
      <div className="panel">
        <h2>Por produto</h2>
        {porProduto.length ? (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="n">Investimento</th>
                  <th className="n">Conversas</th>
                  <th className="n">Custo/conv.</th>
                  <th className="n">Leads</th>
                  <th className="n">Call 1</th>
                  <th className="n">Quentes</th>
                  <th className="n">Agend.</th>
                  <th className="n">Conv.→agend.</th>
                  <th className="n">Custo/agend.</th>
                </tr>
              </thead>
              <tbody>
                {porProduto.map((r) => (
                  <tr
                    key={r.id}
                    className={`clicavel${produto === r.id ? " ativo" : ""}`}
                    onClick={() => setProduto(produto === r.id ? "" : r.id)}
                  >
                    <td>
                      {r.id === SEM_PRODUTO ? (
                        <span className="hint">Sem produto</span>
                      ) : (
                        <span className="etiqueta carro">{r.nome}</span>
                      )}
                    </td>
                    <td className="n">{fmt.moeda(r.m.spend)}</td>
                    <td className="n">{fmt.int(r.m.conversations)}</td>
                    <td className="n">
                      {fmt.moeda(por(r.m.spend, r.m.conversations))}
                    </td>
                    <td className="n">{fmt.int(r.c.leads)}</td>
                    <td className="n">{fmt.int(r.c.call1)}</td>
                    <td className="n">{fmt.int(r.c.quente)}</td>
                    <td className="n">{fmt.int(r.c.agendado)}</td>
                    <td className="n">
                      {fmt.pct(r.c.agendado, r.m.conversations)}
                    </td>
                    <td className="n">
                      {fmt.moeda(por(r.m.spend, r.c.agendado))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">
            Marque etiquetas como “Produto” na aba Regras para ver o funil por
            produto.
          </p>
        )}
      </div>
      <div className="panel">
        <h2>Por campanha</h2>
        {campanhas.length ? (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Produto</th>
                  <th className="n">Investimento</th>
                  <th className="n">Impressões</th>
                  <th className="n">Cliques</th>
                  <th className="n">CTR</th>
                  <th className="n">Conversas</th>
                  <th className="n">Custo/conversa</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map(({ camp, a, p }) => (
                  <tr key={camp.id}>
                    <td>{camp.name}</td>
                    <td>
                      {p ? (
                        <span className="etiqueta carro">
                          {nomeProduto.get(p)}
                        </span>
                      ) : (
                        <span className="hint">—</span>
                      )}
                    </td>
                    <td className="n">
                      <b>{fmt.moeda(a.spend)}</b>
                    </td>
                    <td className="n">{fmt.int(a.impressions)}</td>
                    <td className="n">{fmt.int(a.clicks)}</td>
                    <td className="n">{fmt.pct(a.clicks, a.impressions)}</td>
                    <td className="n">{fmt.int(a.conv)}</td>
                    <td className="n">{fmt.moeda(por(a.spend, a.conv))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">Sem campanhas com veiculação no período.</p>
        )}
      </div>
    </div>
  );
}

function LeadsDoFunil({
  d,
  c,
  etapa,
  setEtapa,
}: {
  d: Dados;
  c: TotaisCrm;
  etapa: Etapa;
  setEtapa: (e: Etapa) => void;
}) {
  const [busca, setBusca] = useState("");
  const nomeTag = new Map((d.crm?.tags ?? []).map((t) => [t.id, t.name]));
  const sdr = new Map((d.crm?.members ?? []).map((m) => [m.id, m.name]));
  const q = normalizar(busca);
  const lista = c.list
    .filter(({ info: i }) =>
      !etapa ? true : etapa === "none" ? !i.call1 : i[etapa],
    )
    .filter(
      (x) =>
        !q ||
        normalizar(
          `${x.lead.name} ${x.lead.phone} ${sdr.get(x.lead.memberId ?? "") ?? ""} ${x.lead.tagIds.map((t) => nomeTag.get(t)).join(" ")}`,
        ).includes(q),
    )
    .sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt));
  return (
    <div className="panel">
      <div className="actions">
        <h2>
          Leads do funil{" "}
          <span className="vitrine-total">· {fmt.int(lista.length)}</span>
        </h2>
        <label className="search">
          <Icon nome="busca" />
          <input
            aria-label="Buscar no funil"
            placeholder="Nome, telefone, SDR ou etiqueta"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
      </div>
      <Segmentado
        pequeno
        rotulo="Etapa"
        opcoes={ETAPAS}
        valor={etapa}
        aoMudar={setEtapa}
      />
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Produto</th>
              <th>Etapa</th>
              <th>SDR</th>
              <th>Entrada</th>
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, 800).map(({ lead: l, info: i }) => (
              <tr key={l.id}>
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
                  {i.products.map((p) => (
                    <span key={p} className="etiqueta carro">
                      {nomeTag.get(p)}
                    </span>
                  ))}
                </td>
                <td>
                  <span className="etiquetas">
                    {i.maxCall ? (
                      <span className="etiqueta">Call {i.maxCall}</span>
                    ) : (
                      <span className="etiqueta apagada">sem call</span>
                    )}
                    {i.quente && (
                      <span className="etiqueta quente">Quente</span>
                    )}
                    {i.frio && <span className="etiqueta frio">Frio</span>}
                    {i.agendado && (
                      <span className="etiqueta bom">Agendado</span>
                    )}
                    {i.desq && (
                      <span className="etiqueta apagada">Desqualificado</span>
                    )}
                  </span>
                </td>
                <td>
                  {sdr.get(l.memberId ?? "") ?? <span className="hint">—</span>}
                </td>
                <td className="num">{fmt.data(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lista.length > 800 && (
        <p className="hint">
          Mostrando 800 de {fmt.int(lista.length)}. Use a busca para filtrar.
        </p>
      )}
      {!lista.length && <Vazio titulo="Nenhum lead nesta etapa" />}
    </div>
  );
}

function Regras({
  d,
  salvar,
}: {
  d: Dados;
  salvar: (p: Partial<ConfigFunil>) => Promise<void>;
}) {
  const produtos = etiquetasDeProduto(d.crm, d.config);
  const tags = [...(d.crm?.tags ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  return (
    <div className="pilha">
      <div className="panel">
        <h2>Como contar</h2>
        <label className="linha-opcao">
          <input
            type="checkbox"
            checked={d.config.cumulative}
            onChange={(e) => void salvar({ cumulative: e.target.checked })}
          />
          Call 3 também conta como call 2 e call 1 (e quente, frio ou agendado
          contam como call 1)
        </label>
        <label className="campo-inline">
          Cliques do Meta
          <select
            value={d.config.clickMetric}
            onChange={(e) =>
              void salvar({
                clickMetric: e.target.value as ConfigFunil["clickMetric"],
              })
            }
          >
            <option value="linkClicks">Cliques no link</option>
            <option value="clicks">Todos os cliques</option>
          </select>
        </label>
      </div>
      <div className="panel">
        <h2>Papel de cada etiqueta do uTalk</h2>
        <p className="dica-crm">
          Sugeridos pelo nome; ajuste os que estiverem errados. “Produto” liga o
          lead ao carro anunciado.
        </p>
        {tags.length ? (
          <div className="grade-regras">
            {tags.map((t) => (
              <label key={t.id} className="campo-inline">
                <span className="regra-nome">{t.name}</span>
                <select
                  value={d.config.tagRoles[t.id] ?? ""}
                  onChange={(e) =>
                    void salvar({
                      tagRoles: {
                        ...d.config.tagRoles,
                        [t.id]: e.target.value as Papel,
                      },
                    })
                  }
                >
                  {(["", ...PAPEIS] as Papel[]).map((p) => (
                    <option key={p} value={p}>
                      {ROTULO_PAPEL[p]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : (
          <p className="hint">
            As etiquetas aparecem depois da primeira leitura do uTalk.
          </p>
        )}
      </div>
      <div className="panel">
        <h2>Produto de cada campanha</h2>
        <p className="dica-crm">
          Automático pelo nome da campanha; escolha outro se o app errar.
        </p>
        {(d.meta?.campaigns ?? []).length ? (
          <div className="grade-regras">
            {d.meta!.campaigns.map((c) => {
              const escolhido = d.config.campaignProducts[c.id];
              const auto = produtoDaCampanha(c, produtos, {
                ...d.config,
                campaignProducts: {},
              });
              return (
                <label key={c.id} className="campo-inline">
                  <span className="regra-nome">{c.name}</span>
                  <select
                    value={escolhido === undefined ? "__auto" : escolhido}
                    onChange={(e) => {
                      const novo = { ...d.config.campaignProducts };
                      if (e.target.value === "__auto") delete novo[c.id];
                      else novo[c.id] = e.target.value;
                      void salvar({ campaignProducts: novo });
                    }}
                  >
                    <option value="__auto">
                      Automático (
                      {produtos.find((p) => p.id === auto)?.name ?? "nenhum"})
                    </option>
                    <option value="">Nenhum</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="hint">
            As campanhas aparecem depois da leitura do Meta no período.
          </p>
        )}
      </div>
    </div>
  );
}
