/** Regras puras da importação do estoque (sem Tauri): testáveis com vitest. */
import { importarFicha, parseNumber } from "./description-generator";

export type PastaVeiculo = {
  caminho: string;
  nome: string;
  pdf: string | null;
  des_md: string | null;
  info_md?: string | null;
  fotos: string[];
  criativos: number;
  modificado: number;
};

const PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

/** "01_FIESTA_PJR1A63" → { modelo: "FIESTA", placa: "PJR1A63" } */
export function lerNomePasta(nome: string): {
  modelo: string;
  placa: string | null;
} {
  const partes = nome
    .toUpperCase()
    .split(/[_\s-]+/)
    .filter(Boolean);
  if (partes.length && /^\d+$/.test(partes[0])) partes.shift();
  const placa =
    partes.length > 1 && PLACA.test(partes.at(-1)!) ? partes.pop()! : null;
  return { modelo: partes.join(" ") || nome, placa };
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** Campos de um DES.md existente (gerado pelo sistema antigo ou por este app). */
export function lerDesExistente(md: string) {
  const texto = md.replace(/\r\n/g, "\n");
  const secao = (titulo: string) => {
    const m = texto.match(
      new RegExp(`^## ${titulo}\\n([\\s\\S]*?)(?=\\n\\n|\\n## |\\n---|$)`, "m"),
    );
    return m?.[1].trim() ?? "";
  };
  const negrito = (titulo: string) =>
    texto.match(new RegExp(`\\*\\*${titulo}\\*\\*\\n(.+)`))?.[1].trim() ?? "";

  const ficha = importarFicha(texto);
  const ano = ficha.ano?.trim() || negrito("ANO");
  const tituloCarrossel = negrito("TITULO"); // "FORD FIESTA 2016"
  const nome = ano
    ? tituloCarrossel.replace(new RegExp(`\\s+${ano}$`), "").trim()
    : tituloCarrossel;
  const valor = secao("VALOR").replace(/^R\$\s*/i, "");
  const km = secao("QUILOMETRAGEM");
  const marca = secao("MARCA / MODELO / VERSÃO");
  const naoInformado = (s: string | undefined) =>
    s && semAcento(s) !== "NAO INFORMADO" ? s : undefined;

  return {
    nome: nome || undefined,
    ano: naoInformado(ano),
    marca_modelo: naoInformado(marca),
    preco: parseNumber(valor),
    km: parseNumber(km, true),
    versao: naoInformado(ficha.versao),
    cambio: naoInformado(ficha.cambio),
    configuracao: naoInformado(ficha.configuracao),
    lugares: naoInformado(ficha.lugares),
    portas: naoInformado(ficha.portas),
    direcao: naoInformado(ficha.direcao),
    seguranca: naoInformado(ficha.seguranca),
    conforto: naoInformado(ficha.conforto),
    infotenimento: naoInformado(ficha.infotenimento),
  };
}

const arquivo = (caminho: string) => caminho.split(/[\\/]/).pop() ?? caminho;
const stem = (caminho: string) => arquivo(caminho).replace(/\.[^.]+$/, "");
const isPng = (caminho: string) => /\.png$/i.test(caminho);

/**
 * Distribui as fotos da pasta nos espaços do editor, no padrão do estoque:
 * 1.jpeg = foto com fundo (original), 1.png / 1_t.png = recorte (principal),
 * 2, 3, 4 = painéis esquerdo, central e direito.
 */
export function distribuirFotos(fotos: string[]) {
  const jpgs = fotos.filter((f) => !isPng(f));
  const original = jpgs[0] ?? null;
  const base = original ? stem(original) : "1";
  const recorte =
    fotos.find(
      (f) => isPng(f) && (stem(f) === base || stem(f).startsWith(base + "_")),
    ) ?? null;
  const restantes = jpgs.slice(1);
  return {
    original,
    recorte,
    left: restantes[0] ?? null,
    center: restantes[1] ?? null,
    right: restantes[2] ?? null,
  };
}

/** Identidade externa estável do BNDV; o id local do banco permanece independente. */
export function idEstoque(nome: string): number | null {
  const match = /^(\d+)_/.exec(nome);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function lerInfoBndv(md: string) {
  const campo = (nome: string) =>
    md
      .split(/\r?\n/)
      .find((linha) => linha.includes(`**${nome}**`))
      ?.split("|")[2]
      ?.trim();
  const nome = campo("Marca / modelo");
  const preco = campo("Preço de tabela");
  return {
    nome: nome && nome !== "—" ? nome : undefined,
    placa: campo("Placa"),
    chassi: campo("Chassi"),
    preco:
      preco && preco !== "—"
        ? parseNumber(preco.replace(/^R\$\s*/, ""))
        : undefined,
  };
}
