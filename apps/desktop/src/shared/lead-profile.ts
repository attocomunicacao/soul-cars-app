/**
 * Ficha do lead no Pré-atendimento IA: a memória estruturada do que o cliente já contou (carro,
 * forma de pagamento, entrada, CPF, data de nascimento, troca) para a IA não repetir perguntas, para
 * conduzir a coleta de dados do financiamento antes de passar ao SDR e para montar o resumo que o SDR
 * recebe. Também mascara CPF e data de nascimento antes de qualquer texto sair do computador (Groq,
 * auditoria, histórico). Regras puras, sem Electron nem disco: o CPF só é cifrado em `main/`.
 */
import type { MensagemIa } from "./pre-service";

/** O que já sabemos de um lead. `cpf` é opaco aqui (no main guarda texto cifrado ou "informado"). */
export type FichaLead = {
  veiculo: string;
  cpf: string;
  /** dd/mm/aaaa */
  nascimento: string;
  /** "R$ 10.000" ou "sem entrada" */
  entrada: string;
  formaPagamento: "" | "financiamento" | "a vista";
  troca: string;
  pediuFinanciamento: boolean;
  /** Quantas vezes a IA já pediu CPF e nascimento sem receber. */
  tentativasDados: number;
  /** O cliente se recusou a passar os dados. */
  recusou: boolean;
  /** A ficha já foi entregue ao SDR (nota privada), para não repetir a transferência. */
  entregue: boolean;
};

export const FICHA_VAZIA: FichaLead = {
  veiculo: "",
  cpf: "",
  nascimento: "",
  entrada: "",
  formaPagamento: "",
  troca: "",
  pediuFinanciamento: false,
  tentativasDados: 0,
  recusou: false,
  entregue: false,
};

/** Minúsculas e sem acento. */
const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

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

// ------------------------------------------------------------------ extração
const RECUSA =
  /nao (quero|vou|posso|prefiro) (passar|informar|dar|mandar|enviar)|prefiro nao (passar|informar|dar)|so (com|por) (o )?(consultor|vendedor|ligacao)/;
const PEDE_DADOS = /\bcpf\b|data de nascimento/;

/** Dados que uma mensagem do cliente traz. `perguntaAnterior` = última mensagem da IA/equipe. */
export function extrairDados(
  texto: string,
  perguntaAnterior = "",
  agora = new Date(),
) {
  const t = sem(texto);
  const antes = sem(perguntaAnterior);
  return {
    cpf: acharCpf(texto),
    nascimento: acharNascimento(texto, agora),
    entrada: acharEntrada(texto, /entrada/.test(antes)),
    formaPagamento: (/financ|parcel|credito|simula/.test(t)
      ? "financiamento"
      : /a vista|avista/.test(t)
        ? "a vista"
        : "") as FichaLead["formaPagamento"],
    troca: /troc/.test(t) ? texto.trim().slice(0, 100) : "",
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
  const f = { ...base };
  let pedidos = 0;
  let anterior = "";
  for (const m of conversa) {
    if (m.role === "assistant") {
      if (PEDE_DADOS.test(sem(m.content))) pedidos++;
      anterior = m.content;
      continue;
    }
    const x = extrairDados(m.content, anterior, agora);
    f.cpf = x.cpf || f.cpf;
    f.nascimento = x.nascimento || f.nascimento;
    f.entrada = x.entrada || f.entrada;
    f.formaPagamento = x.formaPagamento || f.formaPagamento;
    f.troca = x.troca || f.troca;
    if (x.formaPagamento === "financiamento") f.pediuFinanciamento = true;
    if (x.recusou) f.recusou = true;
  }
  if (faltando(f).length)
    f.tentativasDados = Math.max(f.tentativasDados, pedidos);
  return f;
}

// ------------------------------------------------------------------ regras
/** O que ainda falta para a análise de crédito (vazio se o cliente não pediu financiamento). */
export function faltando(f: FichaLead): string[] {
  if (!f.pediuFinanciamento) return [];
  return [
    !f.cpf && "CPF",
    !f.nascimento && "data de nascimento",
    !f.entrada && "entrada",
  ].filter(Boolean) as string[];
}

/** Já pode passar ao SDR? Sim sem financiamento, com os dados completos, se recusou ou se já pediu 2 vezes. */
export const podeTransferir = (f: FichaLead) =>
  !f.pediuFinanciamento ||
  f.entregue ||
  f.recusou ||
  f.tentativasDados >= 2 ||
  faltando(f).length === 0;

/** A frase de pedido de dados, só com o que falta. */
export function frasePedido(f: FichaLead): string {
  const semCpf = !f.cpf;
  const semNasc = !f.nascimento;
  const doc =
    semCpf && semNasc
      ? "preciso do seu CPF e data de nascimento"
      : semCpf
        ? "preciso do seu CPF"
        : semNasc
          ? "preciso da sua data de nascimento"
          : "";
  if (!doc) return "Para a análise de crédito, quanto você dispõe de entrada?";
  return (
    "Consigo fazer uma análise de crédito pra você: " +
    doc +
    "." +
    (f.entrada ? "" : " Quanto você dispõe de entrada?")
  );
}

/** Instrução para o modelo sobre o financiamento ("" se não for o caso ou se já pode transferir sem coletar). */
export function avisoDeFinanciamento(f: FichaLead): string {
  if (!f.pediuFinanciamento || f.entregue) return "";
  if (faltando(f).length === 0)
    return `\n\nATENÇÃO (financiamento): todos os dados da análise de crédito já foram informados. Agradeça em 1 frase, diga que um consultor continua a análise por aqui e inclua [TRANSFERIR]. Não peça os dados de novo.`;
  if (podeTransferir(f)) return "";
  return `\n\nATENÇÃO (financiamento): o cliente quer financiar. Responda a dúvida dele em 1 frase e peça SOMENTE o que falta (${faltando(f).join(", ")}) com esta frase: "${frasePedido(f)}". NÃO inclua [TRANSFERIR] agora.`;
}

/** Bloco "o que já sabemos" para o prompt (CPF e nascimento só como "informado"). */
export function blocoFicha(f: FichaLead): string {
  const linhas = [
    f.veiculo && `- Carro de interesse: ${f.veiculo}`,
    f.formaPagamento && `- Forma de pagamento: ${f.formaPagamento}`,
    f.entrada && `- Entrada: ${f.entrada}`,
    f.cpf && "- CPF: informado (não peça de novo)",
    f.nascimento && "- Data de nascimento: informada (não peça de novo)",
    f.troca && `- Troca: ${f.troca}`,
  ].filter(Boolean);
  return linhas.length
    ? `O QUE JÁ SABEMOS DO LEAD (não pergunte de novo):\n${linhas.join("\n")}`
    : "";
}

/** Resumo para o SDR. `cpfPlano` (só dígitos) entra na nota privada; sem ele, o CPF aparece só como informado. */
export function resumoParaSdr(
  f: FichaLead,
  dados: { nome: string; cpfPlano?: string },
): string {
  const cpf = dados.cpfPlano
    ? formatarCpf(dados.cpfPlano)
    : f.cpf
      ? "informado no chat"
      : "";
  const falta = faltando(f);
  return [
    "RESUMO DA IA (pré-atendimento)",
    `Lead: ${dados.nome}`,
    f.veiculo && `Carro: ${f.veiculo}`,
    f.formaPagamento && `Pagamento: ${f.formaPagamento}`,
    f.entrada && `Entrada: ${f.entrada}`,
    cpf && `CPF: ${cpf}`,
    f.nascimento && `Nascimento: ${f.nascimento}`,
    f.troca && `Troca: ${f.troca}`,
    falta.length && `Ainda falta: ${falta.join(", ")}`,
    f.recusou && "O cliente preferiu não passar os dados por mensagem.",
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
