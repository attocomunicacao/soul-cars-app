/**
 * Resposta da IA a uma conversa: monta o contexto, chama o modelo e pós-processa o texto.
 *
 * Usa persona, loja, respostas rápidas, exemplos, estoque e plano de fotos. Quando é a primeira
 * mensagem e há resposta de abertura cadastrada, nem chama o modelo. Não envia nada ao uTalk.
 */
import {
  montarMensagens,
  planoDeFotos,
  preencher,
  respostaDeAbertura,
  variaveis,
  type MensagemIa,
  type VeiculoIa,
} from "../../shared/pre-service";
import type { FichaLead } from "../../shared/lead-profile";
import { posProcessar } from "../../shared/pre-service-pipeline";
import { gerar, type UsoModelo } from "./llm";
import { paresReais } from "./real-examples";
import { chaveGroq } from "./secrets";
import { buscar, carregar, registrar } from "./state";
import { fotosDo, veiculosDisponiveis } from "./stock";

// ------------------------------------------------------------ resposta
export type Lead = {
  nome: string;
  etiquetas: string[];
  fotosEnviadas: Record<string, number>;
  ficha?: FichaLead;
  /** Estoque já carregado pelo chamador (evita ler o CSV e as pastas duas vezes por rodada). */
  veiculos?: VeiculoIa[];
};

export async function responder(conversa: MensagemIa[], lead: Lead) {
  const e = carregar();
  const cfg = e.config;
  const abertura = !conversa.length && respostaDeAbertura(e.respostas);
  if (abertura)
    return {
      texto: preencher(
        abertura.texto,
        variaveis(e.loja, cfg.nomeAgente, lead.nome),
      ),
      transferir: false,
      encerrar: false,
      plano: null,
      usados: {
        respostas: [abertura.titulo],
        veiculos: 0,
        exemplos: 0,
        reais: 0,
      },
      auditoria: {
        bruto: "",
        uso: { provedor: "resposta-de-abertura", modelo: "", reserva: false },
        latenciaMs: 0,
        veiculos: [] as VeiculoIa[],
      },
    };
  const veiculos = lead.veiculos ?? veiculosDisponiveis();
  const plano = planoDeFotos({
    conversa,
    veiculos,
    fotosDe: fotosDo,
    etiquetas: lead.etiquetas,
    enviadas: lead.fotosEnviadas,
    maxFotos: cfg.maxFotos,
  });
  const { mensagens, usados } = montarMensagens({
    persona: e.persona,
    loja: e.loja,
    config: cfg,
    veiculos,
    respostas: e.respostas,
    exemplos: e.exemplos,
    reais: cfg.usarHistoricoCrm ? paresReais() : [],
    conversa,
    nomeLead: lead.nome,
    notaFotos: plano?.nota,
    ficha: lead.ficha,
  });
  const inicio = Date.now();
  const uso: UsoModelo = {
    provedor: cfg.provedor,
    modelo: cfg.provedor === "groq" ? cfg.modeloGroq : cfg.modeloOllama,
    reserva: false,
  };
  const bruto = await gerar(
    buscar,
    mensagens,
    cfg,
    chaveGroq(),
    (t) => registrar("reserva", t),
    uso,
  );
  const final = posProcessar({
    bruto,
    conversa,
    ficha: lead.ficha,
    veiculos,
    fotos: plano?.fotos.length ?? 0,
    anteriores: conversa
      .filter((m) => m.role === "assistant")
      .map((m) => m.content),
  });
  return {
    texto: final.texto,
    transferir: final.transferir,
    encerrar: final.encerrar,
    plano,
    usados,
    auditoria: { bruto, uso, latenciaMs: Date.now() - inicio, veiculos },
  };
}

/** Resultado de `responder`: texto, plano de fotos e os dados que a auditoria registra. */
export type RespostaIa = Awaited<ReturnType<typeof responder>>;
