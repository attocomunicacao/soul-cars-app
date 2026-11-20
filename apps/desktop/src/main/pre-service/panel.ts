/**
 * Comandos da tela do Pré-atendimento: painel, configurações, aprovação de rascunhos e uTalk.
 *
 * Cada função muda o estado (`state.ts`) e devolve o painel atualizado. É a camada de cima: usa o
 * laço, a entrega ao uTalk, o estoque e os exemplos, e nenhum outro módulo depende dela.
 */
import path from "node:path";
import { tokenUtalk } from "../crm/utalk";
import type {
  ConfigIa,
  ExemploIa,
  LojaIa,
  RespostaRapida,
} from "../../shared/pre-service";
import {
  motivoDaTransferencia,
  resumoParaSdr,
} from "../../shared/lead-profile";
import { guardarTexto } from "../../shared/pre-service-guard";
import { gravarDesfecho } from "./audit";
import { cliente, contatoDo, entregar, tirarEtiqueta } from "./delivery";
import { listarModelos } from "./llm";
import { estadoDoLaco, reiniciarLaco } from "./loop";
import { paresReais, zerarParesReais } from "./real-examples";
import { chaveGroq, guardarChaveGroq } from "./secrets";
import { buscar, carregar, gravar, novoId, registrar } from "./state";
import { veiculosDisponiveis } from "./stock";
import { ARQUIVO_AUDITORIA } from "./turn-audit";

// ------------------------------------------------------------ comandos da tela
/** Tudo o que a tela mostra (sem chave nem token). */
export function painel() {
  const e = carregar();
  return {
    config: e.config,
    loja: e.loja,
    persona: e.persona,
    respostas: e.respostas,
    exemplos: e.exemplos,
    rascunhos: e.rascunhos.map((r) => ({
      ...r,
      fotos: r.fotos.map((f) => path.basename(f)),
    })),
    chats: Object.values(e.chats)
      .map((c) => ({
        chatId: c.chatId,
        nome: c.nome,
        status: c.status,
        mensagens: c.historico.length,
        ultima: c.historico.at(-1) ?? null,
        ultimaIaEm: c.ultimaIaEm,
        // Nota do cliente para o painel (CPF e nascimento nunca aparecem aqui).
        resumo: c.ficha
          ? resumoParaSdr(c.ficha, {
              nome: c.nome,
              motivo:
                c.status === "ativo"
                  ? undefined
                  : motivoDaTransferencia(c.ficha),
            })
          : null,
      }))
      .sort((a, b) => (b.ultima?.em ?? 0) - (a.ultima?.em ?? 0)),
    registros: e.registros.slice(0, 80),
    laco: estadoDoLaco(),
    conexoes: { utalk: !!tokenUtalk(), groq: !!chaveGroq() },
    estoque: veiculosDisponiveis().length,
    exemplosReais: paresReais().length,
  };
}

/** Grava parte das configurações e religa o laço. */
export function salvarConfig(patch: Partial<ConfigIa>) {
  const e = carregar();
  e.config = { ...e.config, ...patch };
  gravar();
  reiniciarLaco();
  return painel();
}
/** Grava os dados da loja usados no contexto. */
export function salvarLoja(patch: Partial<LojaIa>) {
  const e = carregar();
  e.loja = { ...e.loja, ...patch };
  gravar();
  return painel();
}
/** Grava a persona (regras do atendimento). */
export function salvarPersona(persona: string) {
  carregar().persona = persona;
  gravar();
  return painel();
}
/** Cria ou atualiza uma resposta-rápida. */
export function salvarResposta(item: RespostaRapida) {
  const e = carregar();
  const novo = { ...item, id: item.id || novoId() };
  const i = e.respostas.findIndex((x) => x.id === novo.id);
  if (i >= 0) e.respostas[i] = novo;
  else e.respostas.unshift(novo);
  gravar();
  return painel();
}
/** Apaga uma resposta-rápida. */
export function removerResposta(id: string) {
  const e = carregar();
  e.respostas = e.respostas.filter((x) => x.id !== id);
  gravar();
  return painel();
}
/** Correção do simulador ou da aprovação: vira exemplo de ensino. */
export function salvarExemplo(item: Omit<ExemploIa, "id"> & { id?: string }) {
  const e = carregar();
  const novo: ExemploIa = { ...item, id: item.id || novoId() };
  const i = e.exemplos.findIndex((x) => x.id === novo.id);
  if (i >= 0) e.exemplos[i] = novo;
  else e.exemplos.unshift(novo);
  gravar();
  return painel();
}
/** Apaga um exemplo de ensino. */
export function removerExemplo(id: string) {
  const e = carregar();
  e.exemplos = e.exemplos.filter((x) => x.id !== id);
  gravar();
  return painel();
}

/** Rascunhos em aprovação neste instante: impede o clique duplo de enviar a mesma mensagem duas vezes. */
const aprovando = new Set<string>();

/** Aprova um rascunho (texto editado vira exemplo) e envia. */
export async function aprovar(id: string, texto?: string) {
  if (aprovando.has(id))
    throw new Error("Este rascunho já está sendo enviado.");
  aprovando.add(id);
  try {
    const e = carregar();
    const r = e.rascunhos.find((x) => x.id === id);
    if (!r) throw new Error("Rascunho não encontrado.");
    // O texto editado passa pelo mesmo guarda da IA (espaços, palavra em dobro, frase repetida).
    const final = guardarTexto(
      (texto ?? r.texto).trim(),
      (e.chats[r.chatId]?.historico ?? [])
        .filter((m) => m.role === "assistant")
        .map((m) => m.content),
    );
    if (!final)
      throw new Error("A resposta está vazia ou repete o que a IA já disse.");
    if (final !== r.texto && r.pergunta)
      e.exemplos.unshift({
        id: novoId(),
        pergunta: r.pergunta,
        resposta: final,
        origem: "correcao",
      });
    try {
      await entregar({ ...r, texto: final });
    } catch (erro) {
      gravarDesfecho(ARQUIVO_AUDITORIA(), id, "erro");
      throw erro;
    }
    gravarDesfecho(ARQUIVO_AUDITORIA(), id, "aprovado");
    e.rascunhos = e.rascunhos.filter((x) => x.id !== id);
    gravar();
    return painel();
  } finally {
    aprovando.delete(id);
  }
}
/** Descarta um rascunho sem enviar. */
export function descartar(id: string) {
  const e = carregar();
  if (e.rascunhos.some((x) => x.id === id))
    gravarDesfecho(ARQUIVO_AUDITORIA(), id, "descartado");
  e.rascunhos = e.rascunhos.filter((x) => x.id !== id);
  gravar();
  return painel();
}
/** Tira o lead só do app (histórico e rascunhos); nada é apagado no uTalk. */
export function esquecerChat(chatId: string) {
  const e = carregar();
  delete e.chats[chatId];
  e.rascunhos = e.rascunhos.filter((d) => d.chatId !== chatId);
  gravar();
  return painel();
}
/** Devolve o lead à IA: põe a etiqueta de gatilho e tira a de transferência. */
export async function reativar(chatId: string) {
  const e = carregar();
  const st = e.chats[chatId];
  if (!st) throw new Error("Lead não encontrado.");
  if (!e.config.etiquetaGatilhoId)
    throw new Error("Escolha a etiqueta de gatilho.");
  const c = await cliente();
  await c
    .porEtiqueta(await contatoDo(c, st), e.config.etiquetaGatilhoId)
    .catch((erro: Error) => {
      if (!/cont[ée]m|already/i.test(erro.message)) throw erro;
    });
  if (e.config.etiquetaTransferenciaId)
    await tirarEtiqueta(c, st, e.config.etiquetaTransferenciaId).catch(
      () => {},
    );
  st.status = "ativo";
  st.ficha = undefined; // novo ciclo de atendimento
  st.fichaDesde = Date.now();
  registrar("crm", `${st.nome}: devolvido para a IA`);
  return painel();
}

/** Etiquetas do uTalk, para escolher a de gatilho e a de transferência. */
export async function etiquetasUtalk() {
  const c = await cliente();
  return (await c.etiquetas())
    .map((t) => ({ id: t.id, nome: (t.name ?? "").trim() || "(sem nome)" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
/** Traz as respostas-rápidas cadastradas no uTalk (sem repetir as já importadas). */
export async function importarRespostas() {
  const e = carregar();
  let n = 0;
  for (const q of await (await cliente()).respostasRapidas()) {
    const texto = q.text || q.content || q.message;
    const id = "ut_" + q.id;
    if (!texto || e.respostas.some((x) => x.id === id)) continue;
    e.respostas.push({
      id,
      titulo: q.shortcut || q.title || q.name || "uTalk",
      palavras: q.shortcut || "",
      texto,
    });
    n++;
  }
  gravar();
  return { importadas: n, painel: painel() };
}
/** Modelos disponíveis no provedor escolhido. */
export const modelos = () =>
  listarModelos(buscar, carregar().config, chaveGroq());
/** Recalcula os exemplos reais a partir da memória da Soul IA (depois de sincronizar). */
export function recalcularExemplos() {
  zerarParesReais();
  return painel();
}

/** Guarda a chave do Groq cifrada pelo sistema; "" remove. Devolve o painel atualizado. */
export function salvarChaveGroq(chave: string) {
  guardarChaveGroq(chave);
  return painel();
}
