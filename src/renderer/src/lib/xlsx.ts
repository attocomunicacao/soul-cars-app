/**
 * Leitor mínimo de .xlsx (sem dependências): ZIP + SpreadsheetML.
 * Suporta arquivos "stored" e "deflate", strings compartilhadas, inline strings,
 * números, booleanos e datas (seriais do Excel ou texto). Suficiente para os
 * "Raw Data Report" exportados pelo Meta Ads.
 */

export type Celula = string | number | boolean | null;
export type Planilha = { nome: string; linhas: Celula[][] };

// ---------------- ZIP ----------------

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function lerZip(
  buffer: ArrayBuffer,
): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // End of central directory: assinatura 0x06054b50, procurada do fim (comentário até 65 KB).
  let eocd = -1;
  for (
    let i = bytes.length - 22;
    i >= Math.max(0, bytes.length - 22 - 65535);
    i--
  ) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo inválido: não é uma planilha .xlsx.");
  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const arquivos = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (view.getUint32(p, true) !== 0x02014b50)
      throw new Error("Planilha corrompida (diretório ZIP).");
    const metodo = view.getUint16(p + 10, true);
    const compactado = view.getUint32(p + 20, true);
    const nomeLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const comentarioLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const nome = decoder.decode(bytes.subarray(p + 46, p + 46 + nomeLen));
    p += 46 + nomeLen + extraLen + comentarioLen;
    if (nome.endsWith("/")) continue;
    const inicio =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const dados = bytes.subarray(inicio, inicio + compactado);
    if (metodo === 0) arquivos.set(nome, dados);
    else if (metodo === 8) arquivos.set(nome, await inflateRaw(dados));
    else throw new Error(`Compressão ZIP não suportada (${metodo}).`);
  }
  return arquivos;
}

// ---------------- XML ----------------

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
export const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(
          e[1].toLowerCase() === "x"
            ? parseInt(e.slice(2), 16)
            : parseInt(e.slice(1), 10),
        )
      : ENTIDADES[e.toLowerCase()],
  );

const attr = (tag: string, nome: string) =>
  tag.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1];
const textoDeRuns = (xml: string) =>
  [...xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
    .map((m) => decodeXml(m[1]))
    .join("");

function colunaIndice(ref: string): number {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// ---------------- Planilha ----------------

export async function lerXlsx(buffer: ArrayBuffer): Promise<Planilha[]> {
  const zip = await lerZip(buffer);
  const texto = (nome: string) => {
    const f = zip.get(nome);
    return f ? new TextDecoder().decode(f) : null;
  };
  const workbook = texto("xl/workbook.xml");
  if (!workbook) throw new Error("Arquivo inválido: planilha sem workbook.");

  const compartilhadas = [
    ...(texto("xl/sharedStrings.xml") ?? "").matchAll(
      /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g,
    ),
  ].map((m) => textoDeRuns(m[1]));

  // Estilos de data (numFmt) para converter seriais em datas.
  const estilos = texto("xl/styles.xml") ?? "";
  const formatosData = new Set([
    14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57,
  ]);
  for (const m of estilos.matchAll(/<(?:\w+:)?numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId"));
    const codigo = decodeXml(attr(m[0], "formatCode") ?? "")
      .toLowerCase()
      .replace(/"[^"]*"|\[[^\]]*\]/g, "");
    if (/[dy]/.test(codigo) || (/m/.test(codigo) && !/[hs]/.test(codigo)))
      formatosData.add(id);
  }
  const cellXfs =
    estilos.match(
      /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/,
    )?.[1] ?? "";
  const estiloEhData = [...cellXfs.matchAll(/<(?:\w+:)?xf\b[^>]*\/?>/g)].map(
    (m) => formatosData.has(Number(attr(m[0], "numFmtId"))),
  );

  const rels = texto("xl/_rels/workbook.xml.rels") ?? "";
  const alvo = new Map(
    [...rels.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)].map((m) => [
      attr(m[0], "Id"),
      attr(m[0], "Target"),
    ]),
  );

  const planilhas: Planilha[] = [];
  for (const m of workbook.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const nome = decodeXml(attr(m[0], "name") ?? "");
    const rid = attr(m[0], "r:id");
    let caminho = alvo.get(rid) ?? "";
    caminho = caminho.startsWith("/")
      ? caminho.slice(1)
      : "xl/" + caminho.replace(/^\.\//, "");
    const xml = texto(caminho);
    if (!xml) continue;
    const linhas: Celula[][] = [];
    for (const row of xml.matchAll(
      /<(?:\w+:)?row\b([^>]*?)\/>|<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g,
    )) {
      const linha: Celula[] = [];
      for (const c of (row[3] ?? "").matchAll(
        /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,
      )) {
        const abertura = c[1];
        const ref = attr(abertura, "r");
        const tipo = attr(abertura, "t");
        const estilo = Number(attr(abertura, "s") ?? 0);
        const corpo = c[2] ?? "";
        const v = corpo.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
        let valor: Celula = null;
        if (tipo === "s" && v !== undefined)
          valor = compartilhadas[Number(v)] ?? "";
        else if (tipo === "inlineStr") valor = textoDeRuns(corpo);
        else if (tipo === "str" || tipo === "e")
          valor = v !== undefined ? decodeXml(v) : null;
        else if (tipo === "b") valor = v === "1";
        else if (v !== undefined && v !== "") {
          const n = Number(v);
          valor = estiloEhData[estilo] ? serialParaIso(n) : n;
        }
        const idx = ref ? colunaIndice(ref) : linha.length;
        linha[idx] = valor;
      }
      const idxLinha =
        Number(attr(row[1] ?? row[2] ?? "", "r") ?? linhas.length + 1) - 1;
      linhas[idxLinha] = Array.from(linha, (x) => x ?? null);
    }
    planilhas.push({ nome, linhas: Array.from(linhas, (x) => x ?? []) });
  }
  return planilhas;
}

/** Serial do Excel (sistema 1900) → "AAAA-MM-DD". */
export function serialParaIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Linhas → objetos usando a primeira linha não vazia como cabeçalho. */
export function comoRegistros(planilha: Planilha): {
  cabecalho: string[];
  registros: Record<string, Celula>[];
} {
  const inicio = planilha.linhas.findIndex((l) =>
    l.some((c) => c !== null && c !== ""),
  );
  if (inicio < 0) return { cabecalho: [], registros: [] };
  const cabecalho = planilha.linhas[inicio].map((c) => String(c ?? "").trim());
  const registros = planilha.linhas
    .slice(inicio + 1)
    .filter((l) => l.some((c) => c !== null && c !== ""))
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, l[i] ?? null])));
  return { cabecalho, registros };
}
