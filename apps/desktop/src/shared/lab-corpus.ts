/**
 * Corpus do Laboratório de testes da IA: frases, perguntas e situações que clientes reais mandam no
 * WhatsApp, organizadas por categoria. Tudo fictício (CPFs de teste válidos, estoque fictício). Os
 * cenários escritos à mão ficam em `BASE`; `variacoes()` gera, de forma determinística (sem
 * aleatoriedade), versões com erro de digitação, sem acento, com emoji etc. para testar robustez.
 * A lista em Markdown para revisão sai de `listaEmMarkdown()`.
 */
import type { Cenario, Esperado } from "./lab";

/** CPFs fictícios com dígitos verificadores válidos (usados só nos testes). */
export const CPF_TESTE = "529.982.247-25";
export const CPF_TESTE_2 = "111.444.777-35";

type Semente = { categoria: string; frases: string[]; esperado?: Esperado };

/** Categorias de mensagem única: cada frase vira um cenário de um turno. */
const UNICAS: Semente[] = [
  {
    categoria: "saudacao",
    esperado: { transfere: false, proibido: ["R$"] },
    frases: [
      "Oi",
      "Olá",
      "Bom dia",
      "Boa tarde",
      "Boa noite",
      "Opa, tudo bem?",
      "Oi, tudo bem?",
      "E aí",
      "Olá, gostaria de informações",
      "oii",
      "Bom dia! Vi o anúncio de vocês",
      "Alô",
      "Oi, tem alguém aí?",
      "Boa tarde, podem me ajudar?",
      // Erro real (1.0.22): o modelo devolveu texto vazio para esta saudação.
      "Salve.",
    ],
  },
  {
    categoria: "interesse-carro",
    esperado: { transfere: false },
    frases: [
      "Quero ver o Civic",
      "O Corolla ainda está disponível?",
      "Tem T-Cross?",
      "Vocês têm Onix?",
      "Me interessei pelo Renegade",
      "Tem HB20 2021?",
      "Quanto é o Civic?",
      "Qual o preço do Corolla?",
      "Tem algum SUV?",
      "Tem carro automático?",
      "Procuro um sedan",
      "Quero um carro econômico",
      "Tem carro até 70 mil?",
      "O que vocês têm até 80 mil?",
      "Tem algo com baixa quilometragem?",
      "Qual o ano do Onix?",
      "Quantos km tem o Civic?",
      "O Renegade é flex?",
      "Quero um carro para família",
      "Quero um carro para trabalhar com aplicativo",
    ],
  },
  {
    categoria: "fora-do-estoque",
    esperado: { transfere: false },
    frases: [
      "Tem Hilux?",
      "Tem Gol?",
      "Vocês têm Fusca?",
      "Tem Ranger?",
      "Tem moto?",
      "Tem Mobi?",
      "Tem Compass 2023?",
      "Quero um Corolla Cross",
      "Tem caminhonete?",
      "Tem carro elétrico?",
    ],
  },
  {
    categoria: "preco-negociacao",
    esperado: { transfere: false },
    frases: [
      "Faz por 100 mil o Civic?",
      "Qual o menor preço no Corolla?",
      "Tem desconto à vista?",
      "Aceita 70 mil no Onix?",
      "Quanto fica a parcela do Onix?",
      "Qual a taxa de juros?",
      "Dá pra baixar o preço?",
      "Pago hoje se fizer 5 mil de desconto",
      "Esse preço é fechado?",
      "Tem como parcelar no cartão?",
      "Quanto é a entrada mínima?",
      "O preço do anúncio é esse mesmo?",
    ],
  },
  {
    categoria: "financiamento",
    esperado: { transfere: false },
    frases: [
      "Quero financiar",
      "Vocês financiam?",
      "Aceita financiamento com score baixo?",
      "Meu nome está sujo, consigo financiar?",
      "Quantas parcelas posso fazer?",
      "Dá pra financiar sem entrada?",
      "Pra que precisa do meu CPF?",
      "Qual banco vocês trabalham?",
      "Vocês fazem análise de crédito?",
      "Fica quanto de parcela em 48x?",
      "Tem financiamento pra autônomo?",
    ],
  },
  {
    categoria: "troca",
    esperado: { transfere: false },
    frases: [
      "Aceitam troca?",
      "Tenho um Gol 2015 pra dar na troca",
      "Meu carro é Palio 2012 com 120 mil km, quanto vale?",
      "Aceita troca com volta?",
      "Troco meu Uno por um mais novo",
      "Aceitam moto na troca?",
      "Quanto vocês pagam no meu carro?",
    ],
  },
  {
    categoria: "pagamento",
    esperado: { transfere: false },
    frases: [
      "Vou pagar à vista",
      "Pago no cartão",
      "Tenho consórcio contemplado",
      "Parte à vista e parte financiado",
      "Pago no pix",
      "Posso dar um cheque?",
      "Vou vender meu carro e comprar o seu",
    ],
  },
  {
    categoria: "regiao",
    esperado: { transfere: false },
    frases: [
      "Moro em Campinas",
      "Sou de São Paulo",
      "Estou em outro estado, vocês entregam?",
      "Moro longe, tem como ver o carro por vídeo?",
      "Sou de Santos",
      "Moro no interior",
      "Venho de Minas Gerais",
    ],
  },
  {
    categoria: "horario",
    esperado: { transfere: false },
    frases: [
      "Domingo de manhã",
      "Hoje às 15h30",
      "Sábado 14h",
      "Pode ser agora",
      "Posso ir aí hoje?",
      "Vocês abrem domingo?",
      "Que horas vocês fecham?",
      "Onde fica a loja?",
      "Qual o endereço?",
      "Preciso de 10 horas de uso por semana, é muito?",
    ],
  },
  {
    categoria: "pede-humano",
    esperado: { transfere: true },
    frases: [
      "Quero falar com um vendedor",
      "Chama um atendente",
      "Prefiro falar com uma pessoa",
      "Passa pro gerente",
      "Quero falar com alguém de verdade",
    ],
  },
  {
    categoria: "pede-ligacao",
    esperado: { transfere: true },
    frases: [
      "Pode me ligar?",
      "Pode ligar amanhã às 10h",
      "Me liga depois das 18h",
      "Quero que vocês me liguem",
      "Prefiro ligação",
    ],
  },
  {
    categoria: "pergunta-robo",
    esperado: { transfere: false },
    frases: [
      "Você é robô?",
      "Isso é uma IA?",
      "Estou falando com uma pessoa?",
      "Qual seu nome?",
      "Você trabalha aí?",
    ],
  },
  {
    categoria: "fotos-video",
    esperado: { transfere: false },
    frases: [
      "Manda foto do Civic",
      "Tem vídeo do Corolla?",
      "Quero ver mais fotos",
      "Foto do interior do T-Cross",
      "Manda foto de todos",
      "Manda de novo as fotos",
      "Tem foto do motor?",
      "Quero ver o painel",
    ],
  },
  {
    categoria: "lista-estoque",
    esperado: { transfere: false },
    frases: [
      "Quais carros vocês têm?",
      "Me mostra o estoque",
      "Todas as opções, por favor",
      "O que mais tem?",
      "Manda a lista completa",
      "Tem outras opções?",
    ],
  },
  {
    categoria: "link-anuncio",
    esperado: { transfere: false },
    frases: [
      "Vi esse anúncio https://exemplo.com/anuncio/123",
      "Olá! Tenho interesse e queria mais informações, por favor.",
      "https://exemplo.com/carro/civic-2019",
      "Ainda está disponível? Vi no Instagram",
      "Vi no Facebook, ainda tem?",
    ],
  },
  {
    categoria: "mensagem-vazia-ou-midia",
    esperado: { transfere: false },
    frases: [
      ".",
      "?",
      "ok",
      "👍",
      "😀😀",
      "kkkk",
      "???",
      "[áudio]",
      "[figurinha]",
      "[imagem]",
    ],
  },
  {
    categoria: "fora-do-escopo",
    esperado: { transfere: false },
    frases: [
      "Vocês fazem seguro?",
      "Como funciona a transferência e o IPVA?",
      "O carro tem garantia?",
      "Quais documentos preciso levar?",
      "Vocês lavam o carro antes de entregar?",
      "Qual a procedência do carro?",
      "Tem laudo cautelar?",
      "Já bateu?",
      "Passou por leilão?",
      "Qual o consumo do Onix?",
      "Aceita moto?",
      "Vocês vendem peças?",
      "Quanto custa o emplacamento?",
      "Tem rastreador?",
    ],
  },
  {
    categoria: "reclamacao-ou-spam",
    esperado: { transfere: false },
    frases: [
      "Isso é golpe?",
      "Vocês são enganadores",
      "Quero meu dinheiro de volta",
      "Compre bitcoin agora e fique rico",
      "Vendo seguro de carro com desconto",
      "Já comprei aí e o carro deu problema",
      "Parem de me mandar mensagem",
    ],
  },
  {
    categoria: "digitacao-e-giria",
    esperado: { transfere: false },
    frases: [
      "kero ve o sivic",
      "tem coroola?",
      "vcs tem onix?",
      "qnto é o t cross",
      "pq tao caro",
      "blz",
      "vlw",
      "me chama no zap",
      "oq vcs tem de suv",
      "tem hb20 2021 ainda",
      "cvic ainda ta ai",
      "mim manda fotos",
    ],
  },
  {
    categoria: "modelos-e-marcas",
    esperado: { transfere: false },
    frases: [
      "Quero o Renegade",
      "Tem Jeep?",
      "Tem Honda?",
      "Tem Toyota?",
      "Tem Volkswagen?",
      "Tem Chevrolet?",
      "Tem Hyundai?",
      "Quero o HB20",
      "O T-Cross é turbo?",
      "Qual a cor do Onix?",
      "O Corolla é completo?",
      "Tem teto solar?",
      "Tem carro 7 lugares?",
      "Tem hatch?",
      "Quero um carro pra viajar",
      "O Civic é manual ou automático?",
    ],
  },
  {
    categoria: "condicao-do-carro",
    esperado: { transfere: false },
    frases: [
      "O carro é de único dono?",
      "Tem manual e chave reserva?",
      "Os pneus são novos?",
      "Já fez revisão?",
      "Tem alguma batida ou retoque de pintura?",
      "A documentação está em dia?",
      "Tem IPVA pago?",
      "Qual a cor do Civic?",
      "O ar-condicionado funciona?",
    ],
  },
  {
    categoria: "objecoes-e-pressao",
    esperado: { transfere: false },
    frases: [
      "Preciso decidir hoje",
      "Outra loja me ofereceu mais barato",
      "Vou pensar",
      "Posso ver amanhã sem compromisso?",
      "Dá pra reservar o carro?",
      "Achei caro",
      "Vou conversar com minha esposa e te falo",
      "Me manda tudo por escrito",
      "Não tenho pressa",
      "Só estou pesquisando",
    ],
  },
  {
    categoria: "financiamento-perfil",
    esperado: { transfere: false },
    frases: [
      "Posso financiar em 60x?",
      "Qual a entrada para o Civic?",
      "Consigo financiar sem comprovante de renda?",
      "Sou MEI, consigo financiar?",
      "Sou aposentado, posso financiar?",
      "Estou negativado, tem como?",
      "Sou autônomo e recebo por Pix",
    ],
  },
  {
    categoria: "numeros-por-extenso",
    esperado: { transfere: false },
    frases: [
      "Tenho vinte mil de entrada",
      "Posso dar cinquenta mil à vista",
      "Quero um carro de até cem mil",
      "Nasci em quinze de março de noventa",
      "Meu orçamento é uns 80 mil e uns trocados",
    ],
  },
];

/** Conversas de vários turnos (fluxos completos e situações de estado). */
const FLUXOS: Cenario[] = [
  {
    id: "fluxo-financiado-completo",
    categoria: "fluxo-completo",
    titulo: "Financiamento completo até a transferência",
    turnos: [
      "Oi",
      "Quero o Onix",
      "Vou financiar",
      CPF_TESTE,
      "15/03/1990",
      "Tenho CNH sim",
      "Dou 15 mil de entrada",
      "Moro em Campinas",
      "Pode me ligar amanhã às 10h",
    ],
    esperado: { transfere: true, coleta: ["veiculo", "regiao"] },
  },
  {
    id: "fluxo-avista-completo",
    categoria: "fluxo-completo",
    titulo: "Compra à vista até a transferência",
    turnos: [
      "Bom dia",
      "Tem Civic?",
      "Pago à vista",
      "Moro em Santos",
      "Pode ligar amanhã às 9h",
    ],
    esperado: { transfere: true, coleta: ["veiculo", "regiao"] },
  },
  {
    id: "fluxo-troca-completo",
    categoria: "fluxo-completo",
    titulo: "Troca com volta até a transferência",
    turnos: [
      "Boa tarde",
      "Quero ver o T-Cross",
      "Tenho um Gol 2015 para dar na troca",
      "Moro em São Paulo",
      "Pode ligar sábado às 10h",
    ],
    esperado: { transfere: true },
  },
  {
    id: "fluxo-dados-tudo-na-primeira",
    categoria: "fluxo-completo",
    titulo: "Cliente manda tudo numa mensagem só",
    turnos: [
      "Quero o Corolla à vista, moro em Campinas e pode ligar amanhã às 14h",
    ],
    esperado: { transfere: true },
  },
  {
    id: "estado-cpf-invalido",
    categoria: "financiamento-cpf",
    titulo: "CPF digitado errado e depois corrigido",
    turnos: [
      "Quero financiar o Onix",
      "123.456.789-00",
      CPF_TESTE,
      "15/03/1990",
    ],
    esperado: { transfere: false, semSinais: ["cpf-em-claro"] },
  },
  {
    id: "estado-cpf-sem-pontuacao",
    categoria: "financiamento-cpf",
    titulo: "CPF só com números",
    turnos: ["Quero financiar o Civic", "52998224725"],
    esperado: { semSinais: ["cpf-em-claro"] },
  },
  {
    id: "estado-cpf-colado-na-frase",
    categoria: "financiamento-cpf",
    titulo: "CPF dentro de uma frase",
    turnos: [
      "Quero financiar o HB20",
      `meu cpf é ${CPF_TESTE_2}, pode consultar`,
    ],
    esperado: { semSinais: ["cpf-em-claro"] },
  },
  {
    id: "estado-nascimento-formatos",
    categoria: "financiamento-cpf",
    titulo: "Nascimento por extenso",
    turnos: [
      "Quero financiar o Onix",
      CPF_TESTE,
      "nasci em 15 de março de 1990",
    ],
    esperado: { semSinais: ["cpf-em-claro"] },
  },
  {
    id: "estado-nascimento-sem-barras",
    categoria: "financiamento-cpf",
    titulo: "Nascimento sem barras",
    turnos: ["Quero financiar o Onix", CPF_TESTE, "15031990"],
  },
  {
    id: "estado-recusa-cpf",
    categoria: "financiamento-cpf",
    titulo: "Cliente recusa dar o CPF",
    turnos: [
      "Quero financiar o Onix",
      "Não quero passar meu CPF",
      "Já falei que não vou passar",
    ],
    esperado: { semSinais: ["perguntou-dado-ja-informado"] },
  },
  {
    id: "estado-duvida-antes-do-dado",
    categoria: "financiamento-cpf",
    titulo: "Dúvida sobre o CPF antes de informar",
    turnos: [
      "Quero financiar o Onix",
      "Pra que precisa do CPF?",
      "Tá bom, é " + CPF_TESTE,
    ],
  },
  {
    id: "repete-mensagem-igual",
    categoria: "repeticao-do-cliente",
    titulo: "Cliente manda a mesma mensagem três vezes",
    turnos: ["Quero ver o Civic", "Quero ver o Civic", "Quero ver o Civic"],
  },
  {
    id: "repete-saudacao",
    categoria: "repeticao-do-cliente",
    titulo: "Cliente repete a saudação",
    turnos: ["Oi", "Oi", "Oi"],
  },
  {
    id: "repete-pergunta-preco",
    categoria: "repeticao-do-cliente",
    titulo: "Cliente pergunta o preço de novo",
    turnos: [
      "Quanto é o Corolla?",
      "Quanto é o Corolla?",
      "E o preço do Corolla?",
    ],
  },
  {
    id: "repete-pede-fotos",
    categoria: "repeticao-do-cliente",
    titulo: "Pede as fotos várias vezes",
    turnos: [
      "Manda foto do Civic",
      "Manda foto do Civic",
      "Mais fotos do Civic",
    ],
  },
  {
    id: "repete-pede-lista",
    categoria: "repeticao-do-cliente",
    titulo: "Pede a lista de carros duas vezes",
    turnos: ["Quais carros vocês têm?", "Quais carros vocês têm?"],
  },
  {
    id: "repete-ignora-pergunta",
    categoria: "repeticao-do-cliente",
    titulo: "Cliente ignora a pergunta da IA várias vezes",
    turnos: ["Quero o Onix", "ok", "legal", "hum", "tá"],
  },
  {
    id: "rajada-de-mensagens",
    categoria: "repeticao-do-cliente",
    titulo: "Várias mensagens curtas seguidas",
    turnos: [
      "Oi",
      "Tem Civic?",
      "Quanto?",
      "Aceita troca?",
      "Moro em Campinas",
    ],
  },
  {
    id: "muda-de-carro",
    categoria: "contexto",
    titulo: "Cliente troca de carro de interesse",
    turnos: [
      "Quero ver o Civic",
      "Na verdade prefiro o Corolla",
      "Pensando bem, o Onix é melhor",
    ],
    esperado: { semSinais: ["perguntou-dado-ja-informado"] },
  },
  {
    id: "volta-depois-de-sumir",
    categoria: "contexto",
    titulo: "Cliente some e volta",
    turnos: ["Oi", "Tem Civic?", "...", "Voltei, ainda tem aquele carro?"],
  },
  {
    id: "contexto-pronome",
    categoria: "contexto",
    titulo: "Cliente fala 'ele' sem repetir o carro",
    turnos: [
      "Tem Corolla?",
      "Quanto ele custa?",
      "E o km dele?",
      "Manda foto dele",
    ],
  },
  {
    id: "contexto-dois-carros",
    categoria: "contexto",
    titulo: "Compara dois carros",
    turnos: [
      "Estou entre o Civic e o Corolla",
      "Qual é mais novo?",
      "Qual tem menos km?",
    ],
  },
  {
    id: "contexto-ja-informou-regiao",
    categoria: "contexto",
    titulo: "Informa a região antes de ser perguntado",
    turnos: ["Oi, moro em Campinas e quero ver o Onix", "Vou pagar à vista"],
    esperado: { semSinais: ["perguntou-dado-ja-informado"] },
  },
  {
    id: "contexto-ja-informou-pagamento",
    categoria: "contexto",
    titulo: "Informa o pagamento junto com o carro",
    turnos: ["Quero o HB20 e vou pagar à vista", "Moro em Santos"],
    esperado: { semSinais: ["perguntou-dado-ja-informado"] },
  },
  {
    id: "horario-fora-expediente",
    categoria: "horario",
    titulo: "Pede ligação fora do expediente",
    turnos: [
      "Quero o Onix à vista, moro em Campinas",
      "Pode ligar às 7h da manhã",
    ],
  },
  {
    id: "horario-domingo",
    categoria: "horario",
    titulo: "Pede ligação no domingo",
    turnos: [
      "Quero o Civic à vista, moro em Santos",
      "Pode ligar domingo às 10h",
    ],
  },
  {
    id: "horario-sabado-tarde",
    categoria: "horario",
    titulo: "Sábado depois do último horário",
    turnos: [
      "Quero o Corolla à vista, moro em São Paulo",
      "Pode ser sábado às 16h",
    ],
  },
  {
    id: "humano-no-meio",
    categoria: "pede-humano",
    titulo: "Pede atendente no meio da coleta",
    turnos: ["Quero financiar o Onix", "Prefiro falar com um atendente"],
    esperado: { transfere: true },
  },
  {
    id: "fotos-carro-sem-citar",
    categoria: "fotos-video",
    titulo: "Pede foto sem dizer o carro",
    turnos: ["Oi", "Manda umas fotos"],
  },
  {
    id: "fotos-depois-de-lista",
    categoria: "fotos-video",
    titulo: "Pede a lista e depois fotos de um item",
    turnos: ["Quais carros vocês têm?", "Manda foto do Renegade"],
  },
  {
    id: "troca-detalhes",
    categoria: "troca",
    titulo: "Dá os dados do carro da troca aos poucos",
    turnos: [
      "Quero o T-Cross e tenho um carro pra troca",
      "É um Gol",
      "2015",
      "90 mil km",
    ],
  },
  {
    id: "encerra-sem-interesse",
    categoria: "encerramento",
    titulo: "Cliente desiste",
    turnos: ["Oi", "Tem Civic?", "Achei caro, vou deixar", "Obrigado, tchau"],
  },
  {
    id: "encerra-ja-comprou",
    categoria: "encerramento",
    titulo: "Já comprou em outro lugar",
    turnos: ["Oi", "Já comprei em outro lugar, obrigado"],
  },
];

const SEMENTE_LAB = 20260101;

/** Gerador pseudoaleatório determinístico (mulberry32): o mesmo número sempre dá a mesma sequência. */
function aleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Troca duas letras vizinhas da maior palavra (erro de digitação comum). */
function comTypo(frase: string, rnd: () => number): string {
  const palavras = frase.split(" ");
  let alvo = 0;
  palavras.forEach((p, i) => {
    if (/^\p{L}+$/u.test(p) && p.length > palavras[alvo].length) alvo = i;
  });
  const p = palavras[alvo];
  if (p.length < 4 || !/^\p{L}+$/u.test(p)) return frase;
  const i = 1 + Math.floor(rnd() * (p.length - 2));
  if (p[i] === p[i + 1]) return frase;
  palavras[alvo] = p.slice(0, i) + p[i + 1] + p[i] + p.slice(i + 2);
  return palavras.join(" ");
}

const ehTextoSimples = (f: string) =>
  /^[\p{L}\d ,.!?'-]+$/u.test(f) && !/https?:/.test(f);

let cache: { base: Cenario[]; variacoes: Cenario[] } | null = null;

function construir() {
  const base: Cenario[] = [];
  for (const s of UNICAS)
    s.frases.forEach((frase, i) =>
      base.push({
        id: `${s.categoria}-${String(i + 1).padStart(2, "0")}`,
        categoria: s.categoria,
        titulo: frase,
        turnos: [frase],
        esperado: s.esperado,
        origem: "manual",
      }),
    );
  for (const f of FLUXOS) base.push({ ...f, origem: "manual" });

  // Variações: sem acento/minúsculas, com typo, com prefixo de saudação, com emoji.
  const rnd = aleatorio(SEMENTE_LAB);
  const variacoes: Cenario[] = [];
  // Uma variação só entra se as mensagens ainda não existem em nenhum outro cenário.
  const chave = (c: Cenario) =>
    c.turnos.map((t) => t.trim().toLowerCase()).join("|");
  const existentes = new Set(base.map(chave));
  for (const c of base) {
    if (c.turnos.length !== 1 || !ehTextoSimples(c.turnos[0])) continue;
    const t = c.turnos[0];
    const formas: [string, string][] = [
      ["simples", semAcento(t).replace(/[?!.,]/g, "")],
      ["typo", comTypo(t, rnd)],
      ["cumprimento", `Boa tarde, ${t.charAt(0).toLowerCase()}${t.slice(1)}`],
      ["emoji", `${t} 🙂`],
    ];
    for (const [tipo, frase] of formas) {
      const v: Cenario = {
        ...c,
        id: `${c.id}~${tipo}`,
        titulo: frase,
        turnos: [frase],
        origem: "gerado",
      };
      // Com erro de digitação o sistema não é obrigado a reconhecer o pedido (ex.: "pode me ligr").
      if (tipo === "typo" && v.esperado?.transfere)
        v.esperado = { ...v.esperado, transfere: undefined };
      if (!frase || existentes.has(chave(v))) continue;
      existentes.add(chave(v));
      variacoes.push(v);
    }
  }
  return { base, variacoes };
}

/** Cenários escritos à mão (a execução padrão do Laboratório). */
export function cenariosBase(): Cenario[] {
  return (cache ??= construir()).base;
}

/** Variações geradas automaticamente (digitação, acento, emoji…): robustez extra, opcional. */
export function variacoes(): Cenario[] {
  return (cache ??= construir()).variacoes;
}

/** Corpus completo (base + variações). */
export function corpusCompleto(): Cenario[] {
  return [...cenariosBase(), ...variacoes()];
}

/**
 * Conjunto rápido: ~28 cenários do corpus que cobrem os pontos críticos (transferência, consultor
 * prometido sem transferir, preço fora do estoque, financiamento e CPF, fotos, repetição, fluxo
 * completo). Cabe no limite diário do plano grátis do Groq; rode depois de cada ajuste.
 */
export const CONJUNTO_RAPIDO: readonly string[] = [
  // consultor prometido sem transferir / pedido de ligação
  "pede-ligacao-01",
  "horario-05",
  "objecoes-e-pressao-05",
  "condicao-do-carro-01",
  "preco-negociacao-05",
  // preço e estoque
  "preco-negociacao-01",
  "interesse-carro-02",
  "fora-do-estoque-01",
  // financiamento
  "financiamento-01",
  "financiamento-02",
  "financiamento-04",
  // repetição e fechamento
  "repete-ignora-pergunta",
  "repete-pergunta-preco",
  // fotos e mensagem vazia
  "fotos-video-01",
  "fotos-video-03",
  "mensagem-vazia-ou-midia-03",
  // essenciais
  "saudacao-01",
  "saudacao-15",
  "pede-humano-01",
  "humano-no-meio",
  "lista-estoque-01",
  "link-anuncio-02",
  "pergunta-robo-01",
  "troca-02",
  "contexto-pronome",
  "fluxo-avista-completo",
  "fluxo-dados-tudo-na-primeira",
  "estado-recusa-cpf",
  "encerra-sem-interesse",
];

/** Categorias presentes, na ordem em que aparecem. */
export function categorias(lista: Cenario[] = corpusCompleto()): string[] {
  return [...new Set(lista.map((c) => c.categoria))];
}

/** Lista numerada em Markdown (uma seção por categoria) para o usuário revisar todas as frases. */
export function listaEmMarkdown(lista: Cenario[] = corpusCompleto()): string {
  let n = 0;
  const saida = [
    "# Laboratório da IA — lista de cenários",
    "",
    "> Gerado de `src/shared/lab-corpus.ts` (`npm run lab:corpus`). Não editar à mão.",
    "",
  ];
  for (const cat of categorias(lista)) {
    const itens = lista.filter((c) => c.categoria === cat);
    saida.push(`## ${cat} (${itens.length})`, "");
    for (const c of itens) {
      n++;
      const fala = c.turnos.map((t) => `"${t}"`).join(" → ");
      saida.push(`${n}. \`${c.id}\` ${fala}`);
    }
    saida.push("");
  }
  return saida.join("\n");
}
