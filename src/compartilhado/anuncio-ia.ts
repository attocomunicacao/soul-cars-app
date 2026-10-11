/**
 * Modo "prompt pronto" para os textos do anúncio: monta o prompt que o usuário cola no chat
 * (Claude, ChatGPT) e valida o JSON devolvido. Não chama nenhum serviço: custo zero.
 */

export type FichaIA = {
  nome?: string | null;
  ano?: string | null;
  versao?: string | null;
  cambio?: string | null;
  combustivel?: string | null;
  configuracao?: string | null;
  lugares?: string | null;
  portas?: string | null;
  direcao?: string | null;
  seguranca?: string | null;
  conforto?: string | null;
  infotenimento?: string | null;
};

export type TextosAnuncio = {
  textos: { chamada: string; destaques: string[]; cta: string }[];
  titulos: string[];
  whatsapp: string;
};

export type ResultadoValidacao =
  | { ok: true; textos: TextosAnuncio; avisos: string[] }
  | { ok: false; erros: string[] };

export const QTD_TEXTOS = 5;
export const QTD_TITULOS = 5;
export const QTD_DESTAQUES = 3;
export const MAX_TITULO = 40;

const SYSTEM = `Você é redator de anúncios de veículos seminovos da loja {loja}, para Meta Ads (Facebook e Instagram) em São Paulo.
Escreva em português do Brasil, tom confiante e próximo, sem exageros nem clichês vazios.

Regras:
- Use somente informações da ficha. Não invente equipamentos, garantia, financiamento, revisões, histórico ou condição do veículo.
- Não escreva preço, quilometragem, ano ou cor nos textos: esses dados são inseridos automaticamente em outra parte.
- "destaques": escolha 3 itens COPIADOS LITERALMENTE da lista de equipamentos, variando entre os 5 textos e priorizando o que mais atrai compradores. Se a lista tiver menos de 3 itens, use os que existirem.
- Itens marcados como [OPCIONAL — confirmar no veículo] não podem ser destaques.
- Cada um dos 5 textos deve ter um ângulo diferente (ex.: economia, conforto, tecnologia, segurança, oportunidade).
- Títulos: MAIÚSCULAS, até 40 caracteres, incluindo o nome do modelo em pelo menos 3 deles.
- Evite promessas enganosas e termos proibidos em anúncios (ex.: "garantido", "o melhor do Brasil").`;

const FORMATO = `Responda SOMENTE com um JSON válido, sem comentários e sem texto antes ou depois, neste formato:
{
  "textos": [
    { "chamada": "1 ou 2 frases curtas de abertura, com no máximo 1 emoji.",
      "destaques": ["3 equipamentos copiados literalmente da lista"],
      "cta": "Chamada para ação curta, começando com 📲" }
  ],
  "titulos": ["5 títulos em MAIÚSCULAS, até 40 caracteres cada"],
  "whatsapp": "Uma frase curta e convidativa para abrir a mensagem de WhatsApp."
}
"textos" deve ter exatamente 5 itens e "titulos" exatamente 5 itens.`;

const limpaMarcador = (linha: string) => linha.replace(/^[-*•]\s*/, "").trim();
const chave = (s: string) =>
  limpaMarcador(s).replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

/** Linhas de equipamentos da ficha, como o prompt as apresenta. */
export function equipamentosDaFicha(f: FichaIA): string[] {
  return [f.seguranca, f.conforto, f.infotenimento].flatMap((campo) =>
    (campo ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

const ehOpcional = (item: string) => item.toUpperCase().includes("OPCIONAL");

export function montarPrompt(ficha: FichaIA, loja: string): string {
  const dados = {
    nome: ficha.nome,
    ano: ficha.ano,
    motor: ficha.versao,
    cambio: ficha.cambio,
    combustivel: ficha.combustivel,
    configuracao: ficha.configuracao,
    lugares: ficha.lugares,
    portas: ficha.portas,
    direcao: ficha.direcao,
    equipamentos: equipamentosDaFicha(ficha),
  };
  return [
    SYSTEM.replace("{loja}", loja.trim() || "Soul Cars Veículos"),
    FORMATO,
    "Ficha do veículo (JSON):\n" + JSON.stringify(dados, null, 2),
  ].join("\n\n");
}

/** Aceita JSON puro, cercado por ```json ... ``` ou com texto solto em volta. */
export function extrairJson(bruto: string): unknown {
  const texto = bruto.trim();
  if (!texto) throw new Error("Cole a resposta do chat no campo.");
  const cercado = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidatos = [texto];
  if (cercado) candidatos.unshift(cercado[1].trim());
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini >= 0 && fim > ini) candidatos.push(texto.slice(ini, fim + 1));
  for (const c of candidatos) {
    try {
      return JSON.parse(c);
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error(
    "A resposta não é um JSON válido. Peça ao chat para responder somente com o JSON.",
  );
}

const ehTexto = (x: unknown): x is string => typeof x === "string";

export function validarResposta(
  bruto: string,
  ficha: FichaIA,
): ResultadoValidacao {
  let dados: unknown;
  try {
    dados = extrairJson(bruto);
  } catch (e) {
    return { ok: false, erros: [(e as Error).message] };
  }
  const erros: string[] = [];
  const avisos: string[] = [];
  const raiz = dados as Record<string, unknown> | null;
  if (!raiz || typeof raiz !== "object" || Array.isArray(raiz))
    return {
      ok: false,
      erros: ["O JSON precisa ser um objeto com textos, titulos e whatsapp."],
    };

  const equipamentos = equipamentosDaFicha(ficha);
  const permitidos = new Map(
    equipamentos
      .filter((e) => !ehOpcional(e))
      .map((e) => [chave(e), limpaMarcador(e)]),
  );
  const opcionais = new Set(equipamentos.filter(ehOpcional).map(chave));
  const esperados = Math.min(QTD_DESTAQUES, permitidos.size);

  const textos: TextosAnuncio["textos"] = [];
  if (!Array.isArray(raiz.textos) || raiz.textos.length !== QTD_TEXTOS) {
    erros.push(
      `"textos" deve ter exatamente ${QTD_TEXTOS} itens (veio ${Array.isArray(raiz.textos) ? raiz.textos.length : "outro tipo"}).`,
    );
  }
  if (Array.isArray(raiz.textos)) {
    raiz.textos.forEach((item, i) => {
      const n = `Texto ${i + 1}`;
      const t = item as Record<string, unknown> | null;
      if (!t || typeof t !== "object") {
        erros.push(`${n}: precisa ser um objeto com chamada, destaques e cta.`);
        return;
      }
      const chamada = ehTexto(t.chamada) ? t.chamada.trim() : "";
      if (!chamada) erros.push(`${n}: "chamada" está vazia ou ausente.`);
      if (/R\$/.test(chamada))
        avisos.push(`${n}: a chamada cita preço; o preço vem da ficha.`);
      const cta = ehTexto(t.cta) ? t.cta.trim() : "";
      if (!cta.startsWith("📲")) erros.push(`${n}: "cta" deve começar com 📲.`);
      const destaques: string[] = [];
      if (!Array.isArray(t.destaques) || !t.destaques.every(ehTexto)) {
        erros.push(`${n}: "destaques" deve ser uma lista de textos.`);
      } else {
        if (t.destaques.length !== esperados)
          erros.push(
            `${n}: "destaques" deve ter ${esperados} ${esperados === 1 ? "item" : "itens"} (veio ${t.destaques.length}).`,
          );
        for (const d of t.destaques) {
          const k = chave(d);
          const original = permitidos.get(k);
          if (original) destaques.push(original);
          else if (opcionais.has(k))
            erros.push(`${n}: "${d}" é item opcional e não pode ser destaque.`);
          else
            erros.push(
              `${n}: "${d}" não está copiado literalmente da lista de equipamentos.`,
            );
        }
        if (new Set(destaques).size !== destaques.length)
          erros.push(`${n}: há destaques repetidos.`);
      }
      textos.push({ chamada, destaques, cta });
    });
  }

  const titulos: string[] = [];
  if (!Array.isArray(raiz.titulos) || raiz.titulos.length !== QTD_TITULOS) {
    erros.push(
      `"titulos" deve ter exatamente ${QTD_TITULOS} itens (veio ${Array.isArray(raiz.titulos) ? raiz.titulos.length : "outro tipo"}).`,
    );
  }
  if (Array.isArray(raiz.titulos)) {
    raiz.titulos.forEach((item, i) => {
      if (!ehTexto(item) || !item.trim()) {
        erros.push(`Título ${i + 1}: vazio ou não é texto.`);
        return;
      }
      const t = item.trim();
      if (t !== t.toLocaleUpperCase("pt-BR"))
        erros.push(`Título ${i + 1}: deve estar em MAIÚSCULAS ("${t}").`);
      if ([...t].length > MAX_TITULO)
        erros.push(
          `Título ${i + 1}: tem ${[...t].length} caracteres; o máximo é ${MAX_TITULO}.`,
        );
      titulos.push(t);
    });
  }
  const modelo = (ficha.nome ?? "")
    .trim()
    .split(/\s+/)
    .at(-1)!
    .toLocaleUpperCase("pt-BR");
  if (
    modelo &&
    titulos.length &&
    titulos.filter((t) => t.toLocaleUpperCase("pt-BR").includes(modelo))
      .length < 3
  )
    avisos.push(`Menos de 3 títulos citam o modelo (${modelo}).`);

  const whatsapp = ehTexto(raiz.whatsapp) ? raiz.whatsapp.trim() : "";
  if (!whatsapp) erros.push(`"whatsapp" está vazio ou ausente.`);

  if (erros.length) return { ok: false, erros };
  return { ok: true, textos: { textos, titulos, whatsapp }, avisos };
}
