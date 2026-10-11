/**
 * Leitura e escrita nas pastas do estoque e nas fotos do editor.
 *
 * Porta do `scripts/local_server.py` do Studio. Todo caminho que vem da
 * interface passa por `dentro()` ou `nomeSeguro()` antes de virar arquivo:
 * a interface é HTML e não deve poder escrever onde quiser.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as caminhos from "../caminhos";

export const SLOTS = ["main", "left", "center", "right", "original"] as const;
export type Slot = (typeof SLOTS)[number];
const IMAGENS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEOS = [".mp4", ".mov", ".mkv", ".avi"];
/** Subpasta da versão leve do vídeo (engine/video/leve.py). */
export const PASTA_ANUNCIO = "ANUNCIO";

const MIMES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
};
export const mime = (nome: string) =>
  MIMES[path.extname(nome).toLowerCase()] ?? "application/octet-stream";

/** Arquivos (não pastas) de um diretório; lista vazia se ele não existir. */
export function arquivos(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
}

const stem = (p: string) => path.basename(p, path.extname(p));
const ext = (p: string) => path.extname(p).toLowerCase();

/** Ordena 1, 2, 10 (e não 1, 10, 2): o número do começo manda. */
export function natural(a: string, b: string) {
  const n = (p: string) =>
    Number(/^\d+/.exec(stem(p))?.[0] ?? Number.MAX_SAFE_INTEGER);
  return (
    n(a) - n(b) ||
    path.basename(a).toLowerCase().localeCompare(path.basename(b).toLowerCase())
  );
}

/** A pasta de fotos do veículo: aceita FOTO ou FOTOS, como está no estoque. */
export function pastaFotos(pasta: string) {
  try {
    const achada = fs
      .readdirSync(pasta, { withFileTypes: true })
      .find(
        (d) =>
          d.isDirectory() && ["FOTO", "FOTOS"].includes(d.name.toUpperCase()),
      );
    if (achada) return path.join(pasta, achada.name);
  } catch {
    /* pasta inexistente: devolve o padrão */
  }
  return path.join(pasta, "FOTOS");
}

export function nomeSeguro(nome: string) {
  if (
    !nome ||
    path.basename(nome) !== nome ||
    /[\\/:<>"|?*]/.test(nome) ||
    nome.startsWith(".")
  ) {
    throw new Error("Nome de arquivo inválido.");
  }
  return nome;
}

/** Garante que `alvo` está dentro de `raiz` — nada de `..\..\Windows`. */
export function dentro(raiz: string, alvo: string) {
  const r = path.resolve(raiz);
  const a = path.resolve(alvo);
  if (a !== r && !a.startsWith(r + path.sep))
    throw new Error("Arquivo fora da pasta autorizada.");
  return a;
}

// ------------------------------------------------------- pastas do estoque
export type PastaVeiculo = {
  caminho: string;
  nome: string;
  pdf: string | null;
  info_md: string | null;
  des_md: string | null;
  fotos: string[];
  criativos: number;
  modificado: number;
};

/** Uma entrada por subpasta com conteúdo de veículo (ficha, documento ou fotos). */
export function listarEstoque(raiz: string): PastaVeiculo[] {
  const resultado: PastaVeiculo[] = [];
  if (!fs.existsSync(raiz)) return resultado;
  const pastas = fs
    .readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const nome of pastas) {
    const pasta = path.join(raiz, nome);
    const lista = arquivos(pasta);
    const achar = (teste: (p: string) => boolean) => lista.find(teste) ?? null;
    const info = achar((p) => path.basename(p).toLowerCase() === "info.md");
    const des = achar((p) => path.basename(p).toLowerCase() === "des.md");
    const pdf = achar((p) => ext(p) === ".pdf");
    const fotos = arquivos(pastaFotos(pasta))
      .filter((p) => IMAGENS.includes(ext(p)))
      .sort(natural);
    if (!info && !des && !pdf && !fotos.length) continue;

    const tempos = [pasta, ...lista, ...fotos].map((p) => {
      try {
        return Math.trunc(fs.statSync(p).mtimeMs / 1000);
      } catch {
        return 0;
      }
    });
    resultado.push({
      caminho: pasta,
      nome,
      pdf,
      info_md: info,
      des_md: des,
      fotos,
      criativos: arquivos(path.join(pasta, "CRIATIVO")).filter(
        (p) => ext(p) === ".png",
      ).length,
      modificado: Math.max(...tempos),
    });
  }
  return resultado;
}

export const lerArquivo = (raiz: string, caminho: string) =>
  new Uint8Array(fs.readFileSync(dentro(raiz, caminho)));

// --------------------------------------------------- fotos do editor
const pastaDoVeiculo = (veiculo: number | string) =>
  path.join(
    caminhos.PASTA_VEICULOS(),
    String(Math.trunc(Number(veiculo))),
    "fotos",
  );

export type FotoSalva = { slot: Slot; mime: string; nome: string };

export function salvarFoto(
  veiculo: number | string,
  slot: string,
  nome: string,
  tipo: string,
  corpo: Uint8Array,
) {
  if (!SLOTS.includes(slot as Slot)) throw new Error("Foto inválida.");
  const extensao = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  }[tipo];
  if (!extensao) throw new Error("Formato de foto inválido.");
  const pasta = pastaDoVeiculo(veiculo);
  fs.mkdirSync(pasta, { recursive: true });
  const alvo = path.join(pasta, `${slot}.${extensao}`);
  const temporario = alvo + ".tmp";
  // Grava no temporário e troca: se o app fechar no meio, a foto antiga fica.
  fs.writeFileSync(temporario, corpo);
  fs.renameSync(temporario, alvo);
  for (const antigo of arquivos(pasta)) {
    if (
      stem(antigo) === slot &&
      IMAGENS.includes(ext(antigo)) &&
      antigo !== alvo
    )
      fs.rmSync(antigo, { force: true });
  }
  fs.writeFileSync(path.join(pasta, `${slot}.nome`), nome, "utf8");
}

export function listarFotos(veiculo: number | string): FotoSalva[] {
  const pasta = pastaDoVeiculo(veiculo);
  return arquivos(pasta)
    .filter((p) => SLOTS.includes(stem(p) as Slot) && IMAGENS.includes(ext(p)))
    .map((p) => {
      const arquivoNome = path.join(pasta, `${stem(p)}.nome`);
      let nome = path.basename(p);
      try {
        nome = fs.readFileSync(arquivoNome, "utf8");
      } catch {
        /* usa o nome do arquivo */
      }
      return { slot: stem(p) as Slot, mime: mime(p), nome };
    });
}

export function lerFoto(veiculo: number | string, slot: string) {
  if (!SLOTS.includes(slot as Slot)) throw new Error("Foto inválida.");
  const achada = arquivos(pastaDoVeiculo(veiculo)).find(
    (p) => stem(p) === slot && IMAGENS.includes(ext(p)),
  );
  if (!achada) throw new Error("Foto não encontrada.");
  return new Uint8Array(fs.readFileSync(achada));
}

export function apagarArquivosVeiculo(veiculo: number | string) {
  const pasta = path.join(
    caminhos.PASTA_VEICULOS(),
    String(Math.trunc(Number(veiculo))),
  );
  dentro(caminhos.PASTA_VEICULOS(), pasta);
  fs.rmSync(pasta, { recursive: true, force: true });
}

/** Importa as fotos numeradas da pasta do estoque para os espaços do editor. */
export function importarFotosPadrao(veiculo: number | string, pasta: string) {
  const lista = arquivos(pastaFotos(pasta)).sort(natural);
  const pares: [Slot, string][] = [
    ["original", "1"],
    ["left", "1"],
    ["main", "1"],
    ["center", "6"],
    ["right", "7"],
  ];
  let total = 0;
  for (const [slot, numero] of pares) {
    let achada = lista.find(
      (p) => stem(p) === numero && IMAGENS.includes(ext(p)),
    );
    // A principal prefere o recorte: é ele que o editor usa sobre o fundo.
    if (slot === "main")
      achada =
        lista.find((p) => stem(p) === "1_sem_fundo" && ext(p) === ".png") ??
        achada;
    if (!achada) continue;
    salvarFoto(
      veiculo,
      slot,
      path.basename(achada),
      mime(achada),
      new Uint8Array(fs.readFileSync(achada)),
    );
    total++;
  }
  return total;
}

// ------------------------------------------------------------- criativos
/** destino: pasta do veículo (grava em <destino>\CRIATIVO); sem ela, Imagens\SOUL Cars\<pasta>. */
export function salvarCriativo(
  pastaNome: string,
  nome: string,
  destino: string | null,
  corpo: Uint8Array,
) {
  const pasta = destino
    ? path.join(destino, "CRIATIVO")
    : path.join(os.homedir(), "Pictures", "SOUL Cars", nomeSeguro(pastaNome));
  fs.mkdirSync(pasta, { recursive: true });
  const alvo = path.join(pasta, nomeSeguro(nome));
  fs.writeFileSync(alvo, corpo);
  return alvo;
}

/** Grava um arquivo na pasta do veículo (DOC.pdf, DOC.md, DES.md, recortes). */
export function gravarNaPasta(pasta: string, nome: string, corpo: Uint8Array) {
  if (!fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory())
    throw new Error("Pasta não encontrada.");
  const alvo = path.join(pasta, nomeSeguro(nome));
  fs.writeFileSync(alvo, corpo);
  return alvo;
}

// ------------------------------------------------------------- produção
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
  /** Versão leve para anúncio, em ANUNCIO/ (fora das pastas que o render e o Instagram leem). */
  video_leve: string | null;
  video_leve_bytes: number | null;
  criativos: string[];
  projeto: boolean;
};

export function statusProducao(pasta: string): StatusProducao {
  const lista = arquivos(pastaFotos(pasta))
    .filter((p) => IMAGENS.includes(ext(p)))
    .sort(natural);
  const escolher = (teste: (p: string) => boolean) => lista.find(teste) ?? null;
  const videos = [
    ...arquivos(path.join(pasta, "VIDEO")),
    ...arquivos(path.join(pasta, "PROJETO")),
    ...arquivos(pasta).filter(
      (p) => !path.basename(p).toUpperCase().startsWith("VIDEO_"),
    ),
  ];
  const naPasta = arquivos(pasta);
  const final =
    naPasta.find(
      (p) =>
        path.basename(p).toUpperCase().startsWith("VIDEO_") &&
        ext(p) === ".mp4",
    ) ?? null;
  const leve =
    arquivos(path.join(pasta, PASTA_ANUNCIO)).find(
      (p) =>
        path.basename(p).toUpperCase().startsWith("ANUNCIO_") &&
        ext(p) === ".mp4" &&
        !path.basename(p).toLowerCase().endsWith(".parcial.mp4"),
    ) ?? null;
  const bytes = (p: string | null) => (p ? fs.statSync(p).size : null);
  return {
    doc_pdf: naPasta.some((p) => ext(p) === ".pdf"),
    doc_md: fs.existsSync(path.join(pasta, "DOC.md")),
    des_md: fs.existsSync(path.join(pasta, "DES.md")),
    fotos: lista.map((p) => path.basename(p)),
    principal: escolher((p) => stem(p) === "1"),
    sem_fundo: escolher(
      (p) => ext(p) === ".png" && (stem(p) === "1" || stem(p).startsWith("1_")),
    ),
    video_bruto: videos.find((p) => VIDEOS.includes(ext(p))) ?? null,
    video_final: final,
    video_final_bytes: bytes(final),
    video_leve: leve,
    video_leve_bytes: bytes(leve),
    criativos: arquivos(path.join(pasta, "CRIATIVO")).map((p) =>
      path.basename(p),
    ),
    projeto: fs.existsSync(path.join(pasta, "PROJETO")),
  };
}

/** Acha o PDF do documento dentro da pasta do veículo. */
export function documentoNaPasta(pasta: string) {
  const pdfs = arquivos(pasta).filter((p) => ext(p) === ".pdf");
  const pdf =
    pdfs.find((p) => path.basename(p).toLowerCase() === "doc.pdf") ?? pdfs[0];
  if (!pdf)
    throw new Error(
      "Nenhum PDF na pasta do veículo. Coloque o CRLV lá e tente de novo.",
    );
  return {
    caminho: pdf,
    nome: path.basename(pdf),
    ja_e_doc: path.basename(pdf).toLowerCase() === "doc.pdf",
  };
}

/** Prévias locais, sem expor caminhos de arquivo ao navegador. */
export function previaFotos(pasta: string) {
  return arquivos(pastaFotos(pasta))
    .filter((p) => IMAGENS.includes(ext(p)) && !stem(p).endsWith("_sem_fundo"))
    .sort(natural)
    .map((p) => ({
      nome: path.basename(p),
      miniatura: `data:${mime(p)};base64,${fs.readFileSync(p).toString("base64")}`,
    }));
}

export function copiarComoDoc(pasta: string, origem: string) {
  const alvo = path.join(pasta, "DOC.pdf");
  if (path.resolve(alvo) !== path.resolve(origem))
    fs.copyFileSync(origem, alvo);
  return alvo;
}

/**
 * Renomeia as fotos para 1, 2, 3… na ordem recebida.
 *
 * Passa por nomes temporários para poder trocar fotos de posição entre si
 * (1 → 2 e 2 → 1) sem uma sobrescrever a outra. Se algo falhar no meio, os
 * nomes originais voltam.
 */
export function renomearFotos(pasta: string, ordem: string[]) {
  const pasta_ = pastaFotos(pasta);
  if (new Set(ordem).size !== ordem.length) throw new Error("Fotos repetidas.");

  const movimentos: [string, string][] = [];
  ordem.forEach((nome, i) => {
    const origem = path.join(pasta_, nomeSeguro(nome));
    if (!fs.existsSync(origem) || !IMAGENS.includes(ext(origem)))
      throw new Error("Foto não encontrada.");
    movimentos.push([origem, path.join(pasta_, `${i + 1}${ext(origem)}`)]);
    const recorte = path.join(pasta_, `${stem(origem)}_sem_fundo.png`);
    if (fs.existsSync(recorte))
      movimentos.push([recorte, path.join(pasta_, `${i + 1}_sem_fundo.png`)]);
  });

  const origens = new Set(movimentos.map(([o]) => o));
  if (movimentos.some(([, d]) => fs.existsSync(d) && !origens.has(d))) {
    throw new Error("O destino já possui uma foto fora da seleção.");
  }

  const nonce = Math.random().toString(36).slice(2, 10);
  const temporarios: [string, string, string][] = [];
  const concluidos: [string, string, string][] = [];
  try {
    movimentos.forEach(([origem, destino], i) => {
      const temp = path.join(pasta_, `.studio-${nonce}-${i}`);
      fs.renameSync(origem, temp);
      temporarios.push([origem, temp, destino]);
    });
    for (const movimento of temporarios) {
      fs.renameSync(movimento[1], movimento[2]);
      concluidos.push(movimento);
    }
  } catch (erro) {
    // Primeiro libera todos os nomes de destino; só então restaura origens.
    for (const [, temp, destino] of [...concluidos].reverse()) {
      if (fs.existsSync(destino)) fs.renameSync(destino, temp);
    }
    for (const [origem, temp] of [...temporarios].reverse()) {
      if (fs.existsSync(temp)) fs.renameSync(temp, origem);
    }
    throw erro;
  }
  return {
    pasta: pasta_,
    nomes: ordem.map((nome, i) => `${i + 1}${ext(nome)}`),
  };
}

/** Próximo número livre para uma pasta nova no padrão NN_NOME_PLACA. */
export function proximoNumero(raiz: string) {
  const numeros = fs
    .readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => Number(/^(\d+)[_\s-]/.exec(d.name)?.[1] ?? 0))
    .filter((n) => Number.isFinite(n));
  return Math.max(0, ...numeros) + 1;
}

/**
 * Cria a pasta de um veículo novo, copiando o PROJETO do veículo anterior.
 *
 * Só o PROJETO é copiado (o template de edição de vídeo); fotos e documentos
 * do carro anterior nunca entram na pasta nova.
 */
export function criarPasta(
  raiz: string,
  numero: number,
  nome: string,
  placa: string,
) {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  const pastaNome = [String(numero).padStart(2, "0"), slug(nome), slug(placa)]
    .filter(Boolean)
    .join("_");
  const caminho = path.join(raiz, nomeSeguro(pastaNome));
  fs.mkdirSync(caminho, { recursive: true });
  for (const sub of ["CRIATIVO", "FOTOS", "PROJETO"])
    fs.mkdirSync(path.join(caminho, sub), { recursive: true });

  const anteriores = fs
    .readdirSync(raiz, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && d.name !== pastaNome && /^\d+[_\s-]/.test(d.name),
    )
    .map((d) => d.name)
    .sort();
  const modelo = anteriores.at(-1) ?? null;
  const copiados: string[] = [];
  if (modelo) {
    const origem = path.join(raiz, modelo, "PROJETO");
    for (const p of arquivos(origem)) {
      const destino = path.join(caminho, "PROJETO", path.basename(p));
      try {
        fs.copyFileSync(p, destino);
        copiados.push(path.basename(p));
      } catch {
        /* arquivo em uso: segue sem ele */
      }
    }
  }
  return { caminho, nome: pastaNome, modelo_de: modelo, copiados };
}
