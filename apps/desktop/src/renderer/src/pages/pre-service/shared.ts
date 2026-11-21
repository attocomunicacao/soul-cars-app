/**
 * Tipos e constantes do painel do Pré-atendimento, compartilhados pela página e pelas abas.
 */
import {
  type ConfigIa,
  type ExemploIa,
  type LojaIa,
  type RespostaRapida,
} from "../../../../shared/pre-service";

export type Rascunho = {
  id: string;
  chatId: string;
  nome: string;
  pergunta: string;
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  fotos: string[];
  veiculoFotos: string | null;
  em: number;
};

export type Painel = {
  config: ConfigIa;
  loja: LojaIa;
  persona: string;
  respostas: RespostaRapida[];
  exemplos: ExemploIa[];
  rascunhos: Rascunho[];
  chats: {
    chatId: string;
    nome: string;
    status: "ativo" | "humano" | "encerrado";
    mensagens: number;
    ultima: { role: string; content: string; em: number } | null;
    ultimaIaEm: number | null;
    resumo: string | null;
  }[];
  registros: { em: string; tipo: string; texto: string }[];
  laco: {
    rodando: boolean;
    ultimaRodada: string | null;
    ultimoErro: string | null;
  };
  conexoes: { utalk: boolean; groq: boolean };
  estoque: number;
  exemplosReais: number;
};

export type Agir = (
  comando: string,
  args?: Record<string, unknown>,
) => Promise<boolean>;
