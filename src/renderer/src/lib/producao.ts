/** Fluxo de produção do veículo: pasta, documento, mídia, recorte, vídeo. */
import { invoke } from "./desktop";
import { engine } from "./engine";
import type { CamposCrlv } from "./engine";

export type PastaCriada = {
  caminho: string;
  nome: string;
  modelo_de: string | null;
  copiados: string[];
};

export type StatusProducao = {
  doc_pdf: boolean;
  doc_md: boolean;
  des_md: boolean;
  fotos: string[];
  principal: string | null;
  sem_fundo: string | null;
  video_bruto: string | null;
  video_final: string | null;
  video_final_bytes: number | null;
  video_leve: string | null;
  video_leve_bytes: number | null;
  criativos: string[];
  projeto: boolean;
};

export const proximoNumero = (raiz: string) =>
  invoke<number>("estoque_proximo_numero", { raiz });

export const criarPasta = (
  raiz: string,
  numero: number,
  nome: string,
  placa: string,
) => invoke<PastaCriada>("pasta_criar", { raiz, numero, nome, placa });

export const statusProducao = (pasta: string) =>
  invoke<StatusProducao>("producao_status", { pasta });

export type DocumentoNaPasta = {
  caminho: string;
  nome: string;
  ja_e_doc: boolean;
};

/** Acha o PDF do documento dentro da pasta do veículo (sem caixa de seleção de arquivo). */
export const documentoNaPasta = (pasta: string) =>
  invoke<DocumentoNaPasta>("producao_documento", { pasta });

export const copiarComoDoc = (pasta: string, origem: string) =>
  invoke<string>("producao_doc_copiar", { pasta, origem });

/** Grava um arquivo na pasta do veículo (ex.: DOC.pdf, DOC.md, DES.md). */
export async function gravarNaPasta(
  pasta: string,
  nome: string,
  dados: Blob | string,
): Promise<string> {
  const bytes =
    typeof dados === "string"
      ? new TextEncoder().encode(dados)
      : new Uint8Array(await dados.arrayBuffer());
  return invoke<string>("producao_gravar", bytes, {
    headers: {
      "x-pasta": encodeURIComponent(pasta),
      "x-nome": encodeURIComponent(nome),
    },
  });
}

export type DocGerado =
  | { values: CamposCrlv; markdown: string; conflicts: string[] }
  | { senha: string };

/** Lê o CRLV e monta o DOC.md no formato do sistema antigo. */
export const gerarDocMd = (
  pdf: { base64?: string; origem?: string },
  senha?: string,
) =>
  engine<DocGerado>("gerar_doc_md", {
    arquivo: pdf.base64,
    origem: pdf.origem,
    senha,
  });

/** Recorta uma foto do disco e grava o PNG (padrão: <nome>_sem_fundo.png ao lado). */
export const recortarArquivo = (
  origem: string,
  destino?: string,
  modelo?: string,
) => engine<{ caminho: string }>("remover_fundo", { origem, destino, modelo });

export type FotoOrganizada = {
  atual: string;
  novo: string;
  tipo: string;
  descricao: string;
  miniatura: string;
};
export type OrdemFotos = { pasta: string; fotos: FotoOrganizada[] };

/** Ordem sugerida para as fotos do veículo (reconhecimento local e gratuito; não mexe no disco). */
export const organizarFotos = (pasta: string) =>
  engine<OrdemFotos>("fotos_organizar", { pasta });

/** Renomeia as fotos para 1, 2, 3… na ordem recebida (nomes atuais já ordenados). */
export const renomearFotos = (pasta: string, ordem: string[]) =>
  invoke<{ pasta: string; nomes: string[] }>("fotos_renomear", {
    pasta,
    ordem,
  });

export type VideoPronto = { caminho: string; segundos: number };

export const gerarVideo = (
  pasta: string,
  veiculo: string,
  motor: string,
  preco: string,
  python?: string | null,
) =>
  invoke<VideoPronto>("video_gerar", { pasta, veiculo, motor, preco, python });

/** Recodifica o VIDEO_*.mp4 em ANUNCIO/ para subir em anúncio (cerca de 10 Mbps). */

/** Etapas do fluxo, na ordem, com o que falta em cada uma. */
export type Etapa = {
  id: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
};

export function etapas(
  status: StatusProducao | null,
  temPasta: boolean,
  desNoBanco: boolean,
): Etapa[] {
  const s = status;
  const fotosExtras = s
    ? s.fotos.filter((f) => !/^1(_|\.)/i.test(f)).length
    : 0;
  return [
    {
      id: "pasta",
      titulo: "Pasta do veículo",
      ok: temPasta,
      detalhe: temPasta
        ? "Pasta existente vinculada"
        : "Escolha a pasta existente no estoque BNDV",
    },
    {
      id: "documento",
      titulo: "Documento (CRLV)",
      ok: !!s?.doc_pdf && !!s?.doc_md,
      detalhe:
        s?.doc_pdf && s?.doc_md
          ? "DOC.pdf e DOC.md na pasta"
          : "Anexe o PDF do CRLV: gera DOC.pdf e DOC.md",
    },
    {
      id: "descricao",
      titulo: "Descrição (DES.md)",
      ok: !!s?.des_md || desNoBanco,
      detalhe: s?.des_md
        ? "DES.md na pasta"
        : desNoBanco
          ? "Gerado no app; salve na pasta"
          : "Gere o DES.md na ficha",
    },
    {
      id: "midia",
      titulo: "Fotos e vídeo bruto",
      ok: !!s?.principal && !!s?.video_bruto,
      detalhe: !s?.principal
        ? "Coloque as fotos em FOTOS (a principal é 1.jpeg)"
        : !s?.video_bruto
          ? `${s.fotos.length} foto(s); falta o vídeo bruto em PROJETO`
          : `${s.fotos.length} foto(s) e vídeo bruto (${fotosExtras} além da principal)`,
    },
    {
      id: "recorte",
      titulo: "Recorte (1_sem_fundo.png)",
      ok: !!s?.sem_fundo,
      detalhe: s?.sem_fundo
        ? s.sem_fundo.split("\\").pop()!
        : "Gere o PNG sem fundo a partir de 1.jpeg",
    },
    {
      id: "video",
      titulo: "Vídeo com tarjas",
      ok: !!s?.video_final,
      detalhe: s?.video_final
        ? s.video_final.split("\\").pop()!
        : "Gere o VIDEO_<MARCA>.mp4 (tarjas, legendas e trilha)",
    },
    {
      id: "criativos",
      titulo: "Criativos",
      ok: (s?.criativos.length ?? 0) > 0,
      detalhe: s?.criativos.length
        ? `${s.criativos.length} arquivo(s) em CRIATIVO`
        : "Exporte as artes no editor",
    },
    {
      id: "publicacao",
      titulo: "Publicação",
      ok: false,
      detalhe: "Blocos do # ANUNCIO para o Gerenciador de Anúncios",
    },
  ];
}

/** Textos das tarjas do vídeo a partir da ficha. */
export function tarjas(v: {
  nome: string;
  ano: string | null;
  versao: string | null;
  cambio: string | null;
  preco: number | null;
}) {
  const curto = (c: string) =>
    /AUTOM[AÁ]T/i.test(c) ? "AUTOMÁTICO" : /MANUAL/i.test(c) ? "MANUAL" : c;
  const preco =
    v.preco == null
      ? ""
      : `R$ ${v.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return {
    veiculo: [v.nome, v.ano].filter(Boolean).join(" ").toUpperCase(),
    motor: [v.versao, v.cambio ? curto(v.cambio) : ""]
      .filter(Boolean)
      .join(" ")
      .toUpperCase(),
    preco,
  };
}
