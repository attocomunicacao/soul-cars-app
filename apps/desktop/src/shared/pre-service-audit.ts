/**
 * Auditoria do Pré-atendimento IA: o formato de cada "turno" (uma resposta da IA) e as regras puras que
 * apontam sinais de alerta na resposta (prometeu consultor sem transferir, preço fora do estoque,
 * estoque contado errado, fechamento repetido etc.). Sem Electron nem disco: a gravação fica em
 * `main/pre-service/audit.ts` e a tela em `pages/pre-service/PreServicePage.tsx`.
 */
import { normalizar, pediuFoto, type VeiculoIa } from "./pre-service";

/** Sinais de alerta que a auditoria sabe detectar. */
export type SinalAuditoria =
  | "prometeu-consultor-sem-transferir"
  | "preco-fora-do-estoque"
  | "nega-estoque-existente"
  | "contagem-estoque-diferente"
  | "fechamento-repetido"
  | "resposta-longa"
  | "sem-resposta"
  | "foto-sem-plano"
  | "ofereceu-simulacao"
  | "financiamento-sem-dados"
  | "erro";

/** Texto curto de cada sinal, para a tela. */
export const ROTULO_SINAL: Record<SinalAuditoria, string> = {
  "prometeu-consultor-sem-transferir":
    "Prometeu falar com a equipe, mas não transferiu",
  "preco-fora-do-estoque": "Citou um preço que não está no estoque",
  "nega-estoque-existente": "Disse ter poucos carros, mas o estoque tem mais",
  "contagem-estoque-diferente": "Quantidade de carros diferente do estoque",
  "fechamento-repetido": "Repetiu a mesma pergunta de fechamento",
  "resposta-longa": "Resposta longa demais para WhatsApp",
  "sem-resposta": "Não respondeu a mensagem nova",
  "foto-sem-plano": "Disse que enviou fotos, mas nenhuma foi planejada",
  "ofereceu-simulacao": "Ofereceu simular parcelas (a IA não calcula)",
  "financiamento-sem-dados":
    "Financiamento sem pedir CPF, nascimento e entrada (ou transferiu sem eles)",
  erro: "Erro ao responder ou entregar",
};

export type Desfecho =
  "enviado" | "rascunho" | "aprovado" | "descartado" | "erro" | "simulado";

/** Um turno auditado: o que chegou, o que o modelo devolveu e o que foi feito. */
export type TurnoAuditado = {
  id: string;
  em: string;
  origem: "laco" | "simulador";
  chatId: string | null;
  nome: string;
  /** Telefone com os dígitos do meio mascarados. */
  telefone: string | null;
  recebidas: string[];
  provedor: string;
  modelo: string;
  reserva: boolean;
  latenciaMs: number;
  bruto: string;
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  usados: {
    respostas: string[];
    veiculos: number;
    exemplos: number;
    reais: number;
  };
  fotos: { veiculo: string | null; qtd: number; semFotos: boolean };
  estoque: number;
  desfecho: Desfecho;
  erro?: string;
  sinais: SinalAuditoria[];
  /** Dados do financiamento que ainda faltavam (CPF, data de nascimento, entrada). */
  faltando?: string[];
};

/** Entrada de `avaliarTurno`. */
export type EntradaAvaliacao = {
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  recebidas: string[];
  veiculos: VeiculoIa[];
  /** Últimas respostas da IA nesta conversa (mais recente por último), sem a atual. */
  anteriores: string[];
  fotosPlanejadas: number;
  /** Situação da coleta de dados do financiamento (ficha do lead). */
  financiamento?: {
    pediu: boolean;
    faltando: string[];
    podeTransferir: boolean;
  };
};

const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Valores em reais citados no texto (ignora números pequenos, como horários ou parcelas). */
function valoresCitados(texto: string): string[] {
  const achados = texto.matchAll(
    /R\$\s?(\d{1,3}(?:\.\d{3})+|\d{4,})(?:,\d{2})?/g,
  );
  return [...achados].map((m) => soDigitos(m[1]));
}

/** Última frase do texto, normalizada (onde a IA costuma fechar com uma pergunta). */
const fechamento = (texto: string) =>
  normalizar(
    texto
      .trim()
      .split(/\n{2,}/)
      .at(-1) ?? "",
  );

const AGENDAR = /agendar.{0,12}visita|conhecer o carro pessoalmente/;
const PROMETE_EQUIPE =
  /(vou|vamos|irei|posso)\s+(confirmar|verificar|checar|consultar|passar|encaminhar|chamar|falar).{0,50}(consultor|equipe|vendedor|atendente|time)|(consultor|equipe|vendedor|atendente)\s+(vai|ir[áa]|entrar[áa]|retornar[áa]|fazer|faz)|(para|pra)\s+o\s+(consultor|vendedor|time)\s+(fazer|te|ligar|entrar|passar|confirmar|enviar)/;
const SIMULAR = /(posso|podemos|vou|vamos)\s+simular/;
const DIZ_QUE_ENVIOU = /segue|seguem|enviei|enviando|te mand|\u{1F447}/u;
const POUCOS =
  /(apenas|s[óo]|somente)\s+(o |a |um |uma )?[\wÀ-ú-]+.{0,40}(dispon|estoque)|n[ãa]o temos outros/;

/** Aponta os sinais de alerta de uma resposta da IA. */
export function avaliarTurno(e: EntradaAvaliacao): SinalAuditoria[] {
  const sinais: SinalAuditoria[] = [];
  const t = normalizar(e.texto);

  if (!e.texto.trim() && e.recebidas.length) sinais.push("sem-resposta");

  if (PROMETE_EQUIPE.test(t) && !e.transferir && !e.encerrar)
    sinais.push("prometeu-consultor-sem-transferir");

  const precos = new Set(e.veiculos.map((v) => soDigitos(v.preco)));
  // Valor que o próprio cliente digitou (ex.: a entrada) não é preço de carro citado pela IA.
  const digitados = new Set(
    [...e.recebidas.join(" ").matchAll(/\d{1,3}(?:\.\d{3})+|\d{4,}/g)].map(
      (m) => soDigitos(m[0]),
    ),
  );
  const citados = valoresCitados(e.texto).filter((c) => !digitados.has(c));
  if (citados.some((c) => !precos.has(c))) sinais.push("preco-fora-do-estoque");

  if (e.veiculos.length >= 3 && POUCOS.test(t))
    sinais.push("nega-estoque-existente");

  const n = /(\d+)\s+(ve[ií]culos|carros)/.exec(t);
  if (n && Number(n[1]) !== e.veiculos.length)
    sinais.push("contagem-estoque-diferente");

  if (AGENDAR.test(fechamento(e.texto))) {
    const ultimas = e.anteriores.slice(-2);
    if (
      ultimas.length === 2 &&
      ultimas.every((a) => AGENDAR.test(fechamento(a)))
    )
      sinais.push("fechamento-repetido");
  }

  if (e.texto.length > 500) sinais.push("resposta-longa");

  const fin = e.financiamento;
  if (fin?.pediu && fin.faltando.length && !fin.podeTransferir) {
    const pediuDados = /cpf|nascimento|entrada/.test(t);
    if (e.transferir || !pediuDados) sinais.push("financiamento-sem-dados");
  }

  if (SIMULAR.test(t) && !e.transferir) sinais.push("ofereceu-simulacao");

  // Só é falha dizer que enviou foto sem plano de fotos; perguntar "de qual carro?" é correto.
  if (
    pediuFoto(e.recebidas.join(" ")) &&
    e.fotosPlanejadas === 0 &&
    DIZ_QUE_ENVIOU.test(e.texto.toLowerCase())
  )
    sinais.push("foto-sem-plano");

  return sinais;
}

/** Mascara os dígitos do meio de um telefone (guarda DDI/DDD e os 2 últimos dígitos). */
export function mascararTelefone(tel: string | null | undefined) {
  const d = soDigitos(tel ?? "");
  if (d.length < 8) return tel ? "***" : null;
  return `${d.slice(0, 4)}${"*".repeat(d.length - 6)}${d.slice(-2)}`;
}
