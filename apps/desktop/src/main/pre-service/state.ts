/**
 * Estado persistente do Pré-atendimento IA (`pre-atendimento.json` na pasta interna do app).
 *
 * Guarda configurações, loja, persona, respostas rápidas, exemplos, chats, rascunhos e o registro de
 * eventos. É a base dos demais módulos: lê o arquivo uma vez (`carregar`), grava e avisa a tela
 * (`gravar`) e anota eventos (`registrar`). Não conhece uTalk, modelo nem estoque.
 */
import fs from "node:fs";
import path from "node:path";
import { gravarAtomico } from "../core/atomic-write";
import * as caminhos from "../core/paths";
import type { Buscar } from "../crm/utalk-api";
import {
  CONFIG_PADRAO,
  LOJA_PADRAO,
  PERSONAS_ANTERIORES,
  PERSONA_PADRAO,
  RESPOSTAS_PADRAO,
  FINANCIAMENTO_ANTERIOR,
  type ConfigIa,
  type ExemploIa,
  type LojaIa,
  type MensagemIa,
  type RespostaRapida,
} from "../../shared/pre-service";
import { fichaCompativel, type FichaLead } from "../../shared/lead-profile";

export type Emitir = (nome: string, carga: unknown) => void;
export const buscar = fetch as Buscar;

// ------------------------------------------------------------------ estado
export type EstadoChat = {
  chatId: string;
  contatoId: string | null;
  nome: string;
  telefone: string | null;
  historico: (MensagemIa & { em: number })[];
  status: "ativo" | "humano" | "encerrado";
  vistoAte: number;
  ultimaIaEm: number | null;
  fotosEnviadas: Record<string, number>;
  /** A IA conseguiu tirar a etiqueta de gatilho ao transferir? (`false` = ela ainda está no lead) */
  gatilhoRetirado?: boolean;
  /** O que a IA já sabe do lead (CPF cifrado). */
  ficha?: FichaLead;
  /** Só as mensagens depois deste instante contam para a ficha (começa um novo ciclo ao devolver o lead à IA). */
  fichaDesde?: number;
};
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
  veiculoFotosId: string | null;
  inicioFotos: number;
  em: number;
};
export type Registro = { em: string; tipo: string; texto: string };
export type Estado = {
  config: ConfigIa;
  loja: LojaIa;
  persona: string;
  respostas: RespostaRapida[];
  exemplos: ExemploIa[];
  chats: Record<string, EstadoChat>;
  rascunhos: Rascunho[];
  registros: Registro[];
};

const ARQUIVO = () => path.join(caminhos.userData(), "pre-atendimento.json");
let estado: Estado | null = null;
let emitirEvento: Emitir = () => {};

export function carregar(): Estado {
  if (estado) return estado;
  let lido: Partial<Estado> = {};
  try {
    lido = JSON.parse(fs.readFileSync(ARQUIVO(), "utf8")) as Partial<Estado>;
  } catch {
    /* primeira vez */
  }
  estado = {
    config: { ...CONFIG_PADRAO, ...lido.config },
    loja: {
      ...LOJA_PADRAO,
      ...lido.loja,
      ...(lido.loja?.financiamento === FINANCIAMENTO_ANTERIOR
        ? { financiamento: LOJA_PADRAO.financiamento }
        : {}),
    },
    persona:
      !lido.persona || PERSONAS_ANTERIORES.includes(lido.persona)
        ? PERSONA_PADRAO
        : lido.persona,
    respostas: lido.respostas ?? structuredClone(RESPOSTAS_PADRAO),
    exemplos: lido.exemplos ?? [],
    chats: Object.fromEntries(
      Object.entries(lido.chats ?? {}).map(([id, c]) => [
        id,
        c.ficha ? { ...c, ficha: fichaCompativel(c.ficha) } : c,
      ]),
    ),
    rascunhos: lido.rascunhos ?? [],
    registros: lido.registros ?? [],
  };
  return estado;
}
export function gravar() {
  // Atômico: este arquivo guarda configuração, chats e rascunhos inteiros do atendimento.
  gravarAtomico(ARQUIVO(), JSON.stringify(carregar(), null, 1));
  emitirEvento("preatendimento:mudou", null);
}
export function registrar(tipo: string, texto: string) {
  const e = carregar();
  e.registros.unshift({ em: new Date().toISOString(), tipo, texto });
  e.registros = e.registros.slice(0, 300);
  gravar();
}
export const novoId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Define quem recebe o evento `preatendimento:mudou` a cada gravação (a janela principal). */
export function definirEmissor(emitir: Emitir) {
  emitirEvento = emitir;
}
