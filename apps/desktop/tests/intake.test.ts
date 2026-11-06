/**
 * Testes (Vitest) de src/shared/intake-rules.ts e src/main/studio/intake.ts (entrada por pasta sincronizada).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/main/core/paths", () => ({}));

import {
  classificar,
  ehTemporario,
  extrairPlacas,
  nomeComSufixo,
  placaDaPasta,
} from "../src/shared/intake-rules";
import { criarEntrada } from "../src/main/studio/intake";
import { MIGRACOES } from "../src/main/studio/schema";

describe("placa e classificação", () => {
  it("acha placas antigas e Mercosul, com hífen e sem acento", () => {
    expect(extrairPlacas("TORO - ABC1D23")).toEqual(["ABC1D23"]);
    expect(extrairPlacas("[ENTRADA] FIAT TORO - abc1d23")).toEqual(["ABC1D23"]);
    expect(extrairPlacas("Palio abc-1234")).toEqual(["ABC1234"]);
    expect(extrairPlacas("Palio ABC1234")).toEqual(["ABC1234"]);
  });
  it("não confunde ano nem texto com placa", () => {
    expect(extrairPlacas("SUV 2020")).toEqual([]);
    expect(extrairPlacas("TORO")).toEqual([]);
    expect(extrairPlacas("ABC1D234")).toEqual([]);
  });
  it("usa o último trecho como placa da pasta do estoque", () => {
    expect(placaDaPasta("1555244_CHEVROLET_CORSA_SEDAN_KHR2I22")).toBe(
      "KHR2I22",
    );
    expect(placaDaPasta("sem placa")).toBeNull();
  });
  it("classifica por extensão", () => {
    expect(classificar("a.JPG")).toBe("foto");
    expect(classificar("a.heic")).toBe("foto-heic");
    expect(classificar("a.MOV")).toBe("video");
    expect(classificar("a.mp4")).toBe("video");
    expect(classificar("crlv.pdf")).toBe("documento");
    expect(classificar("a.zip")).toBe("outro");
    expect(classificar("semextensao")).toBe("outro");
  });
  it("ignora temporários da nuvem e do Office", () => {
    for (const n of [
      ".tmp",
      "a.crdownload",
      "~$doc.docx",
      "desktop.ini",
      "Thumbs.db",
      ".hidden",
      "b.jpg.partial",
    ])
      expect(ehTemporario(n)).toBe(true);
    expect(ehTemporario("foto.jpg")).toBe(false);
  });
  it("sufixo previsível", () => {
    expect(nomeComSufixo("IMG.jpg", 2)).toBe("IMG_2.jpg");
    expect(nomeComSufixo("semext", 3)).toBe("semext_3");
  });
});

describe("entrada por pasta sincronizada", () => {
  let raiz: string, estoque: string, nuvem: string;
  let db: DatabaseSync;
  let agora: number;
  let videoOcupado = false;
  let eventos: string[];

  const mover = (p: string) => path.join(raiz, p);
  const escrever = (caminho: string, conteudo: string | Buffer) => {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, conteudo);
    const antigo = new Date(Date.now() - 3600_000);
    fs.utimesSync(caminho, antigo, antigo);
  };
  const veiculo = (nome: string) => {
    const p = path.join(estoque, nome);
    for (const sub of ["CRIATIVO", "FOTOS", "VIDEO"])
      fs.mkdirSync(path.join(p, sub), { recursive: true });
    return p;
  };
  const novo = () =>
    criarEntrada({
      selecionar: (sql, v = []) =>
        db
          .prepare(sql)
          .all(...(v as any[]))
          .map((l) => ({ ...l })),
      executar: (sql, v = []) => db.prepare(sql).run(...(v as any[])),
      emitir: (n) => eventos.push(n),
      estoque: () => estoque,
      agora: () => agora,
      videoOcupado: () => videoOcupado,
    });
  /** Dois ciclos: o primeiro observa, o segundo (10 s depois) copia o que ficou estável. */
  const ciclos = async (e: ReturnType<typeof novo>, n = 2) => {
    for (let i = 0; i < n; i++) {
      await e.verificar();
      agora += 10_000;
    }
  };
  const linhas = (sql: string) =>
    db
      .prepare(sql)
      .all()
      .map((l) => ({ ...l })) as Record<string, any>[];

  beforeEach(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-entrada-"));
    estoque = mover("ESTOQUE");
    nuvem = mover("nuvem");
    fs.mkdirSync(estoque);
    fs.mkdirSync(nuvem);
    agora = Date.now();
    videoOcupado = false;
    eventos = [];
    db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT)");
    for (const c of MIGRACOES.find((m) => m.versao === 6)!.sql.split(";"))
      if (c.trim()) db.exec(c);
    db.prepare("INSERT INTO config VALUES ('entrada_pasta', ?)").run(nuvem);
  });
  afterEach(() => {
    db.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  });

  it("copia fotos, vídeo e documento para a pasta certa, sem tocar na origem", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    veiculo("2_FORD_KA_DEF2G34");
    escrever(path.join(nuvem, "TORO - ABC1D23", "IMG_1.jpg"), "foto1");
    escrever(path.join(nuvem, "TORO - ABC1D23", "IMG_2.PNG"), "foto2");
    escrever(path.join(nuvem, "TORO - ABC1D23", "video.mov"), "video-bruto");
    escrever(path.join(nuvem, "TORO - ABC1D23", "crlv.pdf"), "%PDF-doc");
    const e = novo();
    await ciclos(e);
    expect(fs.readFileSync(path.join(toro, "FOTOS", "IMG_1.jpg"), "utf8")).toBe(
      "foto1",
    );
    expect(fs.existsSync(path.join(toro, "FOTOS", "IMG_2.PNG"))).toBe(true);
    expect(fs.readFileSync(path.join(toro, "VIDEO", "video.mov"), "utf8")).toBe(
      "video-bruto",
    );
    expect(fs.readFileSync(path.join(toro, "DOC.pdf"), "utf8")).toBe(
      "%PDF-doc",
    );
    // origem intacta
    expect(fs.existsSync(path.join(nuvem, "TORO - ABC1D23", "video.mov"))).toBe(
      true,
    );
    expect(
      linhas("SELECT * FROM entrada_arquivos WHERE situacao='copiado'"),
    ).toHaveLength(4);
    expect(
      fs
        .readdirSync(path.join(toro, "FOTOS"))
        .some((n) => n.endsWith(".parcial")),
    ).toBe(false);
  });

  it("é idempotente: rodar de novo não duplica nada", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "aaa");
    const e = novo();
    await ciclos(e);
    const antes = fs.readdirSync(path.join(toro, "FOTOS"));
    await ciclos(e, 3);
    expect(fs.readdirSync(path.join(toro, "FOTOS"))).toEqual(antes);
    expect(linhas("SELECT * FROM entrada_arquivos")).toHaveLength(1);
    // um app reiniciado (memória zerada) também não duplica
    await ciclos(novo(), 2);
    expect(fs.readdirSync(path.join(toro, "FOTOS"))).toEqual(antes);
  });

  it("nunca sobrescreve: nome igual com conteúdo diferente ganha sufixo", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(toro, "FOTOS", "a.jpg"), "meu-original");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "da-nuvem-maior");
    await ciclos(novo());
    expect(fs.readFileSync(path.join(toro, "FOTOS", "a.jpg"), "utf8")).toBe(
      "meu-original",
    );
    expect(fs.readFileSync(path.join(toro, "FOTOS", "a_2.jpg"), "utf8")).toBe(
      "da-nuvem-maior",
    );
  });

  it("não copia de novo quando o destino já tem arquivo idêntico", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(toro, "FOTOS", "a.jpg"), "igual");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "igual");
    await ciclos(novo());
    expect(fs.readdirSync(path.join(toro, "FOTOS"))).toEqual(["a.jpg"]);
    expect(linhas("SELECT * FROM entrada_arquivos")[0].situacao).toBe(
      "copiado",
    );
  });

  it("placa sem veículo ou ambígua vira pendência e nada é copiado", async () => {
    const a = veiculo("1_FIAT_TORO_ABC1D23");
    const b = veiculo("9_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "x");
    escrever(path.join(nuvem, "GOL - ZZZ9Z99", "b.jpg"), "y");
    escrever(path.join(nuvem, "SEM PLACA", "c.jpg"), "z");
    await ciclos(novo());
    expect(fs.readdirSync(path.join(a, "FOTOS"))).toEqual([]);
    expect(fs.readdirSync(path.join(b, "FOTOS"))).toEqual([]);
    const pend = linhas(
      "SELECT origem, detalhe FROM entrada_arquivos WHERE situacao='pendente' ORDER BY origem",
    );
    expect(pend).toHaveLength(3);
    expect(pend.map((p) => p.detalhe).join("\n")).toMatch(/Mais de um veículo/);
    expect(pend.map((p) => p.detalhe).join("\n")).toMatch(
      /Nenhum veículo do estoque/,
    );
    expect(pend.map((p) => p.detalhe).join("\n")).toMatch(
      /Não encontrei uma placa/,
    );
  });

  it("a pendência some e o arquivo é copiado quando o veículo passa a existir", async () => {
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "x");
    const e = novo();
    await ciclos(e);
    expect(
      linhas("SELECT * FROM entrada_arquivos WHERE situacao='pendente'"),
    ).toHaveLength(1);
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    await ciclos(e);
    expect(fs.existsSync(path.join(toro, "FOTOS", "a.jpg"))).toBe(true);
    expect(
      linhas("SELECT * FROM entrada_arquivos WHERE situacao='pendente'"),
    ).toHaveLength(0);
  });

  it("não cria um segundo vídeo bruto nem sobrescreve o PDF", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(toro, "VIDEO", "bruto.mov"), "ja-tenho");
    escrever(path.join(toro, "doc.pdf"), "pdf-antigo");
    escrever(path.join(nuvem, "TORO - ABC1D23", "novo.mov"), "novo");
    escrever(path.join(nuvem, "TORO - ABC1D23", "crlv.pdf"), "pdf-novo");
    await ciclos(novo());
    expect(fs.readdirSync(path.join(toro, "VIDEO"))).toEqual(["bruto.mov"]);
    expect(fs.readFileSync(path.join(toro, "doc.pdf"), "utf8")).toBe(
      "pdf-antigo",
    );
    const pend = linhas(
      "SELECT detalhe FROM entrada_arquivos WHERE situacao='pendente'",
    );
    expect(pend).toHaveLength(2);
  });

  it("vídeo editado VIDEO_* não impede o vídeo bruto", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(toro, "VIDEO_TORO.mp4"), "editado");
    escrever(path.join(nuvem, "TORO - ABC1D23", "bruto.mov"), "bruto");
    await ciclos(novo());
    expect(fs.existsSync(path.join(toro, "VIDEO", "bruto.mov"))).toBe(true);
  });

  it("mais de um PDF na entrada vira pendência", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.pdf"), "1");
    escrever(path.join(nuvem, "TORO - ABC1D23", "b.pdf"), "2");
    await ciclos(novo());
    expect(fs.existsSync(path.join(toro, "DOC.pdf"))).toBe(false);
    expect(
      linhas("SELECT * FROM entrada_arquivos WHERE situacao='pendente'"),
    ).toHaveLength(2);
  });

  it("HEIC é copiado com aviso", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "IMG.heic"), "h");
    const e = novo();
    await ciclos(e);
    expect(fs.existsSync(path.join(toro, "FOTOS", "IMG.heic"))).toBe(true);
    expect(e.obterEstado().avisos).toHaveLength(1);
  });

  it("espera o arquivo parar de mudar e ignora temporários", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    const f = path.join(nuvem, "TORO - ABC1D23", "a.jpg");
    escrever(f, "123");
    escrever(path.join(nuvem, "TORO - ABC1D23", "b.jpg.crdownload"), "tmp");
    escrever(path.join(nuvem, "TORO - ABC1D23", "~$x.jpg"), "tmp");
    const e = novo();
    await e.verificar();
    agora += 10_000;
    escrever(f, "123456789"); // cresceu entre as observações
    await e.verificar();
    expect(fs.readdirSync(path.join(toro, "FOTOS"))).toEqual([]);
    agora += 10_000;
    await e.verificar();
    expect(fs.readFileSync(path.join(toro, "FOTOS", "a.jpg"), "utf8")).toBe(
      "123456789",
    );
    expect(fs.readdirSync(path.join(toro, "FOTOS"))).toHaveLength(1);
  });

  it("pausado não copia nada", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "x");
    const e = novo();
    e.pausar(true);
    await ciclos(e);
    expect(fs.readdirSync(path.join(toro, "FOTOS"))).toEqual([]);
  });

  it("espera um vídeo em geração terminar antes de copiar", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "x");
    const e = novo();
    await ciclos(e); // copia normalmente
    expect(fs.existsSync(path.join(toro, "FOTOS", "a.jpg"))).toBe(true);

    escrever(path.join(nuvem, "TORO - ABC1D23", "b.jpg"), "y");
    await ciclos(e, 1); // observa b.jpg
    videoOcupado = true;
    await ciclos(e, 3);
    expect(fs.existsSync(path.join(toro, "FOTOS", "b.jpg"))).toBe(false);
    expect(e.obterEstado().estado.aguardandoVideo).toBe(true);
    expect(e.copiandoAgora()).toBe(false);

    videoOcupado = false;
    await ciclos(e);
    expect(fs.existsSync(path.join(toro, "FOTOS", "b.jpg"))).toBe(true);
    expect(e.obterEstado().estado.aguardandoVideo).toBe(false);
  });

  it("sem pasta configurada ou inexistente mostra erro", async () => {
    const e = novo();
    db.prepare("DELETE FROM config").run();
    await e.verificar();
    expect(e.obterEstado().estado.erro).toMatch(/Escolha a pasta/);
    db.prepare("INSERT INTO config VALUES ('entrada_pasta', ?)").run(
      path.join(raiz, "nao-existe"),
    );
    await e.verificar();
    expect(e.obterEstado().estado.erro).toMatch(/não foi encontrada/);
  });

  it("liberar espaço só envia para a Lixeira o que foi conferido", async () => {
    const toro = veiculo("1_FIAT_TORO_ABC1D23");
    escrever(path.join(nuvem, "TORO - ABC1D23", "a.jpg"), "aaa");
    escrever(path.join(nuvem, "TORO - ABC1D23", "b.jpg"), "bbb");
    const e = novo();
    await ciclos(e);
    expect(e.obterEstado().liberaveis).toEqual([
      expect.objectContaining({ pasta: "TORO - ABC1D23", arquivos: 2 }),
    ]);
    // adultera a cópia de b.jpg: mesmo tamanho, outro conteúdo
    fs.writeFileSync(path.join(toro, "FOTOS", "b.jpg"), "XXX");
    const enviados: string[] = [];
    const r = await e.liberar(["TORO - ABC1D23"], async (c) => {
      enviados.push(path.basename(c));
    });
    expect(enviados).toEqual(["a.jpg"]);
    expect(r.liberados).toBe(1);
    expect(r.ignorados).toHaveLength(1);
    expect(r.ignorados[0].motivo).toMatch(/não confere/);
    // nunca apaga por conta própria: a função de lixeira é quem remove
    expect(fs.existsSync(path.join(nuvem, "TORO - ABC1D23", "a.jpg"))).toBe(
      true,
    );
  });

  it("liberar rejeita nome de pasta com caminho", async () => {
    const e = novo();
    await expect(e.liberar(["..\\fora"], async () => {})).rejects.toThrow(
      /inválida/,
    );
  });
});
