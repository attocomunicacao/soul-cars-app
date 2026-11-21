/**
 * Serviço do módulo CRM · Leads (vindo do Soul APP): lê os leads do uTalk com o mesmo token
 * cifrado do app (crm/utalk.ts), guarda a última leitura e o feed de atividade em
 * `crm-leads/cache.json`, classifica as etiquetas e avisa no Windows quando chega lead novo.
 * Só leitura: nada é alterado no uTalk. A interface chama `atualizarLeads` no intervalo
 * escolhido enquanto a página está aberta.
 */
import { Notification } from "electron";
import {
  CONFIG_LEADS_PADRAO,
  classificarEtiquetas,
  compararLeituras,
  type ConfigLeads,
  type EventoCrm,
  type SnapshotCrm,
} from "../../shared/crm-leads";
import { arquivoInterno, gravarJson, lerJson } from "../core/json-store";
import * as caminhos from "../core/paths";
import { lerLeads, limparCacheDeChats } from "./leads-sync";
import { ClienteUmbler } from "./umbler-client";
import { descobrirOrganizacao, type Buscar } from "./utalk-api";
import { tokenUtalk } from "./utalk";

const ARQ_CONFIG = () => arquivoInterno("crm-leads", "config.json");
const ARQ_CACHE = () => arquivoInterno("crm-leads", "cache.json");

type Cache = { snapshot: SnapshotCrm | null; events: EventoCrm[] };

/** Organização usada (escolhida, importada do Soul APP ou a primeira do token). */
export type OrganizacaoCrm = { id: string; nome: string };

/** Preferências do módulo (com padrões). */
export function configLeads(): ConfigLeads {
  return {
    ...CONFIG_LEADS_PADRAO,
    ...lerJson<Partial<ConfigLeads>>(ARQ_CONFIG(), {}),
  };
}

/** Grava preferências. Trocar a janela de dias refaz o cache de atendimentos. */
export function salvarConfigLeads(patch: Partial<ConfigLeads>) {
  const atual = configLeads();
  const novo: ConfigLeads = { ...atual, ...patch };
  novo.windowDays = Math.max(0, Math.min(365, Math.round(novo.windowDays)));
  novo.intervalSec = Math.max(30, Math.min(3600, Math.round(novo.intervalSec)));
  if (novo.windowDays !== atual.windowDays) limparCacheDeChats();
  gravarJson(ARQ_CONFIG(), novo);
  return novo;
}

/** Organização gravada no config.json (ou null). */
export function organizacaoCrm(): OrganizacaoCrm | null {
  const o = caminhos.lerConfig().crmOrganizacao as OrganizacaoCrm | undefined;
  return o?.id ? o : null;
}

/** Grava a organização e zera leitura e classificação (são de outra conta). */
export function definirOrganizacao(o: OrganizacaoCrm | null) {
  caminhos.gravarConfig({ crmOrganizacao: o ?? null });
  limparDados(true);
}

/** Apaga a leitura guardada (e, se pedido, a classificação das etiquetas). */
export function limparDados(etiquetas: boolean) {
  gravarJson(ARQ_CACHE(), { snapshot: null, events: [] });
  limparCacheDeChats();
  if (etiquetas) salvarConfigLeads({ tagCategories: {}, statusOrder: [] });
}

/** Última leitura guardada, feed e preferências (sem tocar na rede). */
export function dadosLeads() {
  const cache = lerJson<Cache>(ARQ_CACHE(), { snapshot: null, events: [] });
  return {
    snapshot: cache.snapshot,
    events: cache.events,
    config: configLeads(),
    conectado: tokenUtalk() !== null,
    organizacao: organizacaoCrm(),
  };
}

/** Leitura do módulo CRM para o Funil, se for da organização atual. */
export function leituraCompartilhada() {
  const { snapshot, organizacao } = dadosLeads();
  if (!snapshot) return null;
  if (organizacao && snapshot.organization.id !== organizacao.id) return null;
  return snapshot;
}

let emAndamento: Promise<ReturnType<typeof dadosLeads>> | null = null;

/** Busca os leads no uTalk, compara com a leitura anterior e avisa os novos. */
export function atualizarLeads() {
  emAndamento ??= executar().finally(() => (emAndamento = null));
  return emAndamento;
}

async function executar() {
  const token = tokenUtalk();
  if (!token)
    throw new Error("Cadastre o token do uTalk em Configurações › Conexões.");
  const buscar = fetch as Buscar;
  let org = organizacaoCrm();
  if (!org) {
    org = await descobrirOrganizacao(buscar, token);
    caminhos.gravarConfig({ crmOrganizacao: org });
  }
  let cfg = configLeads();
  const snapshot = await lerLeads(
    new ClienteUmbler(buscar, token),
    org.id,
    cfg.windowDays,
  );
  const classe = classificarEtiquetas(snapshot, cfg);
  if (classe.mudou) cfg = salvarConfigLeads(classe.cfg);
  const anterior = lerJson<Cache>(ARQ_CACHE(), { snapshot: null, events: [] });
  const eventos = compararLeituras(anterior.snapshot, snapshot);
  avisarNovos(eventos, cfg);
  gravarJson(ARQ_CACHE(), {
    snapshot,
    events: [...eventos.reverse(), ...anterior.events].slice(0, 500),
  });
  return dadosLeads();
}

function avisarNovos(eventos: EventoCrm[], cfg: ConfigLeads) {
  const novos = eventos.filter((e) => e.type === "novo");
  if (!cfg.notifyNewLeads || !novos.length || !Notification.isSupported())
    return;
  if (novos.length === 1) {
    const e = novos[0];
    new Notification({
      title: "Novo lead",
      body: `${e.text.replace("Novo lead: ", "")}${e.tags?.length ? ` · ${e.tags.join(", ")}` : ""}`,
    }).show();
  } else
    new Notification({
      title: "Novos leads",
      body: `${novos.length} novos leads chegaram`,
    }).show();
}

/** Busca com janela própria (Funil com período maior que a janela do CRM). */
export async function lerLeadsComJanela(janelaDias: number) {
  const token = tokenUtalk();
  const org = organizacaoCrm();
  if (!token || !org)
    throw new Error("Cadastre o token do uTalk em Configurações › Conexões.");
  // Leitura avulsa: cliente próprio e sem mexer no cache de chats do módulo CRM.
  limparCacheDeChats();
  return lerLeads(
    new ClienteUmbler(fetch as Buscar, token),
    org.id,
    janelaDias,
  );
}
