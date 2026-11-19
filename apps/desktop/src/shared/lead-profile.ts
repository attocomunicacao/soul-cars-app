/**
 * Ficha do lead no Pré-atendimento IA: a memória estruturada do que o cliente já contou (carro,
 * região, forma de aquisição, entrada, CPF, nascimento, CNH, troca, melhor horário para a ligação).
 * Serve para a IA não repetir perguntas, para conduzir a qualificação (uma pergunta por mensagem)
 * antes de passar ao SDR, que liga para o cliente e marca a visita, e para montar a nota que o SDR
 * recebe. Também mascara CPF e data de nascimento antes de qualquer texto sair do computador (Groq,
 * auditoria, histórico). Regras puras, sem Electron nem disco: CPF e nascimento só são cifrados em `main/`.
 */
import type { MensagemIa } from "./pre-service";

export type Pagamento = "a vista" | "financiado" | "cartao" | "troca";

/** Itens que a IA tenta descobrir, na ordem em que pergunta. */
export type Campo =
  | "regiao"
  | "pagamento"
  | "troca"
  | "cpf"
  | "nascimento"
  | "cnh"
  | "entrada"
  | "horario";

/** O que já sabemos de um lead. `cpf` e `nascimento` guardam texto cifrado no main (aqui são opacos). */
export type FichaLead = {
  veiculo: string;
  regiao: string;
  pagamento: Pagamento[];
  /** Modelo e ano do veículo dado na troca. */
  troca: string;
  /** "R$ 10.000" ou "sem entrada" */
  entrada: string;
  cpf: string;
  /** dd/mm/aaaa */
  nascimento: string;
  cnh: "" | "sim" | "nao";
  /** Melhor dia e horário para a ligação do consultor. */
  horarioLigacao: string;
  /** Quantas vezes a IA já perguntou cada item sem receber (2 = dispensado). */
  pedidos: Partial<Record<Campo, number>>;
  /** Mensagens do cliente vistas (a coleta só começa depois de algum interesse). */
  mensagensCliente: number;
  /** O cliente se recusou a passar os dados. */
  recusou: boolean;
  /** A ficha já foi entregue ao SDR (nota privada), para não repetir a transferência. */
  entregue: boolean;
};

export const FICHA_VAZIA: FichaLead = {
  veiculo: "",
  regiao: "",
  pagamento: [],
  troca: "",
  entrada: "",
  cpf: "",
  nascimento: "",
  cnh: "",
  horarioLigacao: "",
  pedidos: {},
  mensagensCliente: 0,
  recusou: false,
  entregue: false,
};

/** Aceita fichas salvas por versões anteriores (`formaPagamento`, `tentativasDados`…) e completa o que falta. */
export function fichaCompativel(bruto: unknown): FichaLead {
  const r = (bruto ?? {}) as Record<string, unknown>;
  const f: FichaLead = {
    ...FICHA_VAZIA,
    ...(r as Partial<FichaLead>),
    pagamento: Array.isArray(r.pagamento) ? (r.pagamento as Pagamento[]) : [],
    pedidos: (r.pedidos as FichaLead["pedidos"]) ?? {},
  };
  if (!f.pagamento.length) {
    if (r.formaPagamento === "financiamento") f.pagamento = ["financiado"];
    else if (r.formaPagamento === "a vista") f.pagamento = ["a vista"];
  }
  return f;
}

/** Minúsculas e sem acento. */
const sem = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

// ------------------------------------------------------------------ CPF e data
const CPF_RE = /(?<!\d)(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-.\s]?(\d{2})(?!\d)/g;
const DATA_RE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g;

/** Confere os dois dígitos verificadores do CPF (11 dígitos, não todos iguais). */
export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(digitos[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(digitos[9]) && dv(10) === Number(digitos[10]);
}

/** "52998224725" → "529.982.247-25". */
export const formatarCpf = (d: string) =>
  d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

/** Primeiro CPF válido do texto (só dígitos) ou "". */
function acharCpf(texto: string): string {
  for (const m of texto.matchAll(CPF_RE)) {
    const d = m[1] + m[2] + m[3] + m[4];
    if (cpfValido(d)) return d;
  }
  return "";
}

/** Primeira data de nascimento plausível (maior de 18 anos) como dd/mm/aaaa, ou "". */
function acharNascimento(texto: string, agora: Date): string {
  for (const m of texto.replace(CPF_RE, " ").matchAll(DATA_RE)) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    let ano = Number(m[3]);
    if (m[3].length === 2) {
      const seculo20 = 2000 + ano;
      ano = agora.getFullYear() - seculo20 >= 18 ? seculo20 : 1900 + ano;
    }
    const d = new Date(ano, mes - 1, dia);
    const idade = agora.getFullYear() - ano;
    if (
      d.getFullYear() === ano &&
      d.getMonth() === mes - 1 &&
      d.getDate() === dia &&
      idade >= 18 &&
      idade <= 100
    )
      return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
  }
  return "";
}

// ------------------------------------------------------------------ entrada
const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

function numero(txt: string, sufixo?: string): number | null {
  const n = parseFloat(txt.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return /^(mil|k)$/.test(sufixo ?? "") ? n * 1000 : n;
}

/** Valor da entrada dito pelo cliente. `perguntouEntrada`: a IA acabou de perguntar, então vale um valor solto. */
function acharEntrada(texto: string, perguntouEntrada: boolean): string {
  const t = sem(texto).replace(CPF_RE, " ").replace(DATA_RE, " ");
  if (
    /(sem|nao tenho|zero de|nenhuma) entrada|entrada (zero|nenhuma)/.test(t) ||
    (perguntouEntrada && /^\W*(nao|nada|zero)\W*$/.test(t))
  )
    return "sem entrada";
  const antes =
    /(?:r\$\s*)?(\d[\d.,]*)\s*(mil|k)?\s*(?:reais\s*)?(?:de |pra |para )?entrada/.exec(
      t,
    );
  const depois =
    /entrada\s*(?:de|:|e|seria|=)?\s*(?:r\$\s*)?(\d[\d.,]*)\s*(mil|k)?/.exec(t);
  const achado = antes ?? depois;
  let n = achado ? numero(achado[1], achado[2]) : null;
  if (n === null && perguntouEntrada) {
    // A IA acabou de perguntar a entrada: vale o último valor da resposta, exceto algo que parece ano.
    for (const m of t.matchAll(/(r\$\s*)?(\d[\d.,]*)\s*(mil|k)?/g)) {
      const valor = numero(m[2], m[3]);
      const pareceAno =
        !m[1] && !m[3] && valor !== null && valor >= 1950 && valor <= 2035;
      if (valor !== null && !pareceAno) n = valor;
    }
  }
  return n !== null && n >= 100 ? brl(n) : "";
}

// ------------------------------------------------------------------ perguntas da IA
/** Como reconhecer, numa mensagem da IA, que ela perguntou cada item. */
const PERGUNTA: Record<Campo, RegExp> = {
  regiao: /regiao|bairro|cidade|onde voce (mora|esta|fica)/,
  pagamento:
    /(a vista|financ)[^.?!]*(cartao|troca)|como voce pretende|forma de pagamento/,
  troca: /(modelo|ano)[^.?!]*troca|troca[^.?!]*(modelo|ano)/,
  cpf: /\bcpf\b/,
  nascimento: /nascimento/,
  cnh: /\bcnh\b|habilitacao/,
  entrada: /entrada/,
  horario: /(melhor|qual)[^.?!]*(dia|horario)|horario[^.?!]*ligac/,
};

const CAMPOS = Object.keys(PERGUNTA) as Campo[];
const perguntou = (anterior: string, campo: Campo) =>
  PERGUNTA[campo].test(sem(anterior));

// ------------------------------------------------------------------ extração
const RECUSA =
  /nao (quero|vou|posso|prefiro) (passar|informar|dar|mandar|enviar)|prefiro nao (passar|informar|dar)|so (com|por) (o )?(consultor|vendedor|ligacao)/;
const HUMANO =
  /(falar|conversar|atendimento) com (um |uma |o |a )?(humano|atendente|vendedor|consultor|pessoa|gerente)|\bme (liga|ligue)\b|pode (me )?ligar|quero (que )?(voces |vcs )?(me )?(ligu?e|ligar)|prefiro (falar|ligacao)/;

/** O cliente pediu para falar com alguém ou receber uma ligação? */
export const pediuHumano = (texto: string) => HUMANO.test(sem(texto));

const palavrasDe = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Região dita pelo cliente ("moro em Osasco") ou resposta curta à pergunta da IA. */
function acharRegiao(texto: string, anterior: string): string {
  const t = texto.replace(CPF_RE, " ").replace(DATA_RE, " ").trim();
  const dito =
    /\b(?:(?:moro|resido|moramos|fico)\s+(?:em|na|no|de|da|do|perto de)|sou\s+(?:de|da|do))\s+([^,.!?\n]{2,40})/i.exec(
      t,
    );
  if (dito) return dito[1].trim();
  if (
    perguntou(anterior, "regiao") &&
    t &&
    !/[?\d]/.test(t) &&
    palavrasDe(t) <= 8 &&
    t.length <= 80
  )
    return t.replace(/^(aqui|sou|estou) (em|na|no|de)\s+/i, "").trim();
  return "";
}

/** Melhor dia/horário para a ligação, dito junto de "ligar" ou como resposta à pergunta da IA. */
function acharHorario(texto: string, anterior: string): string {
  const t = texto.trim();
  const n = sem(t);
  const tempo =
    /\b(amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo|manha|tarde|noite|depois do almoco)\b|\d{1,2}\s*(h|:|horas?)/;
  if (perguntou(anterior, "horario") && !/\?/.test(t) && palavrasDe(t) <= 12)
    return t;
  if (/\bliga|ligac|ligar|ligue/.test(n) && tempo.test(n) && !/\?/.test(t))
    return t.slice(0, 80);
  return "";
}

function acharCnh(texto: string, anterior: string): "" | "sim" | "nao" {
  const t = sem(texto);
  if (
    /(sem|nao tenho|nao possuo|nao tenho a) (cnh|habilitacao|carteira)/.test(t)
  )
    return "nao";
  if (
    /(tenho|possuo|com|tenho a) (a )?(cnh|habilitacao|carteira)|cnh (a|b|ab|ok|valida)\b/.test(
      t,
    )
  )
    return "sim";
  if (perguntou(anterior, "cnh")) {
    if (/^\W*(sim|s|tenho|possuo|tenho sim|possuo sim)\W*$/.test(t))
      return "sim";
    if (/^\W*(nao|n|nao tenho|nao possuo)\W*$/.test(t)) return "nao";
  }
  return "";
}

/** Formas de pagamento citadas. */
function acharPagamento(texto: string): Pagamento[] {
  const t = sem(texto);
  const achados: Pagamento[] = [];
  if (/a vista|avista|\bpix\b|dinheiro|em especie/.test(t))
    achados.push("a vista");
  if (/financ|parcel|credito|prestac/.test(t)) achados.push("financiado");
  if (/cartao/.test(t)) achados.push("cartao");
  if (/troc/.test(t)) achados.push("troca");
  return achados;
}

/** Dados que uma mensagem do cliente traz. `perguntaAnterior` = última mensagem da IA/equipe. */
export function extrairDados(
  texto: string,
  perguntaAnterior = "",
  agora = new Date(),
) {
  const t = sem(texto);
  const troca =
    perguntou(perguntaAnterior, "troca") && !/\?/.test(texto)
      ? texto.trim().slice(0, 100)
      : /troc/.test(t)
        ? texto.trim().slice(0, 100)
        : "";
  return {
    cpf: acharCpf(texto),
    nascimento: acharNascimento(texto, agora),
    entrada: acharEntrada(texto, perguntou(perguntaAnterior, "entrada")),
    pagamento: acharPagamento(texto),
    troca,
    cnh: acharCnh(texto, perguntaAnterior),
    regiao: acharRegiao(texto, perguntaAnterior),
    horario: acharHorario(texto, perguntaAnterior),
    recusou: RECUSA.test(t),
  };
}

/**
 * Atualiza a ficha com a conversa (idempotente: pode ser chamada de novo com as mesmas mensagens).
 * `base` traz o que já foi aprendido em rodadas anteriores, além das mensagens que a conversa ainda mostra.
 */
export function fichaDaConversa(
  conversa: MensagemIa[],
  base: FichaLead = FICHA_VAZIA,
  agora = new Date(),
): FichaLead {
  const f: FichaLead = {
    ...base,
    pagamento: [...base.pagamento],
    pedidos: { ...base.pedidos },
  };
  const pedidosNaJanela: Partial<Record<Campo, number>> = {};
  let doCliente = 0;
  let anterior = "";
  for (const m of conversa) {
    if (m.role === "assistant") {
      for (const c of CAMPOS)
        if (perguntou(m.content, c))
          pedidosNaJanela[c] = (pedidosNaJanela[c] ?? 0) + 1;
      anterior = m.content;
      continue;
    }
    doCliente++;
    const x = extrairDados(m.content, anterior, agora);
    f.cpf = x.cpf || f.cpf;
    f.nascimento = x.nascimento || f.nascimento;
    f.entrada = x.entrada || f.entrada;
    f.troca = x.troca || f.troca;
    f.cnh = x.cnh || f.cnh;
    f.regiao = x.regiao || f.regiao;
    f.horarioLigacao = x.horario || f.horarioLigacao;
    for (const p of x.pagamento)
      if (!f.pagamento.includes(p)) f.pagamento.push(p);
    if (x.recusou) f.recusou = true;
  }
  f.mensagensCliente = Math.max(f.mensagensCliente, doCliente);
  for (const c of CAMPOS)
    f.pedidos[c] = Math.max(f.pedidos[c] ?? 0, pedidosNaJanela[c] ?? 0);
  return f;
}

// ------------------------------------------------------------------ regras da coleta
export const financiado = (f: FichaLead) => f.pagamento.includes("financiado");

/** Troca "informada" quando há modelo/ano (ex.: "Gol 2015"), não só a palavra "troca". */
const temDetalheDeTroca = (s: string) =>
  /\b(19|20)\d{2}\b/.test(s) || palavrasDe(s) >= 5;

/** A coleta começa quando o cliente demonstrou interesse (carro, forma de pagamento ou 2+ mensagens). */
export const coletaAtiva = (f: FichaLead) =>
  !!f.veiculo || f.pagamento.length > 0 || f.mensagensCliente >= 2;

/** Itens que o consultor precisa e ainda não temos, na ordem de pergunta (inclui os já dispensados). */
export function ausentes(f: FichaLead): Campo[] {
  const falta: Campo[] = [];
  // Se o cliente já falou em financiar, os dados do financiamento são o assunto: vêm primeiro.
  if (financiado(f)) {
    if (!f.cpf) falta.push("cpf");
    if (!f.nascimento) falta.push("nascimento");
    if (!f.cnh) falta.push("cnh");
    if (!f.entrada) falta.push("entrada");
  }
  if (!f.regiao) falta.push("regiao");
  if (!f.pagamento.length) falta.push("pagamento");
  if (f.pagamento.includes("troca") && !temDetalheDeTroca(f.troca))
    falta.push("troca");
  if (!f.horarioLigacao) falta.push("horario");
  return falta;
}

/** Itens ainda a perguntar: os ausentes que a IA perguntou menos de 2 vezes. */
export const pendentes = (f: FichaLead): Campo[] =>
  coletaAtiva(f) ? ausentes(f).filter((c) => (f.pedidos[c] ?? 0) < 2) : [];

const ROTULO: Record<Campo, string> = {
  regiao: "região",
  pagamento: "forma de pagamento",
  troca: "modelo e ano do veículo na troca",
  cpf: "CPF",
  nascimento: "data de nascimento",
  cnh: "CNH",
  entrada: "entrada",
  horario: "melhor horário para a ligação",
};
export const rotulos = (campos: Campo[]) => campos.map((c) => ROTULO[c]);

/** Já deu para entender a situação do cliente (nada mais a perguntar)? */
export const coletaCompleta = (f: FichaLead) =>
  coletaAtiva(f) && pendentes(f).length === 0;

/** Pode passar ao SDR? Sem coleta ativa, completa, recusa, pedido do cliente ou já entregue. */
export const podeTransferir = (
  f: FichaLead,
  opcoes: { pediuHumano?: boolean } = {},
) =>
  !coletaAtiva(f) ||
  f.entregue ||
  f.recusou ||
  !!opcoes.pediuHumano ||
  pendentes(f).length === 0;

/** Por que a ficha está sendo entregue ao SDR (para a nota). */
export function motivoDaTransferencia(
  f: FichaLead,
  opcoes: { pediuHumano?: boolean } = {},
): string {
  if (opcoes.pediuHumano) return "o cliente pediu para falar com a equipe";
  if (f.recusou) return "o cliente preferiu não passar os dados por mensagem";
  if (coletaAtiva(f) && ausentes(f).length === 0) return "dados completos";
  if (coletaAtiva(f) && pendentes(f).length === 0)
    return "o cliente não respondeu a alguns itens (perguntados 2 vezes)";
  return "a IA encaminhou o atendimento";
}

// ------------------------------------------------------------------ frases e avisos
/** Os itens do financiamento viram uma só pergunta (a frase do usuário, mais CNH e entrada). */
function fraseDoFinanciamento(f: FichaLead, campos: Campo[]): string {
  const docs = [
    campos.includes("cpf") && "CPF",
    campos.includes("nascimento") && "data de nascimento",
  ].filter(Boolean);
  const partes: string[] = [];
  if (docs.length)
    partes.push(
      "Consigo fazer uma análise de crédito pra você: preciso do seu " +
        docs.join(" e ") +
        ".",
    );
  else partes.push("Para a análise de crédito:");
  if (campos.includes("cnh")) partes.push("Você possui CNH?");
  if (campos.includes("entrada")) partes.push("Quanto você dispõe de entrada?");
  return partes.join(" ");
}

/** A próxima pergunta (uma por mensagem; os itens do financiamento vão juntos) e os itens que ela cobre. */
export function proximaPergunta(
  f: FichaLead,
): { campos: Campo[]; frase: string } | null {
  const pend = pendentes(f);
  if (!pend.length) return null;
  const primeiro = pend[0];
  if (["cpf", "nascimento", "cnh", "entrada"].includes(primeiro)) {
    const grupo = pend.filter((c) =>
      ["cpf", "nascimento", "cnh", "entrada"].includes(c),
    );
    return { campos: grupo, frase: fraseDoFinanciamento(f, grupo) };
  }
  const frases: Partial<Record<Campo, string>> = {
    regiao: "Para te atender melhor, em qual região você está?",
    pagamento:
      "Como você pretende adquirir o veículo: à vista, financiado, cartão ou com veículo na troca?",
    troca: "Qual o modelo e ano do veículo que você daria na troca?",
    horario:
      "Perfeito! Um consultor vai te ligar para entender melhor o que você procura. Qual o melhor dia e horário para essa ligação?",
  };
  return { campos: [primeiro], frase: frases[primeiro] ?? "" };
}

/** Instrução para o modelo sobre a coleta de dados ("" se a coleta não começou ou a ficha já foi entregue). */
export function avisoDeColeta(
  f: FichaLead,
  opcoes: { pediuHumano?: boolean } = {},
): string {
  if (!coletaAtiva(f) || f.entregue) return "";
  if (opcoes.pediuHumano || f.recusou)
    return `\n\nATENÇÃO (qualificação): o cliente quer falar com a equipe${f.recusou ? " e prefere não passar os dados por mensagem" : ""}. Confirme em 1 frase que um consultor vai ligar e inclua [TRANSFERIR]. Não faça mais perguntas e não ofereça visita.`;
  const prox = proximaPergunta(f);
  if (!prox)
    return `\n\nATENÇÃO (qualificação): já temos todos os dados do cliente. Agradeça em 1 frase, diga que um consultor vai ligar${f.horarioLigacao ? ` (${f.horarioLigacao})` : ""} e inclua [TRANSFERIR]. Não faça mais perguntas e não ofereça visita.`;
  return `\n\nATENÇÃO (qualificação): antes de passar ao consultor, entenda a situação do cliente. Responda a dúvida dele em no máximo 1 frase e faça UMA pergunta, com estas palavras: "${prox.frase}" NÃO inclua [TRANSFERIR] agora. NÃO ofereça nem agende visita: o consultor liga primeiro e combina a visita depois.`;
}

const PAGAMENTO_ROTULO: Record<Pagamento, string> = {
  "a vista": "à vista",
  financiado: "financiado",
  cartao: "cartão",
  troca: "veículo na troca",
};

/** Bloco "o que já sabemos" para o prompt (CPF e nascimento só como "informado"). */
export function blocoFicha(f: FichaLead): string {
  const dispensados = ausentes(f).filter((c) => (f.pedidos[c] ?? 0) >= 2);
  const linhas = [
    f.veiculo && `- Carro de interesse: ${f.veiculo}`,
    f.regiao && `- Região: ${f.regiao}`,
    f.pagamento.length &&
      `- Forma de aquisição: ${f.pagamento.map((p) => PAGAMENTO_ROTULO[p]).join(", ")}`,
    f.troca && `- Veículo na troca: ${f.troca}`,
    f.entrada && `- Entrada: ${f.entrada}`,
    f.cpf && "- CPF: informado (não peça de novo)",
    f.nascimento && "- Data de nascimento: informada (não peça de novo)",
    f.cnh && `- CNH: ${f.cnh === "sim" ? "possui" : "não possui"}`,
    f.horarioLigacao && `- Melhor horário para a ligação: ${f.horarioLigacao}`,
    dispensados.length &&
      `- Não responderam (não pergunte de novo): ${rotulos(dispensados).join(", ")}`,
  ].filter(Boolean);
  return linhas.length
    ? `O QUE JÁ SABEMOS DO LEAD (não pergunte de novo):\n${linhas.join("\n")}`
    : "";
}

/** Nota para o SDR. Os valores em claro (`cpfPlano`, `nascimentoPlano`) só entram na nota privada, nunca no painel. */
export function resumoParaSdr(
  f: FichaLead,
  dados: {
    nome: string;
    motivo?: string;
    cpfPlano?: string;
    nascimentoPlano?: string;
  },
): string {
  const cpf = dados.cpfPlano
    ? formatarCpf(dados.cpfPlano)
    : f.cpf
      ? "informado no chat"
      : "";
  const nascimento =
    dados.nascimentoPlano ?? (f.nascimento ? "informado no chat" : "");
  const faltou = ausentes(f);
  return [
    "NOTA DO CLIENTE (pré-atendimento da IA)",
    `Lead: ${dados.nome}`,
    f.veiculo && `Carro de interesse: ${f.veiculo}`,
    f.regiao && `Região: ${f.regiao}`,
    f.pagamento.length &&
      `Forma de aquisição: ${f.pagamento.map((p) => PAGAMENTO_ROTULO[p]).join(", ")}`,
    f.troca && `Veículo na troca: ${f.troca}`,
    f.entrada && `Entrada: ${f.entrada}`,
    cpf && `CPF: ${cpf}`,
    nascimento && `Nascimento: ${nascimento}`,
    f.cnh && `CNH: ${f.cnh === "sim" ? "possui" : "não possui"}`,
    f.horarioLigacao && `Melhor horário para a ligação: ${f.horarioLigacao}`,
    faltou.length && `Não informado: ${rotulos(faltou).join(", ")}`,
    dados.motivo && `Motivo da transferência: ${dados.motivo}`,
    "Próximo passo: ligar para o cliente e, depois da ligação, agendar a visita.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ------------------------------------------------------------------ máscara
/** Troca CPF por "[CPF informado]" e, se `datas`, datas por "[data de nascimento informada]". */
export function mascarar(texto: string, datas = false): string {
  let t = texto.replace(CPF_RE, (m, a, b, c, d) =>
    cpfValido(a + b + c + d) ? "[CPF informado]" : m,
  );
  if (datas)
    t = t.replace(DATA_RE, (m) =>
      acharNascimento(m, new Date()) ? "[data de nascimento informada]" : m,
    );
  return t;
}

/** Máscara numa conversa: datas só são mascaradas quando a pergunta anterior ou o texto falam de nascimento. */
export function mascararConversa(conversa: MensagemIa[]): MensagemIa[] {
  let anterior = "";
  return conversa.map((m) => {
    const datas = /nasc/.test(sem(anterior)) || /nasc/.test(sem(m.content));
    anterior = m.content;
    return { ...m, content: mascarar(m.content, datas) };
  });
}
