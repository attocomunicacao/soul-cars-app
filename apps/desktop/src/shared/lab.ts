/**
 * Tipos do Laboratório de testes da IA, compartilhados entre o corpus (shared), o executor (main) e a
 * tela (renderer): o cenário (mensagens do cliente + o que se espera) e as avaliações humanas.
 */
import type { SinalAuditoria } from "./pre-service-audit";

/** O que se espera de um cenário (tudo opcional): o relatório marca falha quando algo não bate. */
export type Esperado = {
  /** A conversa deve terminar transferindo (true) ou nunca transferir (false). */
  transfere?: boolean;
  /** Pelo menos uma resposta deve conter cada trecho (sem acento/caixa). */
  contem?: string[];
  /** Nenhuma resposta pode conter estes trechos. */
  proibido?: string[];
  /** Campos que a ficha deve ter ao final (ex.: "veiculo", "regiao", "cpf"). */
  coleta?: string[];
  /** Sinais de auditoria que não podem aparecer em nenhum turno. */
  semSinais?: SinalAuditoria[];
};

/** Um cenário do corpus: as mensagens do cliente, em ordem. */
export type Cenario = {
  id: string;
  categoria: string;
  titulo: string;
  turnos: string[];
  esperado?: Esperado;
  /** De onde veio: escrito à mão, gerado por variação, anonimizado do histórico ou de um erro real. */
  origem?: "manual" | "gerado" | "historico" | "auditoria";
};

/** Avaliação humana de uma resposta da IA no Laboratório (vira relatório para melhorar a IA). */
export type Avaliacao = {
  /** Execução, cenário, repetição e turno avaliados. */
  execucaoId: string;
  cenarioId: string;
  repeticao: number;
  turno: number;
  /** 1 (péssima) a 5 (ótima). */
  nota: 1 | 2 | 3 | 4 | 5;
  /** Tipos de erro marcados pelo avaliador. */
  etiquetas: EtiquetaErro[];
  comentario: string;
  em: string;
};

/** Tipos de erro que o avaliador pode marcar numa resposta. */
export const ETIQUETAS_ERRO = [
  "repeticao",
  "digitacao",
  "contexto",
  "pergunta-repetida",
  "dado-inventado",
  "tom",
  "longa-demais",
  "nao-respondeu",
  "regra-de-negocio",
  "outro",
] as const;
export type EtiquetaErro = (typeof ETIQUETAS_ERRO)[number];
