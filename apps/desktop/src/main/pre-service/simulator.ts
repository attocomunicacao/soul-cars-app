/**
 * Simulador "Ensinar" e contexto do Laboratório de testes.
 *
 * Responde a conversas digitadas na tela (sem enviar nada ao uTalk) e expõe ao Laboratório a mesma
 * persona, loja, estoque e modelo do atendimento real.
 */
import {
  mascarar,
  mascararConversa,
  fichaDaConversa,
} from "../../shared/lead-profile";
import type { MensagemIa } from "../../shared/pre-service";
import { gerar, type UsoModelo } from "./llm";
import { paresReais } from "./real-examples";
import { responder } from "./reply";
import { chaveGroq } from "./secrets";
import { buscar, carregar, novoId } from "./state";
import { miniatura, veiculosDisponiveis } from "./stock";
import { auditarTurno } from "./turn-audit";

/** O atendimento ao vivo está ligado? (o Laboratório avisa que divide a cota do Groq). */
export const atendimentoLigado = () => carregar().config.ligado;

/**
 * Contexto do Laboratório de testes: a mesma persona, loja, respostas rápidas, estoque, exemplos
 * (ensinados e reais da equipe, como no atendimento) e modelo do atendimento real. Sem a reserva
 * Ollama: uma execução não mistura dois modelos sem avisar. Nunca envia nada ao uTalk.
 */
export function contextoDoLab() {
  const e = carregar();
  const cfg = { ...e.config, reservaOllama: false };
  return {
    persona: e.persona,
    loja: e.loja,
    respostas: e.respostas,
    nomeAgente: e.config.nomeAgente,
    veiculos: veiculosDisponiveis(),
    exemplos: e.exemplos,
    reais: e.config.usarHistoricoCrm ? paresReais() : [],
    modelo: `${e.config.provedor}:${e.config.provedor === "groq" ? e.config.modeloGroq : e.config.modeloOllama}`,
    gerar: (mensagens: { role: string; content: string }[], uso?: UsoModelo) =>
      gerar(buscar, mensagens, cfg, chaveGroq(), () => {}, uso),
  };
}

/** Simulador "Ensinar": responde à conversa digitada na tela, sem enviar nada. Fotos vêm como miniaturas. */
export async function simular(a: {
  conversa: MensagemIa[];
  nome?: string;
  etiquetas?: string[];
  enviadas?: Record<string, number>;
}) {
  const r = await responder(mascararConversa(a.conversa), {
    nome: a.nome || "Cliente",
    etiquetas: a.etiquetas ?? [],
    fotosEnviadas: a.enviadas ?? {},
    ficha: fichaDaConversa(a.conversa),
  });
  auditarTurno({
    id: novoId(),
    origem: "simulador",
    chatId: null,
    nome: a.nome || "Cliente",
    telefone: null,
    recebidas: a.conversa
      .filter((m) => m.role === "user")
      .slice(-1)
      .map((m) => mascarar(m.content, true)),
    anteriores: a.conversa
      .filter((m) => m.role === "assistant")
      .slice(-2)
      .map((m) => m.content),
    desfecho: "simulado",
    r,
    ficha: fichaDaConversa(a.conversa),
  });
  return {
    texto: r.texto,
    transferir: r.transferir,
    encerrar: r.encerrar,
    usados: r.usados,
    fotos: (r.plano?.fotos ?? []).map(miniatura),
    veiculoFotos: r.plano?.veiculo
      ? `${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}`
      : null,
    veiculoFotosId: r.plano?.veiculo?.id ?? null,
    inicioFotos: r.plano?.inicio ?? 0,
    semFotos: !!r.plano?.semFotos,
  };
}
