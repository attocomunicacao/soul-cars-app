/**
 * Serviço do Funil Meta Ads → CRM (vindo do Soul APP): topo do funil no Meta (gasto,
 * impressões, cliques, conversas) e o resto no uTalk (leads, calls, quentes, agendados).
 *
 * Os leads vêm da leitura do módulo CRM · Leads sempre que a janela dela cobre o período
 * (nenhuma busca a mais no uTalk); senão o Funil faz uma leitura própria, maior. Cada fonte
 * falha sozinha: um erro no Meta não esconde o CRM e vice-versa.
 */
import {
  CONFIG_FUNIL_PADRAO,
  completarPapeis,
  resolverPeriodo,
  type ConfigFunil,
  type Intervalo,
  type MetaFunil,
} from "../../shared/funnel";
import type { SnapshotCrm } from "../../shared/crm-leads";
import { arquivoInterno, gravarJson, lerJson } from "../core/json-store";
import {
  configLeads,
  dadosLeads,
  leituraCompartilhada,
  lerLeadsComJanela,
} from "../crm/leads";
import type { Buscar } from "../crm/utalk-api";
import { buscarMetaDoFunil } from "../meta/graph-api";
import { credMeta } from "../meta/meta";

const ARQ_CONFIG = () => arquivoInterno("funil", "config.json");
const VALIDADE_MS = 2 * 60_000;

/** Regras e período do funil (com padrões). */
export function configFunil(): ConfigFunil {
  return {
    ...CONFIG_FUNIL_PADRAO,
    ...lerJson<Partial<ConfigFunil>>(ARQ_CONFIG(), {}),
  };
}

/** Grava regras e período. */
export function salvarConfigFunil(patch: Partial<ConfigFunil>) {
  const n = { ...configFunil(), ...patch };
  gravarJson(ARQ_CONFIG(), n);
  return n;
}

const memoria: {
  meta?: { chave: string; em: number; dados: MetaFunil };
  crm?: { desde: string; em: number; dados: SnapshotCrm };
} = {};

/** A leitura do CRM cobre o início do período? */
function cobre(snap: SnapshotCrm, janelaDias: number, desde: string) {
  return (
    janelaDias === 0 ||
    Date.parse(snap.fetchedAt) - janelaDias * 864e5 <=
      Date.parse(`${desde}T00:00:00`)
  );
}

async function metaDoPeriodo(r: Intervalo, forcar: boolean) {
  const cred = credMeta();
  const chave = `${cred.conta}|${r.since}|${r.until}`;
  const m = memoria.meta;
  if (!forcar && m && m.chave === chave && Date.now() - m.em < VALIDADE_MS)
    return m.dados;
  const dados = await buscarMetaDoFunil(fetch as Buscar, cred, r);
  memoria.meta = { chave, em: Date.now(), dados };
  return dados;
}

async function crmDoPeriodo(r: Intervalo, forcar: boolean) {
  const compartilhada = leituraCompartilhada();
  if (compartilhada && cobre(compartilhada, configLeads().windowDays, r.since))
    return { dados: compartilhada, origem: "crm" as const };
  const c = memoria.crm;
  if (!forcar && c && c.desde <= r.since && Date.now() - c.em < 5 * VALIDADE_MS)
    return { dados: c.dados, origem: "propria" as const };
  const dias = Math.ceil((Date.now() - Date.parse(r.since)) / 864e5) + 2;
  const dados = await lerLeadsComJanela(Math.max(30, dias));
  memoria.crm = { desde: r.since, em: Date.now(), dados };
  return { dados, origem: "propria" as const };
}

/** Dados do funil no período escolhido. Cada fonte devolve dados ou o erro dela. */
export async function dadosFunil(forcar = false) {
  let cfg = configFunil();
  const range = resolverPeriodo(cfg.period);
  const [meta, crm] = await Promise.allSettled([
    metaDoPeriodo(range, forcar),
    crmDoPeriodo(range, forcar),
  ]);
  const erros: { meta?: string; crm?: string } = {};
  if (meta.status === "rejected")
    erros.meta = String((meta.reason as Error)?.message ?? meta.reason);
  if (crm.status === "rejected")
    erros.crm = String((crm.reason as Error)?.message ?? crm.reason);
  const snap = crm.status === "fulfilled" ? crm.value.dados : null;
  if (snap) {
    const carros = new Set(
      Object.entries(configLeads().tagCategories)
        .filter(([, v]) => v === "car")
        .map(([k]) => k),
    );
    const r = completarPapeis(snap, cfg.tagRoles, carros);
    if (r.mudou) cfg = salvarConfigFunil({ tagRoles: r.papeis });
  }
  return {
    config: cfg,
    range,
    meta: meta.status === "fulfilled" ? meta.value : null,
    crm: snap,
    origemCrm: crm.status === "fulfilled" ? crm.value.origem : null,
    erros,
    conexoes: { meta: !!credMeta().token, crm: dadosLeads().conectado },
  };
}
