/** Gera .xlsx de teste (ZIP com deflate) no mesmo formato do Excel/Meta Ads. */
import { deflateRawSync } from "node:zlib";

type Valor = string | number | null | { data: string };

function crc32(buf: Uint8Array) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zip(arquivos: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = enc.encode(conteudo);
    const comp = new Uint8Array(deflateRawSync(dados));
    const n = enc.encode(nome);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 8, true);
    local.setUint32(14, crc32(dados), true);
    local.setUint32(18, comp.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, n.length, true);
    partes.push(new Uint8Array(local.buffer), n, comp);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(10, 8, true);
    cd.setUint32(16, crc32(dados), true);
    cd.setUint32(20, comp.length, true);
    cd.setUint32(24, dados.length, true);
    cd.setUint16(28, n.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), n);
    offset += 30 + n.length + comp.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, Object.keys(arquivos).length, true);
  fim.setUint16(10, Object.keys(arquivos).length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  const tudo = new Blob([
    ...partes,
    ...central,
    new Uint8Array(fim.buffer),
  ] as BlobPart[]);
  return tudo.arrayBuffer() as unknown as ArrayBuffer;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const col = (i: number) => String.fromCharCode(65 + i);

/** Datas {data: "2026-08-01"} viram seriais com estilo de data (como o Excel salva). */
export async function gerarXlsx(
  linhas: Valor[][],
  aba = "Raw Data Report",
): Promise<ArrayBuffer> {
  const strings: string[] = [];
  const idx = (s: string) =>
    strings.includes(s) ? strings.indexOf(s) : strings.push(s) - 1;
  const rows = linhas
    .map((l, r) => {
      const cells = l
        .map((v, c) => {
          const ref = `${col(c)}${r + 1}`;
          if (v === null || v === "") return "";
          if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
          if (typeof v === "object") {
            const serial = Date.parse(v.data + "T00:00:00Z") / 86400000 + 25569;
            return `<c r="${ref}" s="1"><v>${serial}</v></c>`;
          }
          return `<c r="${ref}" t="s"><v>${idx(v)}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return zip({
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(aba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0"?><styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    "xl/sharedStrings.xml": `<?xml version="1.0"?><sst>${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`,
  });
}
