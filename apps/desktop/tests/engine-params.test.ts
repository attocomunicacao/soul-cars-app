/**
 * Testes (Vitest) da validação por método do `engine_call` e do `video_gerar` (src/main/ipc/schemas.ts).
 * Antes, `params` era um objeto livre: `origem`, `destino`, `pasta`… chegavam ao Python sem checar a pasta,
 * e `video_gerar.python` aceitava qualquer executável. Aqui cada método tem a sua forma.
 */
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { criarEsquemas } from "../src/main/ipc/schemas";
import { validarChamada } from "../src/main/ipc/validation";

const raiz = path.join(os.tmpdir(), "soul-motor", "dados");
const interno = path.join(os.tmpdir(), "soul-motor", "interno");
const esquemas = criarEsquemas({
  raizes: () => [raiz, interno],
  raizesAbrir: () => [raiz, interno],
});
const chamar = (comando: string, args: unknown = {}) =>
  validarChamada(comando, esquemas[comando], args, {}, null);
const motor = (method: string, params?: unknown) =>
  chamar("engine_call", { method, params });

const dentro = path.join(raiz, "ESTOQUE", "1_FORD_FIESTA", "CRLV.pdf");
const pastaDentro = path.join(raiz, "ESTOQUE", "1_FORD_FIESTA");
const fora = path.join(os.tmpdir(), "outro-lugar", "segredo.pdf");

describe("engine_call: caminhos só dentro das raízes do app", () => {
  it("ler_crlv e gerar_doc_md aceitam origem dentro e recusam fora", () => {
    for (const metodo of ["ler_crlv", "gerar_doc_md"]) {
      expect(motor(metodo, { origem: dentro }).args.params, metodo).toEqual({
        origem: dentro,
      });
      expect(() => motor(metodo, { origem: fora }), metodo).toThrow(/fora/);
    }
  });

  it("remover_fundo recusa origem e destino fora das raízes", () => {
    expect(
      motor("remover_fundo", { origem: dentro, destino: dentro + ".png" }).args
        .params,
    ).toEqual({ origem: dentro, destino: dentro + ".png" });
    expect(() => motor("remover_fundo", { origem: fora })).toThrow(/fora/);
    expect(() =>
      motor("remover_fundo", { origem: dentro, destino: fora }),
    ).toThrow(/fora/);
  });

  it("remover_fundo só aceita nome de modelo simples", () => {
    expect(
      motor("remover_fundo", {
        origem: dentro,
        modelo: "birefnet-general-lite",
      }).args.params,
    ).toMatchObject({ modelo: "birefnet-general-lite" });
    for (const ruim of ["../../modelo", "a b", "x;rm", ""])
      expect(
        () => motor("remover_fundo", { origem: dentro, modelo: ruim }),
        ruim,
      ).toThrow();
  });

  it("fotos_organizar exige uma pasta dentro das raízes", () => {
    expect(
      motor("fotos_organizar", { pasta: pastaDentro }).args.params,
    ).toEqual({ pasta: pastaDentro });
    expect(() =>
      motor("fotos_organizar", { pasta: path.dirname(fora) }),
    ).toThrow(/fora/);
    expect(() => motor("fotos_organizar", {})).toThrow();
  });
});

describe("engine_call: forma dos demais parâmetros", () => {
  it("descarta parâmetros que o método não declara", () => {
    expect(motor("ping", { extra: 1, outro: "x" }).args.params).toEqual({});
    expect(
      motor("cnw_texto", { texto: "ficha", origem: fora }).args.params,
    ).toEqual({ texto: "ficha" });
  });

  it("params pode faltar nos métodos sem parâmetros", () => {
    expect(motor("ping").args.params).toEqual({});
    expect(motor("aquecer_recorte").args.params).toEqual({});
  });

  it("buscas na web pedem nome e aceitam ano como texto ou número", () => {
    for (const metodo of ["cnw_buscar", "ficha_web_buscar"]) {
      expect(
        motor(metodo, { nome: "FIAT ARGO", ano: "2022" }).args.params,
      ).toEqual({
        nome: "FIAT ARGO",
        ano: "2022",
      });
      expect(
        motor(metodo, { nome: "FIAT ARGO", ano: 2022 }).args.params,
      ).toMatchObject({
        ano: 2022,
      });
      expect(
        motor(metodo, { nome: "FIAT ARGO", ano: null }).args.params,
      ).toEqual({
        nome: "FIAT ARGO",
      });
      expect(() => motor(metodo, {}), metodo).toThrow();
      expect(() => motor(metodo, { nome: 7 }), metodo).toThrow();
    }
  });

  it("fichas pedem o código e limitam o tamanho do texto", () => {
    expect(
      motor("cnw_ficha", { codigo: "123", referer: "https://x.com/" }).args
        .params,
    ).toEqual({ codigo: "123", referer: "https://x.com/" });
    expect(() => motor("ficha_web_ficha", {})).toThrow();
    expect(() => motor("cnw_texto", { texto: "x".repeat(300_000) })).toThrow();
  });

  it("ocr_equipamentos só aceita os modos conhecidos", () => {
    expect(
      motor("ocr_equipamentos", { arquivo: "QUJD", modo: "seguranca" }).args
        .params,
    ).toEqual({ arquivo: "QUJD", modo: "seguranca" });
    expect(() =>
      motor("ocr_equipamentos", { arquivo: "QUJD", modo: "tudo" }),
    ).toThrow();
  });

  it("a senha do CRLV é texto curto", () => {
    expect(
      motor("ler_crlv", { origem: dentro, senha: "123" }).args.params,
    ).toMatchObject({
      senha: "123",
    });
    expect(() =>
      motor("ler_crlv", { origem: dentro, senha: "x".repeat(500) }),
    ).toThrow();
  });
});

describe("métodos internos e executável do vídeo", () => {
  it("soulia_planilha não é chamável pela interface", () => {
    expect(() => motor("soulia_planilha", { caminho: dentro })).toThrow(
      /method/,
    );
  });

  it("método desconhecido continua recusado", () => {
    expect(() => motor("rm_rf", {})).toThrow(/method/);
  });

  it("video_gerar descarta o python informado pela interface", () => {
    const r = chamar("video_gerar", {
      pasta: pastaDentro,
      veiculo: "FIAT ARGO",
      motor: "1.0",
      preco: "50.000",
      python: "C:\\Windows\\System32\\cmd.exe",
    });
    expect(r.args).toEqual({
      pasta: pastaDentro,
      veiculo: "FIAT ARGO",
      motor: "1.0",
      preco: "50.000",
    });
  });
});
