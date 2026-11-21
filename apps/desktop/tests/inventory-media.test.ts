/**
 * Testes (Vitest) da detecção de fotos/vídeo/documento nas pastas do ESTOQUE, tolerante às
 * variações de nome de pasta e arquivo (src/main/studio/files.ts).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listarEstoque,
  pastaFotos,
  statusProducao,
} from "../src/main/studio/files";

const DES = "## ANO\n2017\n";

describe("mídia nas pastas", () => {
  let raiz: string;
  const criar = (rel: string, conteudo = "x") => {
    const alvo = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, conteudo);
  };
  beforeEach(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), "estoque-"));
  });
  afterEach(() => fs.rmSync(raiz, { recursive: true, force: true }));

  it("padrão do estoque: FOTOS, VIDEO, DOC.pdf e DES.md", () => {
    criar("1_JEEP_RENEGADE_PZZ8E03/FOTOS/2.jpeg");
    criar("1_JEEP_RENEGADE_PZZ8E03/FOTOS/1.jpeg");
    criar("1_JEEP_RENEGADE_PZZ8E03/FOTOS/1_sem_fundo.png");
    criar("1_JEEP_RENEGADE_PZZ8E03/VIDEO/IMG_4080.MOV");
    criar("1_JEEP_RENEGADE_PZZ8E03/DOC.pdf");
    criar("1_JEEP_RENEGADE_PZZ8E03/DES.md", DES);
    const s = statusProducao(path.join(raiz, "1_JEEP_RENEGADE_PZZ8E03"));
    expect([...s.fotos].sort()).toEqual([
      "1.jpeg",
      "1_sem_fundo.png",
      "2.jpeg",
    ]);
    expect(s.video_bruto).toMatch(/IMG_4080\.MOV$/);
    expect(s.doc_pdf).toBe(true);
    expect(s.des_md).toBe(true);
  });

  it("variações: Foto, Vídeos, Documento/, des.md e extensões maiúsculas", () => {
    const p = "2_FIAT_STRADA_QAZ2G19";
    criar(`${p}/Foto/1.JPG`);
    criar(`${p}/Vídeos/clip.mp4`);
    criar(`${p}/Documento/crlv.PDF`);
    criar(`${p}/des.md`, DES);
    criar(`${p}/doc.MD`, "doc");
    const pasta = path.join(raiz, p);
    expect(path.basename(pastaFotos(pasta))).toBe("Foto");
    const s = statusProducao(pasta);
    expect(s.fotos).toEqual(["1.JPG"]);
    expect(s.video_bruto).toMatch(/clip\.mp4$/);
    expect(s.doc_pdf).toBe(true);
    expect(s.des_md).toBe(true);
    expect(s.doc_md).toBe(true);
  });

  it("vídeo final VIDEO_*.mp4 na raiz conta como vídeo", () => {
    criar("3_NISSAN_KICKS_FJB3F56/VIDEO_NISSAN.mp4");
    const s = statusProducao(path.join(raiz, "3_NISSAN_KICKS_FJB3F56"));
    expect(s.video_final).toMatch(/VIDEO_NISSAN\.mp4$/);
  });

  it("pasta só com subpastas vazias: sem fotos, vídeo nem documento", () => {
    fs.mkdirSync(path.join(raiz, "4_VW_SAVEIRO_SDY2C97/FOTOS"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(raiz, "4_VW_SAVEIRO_SDY2C97/VIDEO"));
    criar("4_VW_SAVEIRO_SDY2C97/INFO.md", "| **Placa** | SDY2C97 |");
    const s = statusProducao(path.join(raiz, "4_VW_SAVEIRO_SDY2C97"));
    expect(s.fotos).toEqual([]);
    expect(s.video_bruto).toBeNull();
    expect(s.doc_pdf).toBe(false);
  });

  it("listarEstoque acha DES.md, PDF em subpasta e fotos (vitrine)", () => {
    criar("5_KIA_SORENTO_PFU1B45/Fotos/1.jpeg");
    criar("5_KIA_SORENTO_PFU1B45/DOCUMENTOS/DOC.pdf");
    criar("5_KIA_SORENTO_PFU1B45/DES.MD", DES);
    fs.mkdirSync(path.join(raiz, "vazia"));
    const lista = listarEstoque(raiz);
    expect(lista).toHaveLength(1);
    expect(lista[0].des_md).toMatch(/DES\.MD$/);
    expect(lista[0].pdf).toMatch(/DOC\.pdf$/);
    expect(lista[0].fotos).toHaveLength(1);
  });
});
