import { invoke } from "./desktop";

/** Chama um método do motor Python (engine/main.py). */
export function engine<T = unknown>(
  method: string,
  params?: unknown,
): Promise<T> {
  return invoke<T>("engine_call", { method, params });
}

export async function paraBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function deBase64(b64: string, type: string, nome: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], nome, { type });
}

export type CamposCrlv = {
  renavam: string;
  placa: string;
  exercicio: string;
  fabricacao: string;
  modelo: string;
  crv: string;
  seguranca: string;
  cat: string;
  marca: string;
  especie: string;
  anterior: string;
  chassi: string;
  cor: string;
  combustivel: string;
  observacoes: string;
};
export type ResultadoCrlv =
  | { senha: string }
  | {
      values: CamposCrlv;
      conflicts: string[];
      paginas: number;
      sem_texto: number[];
      ocr?: boolean;
    };

/** PDF do anexo (File) ou já gravado no disco (caminho). */
export const lerCrlv = async (pdf: File | string, senha?: string) =>
  engine<ResultadoCrlv>("ler_crlv", {
    ...(typeof pdf === "string"
      ? { origem: pdf }
      : { arquivo: await paraBase64(pdf) }),
    senha,
  });

export type Categoria = "seguranca" | "conforto" | "infotenimento";
export const ocrEquipamentos = async (
  imagem: Blob,
  modo: "auto" | Categoria = "auto",
) =>
  engine<{ itens: Record<Categoria, string[]>; titulos: number; fora: number }>(
    "ocr_equipamentos",
    {
      arquivo: await paraBase64(imagem),
      modo,
    },
  );

let recorteAquecido = false;

/** Carrega o modelo de recorte em segundo plano (uma vez por sessão), para o primeiro recorte sair mais rápido. */
export function aquecerRecorte() {
  if (recorteAquecido) return;
  recorteAquecido = true;
  // Sem o motor instalado isto falha em silêncio: o recorte avisa quando for usado.
  void engine("aquecer_recorte").catch(() => {
    recorteAquecido = false;
  });
}

export async function removerFundo(foto: Blob, nome = "foto"): Promise<File> {
  const { png } = await engine<{ png: string }>("remover_fundo", {
    arquivo: await paraBase64(foto),
  });
  return deBase64(
    png,
    "image/png",
    nome.replace(/\.[^.]+$/, "") + "-sem-fundo.png",
  );
}

// ---- Carros na Web (ficha técnica + equipamentos de série) ----
export type VersaoCnw = { codigo: string; titulo: string; ano: string };
export type BuscaCnw = { modelo: string; versoes: VersaoCnw[]; busca: string };
export type FichaCnw = {
  codigo: string;
  url: string;
  tecnicos: {
    titulo: string;
    ano: string;
    configuracao: string;
    lugares: string;
    portas: string;
    cambio: string;
    direcao: string;
    combustivel: string;
  };
  equipamentos: Record<Categoria, string[]>;
};

/** Versões daquele modelo/ano no catálogo do site. */
export const buscarCnw = (nome: string, ano?: string | null) =>
  engine<BuscaCnw>("cnw_buscar", { nome, ano });

/** Ficha da versão escolhida. Só traz equipamentos DE SÉRIE (os opcionais ficam de fora). */
export const fichaCnw = (codigo: string, referer?: string) =>
  engine<FichaCnw>("cnw_ficha", { codigo, referer });

/** Consulta na web com reserva: tenta cada fonte até uma responder. */
export type BuscaWeb = BuscaCnw & {
  fonte: string;
  avisos: string[];
  /** Palavras do nome que a fonte não usa no modelo (ex.: "hatch"). */
  ignoradas?: string[];
};
export type FichaWeb = FichaCnw & {
  /** true: só itens de série (Carros na Web). false: o site não separa série de opcional. */
  equipamentos_de_serie: boolean;
  fonte: string;
};
export const buscarWeb = (nome: string, ano?: string | null) =>
  engine<BuscaWeb>("ficha_web_buscar", { nome, ano });
export const fichaWeb = (codigo: string) =>
  engine<FichaWeb>("ficha_web_ficha", { codigo });

/** Dados técnicos a partir do texto da ficha colado pela pessoa. Não acessa o site e não traz equipamentos. */
export const fichaCnwTexto = (texto: string) =>
  engine<FichaCnw>("cnw_texto", { texto });
