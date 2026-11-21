/**
 * Regras puras do Pré-atendimento IA (portadas do Soul IA): sem Electron, sem rede, sem disco.
 *
 *  - padrões: persona, respostas-rápidas e configurações iniciais;
 *  - contexto: escolha do estoque, respostas-rápidas e exemplos relevantes (sobreposição de palavras);
 *  - horário de visita: o modelo erra a conta, então ela é feita aqui (seg–sex até 16h, sáb até 15h);
 *  - fotos: detecção do pedido, escolha do veículo com tolerância a erro de digitação e plano de envio
 *    (até `maxFotos` por pedido; "mais fotos" continua de onde parou);
 *  - exemplos reais: pares lead → resposta da equipe extraídos das conversas do CRM.
 */

import {
  avisoDeColeta,
  blocoFicha,
  pediuHumano,
  perguntouQualificacao,
  type FichaLead,
} from "./lead-profile";

// ------------------------------------------------------------------ tipos
/** Veículo disponível no estoque (o BNDV só traz marca, modelo, placa, preço e status). */
export type VeiculoIa = {
  id: string;
  marca: string;
  modelo: string;
  placa: string;
  preco: string;
  /** Quilometragem (do DES.md da pasta), ex.: "84.000"; vazio se não houver. */
  km?: string;
};

export type Papel = "user" | "assistant";
export type MensagemIa = { role: Papel; content: string };

export type RespostaRapida = {
  id: string;
  titulo: string;
  palavras: string;
  texto: string;
};
export type ExemploIa = {
  id: string;
  pergunta: string;
  resposta: string;
  origem: "correcao" | "manual";
};
export type ParReal = { conversa: string; pergunta: string; resposta: string };

export type LojaIa = {
  nome: string;
  endereco: string;
  horario: string;
  telefone: string;
  site: string;
  financiamento: string;
  troca: string;
  extra: string;
};

export type Provedor = "groq" | "ollama";

/** Configurações do atendimento (a chave do Groq não fica aqui: vai cifrada no config.json). */
export type ConfigIa = {
  ligado: boolean;
  provedor: Provedor;
  modeloGroq: string;
  reservaOllama: boolean;
  urlOllama: string;
  modeloOllama: string;
  temperatura: number;
  etiquetaGatilhoId: string;
  etiquetaTransferenciaId: string;
  intervaloSeg: number;
  enviarSemAprovacao: boolean;
  enviarAbertura: boolean;
  nomeAgente: string;
  maxFotos: number;
  usarHistoricoCrm: boolean;
};

export const CONFIG_PADRAO: ConfigIa = {
  ligado: false,
  provedor: "groq",
  modeloGroq: "qwen/qwen3.8-27b",
  reservaOllama: true,
  urlOllama: "http://127.0.0.1:11434",
  modeloOllama: "qwen2.5:7b",
  temperatura: 0.4,
  etiquetaGatilhoId: "",
  etiquetaTransferenciaId: "",
  intervaloSeg: 10,
  enviarSemAprovacao: false,
  enviarAbertura: false,
  nomeAgente: "Sofia",
  maxFotos: 6,
  usarHistoricoCrm: true,
};

/** Texto padrão do financiamento até a 1.0.20: quem ainda o usa (sem edição) passa para o novo. */
export const FINANCIAMENTO_ANTERIOR =
  "Trabalhamos com financiamento pelos principais bancos; as condições dependem da análise de crédito.";

export const LOJA_PADRAO: LojaIa = {
  nome: "Soul Cars",
  endereco: "Av. São Miguel, 8999",
  horario:
    "Segunda a sexta, 8h às 17h. Sábado, 8h às 16h. Domingo só com hora marcada. Último horário de visita: 16h em dia útil e 15h no sábado.",
  telefone: "",
  site: "",
  financiamento:
    "Trabalhamos com financiamento; a análise de crédito é feita pelo nosso sistema e as condições dependem do seu score.",
  troca: "Aceitamos seu usado na troca, mediante avaliação presencial.",
  extra: "",
};

/** Personas padrão de versões anteriores: quem ainda usa uma delas (sem edição) passa para a nova. */
export const PERSONAS_ANTERIORES: string[] = [
  `Você é a {agente}, consultora de pré-atendimento da {loja} pelo WhatsApp.
O lead demonstrou interesse num veículo, mas nosso time não conseguiu falar com ele por telefone.
Objetivo: retomar o contato de forma leve, entender o interesse (modelo, faixa de preço, forma de pagamento, troca) e agendar uma visita ou ligação com um consultor.
Regras:
- Mensagens curtas (no máximo 3 frases), tom cordial e natural, em português do Brasil. Sem textão.
- Faça uma pergunta por vez.
- Use SOMENTE as informações do CONTEXTO para falar de veículos, preços, horários e condições. Se não souber, diga que vai confirmar com o consultor.
- Nunca invente preço, quilometragem, ano, disponibilidade ou condição de financiamento.
- Se o veículo pedido NÃO aparece na lista de ESTOQUE, diga que no momento não temos esse modelo e ofereça opções parecidas da lista.
- Um link de anúncio enviado pelo cliente só indica o carro de interesse — não é pedido de humano.
- Se o cliente pedir para falar com humano, estiver irritado, quiser fechar negócio ou confirmar uma visita, responda brevemente e inclua a tag [TRANSFERIR] no fim.
- Se o cliente pedir para não receber mensagens, peça desculpas e inclua [ENCERRAR].`,
  `Você é a {agente}, consultora de pré-atendimento da {loja} pelo WhatsApp.
O lead demonstrou interesse num veículo, mas nosso time não conseguiu falar com ele por telefone.
Objetivo: retomar o contato de forma leve, entender o interesse (modelo, faixa de preço, forma de pagamento, troca) e agendar uma visita ou ligação com um consultor.
Regras:
- Mensagens curtas (no máximo 3 frases), tom cordial e natural, em português do Brasil. Sem textão.
- Faça uma pergunta por vez.
- Use SOMENTE as informações do CONTEXTO para falar de veículos, preços, horários e condições. Se não souber, encaminhe ao consultor conforme as REGRAS DE ENCAMINHAMENTO.
- Nunca invente preço, quilometragem, ano, disponibilidade ou condição de financiamento.
- Se o veículo pedido NÃO aparece na lista de ESTOQUE, diga que no momento não temos esse modelo e ofereça opções parecidas da lista.
- Um link de anúncio enviado pelo cliente só indica o carro de interesse — não é pedido de humano.
- Se o cliente pedir para falar com humano, estiver irritado, quiser fechar negócio ou confirmar uma visita, responda brevemente e inclua a tag [TRANSFERIR] no fim.
- Se o cliente pedir para não receber mensagens, peça desculpas e inclua [ENCERRAR].`,
];

export const PERSONA_PADRAO = `Você é a {agente}, consultora de pré-atendimento da {loja} pelo WhatsApp.
O lead demonstrou interesse num veículo, mas nosso time não conseguiu falar com ele por telefone.
Objetivo: retomar o contato de forma leve, entender a situação do cliente (região, como pretende adquirir o veículo: à vista, financiado, cartão ou veículo na troca) e combinar uma LIGAÇÃO com um consultor. Você não agenda visita: depois da ligação, o consultor combina a visita.
Regras:
- Mensagens curtas (no máximo 3 frases), tom cordial e natural, em português do Brasil. Sem textão.
- Faça uma pergunta por vez.
- Use SOMENTE as informações do CONTEXTO para falar de veículos, preços, horários e condições. O que não estiver lá, o consultor confirma na ligação.
- Nunca invente preço, quilometragem, ano, disponibilidade ou condição de financiamento.
- Se o veículo pedido NÃO aparece na lista de ESTOQUE, diga que no momento não temos esse modelo e ofereça opções parecidas da lista.
- Um link de anúncio enviado pelo cliente só indica o carro de interesse — não é pedido de humano.
- Se o cliente pedir para falar com humano ou estiver irritado, responda brevemente e inclua a tag [TRANSFERIR] no fim.
- Se o cliente pedir para não receber mensagens, peça desculpas e inclua [ENCERRAR].`;

/**
 * Regras fixas de encaminhamento, sempre enviadas ao modelo depois da persona (valem mesmo que uma
 * persona antiga diga o contrário): quando incluir [TRANSFERIR] e como responder a cumprimentos.
 */
export const REGRAS_DE_ENCAMINHAMENTO = `REGRAS DE ENCAMINHAMENTO (valem mesmo que a persona diga o contrário):
- Seu objetivo é entender a situação do cliente e combinar uma LIGAÇÃO com um consultor. Você NÃO agenda nem oferece visita: a visita é combinada pelo consultor depois da ligação. Se o cliente quiser visitar, diga que o consultor liga para combinar.
- Você NÃO calcula parcelas, taxas, avaliação de troca, desconto, quilometragem, laudo nem histórico do carro. Se o cliente perguntar algo que o CONTEXTO não traz, diga que o consultor confirma na ligação e continue a conversa. Nunca prometa calcular nem simular.
- Quando o contexto trouxer o aviso ATENÇÃO (qualificação), siga-o: responda a dúvida em 1 frase e faça a pergunta indicada, uma por mensagem. Só inclua [TRANSFERIR] quando esse aviso mandar ou quando o cliente pedir para falar com alguém.
- Só diga que um consultor vai ligar quando for transferir (no fim da qualificação ou a pedido do cliente); enquanto estiver perguntando, não prometa ligação. Ao transferir, responda em 1 ou 2 frases e não invente prazo.
- Análise de crédito: se o cliente perguntar o que é, explique que é feita pelo NOSSO SISTEMA, que consulta o score do cliente para definir as melhores condições de financiamento. Nunca diga que é um processo dos bancos e nunca use a palavra "histórico": diga "score". Se perguntarem para que serve o CPF ou a data de nascimento: responda em 1 frase que é para a análise de crédito no nosso sistema (consulta do score); o sistema repete a pergunta depois, então não peça o dado nem pergunte nada.
- Pergunta geral ("vocês financiam?", "aceitam troca?"): responda com o texto de FINANCIAMENTO ou TROCA do contexto, sem [TRANSFERIR], e siga a qualificação.
- Não comente a localização do cliente nem diga que a loja é perto ou longe dele; só agradeça a informação.
- Cumprimento sozinho ("oi", "olá", "bom dia"): cumprimente de volta e pergunte no que pode ajudar. Não responda "sem problemas". Apresente-se (nome e loja) só na primeira mensagem da conversa.
- Não ofereça visita e não termine toda mensagem com a mesma pergunta: responda primeiro o que foi perguntado e varie a frase.`;

export const RESPOSTAS_PADRAO: RespostaRapida[] = [
  {
    id: "q1",
    titulo: "Saudação follow-up",
    palavras: "oi olá bom dia boa tarde",
    texto:
      "Oi, {nome}! Aqui é a {agente}, da {loja}. Tentamos falar com você por telefone sobre o veículo que você viu. Ainda está procurando carro?",
  },
  {
    id: "q2",
    titulo: "Horário de atendimento",
    palavras: "horário horario abre fecha funciona sábado domingo",
    texto: "Nosso horário: {horario}",
  },
];

// ------------------------------------------------------------------ texto
/** Minúsculas, sem acento; "66.900" vira "66900" para casar com o preço. */
export const normalizar = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d)\.(\d{3})/g, "$1$2");

const palavras = (s: unknown) =>
  normalizar(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 || /^\d+$/.test(t));

/** Troca {nome}, {agente}, {loja}… pelos valores; marcadores desconhecidos ficam como estão. */
export function preencher(texto: string, vars: Record<string, string>) {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** Os `k` documentos com mais palavras em comum com a consulta (nenhum se não houver sobreposição). */
export function ranquear<T>(
  consulta: string,
  docs: T[],
  textoDe: (d: T) => string,
  k: number,
): T[] {
  const q = new Set(palavras(consulta).filter((t) => t.length > 2));
  return docs
    .map((d) => ({
      d,
      s: palavras(textoDe(d)).reduce((n, t) => n + (q.has(t) ? 1 : 0), 0),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.d);
}

export const descreverVeiculo = (v: VeiculoIa) =>
  [
    `${v.marca} ${v.modelo}`.trim(),
    v.preco && `R$ ${v.preco}`,
    v.km && `${v.km} km`,
  ]
    .filter(Boolean)
    .join(" · ");

// ------------------------------------------------------------ horário de visita
/**
 * Confere o horário pedido na última mensagem do lead. Devolve uma instrução para o modelo quando
 * o horário não pode ser confirmado (antes das 8h ou depois do último horário de visita), ou "".
 */
export function avisoDeHorario(conversa: MensagemIa[]): string {
  const ultima = normalizar(
    conversa.filter((m) => m.role === "user").at(-1)?.content,
  );
  const m = ultima.match(/\b(\d{1,2})\s*(?:h|:|hrs?|horas?)\s*(\d{2})?\b/);
  if (!m) return "";
  const hora = Number(m[1]) + Number(m[2] || 0) / 60;
  if (hora < 6 || hora > 23) return "";
  const dia = /sabado/.test(ultima)
    ? "sábado"
    : /domingo/.test(ultima)
      ? "domingo"
      : "dia útil";
  if (dia === "domingo") return "";
  const limite = dia === "sábado" ? 15 : 16;
  if (hora < 8)
    return `\n\nATENÇÃO: o lead pediu ${m[0]}, antes de a loja abrir (8h). NÃO confirme; ofereça um horário a partir das 8h. Não inclua [TRANSFERIR].`;
  if (hora <= limite) return "";
  return `\n\nATENÇÃO: o lead pediu ${m[0]} (${dia}), mas o último horário de visita é ${limite}h. NÃO confirme esse horário e NÃO inclua [TRANSFERIR]. Explique que a loja fecha logo depois e ofereça um horário até ${limite}h.`;
}

/** Tira as tags [TRANSFERIR]/[ENCERRAR] e o raciocínio do texto do modelo. */
export function interpretarResposta(
  bruto: string,
  conversa: MensagemIa[],
  opcoes: { bloquearTransferencia?: boolean } = {},
) {
  const texto = bruto.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Horário fora do expediente não é visita confirmada: não transfere.
  const transferir =
    /\[TRANSFERIR\]/i.test(texto) &&
    !avisoDeHorario(conversa) &&
    !soLinkDeAnuncio(conversa) &&
    !opcoes.bloquearTransferencia;
  const encerrar = /\[ENCERRAR\]/i.test(texto);
  return {
    texto: texto.replace(/\[(TRANSFERIR|ENCERRAR)\]/gi, "").trim(),
    transferir,
    encerrar,
  };
}

const LINK = /https?:\/\/\S+/i;
const PEDIDO_DE_HUMANO =
  /\b(humano|atendente|vendedor|consultor|pessoa|gerente|ligar|ligue|liga|fechar|comprar|visita|agendar)\b/;

/** A última mensagem do lead é um link de anúncio sem pedido de humano? (o link só indica o carro) */
export function soLinkDeAnuncio(conversa: MensagemIa[]) {
  const ultima =
    conversa.filter((m) => m.role === "user").at(-1)?.content ?? "";
  return (
    LINK.test(ultima) &&
    !PEDIDO_DE_HUMANO.test(normalizar(ultima.replace(LINK, " ")))
  );
}

/** Instrução extra quando a última mensagem do lead é só um link de anúncio, ou "". */
export const avisoDeLink = (conversa: MensagemIa[]) =>
  soLinkDeAnuncio(conversa)
    ? "\n\nATENÇÃO: o lead mandou um link de anúncio. Isso só indica o carro de interesse: responda sobre o carro e NÃO inclua [TRANSFERIR]."
    : "";

// ------------------------------------------------------------------ fotos
const PEDIDO =
  /\b(fotos?|imagens?|imagem|mais fotos|manda(r)? (as )?fotos?|ver (o carro|ele|ela|por dentro|o interior)|como (ele|ela) (e|esta) por dentro)\b/;
/** A mensagem pede foto ("manda foto", "tem mais imagens?", "quero ver por dentro")? */
export const pediuFoto = (texto: string) => PEDIDO.test(normalizar(texto));
const PERGUNTA_OUTRA =
  /\b(quanto|preco|valor|km|quilometr|ano|parcela|financ|entrada|troca|horario|endereco)\b/;

const MARCAS =
  /^(volkswagen|vw|chevrolet|gm|hyundai|toyota|fiat|jeep|nissan|renault|ford|honda|kia|mercedes|benz|bmw|audi|peugeot|citroen|mitsubishi|kawasaki|yamaha)$/;
// Palavras comuns num pedido de foto: se só sobrar isso, o pedido é genérico.
const COMUNS = new Set(
  (
    "tem manda mandar envia enviar fotos foto imagem imagens mais dele dela carro ver por dentro interior " +
    "que voce voces pode poderia quero queria gostaria favor tambem esse essa desse dessa outro outra outras outros uns umas " +
    "algumas alguns qual dos das pra para com sem tudo bem ola bom dia boa tarde noite sim nao ainda mesmo como esta veiculo " +
    "moto modelo aquele aquela daquele daquela consegue vcs vc ele ela isso " +
    "me mim pro encaminha encaminhar encaminhe envie mande manda passa passar mostra mostrar todas todos"
  ).split(" "),
);

/** Distância de edição (Levenshtein). */
export function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}
/** Mesma palavra, tolerando erro de digitação em palavras de 5+ letras ("renagade" ≈ "renegade"). */
export const parecido = (a: string, b: string) =>
  a === b ||
  (!/^\d+$/.test(a) &&
    a.length >= 5 &&
    b.length >= 5 &&
    Math.abs(a.length - b.length) <= 2 &&
    distancia(a, b) <= (a.length >= 7 ? 2 : 1));

const palavrasDoVeiculo = (v: VeiculoIa) =>
  [...new Set(palavras(`${v.marca} ${v.modelo}`))]
    .map((t) => ({ t, peso: MARCAS.test(t) ? 1 : 3 }))
    .concat(v.preco ? [{ t: String(v.preco).replace(/\D/g, ""), peso: 4 }] : [])
    .filter((x) => x.t);

function pontuar(veiculos: VeiculoIa[], texto: string, peso = 1) {
  const ditas = [...new Set(palavras(texto))];
  return new Map(
    veiculos.map((v) => [
      v,
      palavrasDoVeiculo(v).reduce(
        (n, { t, peso: p }) =>
          n + (ditas.some((w) => parecido(w, t)) ? p * peso : 0),
        0,
      ),
    ]),
  );
}

export type Escolha =
  | { tipo: "nenhum" }
  | { tipo: "um"; veiculo: VeiculoIa }
  | { tipo: "varios"; veiculos: VeiculoIa[] };

function decidir(placar: Map<VeiculoIa, number>): Escolha {
  const ord = [...placar].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  if (!ord.length) return { tipo: "nenhum" };
  const topo = ord.filter(([, s]) => s === ord[0][1]).map(([v]) => v);
  return topo.length > 1
    ? { tipo: "varios", veiculos: topo }
    : { tipo: "um", veiculo: topo[0] };
}

/** Veículo citado no texto ("foto do Renagade", "o de 66.900"). */
export const veiculoCitado = (veiculos: VeiculoIa[], texto: string) =>
  decidir(pontuar(veiculos, texto));

/**
 * Carro que o cliente citou nesta mensagem, para a ficha. Mais rígido que `veiculoCitado`: uma palavra
 * EXATA do modelo (ou preço) sempre vale e pode trocar o carro da ficha; a aproximação (erro de digitação)
 * só preenche quando a ficha ainda não tem carro e a mensagem não responde a uma pergunta da qualificação.
 */
export function veiculoMencionado(
  veiculos: VeiculoIa[],
  texto: string,
  perguntaAnterior: string,
  carroDaFicha: string,
): VeiculoIa | null {
  const ditas = new Set(palavras(texto));
  const exato = veiculos
    .map((v) => ({
      v,
      s: palavrasDoVeiculo(v).reduce(
        (n, { t, peso }) => n + (ditas.has(t) ? peso : 0),
        0,
      ),
    }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s);
  if (exato.length && (exato.length === 1 || exato[0].s > exato[1].s))
    return exato[0].v;
  // A aproximação (erro de digitação) só preenche carro vazio e nunca em resposta a uma pergunta da qualificação
  // ("Somente o carro na troca" não é o Sorento).
  if (carroDaFicha || perguntouQualificacao(perguntaAnterior)) return null;
  const escolha = veiculoCitado(veiculos, texto);
  return escolha.tipo === "um" ? escolha.veiculo : null;
}

/** O texto cita algo que parece um carro, mas que não está no estoque? (aí perguntamos, sem chutar) */
export function citaDesconhecido(veiculos: VeiculoIa[], texto: string) {
  const conhecidos = veiculos.flatMap(palavrasDoVeiculo).map((x) => x.t);
  return [...new Set(palavras(texto))].some(
    (w) =>
      w.length > 2 &&
      !COMUNS.has(w) &&
      !/^\d+$/.test(w) &&
      !conhecidos.some((t) => parecido(w, t)),
  );
}

/**
 * O lead citou uma marca que não bate com nenhum veículo do estoque ("tem Jeep Compass?")?
 * Devolve uma instrução para o modelo não inventar o carro, ou "".
 */
export function avisoDeEstoque(veiculos: VeiculoIa[], conversa: MensagemIa[]) {
  const ultima =
    conversa.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const marca = palavras(ultima.replace(LINK, " ")).find((w) => MARCAS.test(w));
  if (!marca) return "";
  const temDaMarca = veiculos.some((v) =>
    palavras(`${v.marca} ${v.modelo}`).some(
      (t) => parecido(t, marca) || t === marca,
    ),
  );
  if (temDaMarca && veiculoCitado(veiculos, ultima).tipo !== "nenhum")
    return "";
  return `\n\nATENÇÃO: o veículo que o lead pediu (${marca}) NÃO está no ESTOQUE. Diga que no momento não temos esse modelo e ofereça 1 ou 2 opções parecidas da lista. NUNCA diga que temos esse carro.`;
}

/** Pedido genérico ("manda foto"): procura o carro nas últimas mensagens e nas etiquetas do contato. */
export function veiculoPeloContexto(
  veiculos: VeiculoIa[],
  conversa: MensagemIa[],
  etiquetas: string[],
) {
  const placar = pontuar(
    veiculos,
    conversa
      .slice(-8)
      .map((m) => m.content)
      .join(" "),
    2,
  );
  for (const [v, s] of pontuar(veiculos, etiquetas.join(" ")))
    placar.set(v, (placar.get(v) ?? 0) + s);
  return decidir(placar);
}

export type PlanoFotos = {
  veiculo: VeiculoIa | null;
  fotos: string[];
  inicio: number;
  semFotos: boolean;
  nota: string;
};

/**
 * O que fazer quando o lead pede foto: as fotos a enviar (depois do texto) e uma instrução para o
 * modelo. `enviadas` = quantas fotos de cada veículo já foram enviadas nesta conversa. `null` se
 * a mensagem não é pedido de foto.
 */
export function planoDeFotos(p: {
  conversa: MensagemIa[];
  veiculos: VeiculoIa[];
  fotosDe: (id: string) => string[];
  etiquetas?: string[];
  enviadas?: Record<string, number>;
  maxFotos?: number;
}): PlanoFotos | null {
  const { conversa, veiculos, fotosDe } = p;
  const doLead = conversa
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const ultima = doLead.at(-1) ?? "";
  const ultimaIa =
    conversa.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
  const pediuAgora = pediuFoto(ultima);
  // Continuação: pediu foto há pouco e agora responde curto citando um carro ou respondendo "de qual?".
  const pediuAntes = doLead.slice(-3, -1).some(pediuFoto);
  const curta =
    ultima.trim().split(/\s+/).length <= 6 &&
    !PERGUNTA_OUTRA.test(normalizar(ultima));
  const citado = veiculoCitado(veiculos, ultima);
  const continua =
    !pediuAgora &&
    pediuAntes &&
    curta &&
    (citado.tipo !== "nenhum" || /qual/i.test(ultimaIa));
  if (!pediuAgora && !continua) return null;

  let r: Escolha = citado;
  if (r.tipo === "nenhum" && !citaDesconhecido(veiculos, ultima))
    r = veiculoPeloContexto(veiculos, conversa, p.etiquetas ?? []);

  const max = Math.max(1, p.maxFotos ?? 6);
  const nome = (v: VeiculoIa) =>
    `${v.marca} ${v.modelo}${v.preco ? ` (R$ ${v.preco})` : ""}`;
  const curto = (v: VeiculoIa) => `${v.marca} ${v.modelo}`;
  const vazio = { veiculo: null, fotos: [], inicio: 0, semFotos: false };

  if (r.tipo === "um") {
    const v = r.veiculo;
    const todas = fotosDe(v.id);
    const ja = p.enviadas?.[v.id] ?? 0;
    const fotos = todas.slice(ja, ja + max);
    if (fotos.length)
      return {
        veiculo: v,
        fotos,
        inicio: ja,
        semFotos: false,
        nota: `FOTOS: logo depois da sua mensagem o sistema vai enviar ${fotos.length} fotos do ${nome(v)}${ja ? " (fotos novas, diferentes das já enviadas)" : ""}. Escreva só UMA frase curta apresentando as fotos, por exemplo: "Segue as fotos do ${curto(v)} 👇". Não fale de outros carros e não diga que o carro está indisponível.`,
      };
    if (todas.length)
      return {
        veiculo: v,
        fotos: [],
        inicio: ja,
        semFotos: false,
        nota: `FOTOS: o lead pediu mais fotos do ${nome(v)}, mas já enviamos todas as ${todas.length} que temos. Diga isso de forma simpática e convide para uma visita para ver o carro pessoalmente.`,
      };
    return {
      veiculo: v,
      fotos: [],
      inicio: 0,
      semFotos: true,
      nota: `FOTOS: o lead pediu fotos do ${nome(v)}, mas ainda não temos fotos cadastradas dele. Diga que vai pedir para um consultor enviar as fotos em breve e siga o atendimento. Não invente que enviou fotos e não diga que o carro está indisponível.`,
    };
  }
  if (r.tipo === "varios")
    return {
      ...vazio,
      nota: `FOTOS: o lead pediu fotos, mas há mais de um veículo possível: ${r.veiculos.slice(0, 4).map(nome).join("; ")}. Pergunte de qual deles ele quer as fotos (cite os preços). Não diga que enviou fotos.`,
    };
  return {
    ...vazio,
    nota: "FOTOS: o lead pediu fotos, mas não identificamos o veículo no nosso estoque. Pergunte de qual carro ele quer as fotos (pode ser que tenha digitado o nome diferente). Não diga que enviou fotos e não diga que o carro está indisponível.",
  };
}

/** Só as fotos numeradas (1.jpeg, 2.jpeg…), em ordem; recortes como "1_sem_fundo.png" ficam de fora. */
export const fotosNumeradas = (nomes: string[]) =>
  nomes
    .filter((f) => /^\d+\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));

// ---------------------------------------------------------- montagem do pedido
export type EntradaContexto = {
  persona: string;
  loja: LojaIa;
  config: Pick<ConfigIa, "nomeAgente">;
  veiculos: VeiculoIa[];
  respostas: RespostaRapida[];
  exemplos: ExemploIa[];
  reais: ParReal[];
  conversa: MensagemIa[];
  nomeLead: string;
  notaFotos?: string;
  /** O que já sabemos do lead (carro, entrada, CPF…): evita repetir perguntas e conduz o financiamento. */
  ficha?: FichaLead;
};

/** Só o primeiro nome: o nome completo não precisa sair do computador para o modelo externo. */
const primeiroNome = (nome = "") => nome.trim().split(/\s+/)[0] ?? "";

export const variaveis = (
  loja: LojaIa,
  nomeAgente: string,
  nomeLead = "",
): Record<string, string> => ({
  nome: nomeLead.split(" ")[0] ?? "",
  agente: nomeAgente,
  loja: loja.nome,
  horario: loja.horario,
  endereco: loja.endereco,
  telefone: loja.telefone,
  site: loja.site,
});

/** A resposta-rápida de abertura ("Saudação…"/"Abertura…"), se houver: mais previsível que o modelo. */
/**
 * Um lead com a etiqueta de gatilho de volta, que a IA tinha entregue à equipe ("humano"), foi devolvido
 * à IA no uTalk. Não vale se a IA não conseguiu tirar a etiqueta (ela nunca saiu) nem para "encerrado":
 * quem pediu para não receber mensagens só volta pelo botão "Devolver à IA".
 */
export const voltouParaIa = (chat: {
  status: string;
  gatilhoRetirado?: boolean;
}) => chat.status === "humano" && chat.gatilhoRetirado !== false;

export const respostaDeAbertura = (respostas: RespostaRapida[]) =>
  respostas.find((q) => /sauda|abertura/i.test(q.titulo)) ?? null;

/** O cliente quer ver todos os carros ("quais são todas as opções?", "o que vocês têm?")? */
const LISTA =
  /(todas?|todos)\s+(as\s+|os\s+)?(opcoes|carros|veiculos|modelos)|quais\s+(sao\s+|voces\s+tem\s+|vcs\s+tem\s+)?(as\s+|os\s+|todas\s+|todos\s+)?(opcoes|carros|veiculos|modelos)|o que (voces |vcs )?tem|catalogo|estoque|(mais|outras|outros)\s+(opcoes|carros|veiculos|modelos)/;
export const pediuLista = (texto: string) => LISTA.test(normalizar(texto));

/** Lista completa do estoque (a IA não escolhe quais mostrar): uma linha por carro, com preço e km quando houver. */
export const listaDeVeiculos = (veiculos: VeiculoIa[]) =>
  `Temos ${veiculos.length} veículos disponíveis:\n` +
  veiculos.map((v) => "- " + descreverVeiculo(v)).join("\n");

/** Mensagens para o modelo: sistema com persona e contexto, exemplos de ensino e as últimas 12 da conversa. */
export function montarMensagens(e: EntradaContexto) {
  const vars = variaveis(e.loja, e.config.nomeAgente, e.nomeLead);
  const recente = e.conversa
    .slice(-4)
    .map((m) => m.content)
    .join(" ");
  // O estoque relevante vem do que o LEAD disse (não do que a IA acabou de listar, que se auto-reforçava).
  const doLeadRecente = e.conversa
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ");
  const pedeLista = pediuLista(
    e.conversa.filter((m) => m.role === "user").at(-1)?.content ?? "",
  );
  const veiculos = pedeLista
    ? e.veiculos.slice(0, 40)
    : ranquear(doLeadRecente, e.veiculos, descreverVeiculo, 6);
  // Saudação/abertura só serve na primeira mensagem da IA (depois repetiria a apresentação).
  const jaConversou = e.conversa.some((m) => m.role === "assistant");
  const rapidas = ranquear(
    recente,
    jaConversou
      ? e.respostas.filter((q) => !/sauda|abertura/i.test(q.titulo))
      : e.respostas,
    (q) => `${q.titulo} ${q.palavras} ${q.texto}`,
    3,
  );
  const exemplos = ranquear(recente, e.exemplos, (x) => x.pergunta, 4);
  const doLead = e.conversa
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join(" ");
  const reais = ranquear(doLead, e.reais, (p) => p.pergunta, 4);
  const l = e.loja;
  const contexto = [
    `LOJA: ${l.nome}. Endereço: ${l.endereco || "confirmar com consultor"}. Horário: ${l.horario}. Telefone: ${l.telefone}. Site: ${l.site}`,
    `FINANCIAMENTO: ${l.financiamento}`,
    `TROCA: ${l.troca}`,
    l.extra && `OUTRAS INFORMAÇÕES: ${l.extra}`,
    `ESTOQUE (${e.veiculos.length} veículos disponíveis; use esta lista quando o cliente perguntar o que temos; se um veículo não mostra preço ou km, esse dado não está disponível: não invente e encaminhe ao consultor):\n` +
      ((veiculos.length ? veiculos : e.veiculos.slice(0, 12))
        .map((v) => "- " + descreverVeiculo(v))
        .join("\n") || "- (sem veículos disponíveis no momento)"),
    reais.length &&
      "COMO NOSSA EQUIPE JÁ RESPONDEU CASOS PARECIDOS (imite o tom e a abordagem; NÃO copie preços, datas ou nomes daqui — use só os do contexto acima):\n" +
        reais
          .map(
            (p) =>
              `- Lead: "${p.pergunta.slice(0, 200)}"\n  Equipe: "${p.resposta.slice(0, 300)}"`,
          )
          .join("\n"),
    rapidas.length &&
      "RESPOSTAS-RÁPIDAS APROVADAS (prefira usá-las quando couberem):\n" +
        rapidas
          .map((q) => `- ${q.titulo}: ${preencher(q.texto, vars)}`)
          .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
  const sistema =
    preencher(e.persona, vars) +
    `

${REGRAS_DE_ENCAMINHAMENTO}` +
    `\n\nNome do lead: ${primeiroNome(e.nomeLead) || "desconhecido"}.\n\nCONTEXTO:\n${contexto}` +
    avisoDeHorario(e.conversa) +
    avisoDeLink(e.conversa) +
    avisoDeEstoque(e.veiculos, e.conversa) +
    (e.ficha
      ? "\n\n" +
        blocoFicha(e.ficha) +
        avisoDeColeta(e.ficha, {
          pediuHumano: pediuHumano(
            e.conversa.filter((m) => m.role === "user").at(-1)?.content ?? "",
          ),
        })
      : "") +
    (e.notaFotos ? "\n\n" + e.notaFotos : "");
  const mensagens: { role: "system" | Papel; content: string }[] = [
    { role: "system", content: sistema },
  ];
  for (const x of exemplos)
    mensagens.push(
      { role: "user", content: x.pergunta },
      { role: "assistant", content: x.resposta },
    );
  for (const m of e.conversa.slice(-12)) mensagens.push(m);
  if (!e.conversa.length)
    mensagens.push({
      role: "user",
      content:
        "(Início: escreva a primeira mensagem de retomada de contato para este lead.)",
    });
  return {
    mensagens,
    usados: {
      veiculos: veiculos.length,
      respostas: rapidas.map((q) => q.titulo),
      exemplos: exemplos.length,
      reais: reais.length,
    },
  };
}

// ------------------------------------------------------------ exemplos reais
export type MensagemCrm = {
  em: number;
  de: "lead" | "equipe" | "robo";
  texto: string;
  tipo: string | null;
  privada: boolean;
};
export type ConversaCrm = {
  id: string;
  direta: boolean;
  etiquetas: string[];
  mensagens: MensagemCrm[];
};

const LIXO =
  /^(ok|oi|ola|olá|bom dia|boa tarde|boa noite|obrigad[oa]|👍|sim|não|nao)[.!]*$/i;
const ARQUIVO = /^\S+\.(pdf|jpe?g|png|docx?|xlsx?|mp4|ogg|opus)$/i;
const DADO_PESSOAL =
  /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\(?\d{2}\)?\s?9?\d{4}-?\d{4}|\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b|\S+@\S+\.\w+/;

/**
 * Pares "lead escreve (1+ mensagens) → equipe responde em até 10 min" das conversas de venda (chat
 * direto com contato etiquetado). Fica de fora: nota privada, arquivo, cumprimento solto, dado pessoal
 * e as mensagens que a própria IA enviou (`daIa`), que saem com o mesmo usuário do token.
 */
export function extrairPares(
  conversas: ConversaCrm[],
  daIa: Set<string> = new Set(),
): ParReal[] {
  const saida: ParReal[] = [];
  for (const c of conversas) {
    if (!c.direta || !c.etiquetas.length) continue;
    const msgs = c.mensagens
      .filter(
        (m) =>
          !m.privada &&
          (!m.tipo || m.tipo === "Text") &&
          m.texto.trim() &&
          !ARQUIVO.test(m.texto.trim()),
      )
      .filter(
        (m) =>
          m.de === "lead" || (m.de === "equipe" && !daIa.has(m.texto.trim())),
      )
      .sort((a, b) => a.em - b.em);
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].de !== "lead") continue;
      const pergunta: string[] = [];
      while (i < msgs.length && msgs[i].de === "lead")
        pergunta.push(msgs[i++].texto);
      const resposta: string[] = [];
      const t0 = msgs[i]?.em ?? 0;
      while (
        i < msgs.length &&
        msgs[i].de === "equipe" &&
        msgs[i].em - t0 < 10 * 60_000
      )
        resposta.push(msgs[i++].texto);
      i--;
      const q = pergunta.join("\n").trim();
      const a = resposta.join("\n").trim();
      if (!a || q.length < 4 || a.length < 8 || a.length > 700 || LIXO.test(q))
        continue;
      if (DADO_PESSOAL.test(q) || DADO_PESSOAL.test(a)) continue;
      saida.push({ conversa: c.id, pergunta: q.slice(0, 500), resposta: a });
    }
  }
  return saida;
}

/** Mensagem do uTalk enviada pelo lead (e não pela equipe, pelo celular "External" ou por robô)? */
export const doContato = (m: {
  source?: string | null;
  sentByOrganizationMember?: unknown;
  botInstance?: unknown;
}) =>
  m.source
    ? String(m.source).toLowerCase() === "contact"
    : !m.sentByOrganizationMember && !m.botInstance;
