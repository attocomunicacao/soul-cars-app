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
  | "veiculo"
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
  /** Quantas vezes a IA fez a pergunta de cada item (inclusive as respondidas com uma dúvida). */
  perguntados: Partial<Record<Campo, number>>;
  /** Mensagens do cliente vistas (a coleta só começa depois de algum interesse). */
  mensagensCliente: number;
  /** O cliente se recusou a passar os dados. */
  recusou: boolean;
  /** A ficha já foi entregue ao SDR (nota privada), para não repetir a transferência. */
  entregue: boolean;
  /** O último CPF enviado não passou na validação (digitado errado). */
  cpfInvalido: boolean;
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
  perguntados: {},
  mensagensCliente: 0,
  recusou: false,
  entregue: false,
  cpfInvalido: false,
};

/** Aceita fichas salvas por versões anteriores (`formaPagamento`, `tentativasDados`…) e completa o que falta. */
export function fichaCompativel(bruto: unknown): FichaLead {
  const r = (bruto ?? {}) as Record<string, unknown>;
  const f: FichaLead = {
    ...FICHA_VAZIA,
    ...(r as Partial<FichaLead>),
    pagamento: Array.isArray(r.pagamento) ? (r.pagamento as Pagamento[]) : [],
    pedidos: (r.pedidos as FichaLead["pedidos"]) ?? {},
    perguntados: (r.perguntados as FichaLead["perguntados"]) ?? {},
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

// Contato e endereço: saem mascarados antes de o texto ir ao modelo (a ficha do lead não usa nenhum deles).
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Celular: (DDD) 9 xxxx-xxxx, com ou sem +55, pontuação e espaços. Não pega número colado a outros dígitos. */
const CELULAR_RE =
  /(?<![\d.,])(?:\+?55[\s.-]?)?(?:\(\d{2}\)[\s.-]?|\d{2}[\s.-]?)?9[\s.-]?\d{4}[\s.-]?\d{4}(?![\d])/g;
/** Fixo: precisa do DDD ou de hífen entre os dois blocos, para não pegar "2019 2020" nem preços. */
const FIXO_RE =
  /(?<![\d.,])(?:\+?55[\s.-]?)?(?:(?:\(\d{2}\)[\s.-]?|\d{2}[\s.-])[2-5]\d{3}[\s.-]?\d{4}|[2-5]\d{3}-\d{4})(?![\d])/g;
const CEP_RE = /(?<!\d)\d{5}-\d{3}(?!\d)|(?<=\bcep\s*:?\s*)\d{8}(?!\d)/gi;
const TIPO_DE_VIA = String.raw`(?:rua|r\.|avenida|av\.?|alameda|travessa|tv\.|rodovia|estrada|pra[cç]a)`;
/** Via + número: "Rua das Flores, 123", "Av. Paulista, nº 1578", "Travessa Alegria nº 12". Bairro e região não entram. */
const ENDERECO_RE = new RegExp(
  String.raw`\b${TIPO_DE_VIA}\s+(?:[^,\n]{1,60},\s*(?:n[º°o.]*\s*)?\d{1,5}|[^,\n]{1,60}?\s+n[º°o.]*\s*\d{1,5})\b`,
  "gi",
);
/** Dois anos seguidos ("2019 2020", "2019-2020") parecem fixo, mas são ano de fabricação e modelo. */
const DOIS_ANOS_RE = /^(?:19|20)\d{2}[\s.-](?:19|20)\d{2}$/;

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

/** O texto tem algo no formato de CPF (com . ou -, ou 11 dígitos quando a IA acabou de pedir o CPF)? */
function pareceCpf(texto: string, perguntouCpf: boolean): boolean {
  for (const m of texto.matchAll(CPF_RE)) {
    if (/[.-]/.test(m[0])) return true;
    if (perguntouCpf && /^\d{11}$/.test(m[0].replace(/\s/g, ""))) return true;
  }
  return false;
}

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

const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};
/** Datas escritas de outro jeito ("15 de março de 1990", "15 03 1990", "15031990"), em formato dd/mm/aaaa. */
const DATA_SOLTA = [
  /(?<!\d)(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})(?!\d)/g,
  /(?<!\d)(\d{1,2})\s+(\d{1,2})\s+(\d{4})(?!\d)/g,
  /(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/g,
];
/** Passa as datas "soltas" para dd/mm/aaaa (só vale quando a IA acabou de perguntar o nascimento). */
function dataNormalizada(texto: string): string {
  let t = sem(texto);
  t = t.replace(DATA_SOLTA[0], (m, d: string, mes: string, a: string) =>
    MESES[mes] ? `${d}/${MESES[mes]}/${a}` : m,
  );
  for (const re of DATA_SOLTA.slice(1)) t = t.replace(re, "$1/$2/$3");
  return t;
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
    (perguntouEntrada && /^\W*(nao|nada|zero|nenhum|nenhuma)\W*$/.test(t))
  )
    return "sem entrada";
  // "Somente o carro/o Gol na troca": o veículo é a entrada, em dinheiro não há nada (sem número na frase).
  if (
    (perguntouEntrada || /entrada/.test(t)) &&
    /\b(somente|so|apenas)\s+(o|a|um|uma)\b/.test(t) &&
    !/\d/.test(t.replace(/\b(19|20)\d{2}\b/g, ""))
  )
    return "sem entrada (só o veículo na troca)";
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
  veiculo:
    /qual (desses )?(carro|veiculo)|(carro|veiculo) (voce )?(tem )?interesse/,
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
/** O cliente fez uma pergunta ou pediu explicação (não ignorou o pedido do sistema). */
const DUVIDA =
  /\?|\b(pra|para)\s+que\b|\bpor\s*que\b|\bo\s+que\s+(e|eh)\b|\bcomo\s+assim\b|\bnao\s+entendi\b|\bpra\s+que\b/;

const RECUSA =
  /nao (quero|vou|posso|prefiro) (passar|informar|dar|mandar|enviar)|prefiro nao (passar|informar|dar)|so (com|por) (o )?(consultor|vendedor|ligacao)/;
const HUMANO =
  /(falar|conversar|atendimento) com (um |uma |o |a )?(humano|atendente|vendedor|consultor|pessoa|gerente)|\bme (liga|ligue)\b|pode (me )?ligar|quero (que )?(voces |vcs )?(me )?(ligu?e|ligar)|prefiro (falar|ligacao)|\b(chama|chame|chamar)\s+(um |uma |o |a )?(humano|atendente|vendedor|consultor|gerente|alguem|pessoa)|\b(passa|passe|passar|transfere|transfira)\s+(pra|para|pro|p\/)?\s*(o |a |um |uma )?(humano|atendente|vendedor|consultor|gerente|alguem|pessoa)|falar com alguem|(alguem|pessoa|gente) de verdade|\bquero (um |uma )?(humano|atendente|vendedor|consultor)\b/;

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
  // "Falo aqui da Zona Norte", "aqui de Osasco": o cliente conta de onde fala.
  const daqui =
    /\b(?:(?:falo|escrevo|chamando)\s+)?aqui\s+(?:da|do|de|em|na|no)\s+([^,.!?\n]{2,30})/i.exec(
      t,
    );
  if (daqui && palavrasDe(daqui[1]) <= 4) return daqui[1].trim();
  // "ok", "sim", "depois"… não são uma região.
  const SEM_REGIAO =
    /^(ok|sim|nao|n|ta|hum|uhum|blz|beleza|certo|depois|talvez|agora|tanto faz|nao sei)\b/;
  if (
    perguntou(anterior, "regiao") &&
    t &&
    !/[?\d]/.test(t) &&
    !SEM_REGIAO.test(sem(t)) &&
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

/** Veículo dado na troca: só o modelo/ano ("Gol 2015"), não a frase inteira. */
function acharTroca(texto: string, perguntouTroca: boolean): string {
  const t = texto.trim();
  if (perguntouTroca && !/\?/.test(t)) return t.slice(0, 60);
  if (!/troc/i.test(t)) return "";
  const dito =
    /(?:tenho|dou|daria|dar|meu|minha|com)\s+(?:um|uma|o|a)?\s*([^.,;!?]{3,40}?)\s+(?:na|de|pra|para)\s+(?:a\s+)?troca/i.exec(
      t,
    );
  return (dito ? dito[1] : t).trim().slice(0, 60);
}

/** Dados que uma mensagem do cliente traz. `perguntaAnterior` = última mensagem da IA/equipe. */
export function extrairDados(
  texto: string,
  perguntaAnterior = "",
  agora = new Date(),
) {
  const t = sem(texto);
  const troca = acharTroca(texto, perguntou(perguntaAnterior, "troca"));
  const cpf = acharCpf(texto);
  return {
    cpf,
    // Parece um CPF (com pontos/traço, ou resposta à pergunta do CPF), mas não passou nos dígitos.
    cpfInvalido: !cpf && pareceCpf(texto, perguntou(perguntaAnterior, "cpf")),
    nascimento:
      acharNascimento(texto, agora) ||
      (perguntou(perguntaAnterior, "nascimento")
        ? acharNascimento(dataNormalizada(texto), agora)
        : ""),
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
    perguntados: { ...base.perguntados },
  };
  const pedidosNaJanela: Partial<Record<Campo, number>> = {};
  let doCliente = 0;
  let anterior = "";
  // Itens que a última mensagem da IA perguntou e ainda esperam a resposta do cliente.
  let aguardando: Campo[] = [];
  const GRUPO_FINANCIAMENTO: Campo[] = ["cpf", "nascimento", "cnh", "entrada"];
  const perguntadosNaJanela: Partial<Record<Campo, number>> = {};
  for (const m of conversa) {
    if (m.role === "assistant") {
      aguardando = CAMPOS.filter((c) => perguntou(m.content, c));
      for (const c of aguardando)
        perguntadosNaJanela[c] = (perguntadosNaJanela[c] ?? 0) + 1;
      anterior = m.content;
      continue;
    }
    doCliente++;
    const x = extrairDados(m.content, anterior, agora);
    if (x.cpf) f.cpfInvalido = false;
    else if (x.cpfInvalido) f.cpfInvalido = true;
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
    // Um pedido só conta como "ignorado" depois que o cliente respondeu SEM dar nada do assunto:
    // mandar um dado (mesmo um CPF errado) mostra que ele está colaborando.
    const colaborou = !!(
      x.cpf ||
      x.cpfInvalido ||
      x.nascimento ||
      x.cnh ||
      x.entrada
    );
    // Uma dúvida ("pra que meu CPF?", "o que é análise de crédito?") também não é pedido ignorado: o cliente
    // está engajado e merece a resposta antes de a pergunta ser repetida.
    const duvida = DUVIDA.test(sem(m.content));
    for (const c of aguardando)
      if (!duvida && !(colaborou && GRUPO_FINANCIAMENTO.includes(c)))
        pedidosNaJanela[c] = (pedidosNaJanela[c] ?? 0) + 1;
    aguardando = [];
  }
  f.mensagensCliente = Math.max(f.mensagensCliente, doCliente);
  for (const c of CAMPOS) {
    f.pedidos[c] = Math.max(f.pedidos[c] ?? 0, pedidosNaJanela[c] ?? 0);
    f.perguntados[c] = Math.max(
      f.perguntados[c] ?? 0,
      perguntadosNaJanela[c] ?? 0,
    );
  }
  return f;
}

// ------------------------------------------------------------------ regras da coleta
export const financiado = (f: FichaLead) => f.pagamento.includes("financiado");

/** Troca "informada" quando há modelo/ano (ex.: "Gol 2015"), não só a palavra "troca". */
const temDetalheDeTroca = (s: string) =>
  /\b(19|20)\d{2}\b/.test(s) || palavrasDe(s) >= 5;
/** Quantas vezes a IA pergunta o mesmo item antes de dispensá-lo (o cliente pode tirar uma dúvida no meio). */
export const MAX_PEDIDOS = 3;

/** A coleta começa quando o cliente demonstrou interesse (carro, forma de pagamento ou 2+ mensagens). */
export const coletaAtiva = (f: FichaLead) =>
  !!f.veiculo || f.pagamento.length > 0 || f.mensagensCliente >= 2;

/** Itens que o consultor precisa e ainda não temos, na ordem de pergunta (inclui os já dispensados). */
export function ausentes(f: FichaLead): Campo[] {
  const falta: Campo[] = [];
  // O carro de interesse vem antes de qualquer outra pergunta.
  if (!f.veiculo) falta.push("veiculo");
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

/** Itens ainda a perguntar: os ausentes que a IA perguntou menos de `MAX_PEDIDOS` vezes. */
export const pendentes = (f: FichaLead): Campo[] =>
  coletaAtiva(f)
    ? ausentes(f).filter((c) => (f.pedidos[c] ?? 0) < MAX_PEDIDOS)
    : [];

const ROTULO: Record<Campo, string> = {
  veiculo: "carro de interesse",
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

/** Itens da qualificação que a ficha já tem preenchidos (a IA não deve perguntar de novo). */
export const informados = (f: FichaLead): Campo[] =>
  CAMPOS.filter((c) => {
    switch (c) {
      case "veiculo":
        return !!f.veiculo;
      case "regiao":
        return !!f.regiao;
      case "pagamento":
        return f.pagamento.length > 0;
      case "troca":
        return temDetalheDeTroca(f.troca);
      case "cpf":
        return !!f.cpf;
      case "nascimento":
        return !!f.nascimento;
      case "cnh":
        return !!f.cnh;
      case "entrada":
        return !!f.entrada;
      default:
        return !!f.horarioLigacao;
    }
  });

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
    return "o cliente não respondeu a alguns itens (perguntados 3 vezes)";
  return "a IA encaminhou o atendimento";
}

// ------------------------------------------------------------------ frases e avisos
/** Uma pergunta por mensagem: o cliente responde uma coisa de cada vez e a ficha guarda sem confusão. */
const FRASES: Record<Campo, string> = {
  veiculo: "Qual carro você tem interesse?",
  regiao: "Para te atender melhor, em qual região você está?",
  pagamento:
    "Como você pretende adquirir o veículo: à vista, financiado, cartão ou com veículo na troca?",
  troca: "Qual o modelo e ano do veículo que você daria na troca?",
  cpf: "Qual é o seu CPF?",
  nascimento: "Qual é a sua data de nascimento?",
  cnh: "Você possui CNH?",
  entrada: "Quanto você dispõe de entrada?",
  horario:
    "Perfeito! Um consultor vai te ligar para entender melhor o que você procura. Qual o melhor dia e horário para essa ligação?",
};

/** A próxima pergunta (sempre um único item) e o item que ela cobre. */
export function proximaPergunta(
  f: FichaLead,
): { campos: Campo[]; frase: string } | null {
  const pend = pendentes(f);
  if (!pend.length) return null;
  const primeiro = pend[0];
  if (primeiro === "cpf") {
    // CPF digitado errado: pede só para conferir.
    if (f.cpfInvalido)
      return {
        campos: ["cpf"],
        frase:
          "Não consegui validar esse CPF. Pode conferir e me enviar de novo?",
      };
    // A primeira pergunta do financiamento explica o motivo (a frase do usuário), uma só vez.
    if (!(f.perguntados.cpf ?? 0))
      return {
        campos: ["cpf"],
        frase:
          "Consigo fazer uma análise de crédito pra você. Para começar, qual é o seu CPF?",
      };
  }
  return { campos: [primeiro], frase: FRASES[primeiro] };
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
  return `\n\nATENÇÃO (qualificação): o cliente ainda está sendo atendido pela IA. Responda a dúvida dele em no máximo 1 ou 2 frases, SEM fazer perguntas: o sistema acrescenta sozinho a próxima pergunta. Não escreva pedidos de dados nem de documentos. NÃO inclua [TRANSFERIR] agora. NÃO diga que um consultor vai ligar (isso só no fim, quando o sistema mandar). NÃO ofereça nem agende visita: o consultor liga primeiro e combina a visita depois.`;
}

const PAGAMENTO_ROTULO: Record<Pagamento, string> = {
  "a vista": "à vista",
  financiado: "financiado",
  cartao: "cartão",
  troca: "veículo na troca",
};

/** Bloco "o que já sabemos" para o prompt (CPF e nascimento só como "informado"). */
export function blocoFicha(f: FichaLead): string {
  const dispensados = ausentes(f).filter(
    (c) => (f.pedidos[c] ?? 0) >= MAX_PEDIDOS,
  );
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
/**
 * Troca CPF por "[CPF informado]" e, se `datas`, datas por "[data de nascimento informada]".
 * Sempre troca também e-mail, telefone, CEP e endereço com número (veja `mascararContato`).
 */
export function mascarar(
  texto: string,
  datas = false,
  cpfQualquer = false,
): string {
  // CPF válido sempre; também o que tem cara de CPF (pontos/traço, ou 11 dígitos logo após o pedido do CPF),
  // porque um CPF digitado errado continua sendo dado pessoal.
  let t = texto.replace(CPF_RE, (m, a, b, c, d) =>
    cpfValido(a + b + c + d) ||
    /[.-]/.test(m) ||
    (cpfQualquer && /^\d{11}$/.test(m.replace(/\s/g, "")))
      ? "[CPF informado]"
      : m,
  );
  // Datas de nascimento plausíveis (maior de 18 anos): com ano de 4 dígitos sempre; com 2 dígitos só no contexto.
  t = t.replace(DATA_RE, (m, _d, _m2, ano: string) =>
    (datas || ano.length === 4) && acharNascimento(m, new Date())
      ? "[data de nascimento informada]"
      : m,
  );
  // Com contexto de nascimento, também as datas escritas por extenso ou sem barras.
  if (datas)
    for (const re of DATA_SOLTA)
      t = t.replace(new RegExp(re.source, "gi"), (m) =>
        acharNascimento(dataNormalizada(m), new Date())
          ? "[data de nascimento informada]"
          : m,
      );
  return mascararContato(t);
}

/** Troca e-mail, telefone, CEP e endereço (via + número) pelos marcadores "[… informado]". */
function mascararContato(texto: string): string {
  return texto
    .replace(EMAIL_RE, "[e-mail informado]")
    .replace(CEP_RE, "[CEP informado]")
    .replace(ENDERECO_RE, "[endereço informado]")
    .replace(CELULAR_RE, "[telefone informado]")
    .replace(FIXO_RE, (m) =>
      DOIS_ANOS_RE.test(m.trim()) ? m : "[telefone informado]",
    );
}

/** Máscara numa conversa: datas só são mascaradas quando a pergunta anterior ou o texto falam de nascimento. */
export function mascararConversa(conversa: MensagemIa[]): MensagemIa[] {
  // O contexto é a última mensagem da IA (não a do cliente): o cliente pode mandar CPF e data em mensagens seguidas.
  let ultimaIa = "";
  return conversa.map((m) => {
    if (m.role === "assistant") ultimaIa = m.content;
    const datas = /nasc/.test(sem(ultimaIa)) || /nasc/.test(sem(m.content));
    const cpfQualquer = perguntou(ultimaIa, "cpf");
    return { ...m, content: mascarar(m.content, datas, cpfQualquer) };
  });
}

/**
 * Texto de uma resposta que transfere: sem perguntas (a conversa vai para o consultor) e sempre dizendo
 * que um consultor vai ligar, mesmo que o modelo tenha esquecido.
 */
export function fecharTransferencia(texto: string, f: FichaLead): string {
  const resposta = texto
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("?"))
    .join(" ");
  if (/consultor|ligar|ligacao|ligação/i.test(resposta)) return resposta;
  const quando = f.horarioLigacao ? ` (${f.horarioLigacao})` : "";
  const fecho = `Combinado! Um consultor vai te ligar${quando} para continuar o seu atendimento.`;
  return resposta ? `${resposta}\n\n${fecho}` : fecho;
}

/** A IA fez pergunta sobre este item da qualificação? (para a auditoria) */
export const perguntouCampo = (texto: string, campo: Campo) =>
  perguntou(texto, campo);

/** A mensagem da IA é uma pergunta da qualificação (então a resposta do cliente é dado, não um carro)? */
export const perguntouQualificacao = (anterior: string) =>
  CAMPOS.some((c) => perguntou(anterior, c));

/** Promessa de ligação do consultor: só pode aparecer no fim da qualificação, não no meio dela. */
const PROMETE_LIGACAO =
  /(consultor|equipe|vendedor)[^.?!]{0,25}(vai|ira|entrara)[^.?!]{0,25}(ligar|ligue|contato)|vai te ligar|ligar (para|pra) voce/;

/** Frase que pede um dado ("preciso do seu CPF", "me informe", "qual é o seu…"). */
const PEDE_DADO =
  /\b(preciso|precisamos|precisa|me\s+(informe|envie|passe|mande|diga)|(pode|poderia)\s+(me\s+)?(informar|enviar|passar|mandar)|informe|envie|digite|qual\s+(e|eh|seria)\s+(o|a)\s+seu)\b/;
/** Frase que explica para que serve o dado (resposta a "para que meu CPF?"). */
const EXPLICA =
  /\b(para|pois|porque|serve|utiliza|utilizado|usado|consulta|score)\b|nosso sistema/;

/**
 * Junta a resposta do modelo com a próxima pergunta da qualificação: tira as frases com "?" que o modelo
 * tenha escrito (quem pergunta é o sistema, sempre na ordem certa) e acrescenta a pergunta.
 */
export function anexarPergunta(
  texto: string,
  frase: string,
  campos: Campo[] = [],
  confirmar = false,
): string {
  // Frases da pergunta do sistema: o modelo costuma copiá-las ("Não consegui validar esse CPF.").
  const dela = frase
    .split(/(?<=[.!?])\s+/)
    .map((x) =>
      sem(x)
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/ +/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const resposta = texto
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => {
      if (!x || x.includes("?")) return false;
      if (PROMETE_LIGACAO.test(sem(x))) return false; // ainda está perguntando: não promete ligação
      const norma = sem(x)
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/ +/g, " ")
        .trim();
      if (dela.some((d) => d.includes(norma) || norma.includes(d)))
        return false;
      // Some a frase que PEDE o dado (o sistema já pede); a que EXPLICA ("o CPF é usado para a análise…") fica.
      const pede =
        PEDE_DADO.test(sem(x)) &&
        !EXPLICA.test(sem(x)) &&
        campos.some((c) => perguntou(x, c));
      return !pede;
    })
    .join(" ");
  if (!resposta) return confirmar ? `Anotado!\n\n${frase}` : frase;
  return `${resposta}\n\n${frase}`;
}
