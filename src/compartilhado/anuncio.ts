/**
 * Regras do painel "Pronto para anunciar": checklist de prontidão, cartão da campanha e
 * lembrete de pausa. Funções puras (sem disco, sem banco, sem Electron): o app só mostra o
 * que elas calculam, e nada aqui publica ou ativa anúncio.
 */
import { blocosDeCopia, type BlocoCopia } from "./publicacao";
import { slugInstagram } from "./instagram";

/** Prefixo do nome da campanha de venda (o DES.md ainda gera [LEAD]; o cartão corrige). */
export const PREFIXO_VENDA = "[VENDA]";
/** Dados do BNDV mais velhos que isso não garantem o aviso de venda. */
export const HORAS_DADOS_ANTIGOS = 24;

export type DestinoChecklist = "producao" | "ficha" | "criativos";

export type EntradaChecklist = {
  nome: string;
  ano: string | null;
  doc_pdf: boolean;
  doc_md: boolean;
  des_md: boolean;
  fotos: string[];
  video_final: string | null;
  criativos: string[];
};

export type ItemChecklist = {
  id: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
  /** Aba onde o item se resolve. */
  destino: DestinoChecklist;
};

const stem = (n: string) => n.replace(/\.[^.]+$/, "");

/** Fotos "de verdade" (sem os recortes `_sem_fundo`), na ordem em que estão. */
function fotosDoVeiculo(nomes: string[]) {
  return nomes.filter((n) => !/_sem_fundo$/i.test(stem(n)));
}

/** As fotos estão numeradas 1, 2, 3… sem buracos? */
export function fotosNumeradas(nomes: string[]): {
  ok: boolean;
  detalhe: string;
} {
  const fotos = fotosDoVeiculo(nomes);
  if (!fotos.length)
    return { ok: false, detalhe: "Coloque as fotos na pasta FOTOS." };
  const numeros = fotos.map((n) =>
    /^\d+$/.test(stem(n)) ? Number(stem(n)) : NaN,
  );
  const fora = fotos.filter((_, i) => Number.isNaN(numeros[i]));
  if (fora.length)
    return {
      ok: false,
      detalhe: `${fora.length} foto(s) sem número (${fora.slice(0, 2).join(", ")}…). Renomeie pela ordem do painel.`,
    };
  const ordenados = [...numeros].sort((a, b) => a - b);
  const falta = ordenados.findIndex((n, i) => n !== i + 1);
  if (falta >= 0)
    return {
      ok: false,
      detalhe: `A sequência de números tem buraco ou repetição perto de ${ordenados[falta]}. Renomeie pela ordem do painel.`,
    };
  return {
    ok: true,
    detalhe: `${fotos.length} foto(s) numeradas de 1 a ${fotos.length}`,
  };
}

/** Nome do criativo de foto do anúncio (o mesmo que o editor exporta como "Tráfego Pago"). */
export const nomeBaseCriativo = (nome: string, ano: string | null) =>
  slugInstagram(nome, ano);

export function fotoDoAnuncio(
  criativos: string[],
  nome: string,
  ano: string | null,
): string | null {
  const alvo = `${nomeBaseCriativo(nome, ano)}-trafego-pago`;
  return (
    criativos.find(
      (n) => stem(n).toLowerCase() === alvo && /\.(png|jpe?g)$/i.test(n),
    ) ?? null
  );
}

export function checklist(e: EntradaChecklist): ItemChecklist[] {
  const fotos = fotosNumeradas(e.fotos);
  const foto = fotoDoAnuncio(e.criativos, e.nome, e.ano);
  return [
    {
      id: "documento",
      titulo: "Documento lido",
      ok: e.doc_pdf && e.doc_md,
      detalhe:
        e.doc_pdf && e.doc_md
          ? "DOC.pdf e DOC.md na pasta"
          : e.doc_pdf
            ? "Falta ler o documento (gerar DOC.md)"
            : "Anexe o PDF do documento",
      destino: "ficha",
    },
    {
      id: "fotos",
      titulo: "Fotos presentes e na ordem",
      ok: fotos.ok,
      detalhe: fotos.detalhe,
      destino: "producao",
    },
    {
      id: "video",
      titulo: "Vídeo gerado",
      ok: !!e.video_final,
      detalhe: e.video_final
        ? e.video_final.split(/[\\/]/).pop()!
        : "Gere o vídeo no Editor Mágico",
      destino: "producao",
    },
    {
      id: "descricao",
      titulo: "DES.md gerado",
      ok: e.des_md,
      detalhe: e.des_md ? "DES.md na pasta" : "Gere o DES.md na ficha",
      destino: "ficha",
    },
    {
      id: "criativos",
      titulo: "Criativo de foto exportado",
      ok: !!foto,
      detalhe:
        foto ??
        `Exporte "${nomeBaseCriativo(e.nome, e.ano)}-trafego-pago" no editor`,
      destino: "criativos",
    },
  ];
}

export const prontoParaAnunciar = (itens: ItemChecklist[]) =>
  itens.every((i) => i.ok);

// ---------------------------------------------------------------- cartão
export type CartaoCampanha = {
  nomeCampanha: string | null;
  textos: BlocoCopia[];
  titulos: BlocoCopia[];
  descricoes: BlocoCopia[];
  mensagens: BlocoCopia[];
};

/** Tira o prefixo [LEAD]/[VENDA]/… do nome da campanha: o padrão é só "Marca Modelo Ano". */
export function nomeComPrefixoVenda(nome: string): string {
  return nome.trim().replace(/^\[[^\]]*\]\s*/, "");
}

/**
 * Os blocos do `# ANUNCIO` do DES.md: os 5 textos principais, 5 títulos e 5 descrições
 * (as cinco lacunas do Gerenciador) e as mensagens do WhatsApp.
 */
export function cartaoCampanha(desMd: string): CartaoCampanha {
  const blocos = blocosDeCopia(desMd);
  const nome = blocos.find((b) => b.label === "Nome da campanha")?.text;
  return {
    nomeCampanha: nome ? nomeComPrefixoVenda(nome) : null,
    textos: blocos.filter((b) => /^\d+\.\s*TEXTO PRINCIPAL$/.test(b.label)),
    titulos: blocos.filter((b) => /^Título \d+$/.test(b.label)),
    descricoes: blocos.filter((b) => /^Descrição \d+$/.test(b.label)),
    mensagens: blocos.filter((b) => /^MENSAGEM/.test(b.label)),
  };
}

// ----------------------------------------------------------- lembrete de pausa
export type AnuncioRegistrado = {
  id: number;
  veiculo_id: number;
  estoque_id: number | null;
  modelo: string;
  campanha: string;
  /** AAAA-MM-DD */
  criado_dia: string;
  pausado_dia: string | null;
};

export type AvisoPausa = {
  anuncio: AnuncioRegistrado;
  /** AAAA-MM-DD da última venda do veículo. */
  vendidoEm: string;
};

const dia = (iso: string) => iso.slice(0, 10);

/**
 * Anúncios ainda não pausados cujo veículo tem venda no BNDV no dia da criação do anúncio
 * ou depois. `vendas`: id do BNDV → data (ISO) da última venda.
 */
export function anunciosParaPausar(
  anuncios: AnuncioRegistrado[],
  vendas: Record<string, string>,
): AvisoPausa[] {
  const avisos: AvisoPausa[] = [];
  for (const a of anuncios) {
    if (a.pausado_dia || a.estoque_id == null) continue;
    const venda = vendas[String(a.estoque_id)];
    if (venda && dia(venda) >= a.criado_dia)
      avisos.push({ anuncio: a, vendidoEm: dia(venda) });
  }
  return avisos;
}

/** Há anúncios abertos e o arquivo de vendas do BNDV está velho (ou não existe)? */
export function dadosDoBndvAntigos(
  anunciosAbertos: number,
  atualizadoEm: string | null,
  agora = Date.now(),
): boolean {
  if (!anunciosAbertos) return false;
  if (!atualizadoEm) return true;
  const t = Date.parse(atualizadoEm);
  return !Number.isFinite(t) || agora - t > HORAS_DADOS_ANTIGOS * 3600_000;
}

/** AAAA-MM-DD no horário local. */
export function hoje(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

export const dataBr = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
    : d;
