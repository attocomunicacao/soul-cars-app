/**
 * Auditoria dos turnos do Pré-atendimento IA (`pre-atendimento-auditoria.jsonl`).
 *
 * Cada resposta da IA (do laço ou do simulador) vira um turno com sinais de qualidade. Gravar nunca
 * lança erro: a auditoria não pode atrapalhar o atendimento. Também entrega os turnos e os
 * históricos ao Laboratório de testes.
 */
import path from "node:path";
import * as caminhos from "../core/paths";
import {
  avaliarTurno,
  mascararTelefone,
  type Desfecho,
} from "../../shared/pre-service-audit";
import {
  ausentes,
  MAX_PEDIDOS,
  informados,
  pendentes,
  podeTransferir,
  rotulos,
  type FichaLead,
} from "../../shared/lead-profile";
import { gravarTurno, lerTurnos } from "./audit";
import type { RespostaIa } from "./reply";
import { carregar } from "./state";

// ------------------------------------------------------------ auditoria
export const ARQUIVO_AUDITORIA = () =>
  path.join(caminhos.userData(), "pre-atendimento-auditoria.jsonl");

/** Grava um turno na auditoria (nunca lança: a auditoria não pode atrapalhar o atendimento). */
export function auditarTurno(a: {
  id: string;
  origem: "laco" | "simulador";
  chatId: string | null;
  nome: string;
  telefone: string | null;
  recebidas: string[];
  anteriores: string[];
  desfecho: Desfecho;
  r?: RespostaIa;
  erro?: string;
  ficha?: FichaLead;
}) {
  try {
    const { r } = a;
    const abertura = r?.auditoria.uso.provedor === "resposta-de-abertura";
    const sinais =
      r && !abertura
        ? avaliarTurno({
            texto: r.texto,
            transferir: r.transferir,
            encerrar: r.encerrar,
            recebidas: a.recebidas,
            veiculos: r.auditoria.veiculos,
            anteriores: a.anteriores,
            fotosPlanejadas: r.plano?.fotos.length ?? 0,
            coleta: a.ficha && {
              financiado: a.ficha.pagamento.includes("financiado"),
              pendentes: pendentes(a.ficha),
              informados: informados(a.ficha),
              dispensados: a.ficha.recusou
                ? []
                : ausentes(a.ficha).filter(
                    (c) => (a.ficha?.pedidos[c] ?? 0) >= MAX_PEDIDOS,
                  ),
              podeTransferir: podeTransferir(a.ficha),
            },
          })
        : [];
    if (a.erro) sinais.push("erro");
    gravarTurno(ARQUIVO_AUDITORIA(), {
      id: a.id,
      em: new Date().toISOString(),
      origem: a.origem,
      chatId: a.chatId,
      nome: a.nome,
      telefone: mascararTelefone(a.telefone),
      recebidas: a.recebidas,
      provedor: r?.auditoria.uso.provedor ?? "",
      modelo: r?.auditoria.uso.modelo ?? "",
      reserva: r?.auditoria.uso.reserva ?? false,
      latenciaMs: r?.auditoria.latenciaMs ?? 0,
      bruto: r?.auditoria.bruto ?? "",
      texto: r?.texto ?? "",
      transferir: r?.transferir ?? false,
      encerrar: r?.encerrar ?? false,
      usados: r?.usados ?? {
        respostas: [],
        veiculos: 0,
        exemplos: 0,
        reais: 0,
      },
      fotos: {
        veiculo: r?.plano?.veiculo
          ? `${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}`
          : null,
        qtd: r?.plano?.fotos.length ?? 0,
        semFotos: !!r?.plano?.semFotos,
      },
      estoque: r?.auditoria.veiculos.length ?? 0,
      desfecho: a.desfecho,
      ...(a.ficha ? { faltando: rotulos(pendentes(a.ficha)) } : {}),
      ...(a.erro ? { erro: a.erro } : {}),
      sinais,
    });
  } catch {
    /* sem auditoria neste turno */
  }
}

/** Turnos auditados, do mais recente ao mais antigo, para a aba Auditoria. */
export const auditoria = (limite = 200) =>
  lerTurnos(ARQUIVO_AUDITORIA(), Math.min(Math.max(limite, 1), 1000));

/**
 * Turnos da auditoria e histórico de cada chat, para o Laboratório transformar erros reais em
 * cenários (anonimizados lá, em `main/lab/audit-scenarios.ts`). Só leitura.
 */
export function auditoriaParaLab() {
  return {
    turnos: lerTurnos(ARQUIVO_AUDITORIA(), 1000),
    historicos: Object.fromEntries(
      Object.entries(carregar().chats).map(([id, c]) => [id, c.historico]),
    ),
  };
}
