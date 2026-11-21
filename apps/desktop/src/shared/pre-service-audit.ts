/**
 * Auditoria do Pré-atendimento IA: o formato de cada "turno" (uma resposta da IA) e as regras puras que
 * apontam sinais de alerta na resposta (prometeu consultor sem transferir, preço fora do estoque,
 * estoque contado errado, fechamento repetido etc.). Sem Electron nem disco: a gravação fica em
 * `main/pre-service/audit.ts` e a tela em `pages/pre-service/PreServicePage.tsx`.
 */
import { normalizar, pediuFoto, type VeiculoIa } from "./pre-service";
import { perguntouCampo, type Campo } from "./lead-profile";
import { achados } from "./pre-service-guard";

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
  | "transferiu-sem-coletar"
  | "ofereceu-visita"
  | "resposta-repetida"
  | "dispensou-sem-recusa"
  | "perguntou-dado-ja-informado"
  | "perguntou-regiao-sem-carro"
  | "quase-repetida"
  | "frase-duplicada"
  | "palavra-repetida"
  | "cpf-em-claro"
  | "texto-sujo"
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
    "Cliente falou de financiamento e a IA não pediu os dados que faltavam",
  "transferiu-sem-coletar":
    "Transferiu antes de coletar os dados (região, pagamento, horário…)",
  "resposta-repetida": "Repetiu a mesma resposta da mensagem anterior",
  "dispensou-sem-recusa":
    "Deixou de pedir um dado (3 pedidos sem resposta) sem o cliente recusar",
  "ofereceu-visita":
    "Ofereceu agendar visita (o consultor combina depois da ligação)",
  "perguntou-regiao-sem-carro":
    "Perguntou a região antes de confirmar o carro de interesse",
  "perguntou-dado-ja-informado":
    "Perguntou de novo algo que o cliente já respondeu",
  "quase-repetida": "Resposta quase igual a uma das últimas da IA",
  "frase-duplicada": "Frase repetida dentro da mesma resposta",
  "palavra-repetida": 'Palavra repetida em seguida (ex.: "de de")',
  "cpf-em-claro": "CPF do cliente escrito na resposta",
  "texto-sujo": "Espaços ou pontuação duplicados no texto",
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
  /** Itens da qualificação que a IA ainda ia perguntar (região, CPF, entrada…). */
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
  /** Situação da qualificação do lead (ficha): financiado?, itens pendentes e se já podia transferir. */
  coleta?: {
    financiado: boolean;
    pendentes: string[];
    podeTransferir: boolean;
    /** Itens que a ficha já tem: a IA não deveria perguntar de novo. */
    informados: Campo[];
    /** Itens dispensados por falta de resposta (3 pedidos), quando o cliente não recusou. */
    dispensados?: Campo[];
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
const OFERECE_VISITA =
  /(quer|queira|gostaria|prefere|posso|podemos|vamos)[^.?!]{0,25}(agendar|marcar)[^.?!]{0,15}visita|agendar (uma )?visita para|conhecer o carro pessoalmente/;
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

  // Promessa de consultor nas frases afirmativas (a pergunta do horário, "um consultor vai te ligar… qual o
  // melhor dia?", faz parte do roteiro e não conta).
  const afirmacoes = e.texto
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => s && !s.includes("?"));
  if (
    !e.transferir &&
    !e.encerrar &&
    !perguntouCampo(e.texto, "horario") &&
    afirmacoes.some((s) => PROMETE_EQUIPE.test(normalizar(s)))
  )
    sinais.push("prometeu-consultor-sem-transferir");

  // Mesma resposta que a IA acabou de mandar (não deveria ser enviada duas vezes seguidas).
  if (
    e.texto.trim() &&
    e.anteriores.length &&
    normalizar(e.anteriores[e.anteriores.length - 1]) === normalizar(e.texto)
  )
    sinais.push("resposta-repetida");

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

  const col = e.coleta;
  if (col) {
    if (e.transferir && !col.podeTransferir)
      sinais.push("transferiu-sem-coletar");
    // Só vale quando o cliente falou de financiamento agora e a IA não pediu nenhum dos dados.
    const docs = ["cpf", "nascimento", "cnh", "entrada"].some((c) =>
      col.pendentes.includes(c),
    );
    const falouDeFinanciar = /financ|parcel|entrada|credito/.test(
      normalizar(e.recebidas.join(" ")),
    );
    if (
      col.financiado &&
      docs &&
      falouDeFinanciar &&
      !/cpf|nascimento|cnh|entrada/.test(t) &&
      !e.transferir
    )
      sinais.push("financiamento-sem-dados");
  }

  if (OFERECE_VISITA.test(t)) sinais.push("ofereceu-visita");

  // A IA perguntou de novo algo que a ficha já tem (CPF, entrada, região…)? Só conta frase com "?".
  const jaSabia = e.coleta?.informados ?? [];
  const perguntas = e.texto
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => s.includes("?"));
  if (perguntas.some((p) => jaSabia.some((c) => perguntouCampo(p, c))))
    sinais.push("perguntou-dado-ja-informado");
  if (e.coleta?.dispensados?.length) sinais.push("dispensou-sem-recusa");
  // O carro de interesse vem antes da região.
  if (
    e.coleta &&
    !jaSabia.includes("veiculo") &&
    perguntas.some((p) => perguntouCampo(p, "regiao"))
  )
    sinais.push("perguntou-regiao-sem-carro");

  if (SIMULAR.test(t) && !e.transferir) sinais.push("ofereceu-simulacao");

  // Só é falha dizer que enviou foto sem plano de fotos; perguntar "de qual carro?" é correto.
  if (
    pediuFoto(e.recebidas.join(" ")) &&
    e.fotosPlanejadas === 0 &&
    DIZ_QUE_ENVIOU.test(e.texto.toLowerCase())
  )
    sinais.push("foto-sem-plano");

  // Repetições e sujeira de texto (guarda anti-duplicação); a igualdade exata já foi sinalizada acima.
  for (const a of achados(e.texto, e.anteriores))
    if (a !== "quase-repetida" || !sinais.includes("resposta-repetida"))
      sinais.push(a);

  return sinais;
}

/** Mascara os dígitos do meio de um telefone (guarda DDI/DDD e os 2 últimos dígitos). */
export function mascararTelefone(tel: string | null | undefined) {
  const d = soDigitos(tel ?? "");
  if (d.length < 8) return tel ? "***" : null;
  return `${d.slice(0, 4)}${"*".repeat(d.length - 6)}${d.slice(-2)}`;
}
