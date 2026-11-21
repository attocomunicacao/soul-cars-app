/**
 * Cliente tipado dos comandos `lab_*` do Laboratório de testes da IA (processo principal). A tela não
 * conhece Node: tudo passa pela ponte do preload. Os tipos vêm de `shared/` e do executor.
 */
import type { Avaliacao, EtiquetaErro } from "../../../shared/lab";
import type { SinalAuditoria } from "../../../shared/pre-service-audit";
import { invoke } from "./desktop-bridge";

export type CenarioResumo = {
  id: string;
  categoria: string;
  titulo: string;
  turnos: number;
  origem: "manual" | "gerado" | "historico" | "auditoria";
};
export type CenariosLab = {
  base: number;
  total: number;
  categorias: string[];
  cenarios: CenarioResumo[];
  /** Ids do conjunto rápido (pontos críticos, cabe no limite diário do Groq). */
  rapido: string[];
  /** O atendimento ao vivo está ligado (usa a mesma cota do Groq). */
  atendimentoLigado: boolean;
  pasta: string;
};
/** Quem respondeu de fato e quantos tokens a chamada gastou. */
export type UsoLab = {
  provedor: string;
  modelo: string;
  reserva: boolean;
  tokens?: number;
};
export type TurnoLab = {
  cliente: string;
  bruto: string;
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  omitido: boolean;
  fotos: number;
  sinais: SinalAuditoria[];
  latenciaMs: number;
  uso?: UsoLab;
  /** Exemplos reais da equipe que entraram no prompt. */
  reais?: number;
};
export type ResultadoLab = {
  id: string;
  categoria: string;
  titulo: string;
  repeticao: number;
  turnos: TurnoLab[];
  falhas: string[];
  erro?: string;
};
export type ExecucaoLab = {
  id: string;
  em: string;
  modelo: string;
  repeticoes: number;
  resultados: ResultadoLab[];
  tokens?: number;
  interrompida?: string;
  pedidos?: number;
};
export type ResumoExecucao = {
  id: string;
  em: string;
  modelo: string;
  cenarios: number;
  comFalhas: number;
  tokens: number;
  chamadas: number;
  interrompida?: string;
};
export type EntradaAvaliacao = {
  execucaoId: string;
  cenarioId: string;
  repeticao: number;
  turno: number;
  nota: number;
  etiquetas: EtiquetaErro[];
  comentario: string;
};

export const lab = {
  cenarios: () => invoke<CenariosLab>("lab_cenarios"),
  rodar: (a: { ids?: string[]; categoria?: string; repeticoes?: number }) =>
    invoke<ExecucaoLab>("lab_rodar", a),
  cancelar: () => invoke<boolean>("lab_cancelar"),
  execucoes: () => invoke<ResumoExecucao[]>("lab_execucoes"),
  execucao: (id: string) => invoke<ExecucaoLab>("lab_execucao", { id }),
  avaliar: (a: EntradaAvaliacao) => invoke<Avaliacao>("lab_avaliar", a),
  avaliacoes: (execucaoId?: string) =>
    invoke<Avaliacao[]>("lab_avaliacoes", { execucaoId }),
  relatorio: (execucaoId: string) =>
    invoke<string>("lab_relatorio", { execucaoId }),
  analisarHistorico: () =>
    invoke<{
      analise: { conversas: number; mensagens: number };
      pasta: string;
    }>("lab_analisar_historico"),
  cenariosDaAuditoria: () =>
    invoke<{ cenarios: number; turnosLidos: number }>("lab_cenarios_auditoria"),
  abrirPasta: () => invoke<boolean>("lab_abrir_pasta"),
  sincronizarHistorico: () => invoke<unknown>("soulia_sincronizar", {}),
  cancelarSincronizacao: () => invoke<boolean>("soulia_cancelar"),
};
