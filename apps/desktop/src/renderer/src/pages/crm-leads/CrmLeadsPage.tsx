/**
 * Página CRM · Leads (vinda do Soul APP): leads do uTalk em quatro visões — Painel (números,
 * leads por carro, funil por status, entrada por dia, desempenho por SDR e carro × status),
 * Kanban por status, lista de Leads (com CSV) e Atividade (o que mudou a cada atualização).
 *
 * A leitura roda no main (`crm_leads_atualizar`); esta página pede uma atualização ao abrir
 * e depois no intervalo escolhido, e para o timer ao sair.
 *
 * Este arquivo guarda o carregamento, os filtros e a troca de visões; cada visão mora em seu
 * arquivo (Painel, Kanban, ListaLeads, Atividade, DetalheLead), com os ajudantes em lead-helpers.tsx
 * e os tipos e constantes comuns em shared.ts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NENHUM,
  categoria,
  filtrarLeads,
  type ConfigLeads,
  type EventoCrm,
  type FiltrosLeads,
  type LeadCrm,
  type PeriodoLeads,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { Segmentado, Vazio, fmt, ha, textoDoErro } from "../../app/components";
import { Icon } from "../../app/icons";
import { invoke } from "../../lib/desktop-bridge";
import { Dashboard } from "./Dashboard";
import { Kanban } from "./Kanban";
import { LeadList } from "./LeadList";
import { Activity } from "./Activity";
import { LeadDetail } from "./LeadDetail";

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
      setErro(textoDoErro(e));
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
      .catch((e) => aoErro(textoDoErro(e)));
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
        <Dashboard
          snap={snap}
          cfg={cfg!}
          leads={leads}
          filtros={filtros}
          setFiltros={setFiltros}
        />
      ) : visao === "kanban" ? (
        <Kanban snap={snap} cfg={cfg!} leads={leads} abrir={setAberto} />
      ) : visao === "leads" ? (
        <LeadList snap={snap} cfg={cfg!} leads={leads} abrir={setAberto} />
      ) : (
        <Activity eventos={dados.events} intervalo={intervalo} />
      )}
      {aberto && snap && (
        <LeadDetail
          lead={aberto}
          snap={snap}
          cfg={cfg!}
          fechar={() => setAberto(null)}
        />
      )}
    </section>
  );
}
