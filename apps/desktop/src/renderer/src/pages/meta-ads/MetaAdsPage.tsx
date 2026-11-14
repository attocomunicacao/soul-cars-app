/**
 * Página Meta Ads (vinda do Soul APP): saúde da conta, números do período comparados com o
 * anterior, gasto e eficiência por dia, funil, público e posicionamentos (Visão geral) e a
 * tabela de campanhas ativas com situação e alertas (Campanhas). Só leitura da Graph API;
 * campanhas se editam no Gerenciador (item "Gerenciador de Anúncios" do menu).
 */
import { useCallback, useEffect, useState } from "react";
import {
  PERIODOS_META,
  alertas,
  destaquesMeta,
  faixaDeSaude,
  nomeGenero,
  notaDeSaude,
  rotuloResultado,
  situacaoDaCampanha,
  variacao,
  type ConfigMeta,
  type DadosMeta,
  type LinhaCampanha,
  type PresetMeta,
} from "../../../../shared/meta-ads";
import { Barras, Colunas, Linha, Mini } from "../../app/charts";
import {
  Destaques,
  Kpi,
  Segmentado,
  Selo,
  Variacao,
  Vazio,
  baixarCsv,
  fmt,
  ha,
  textoDoErro,
} from "../../app/components";
import { Icon } from "../../app/icons";
import { invoke } from "../../lib/desktop-bridge";

type Resposta = { dados: DadosMeta; config: ConfigMeta };
type Visao = "geral" | "campanhas";
const VISOES = [
  ["geral", "Visão geral"],
  ["campanhas", "Campanhas"],
] as const;

const PLATAFORMA: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  threads: "Threads",
};

export function MetaAdsPage({
  aoErro,
  abrirConfiguracoes,
}: {
  aoErro: (m: string) => void;
  abrirConfiguracoes: () => void;
}) {
  const [estado, setEstado] = useState<{
    configurado: boolean;
    conta: string;
  } | null>(null);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [visao, setVisao] = useState<Visao>("geral");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [preset, setPreset] = useState<PresetMeta | null>(null);

  const carregar = useCallback(async (p?: PresetMeta) => {
    setCarregando(true);
    try {
      const r = await invoke<Resposta>("meta_painel", p ? { preset: p } : {});
      setResp(r);
      setPreset(r.config.datePreset);
      setErro("");
    } catch (e) {
      setErro(textoDoErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    invoke<{ configurado: boolean; conta: string }>("meta_estado")
      .then((e) => {
        if (!vivo) return;
        setEstado(e);
        if (e.configurado && e.conta) void carregar();
      })
      .catch((e) => aoErro(String(e)));
    return () => {
      vivo = false;
    };
  }, [carregar, aoErro]);

  // Atualiza sozinho a cada 5 minutos enquanto a página está aberta.
  const pronto = !!estado?.configurado;
  useEffect(() => {
    if (!pronto) return;
    const t = setInterval(() => void carregar(), 5 * 60_000);
    return () => clearInterval(t);
  }, [pronto, carregar]);

  if (!estado) return <p className="empty">Carregando…</p>;

  const d = resp?.dados;
  const cabecalho = (
    <div className="page-head">
      <div>
        <p className="eyebrow">Meta Ads</p>
        <h1>Campanhas</h1>
        <p>
          {d
            ? `${fmt.dataBR(d.period.cur[0])} a ${fmt.dataBR(d.period.cur[1])} · comparado com ${fmt.dataBR(d.period.prev[0])} a ${fmt.dataBR(d.period.prev[1])}`
            : "Desempenho das campanhas ativas, direto da sua conta de anúncios."}
        </p>
      </div>
      <div className="actions">
        {d && (
          <span
            className={`pilula ${erro ? "erro" : carregando ? "sync" : "ok"}`}
          >
            <i />
            {erro
              ? "Erro ao atualizar"
              : carregando
                ? "Atualizando…"
                : `Atualizado ${ha(d.updatedAt)}`}
          </span>
        )}
        <button
          disabled={!pronto || carregando}
          onClick={() => void carregar()}
        >
          <Icon nome="recarregar" />
          Atualizar
        </button>
      </div>
    </div>
  );

  if (!estado.configurado || !estado.conta)
    return (
      <section>
        {cabecalho}
        <div className="panel">
          <Vazio
            titulo="Conecte sua conta de anúncios"
            acao={
              <button className="primary" onClick={abrirConfiguracoes}>
                Abrir Conexões
              </button>
            }
          >
            Cole um token do Meta com permissão de leitura de anúncios
            (ads_read) e o ID da conta em Configurações › Conexões. O app só lê
            os números: nada muda nas campanhas.
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
        <Segmentado
          pequeno
          rotulo="Período"
          opcoes={PERIODOS_META}
          valor={preset ?? "last_7d"}
          aoMudar={(p) => {
            setPreset(p);
            void carregar(p);
          }}
        />
      </div>
      {!d ? (
        <div className="panel">
          <Vazio
            titulo={
              carregando ? "Buscando os números no Meta…" : "Sem dados ainda"
            }
          />
        </div>
      ) : visao === "geral" ? (
        <VisaoGeral d={d} cfg={resp!.config} />
      ) : (
        <Campanhas d={d} cfg={resp!.config} />
      )}
    </section>
  );
}

const serieDe = (
  d: DadosMeta,
  chave: "spend" | "results" | "roas" | "cpr" | "ctr" | "revenue",
) =>
  d.series.map((s) =>
    chave === "roas"
      ? s.spend > 0 && s.revenue > 0
        ? s.revenue / s.spend
        : null
      : chave === "cpr"
        ? s.results > 0
          ? s.spend / s.results
          : null
        : chave === "ctr"
          ? s.impressions > 0
            ? (s.clicks / s.impressions) * 100
            : null
          : s[chave],
  );

function VisaoGeral({ d, cfg }: { d: DadosMeta; cfg: ConfigMeta }) {
  const { destaques, temReceita, atual, antes, cprMedio } = destaquesMeta(
    d,
    cfg.roasTarget,
  );
  const nota = notaDeSaude(atual, antes, cfg.roasTarget, temReceita);
  const [faixa, tom] = faixaDeSaude(nota);
  const rotulo = rotuloResultado(d.mainType);
  const singular = rotulo.toLowerCase().replace(/s$/, "");
  const dias = d.series.map((s) => s.date);
  const nDias = Math.max(
    1,
    Math.round(
      (Date.parse(d.period.cur[1]) - Date.parse(d.period.cur[0])) / 864e5,
    ) + 1,
  );
  const orcamento = d.rows.reduce((a, r) => a + (r.dailyBudget ?? 0), 0);
  const x2 = (v: number | null) =>
    v == null
      ? "—"
      : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  const idades = [...new Set(d.demographics.map((q) => q.key.age))].sort();
  const generos = ["female", "male", "unknown"].filter((g) =>
    d.demographics.some((q) => q.key.gender === g && q.results > 0),
  );
  const maxPub = Math.max(1, ...d.demographics.map((q) => q.results));
  const posicoes = d.placements
    .filter((q) => q.spend > 0)
    .map((q) => ({
      nome: `${PLATAFORMA[q.key.platform] ?? q.key.platform} · ${q.key.position.replace(new RegExp(`^${q.key.platform}_?`), "").replace(/_/g, " ") || "geral"}`,
      ...q,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 7);
  return (
    <div className="pilha">
      <div className="duas-colunas larga-estreita">
        <div className="panel destaque-gasto">
          <small>Investimento no período</small>
          <strong className="numero-grande">{fmt.moeda(atual.spend)}</strong>
          <p className="kpi-apoio">
            <Variacao
              valor={variacao(atual.spend, antes.spend)}
              subirEhBom={false}
              sufixo=" vs. período anterior"
            />
          </p>
          <Mini valores={serieDe(d, "spend")} cor="var(--dado-1)" />
          <dl className="mini-ficha">
            <div>
              <dt>Orçamento diário somado</dt>
              <dd>{orcamento ? fmt.moeda(orcamento) : "—"}</dd>
            </div>
            <div>
              <dt>Média por dia</dt>
              <dd>{fmt.moeda(atual.spend / nDias)}</dd>
            </div>
            <div>
              <dt>Campanhas ativas</dt>
              <dd>{d.rows.length}</dd>
            </div>
          </dl>
        </div>
        <div className="panel saude">
          <small>Saúde da conta</small>
          <div className="saude-nota">
            <span
              className={`anel ${tom}`}
              style={{ "--nota": nota } as React.CSSProperties}
            >
              <b>{nota}</b>
            </span>
            <span className={`saude-faixa ${tom}`}>{faixa}</span>
          </div>
          <p className="hint">
            Junta ROAS ou custo por resultado, tendência, CTR e frequência.
          </p>
        </div>
      </div>
      <div className="kpis">
        {temReceita && (
          <Kpi
            rotulo="Receita (compras)"
            valor={fmt.moeda(atual.revenue)}
            apoio={<Variacao valor={variacao(atual.revenue, antes.revenue)} />}
          />
        )}
        {temReceita && (
          <Kpi
            rotulo="ROAS"
            valor={atual.roas != null ? `${x2(atual.roas)}x` : "—"}
            apoio={<Variacao valor={variacao(atual.roas, antes.roas)} />}
          />
        )}
        <Kpi
          rotulo={rotulo}
          valor={fmt.int(atual.results)}
          apoio={<Variacao valor={variacao(atual.results, antes.results)} />}
        />
        <Kpi
          rotulo={`Custo por ${singular}`}
          valor={fmt.moeda(atual.cpr)}
          apoio={
            <Variacao
              valor={variacao(atual.cpr, antes.cpr)}
              subirEhBom={false}
            />
          }
        />
        {!temReceita && (
          <Kpi
            rotulo="Alcance"
            valor={fmt.int(atual.reach)}
            apoio={<Variacao valor={variacao(atual.reach, antes.reach)} />}
          />
        )}
        <Kpi
          rotulo="CTR"
          valor={atual.ctr != null ? `${x2(atual.ctr)}%` : "—"}
          apoio={<Variacao valor={variacao(atual.ctr, antes.ctr)} />}
        />
        <Kpi
          rotulo="CPC"
          valor={fmt.moeda(atual.cpc)}
          apoio={
            <Variacao
              valor={variacao(atual.cpc, antes.cpc)}
              subirEhBom={false}
            />
          }
        />
      </div>
      <div className="panel">
        <h2>Destaques</h2>
        <Destaques
          itens={destaques}
          vazio="Sem dados suficientes para destaques neste período."
        />
      </div>
      <div className="duas-colunas">
        <div className="panel">
          <h2>Gasto por dia</h2>
          <Colunas
            rotulo="Gasto por dia"
            dias={dias}
            formato={(v) => fmt.moeda(v)}
            series={[
              {
                nome: "Gasto",
                cor: "var(--dado-1)",
                valores: d.series.map((s) => s.spend),
              },
            ]}
          />
        </div>
        <div className="panel">
          <h2>
            {temReceita ? "ROAS por dia" : `Custo por ${singular} por dia`}
          </h2>
          <Linha
            rotulo={
              temReceita ? "ROAS por dia" : `Custo por ${singular} por dia`
            }
            dias={dias}
            formato={(v) => (temReceita ? `${x2(v)}x` : fmt.moeda(v))}
            serie={{
              nome: "Eficiência",
              cor: "var(--dado-1)",
              valores: serieDe(d, temReceita ? "roas" : "cpr"),
            }}
            referencia={
              temReceita
                ? { valor: cfg.roasTarget, rotulo: "meta" }
                : cprMedio
                  ? { valor: cprMedio, rotulo: "média" }
                  : undefined
            }
          />
        </div>
      </div>
      <div className="duas-colunas">
        <div className="panel">
          <h2>Funil do anúncio</h2>
          {d.funnel.length ? (
            <Barras
              log
              rotulo="Funil do anúncio"
              itens={d.funnel.map((f, i) => ({
                chave: f.name,
                rotulo: f.name,
                valor: f.value,
                texto: `${fmt.int(f.value)}${i ? ` · ${fmt.pct(f.value, d.funnel[i - 1].value)}` : ""}`,
              }))}
            />
          ) : (
            <p className="hint">Sem dados de funil no período.</p>
          )}
        </div>
        <div className="panel">
          <h2>Posicionamentos</h2>
          {posicoes.length ? (
            <Barras
              rotulo="Gasto por posicionamento"
              itens={posicoes.map((p) => ({
                chave: p.nome,
                rotulo: p.nome,
                valor: p.spend,
                texto: `${fmt.moeda(p.spend)} · ${fmt.int(p.results)}`,
              }))}
            />
          ) : (
            <p className="hint">Sem dados de posicionamento.</p>
          )}
        </div>
      </div>
      <div className="panel">
        <h2>Público · {rotulo.toLowerCase()} por idade e gênero</h2>
        {generos.length ? (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Gênero</th>
                  {idades.map((a) => (
                    <th key={a} className="n">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generos.map((g) => (
                  <tr key={g}>
                    <td>{nomeGenero(g)}</td>
                    {idades.map((a) => {
                      const s = d.demographics.find(
                        (q) => q.key.age === a && q.key.gender === g,
                      );
                      const v = s?.results ?? 0;
                      return (
                        <td
                          key={a}
                          className="n"
                          title={
                            s
                              ? `Gasto ${fmt.moeda(s.spend)}${v ? ` · ${fmt.moeda(s.spend / v)} por resultado` : ""}`
                              : ""
                          }
                        >
                          <span
                            className="calor"
                            style={
                              { "--calor": v / maxPub } as React.CSSProperties
                            }
                          >
                            {v ? fmt.int(v) : "·"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">Sem dados de público.</p>
        )}
      </div>
    </div>
  );
}

type ColunaCamp =
  | "name"
  | "situacao"
  | "dailyBudget"
  | "spend"
  | "results"
  | "costPerResult"
  | "ctr"
  | "frequency"
  | "roas";

function Campanhas({ d, cfg }: { d: DadosMeta; cfg: ConfigMeta }) {
  const [ordem, setOrdem] = useState<{ k: ColunaCamp; dir: 1 | -1 }>({
    k: "spend",
    dir: -1,
  });
  const [busca, setBusca] = useState("");
  const temReceita = d.totals.revenue > 0;
  const comCpr = d.rows.filter((r) => r.costPerResult != null && r.results > 0);
  const cprMedio = comCpr.length
    ? comCpr.reduce((a, r) => a + (r.costPerResult ?? 0), 0) / comCpr.length
    : 0;
  const emAlerta = alertas(d.rows, cfg);
  const linhas = d.rows
    .map((r) => ({
      r,
      s: situacaoDaCampanha(r, cprMedio, cfg.roasTarget, temReceita),
    }))
    .filter(({ r }) =>
      r.name.toLowerCase().includes(busca.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const v = (x: { r: LinhaCampanha; s: { ordem: number } }) =>
        ordem.k === "situacao"
          ? x.s.ordem
          : ordem.k === "name"
            ? x.r.name
            : (x.r[ordem.k] ?? -1);
      const x = v(a);
      const y = v(b);
      return (
        (typeof x === "string"
          ? x.localeCompare(String(y), "pt-BR")
          : x - (y as number)) * ordem.dir
      );
    });
  const cab = (k: ColunaCamp, r: string, n = true) => (
    <th className={n ? "n" : ""}>
      <button
        className="ordenar"
        onClick={() =>
          setOrdem({ k, dir: ordem.k === k ? (-ordem.dir as 1 | -1) : -1 })
        }
      >
        {r}
        {ordem.k === k ? (ordem.dir > 0 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const exportar = () =>
    baixarCsv(`meta-ads-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Campanha",
        "Situação",
        "Orçamento diário",
        "Gasto",
        "Resultados",
        "Custo por resultado",
        "CTR %",
        "Frequência",
        "Receita",
        "ROAS",
      ],
      ...linhas.map(({ r, s }) => [
        r.name,
        s.rotulo,
        r.dailyBudget ?? "",
        r.spend,
        r.results,
        r.costPerResult ?? "",
        r.ctr,
        r.frequency,
        r.revenue,
        r.roas ?? "",
      ]),
    ]);
  const nomesAlerta = d.rows.filter((r) => emAlerta[r.id]).map((r) => r.name);
  return (
    <div className="panel">
      {nomesAlerta.length > 0 && (
        <div className="notice error" role="status">
          <b>
            {nomesAlerta.length} campanha(s) passaram dos limites de alerta:
          </b>{" "}
          {nomesAlerta.join(", ")}
        </div>
      )}
      <div className="actions">
        <h2>
          Campanhas ativas{" "}
          <span className="vitrine-total">· {linhas.length}</span>
        </h2>
        <label className="search">
          <Icon nome="busca" />
          <input
            aria-label="Buscar campanha"
            placeholder="Buscar campanha"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <button onClick={exportar} disabled={!linhas.length}>
          Exportar CSV
        </button>
      </div>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              {cab("name", "Campanha", false)}
              {cab("situacao", "Situação", false)}
              {cab("dailyBudget", "Orç. diário")}
              {cab("spend", "Gasto")}
              {cab("results", rotuloResultado(d.mainType))}
              {cab("costPerResult", "Custo/result.")}
              {cab("ctr", "CTR")}
              {cab("frequency", "Freq.")}
              {temReceita && cab("roas", "ROAS")}
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ r, s }) => (
              <tr
                key={r.id}
                className={emAlerta[r.id] ? "alerta" : ""}
                title={emAlerta[r.id]?.join("\n")}
              >
                <td>{r.name}</td>
                <td>
                  <Selo tom={s.tom}>{s.rotulo}</Selo>
                </td>
                <td className="n">
                  {r.dailyBudget ? fmt.moeda(r.dailyBudget) : "—"}
                </td>
                <td className="n">
                  <b>{fmt.moeda(r.spend)}</b>
                </td>
                <td className="n">{fmt.int(r.results)}</td>
                <td className="n">{fmt.moeda(r.costPerResult)}</td>
                <td className="n">{r.ctr ? `${fmt.dec1(r.ctr)}%` : "—"}</td>
                <td className={`n${r.frequency > 2.5 ? " texto-atencao" : ""}`}>
                  {r.frequency ? fmt.dec1(r.frequency) : "—"}
                </td>
                {temReceita && (
                  <td className="n">
                    {r.roas != null ? `${fmt.dec1(r.roas)}x` : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!linhas.length && <Vazio titulo="Nenhuma campanha ativa no período" />}
    </div>
  );
}
