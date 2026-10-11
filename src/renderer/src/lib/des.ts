/**
 * Gerador do DES.md. Porta fiel do description.js do sistema HTML anterior
 * e shared/core.js: a saída precisa continuar idêntica (ver des.test.ts).
 */

export type Loja = {
  contato: string;
  horario: string;
  loja: string;
  endereco: string;
};

export type FichaDes = {
  nome: string; // nome comercial, sem ano
  ano: string;
  marca_modelo: string; // do CRLV
  cor: string;
  combustivel: string;
  preco: number;
  km: number;
  versao: string; // motor
  configuracao: string;
  lugares: string;
  portas: string;
  cambio: string;
  direcao: string;
  seguranca: string;
  conforto: string;
  infotenimento: string;
};

export const TECNICOS = [
  ["versao", "Motor"],
  ["ano", "Ano"],
  ["configuracao", "Configuração"],
  ["lugares", "Lugares"],
  ["portas", "Portas"],
  ["cambio", "Câmbio"],
  ["direcao", "Direção"],
] as const;

export const EQUIPAMENTOS = [
  ["seguranca", "Segurança"],
  ["conforto", "Conforto"],
  ["infotenimento", "Infotenimento"],
] as const;

/** Opções sugeridas nos campos técnicos (o campo continua aceitando texto livre). */
export const OPCOES: Record<
  "cambio" | "configuracao" | "direcao" | "lugares" | "portas" | "versao",
  string[]
> = {
  cambio: [
    "MANUAL",
    "MANUAL DE 5 MARCHAS",
    "MANUAL DE 6 MARCHAS",
    "AUTOMÁTICO",
    "AUTOMÁTICO DE 4 MARCHAS",
    "AUTOMÁTICO DE 6 MARCHAS",
    "AUTOMÁTICO DE 8 MARCHAS",
    "AUTOMATIZADO",
    "AUTOMATIZADO DE 6 MARCHAS",
    "AUTOMATIZADO DE 7 MARCHAS",
    "CVT",
    "CVT DE 7 MARCHAS",
  ],
  configuracao: [
    "HATCHBACK",
    "SEDÃ",
    "SUV",
    "PICAPE",
    "PERUA",
    "MINIVAN",
    "CUPÊ",
    "CONVERSÍVEL",
    "FURGÃO",
  ],
  direcao: ["MECÂNICA", "HIDRÁULICA", "ELÉTRICA", "ELETRO-HIDRÁULICA"],
  lugares: ["2", "4", "5", "7"],
  portas: ["2", "3", "4", "5"],
  versao: [],
};

const DECIMAL = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const INTEIRO = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;

/** "R$ 48.900,00" → 48900 · "84.000 km" → 84000 (whole) · inválido → null */
export function parseNumber(raw: string, whole = false): number | null {
  const clean = String(raw)
    .replace(/^R\$\s*/i, "")
    .replace(/\s*km$/i, "")
    .replace(/\s/g, "");
  if (!(whole ? INTEIRO : DECIMAL).test(clean)) return null;
  const value = Number(clean.replaceAll(".", "").replace(",", "."));
  return Number.isFinite(value) && Number.isSafeInteger(Math.round(value * 100))
    ? value
    : null;
}

export const formatNumber = (value: number, decimals = 0) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export function shortGearbox(value: string) {
  if (/AUTOM[AÁ]T/i.test(value)) return "AUTOMÁTICO";
  return /MANUAL/i.test(value) ? "MANUAL" : value;
}

export function fuelLabel(value: string) {
  return /(?:ALCOOL|ÁLCOOL|ETANOL)\s*\/\s*GASOLINA|GASOLINA\s*\/\s*(?:ALCOOL|ÁLCOOL|ETANOL)/i.test(
    value,
  )
    ? "FLEX"
    : value;
}

/** Termo de busca da ficha técnica: nome comercial + modelo do CRLV + ano.
 *  ("MERCEDES BENZ", "I/M.BENZ GLA250", "2016") → "MERCEDES BENZ GLA 250 2016" */
export function termoBusca(nome: string, marcaModelo: string, ano: string) {
  const partes = marcaModelo.replace(/^(IMP|I)[/]/i, "").split("/");
  const doDocumento = (partes.length > 1 ? partes.slice(1) : partes) // a marca já está no nome comercial
    .join(" ")
    .replace(/([A-Za-z])(\d)/g, "$1 $2") // GLA250 → GLA 250
    .split(/\s+/)
    .filter((p) => p && !/^[A-Za-zÀ-ÿ]\.[A-Za-zÀ-ÿ]+$/.test(p)) // abreviação da marca: M.BENZ
    .join(" ");
  const palavras: string[] = [];
  for (const palavra of `${nome} ${doDocumento} ${ano}`.split(/\s+/))
    if (
      palavra &&
      !palavras.some((p) => p.toUpperCase() === palavra.toUpperCase())
    )
      palavras.push(palavra);
  return palavras.join(" ");
}

/** Sugestão de nome a partir do CRLV: "I/FORD FIESTA HA" → "FORD FIESTA". */
export function sugerirNome(marca: string) {
  return marca
    .replace(/^(IMP|I)\//i, "")
    .replaceAll("/", " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

const MISSING = "NÃO INFORMADO";
const field = (h: string, c: string) => `## ${h}\n${c}\n`;
const block = (h: string, c: string) => `## ${h}\n\n${c}\n`;
const bold = (h: string, c: string) => `**${h}**\n${c}`;
const SEP = "\n---\n\n";

export function camposVazios(f: FichaDes) {
  return [...TECNICOS, ...EQUIPAMENTOS]
    .filter(([id]) => !String(f[id]).trim())
    .map(([, label]) => label);
}

/** Parte criativa escrita pela IA (engine/ia.py). Fatos continuam vindo da ficha. */
export type TextosIA = {
  textos: { chamada: string; destaques: string[]; cta: string }[];
  titulos: string[];
  whatsapp: string;
};

/** Prefixo do nome da campanha. O objetivo virou geração de leads em 14/09/2026;
 *  os anúncios antigos continuam com [VENDA] no DES.md que já foi gerado. */
export const PREFIXO_CAMPANHA = "[LEAD]";

export function gerarDes(
  f: FichaDes,
  loja: Loja,
  ia?: TextosIA | null,
  prefixoCampanha = PREFIXO_CAMPANHA,
): string {
  const v = (s: string) => String(s ?? "").trim();
  const text = (s: string) => v(s) || MISSING;
  const title = text(f.nome);
  const year = text(f.ano);
  const name = `${title} ${year}`;
  const engine = text(f.versao);
  const gearbox = text(f.cambio);
  const shortGear = shortGearbox(gearbox);
  const fuel = fuelLabel(v(f.combustivel)) || MISSING;
  const color = v(f.cor) || MISSING;
  const priceText = formatNumber(f.preco, 2);
  const kmText = formatNumber(f.km);
  const precoCurto = formatNumber(f.preco, f.preco % 1 ? 2 : 0);

  let md =
    "# DESCRIÇÃO - EXTRAÍDA DO DOC.MD\n\n" +
    field("MARCA / MODELO / VERSÃO", v(f.marca_modelo) || MISSING) +
    "\n" +
    field("QUILOMETRAGEM", kmText) +
    "\n" +
    field("VALOR", "R$" + priceText);

  md +=
    SEP + "# DESCRIÇÃO - [CARROS NA WEB](https://www.carrosnaweb.com.br/)\n\n";
  md += TECNICOS.map(([id, label]) =>
    field(label.toUpperCase(), text(f[id])),
  ).join("\n");
  md +=
    SEP +
    "# DESCRIÇÃO - [EQUIPAMENTOS CARROS NA WEB](https://www.carrosnaweb.com.br/)\n\n";
  md += EQUIPAMENTOS.map(([id, label]) =>
    field(label.toUpperCase(), text(f[id])),
  ).join("\n");

  const campaign = `${prefixoCampanha} ${name}`;
  const estados = [
    "📄 CAMPANHA EM RASCUNHO",
    "✅ CAMPANHA PUBLICADA",
    "⚙️ CAMPANHA EM PROCESSAMENTO",
    "🤖 BOT CONFIGURADO",
    "🔔 CAMPANHA ATIVA",
    "⚠️ REAJUSTE",
  ];
  md +=
    SEP +
    "# ANUNCIO\n\n" +
    block(
      "NOME DA CAMPANHA",
      [campaign, ...estados.map((s) => campaign + "\n" + s)].join("\n\n"),
    );
  md +=
    SEP +
    bold("CONTATO", text(loja.contato)) +
    "\n\n" +
    bold("HORÁRIO DE CONTATO", text(loja.horario)) +
    "\n";
  md +=
    SEP +
    block(
      "CARROSSEL",
      [
        bold("TITULO", name),
        bold("SUBTITULO", engine),
        bold("TERCEIRO TITULO", shortGear),
        bold("VALOR DE VENDA", precoCurto),
        bold("ANO", year),
      ].join("\n\n"),
    );

  const lista = (s: string) =>
    v(s)
      .split("\n")
      .map((x) => x.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  const comfort = lista(f.conforto),
    media = lista(f.infotenimento),
    safety = lista(f.seguranca);
  const picks = [
    comfort,
    media,
    comfort.slice(3),
    safety,
    [...media.slice(1), ...safety.slice(2)],
  ];
  const calls = [
    "📲 Chama agora!",
    "📲 Agende sua visita!",
    "📲 Fale com a gente!",
    "📲 Chama no WhatsApp!",
    "📲 Venha conhecer!",
  ];
  const vehicleHeading = [
    title,
    v(f.versao),
    v(f.cambio) ? shortGear : "",
    year,
  ]
    .filter(Boolean)
    .join(" ");

  for (let i = 0; i < 5; i++) {
    const criativo = ia?.textos[i];
    const facts = [`🚗 ${vehicleHeading}`];
    if (criativo?.chamada.trim()) facts.push(criativo.chamada.trim());
    facts.push(
      `💰 R$ ${priceText}`,
      `🔰 ${year} | ${color}\n⚙️ ${gearbox} | ${fuel}\n🧾 ${kmText} km rodados`,
    );
    const selected = criativo?.destaques.length
      ? criativo.destaques.slice(0, 3)
      : picks[i].slice(0, 3);
    if (selected.length) facts.push(selected.map((s) => "🔹 " + s).join("\n"));
    facts.push(criativo?.cta.trim() || calls[i]);
    md += SEP + block(`${i + 1}. TEXTO PRINCIPAL`, facts.join("\n\n"));
  }

  const titulosPadrao = [
    vehicleHeading,
    "CONFIRA NOSSO " + name,
    "CONHEÇA O " + name,
    name + " À VENDA",
    "VENHA CONHECER O " + name,
  ];
  const titulos =
    ia?.titulos.filter((t) => t.trim()).length === 5
      ? ia.titulos
      : titulosPadrao;
  md += SEP + block("TÍTULOS", titulos.join("\n\n"));
  md +=
    SEP +
    block(
      "DESCRIÇÕES",
      [
        `R$ ${precoCurto}`,
        `R$ ${priceText}`,
        `POR R$ ${priceText}`,
        `VALOR: R$ ${priceText}`,
        `VALOR DE VENDA: R$ ${priceText}`,
      ].join("\n\n"),
    );
  md +=
    SEP +
    block(
      "MENSAGEM DE BOAS-VINDAS",
      `🚗 Bem-vindo(a) à ${text(loja.loja)}!\n📍 ${text(loja.endereco)}\n📞 ${text(loja.contato)}`,
    );
  md += SEP + block("MENSAGEM PRONTA", "Olá! tenho interesse: " + name);
  md +=
    SEP +
    block(
      "MENSAGEM PARA O WHATSAPP",
      `${ia?.whatsapp.trim() ? ia.whatsapp.trim() + "\n\n" : ""}${vehicleHeading}.\n${text(f.configuracao)} | ${color} | ${fuel}\n\n*VALOR: R$ ${priceText}*\n*KM: ${kmText}*`,
    );
  return md;
}

// ---- Importar ficha técnica colada (Carros na Web ou DES.md antigo) ----

type CampoImport =
  (typeof TECNICOS)[number][0] | (typeof EQUIPAMENTOS)[number][0];

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
const norm = (s: string) =>
  normalize(s)
    .replace(/^#+\s*|\*\*/g, "")
    .replace(/:$/, "")
    .trim();

const ALIASES = new Map<string, CampoImport>([
  ...[...TECNICOS, ...EQUIPAMENTOS].map(
    ([id, label]) => [norm(label), id] as [string, CampoImport],
  ),
  ["TRANSMISSAO", "cambio"],
  ["ASSISTENCIA", "direcao"],
  ["CARROCERIA", "configuracao"],
  ["OCUPANTES", "lugares"],
  ["ENTRETENIMENTO", "infotenimento"],
]);
const isEquip = (id: CampoImport | null) =>
  EQUIPAMENTOS.some(([e]) => e === id);

export function importarFicha(
  source: string,
): Partial<Record<CampoImport, string>> {
  const found: Partial<Record<CampoImport, string[]>> = {};
  let active: CampoImport | null = null;
  let topSection = "";
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    if (/^# /.test(line)) {
      topSection = norm(line);
      active = null;
      continue;
    }
    if (topSection === "ANUNCIO") break;
    if (/^---+$/.test(line)) {
      active = null;
      continue;
    }
    const stripped = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
    const pair = stripped.match(/^([^:\t]+)[:\t]+\s*(.*)$/);
    const id = ALIASES.get(norm(pair ? pair[1] : stripped));
    if (id) {
      active = id;
      if (pair?.[2]) {
        found[id] = [pair[2].trim()];
        if (!isEquip(id)) active = null;
      }
      continue;
    }
    if (/^#/.test(line) || (/^[^:]{1,60}:/.test(line) && !isEquip(active))) {
      active = null;
      continue;
    }
    if (active) {
      (found[active] ??= []).push(stripped.replace(/^[-•]\s*/, ""));
      if (!isEquip(active)) active = null;
    }
  }
  return Object.fromEntries(
    Object.entries(found).map(([k, items]) => [k, items!.join("\n")]),
  );
}
