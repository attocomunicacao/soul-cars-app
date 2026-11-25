/** Testes da busca da pasta do Google Drive para Desktop, com um disco fictício. */
import { describe, expect, it } from "vitest";
import { localizarPastaDrive, type DiscoDrive } from "../src/main/drive/locate";

const ID = "1fJXdtLPrPwwWPh_ETgat-2xBGWQ1I8yW";

/** Disco fictício: mapa de pasta → subpastas. */
function disco(
  arvore: Record<string, string[]>,
  home = "C:\\Users\\loja",
): DiscoDrive {
  return {
    unidades: () => [...new Set(Object.keys(arvore).map((p) => p[0]!))],
    subpastas: (p) => arvore[p] ?? [],
    home: () => home,
  };
}

describe("localizarPastaDrive", () => {
  it("avisa quando o Drive para Desktop não está instalado", () => {
    expect(localizarPastaDrive(ID, disco({ "C:\\": ["Windows"] }))).toEqual({
      situacao: "drive-nao-encontrado",
    });
  });

  it("acha a pasta compartilhada pelo ID", () => {
    const d = disco({
      "G:\\": ["Meu Drive", ".shortcut-targets-by-id"],
      [`G:\\.shortcut-targets-by-id\\${ID}`]: ["ESTOQUE"],
    });
    expect(localizarPastaDrive(ID, d)).toEqual({
      situacao: "encontrada",
      caminho: `G:\\.shortcut-targets-by-id\\${ID}\\ESTOQUE`,
    });
  });

  it("orienta a adicionar o atalho quando o Drive existe mas a pasta não foi adicionada", () => {
    const d = disco({ "G:\\": ["Meu Drive", ".shortcut-targets-by-id"] });
    expect(localizarPastaDrive(ID, d).situacao).toBe("pasta-nao-adicionada");
  });

  it("devolve candidatos quando há mais de uma pasta e nenhuma se chama ESTOQUE", () => {
    const d = disco({
      "G:\\": [".shortcut-targets-by-id"],
      [`G:\\.shortcut-targets-by-id\\${ID}`]: ["A", "B"],
    });
    const r = localizarPastaDrive(ID, d);
    expect(r.situacao).toBe("ambigua");
  });

  it("acha a pasta ESTOQUE direto no Meu Drive (mesma conta do dono)", () => {
    const d = disco({
      "G:\\": ["My Drive"],
      "G:\\My Drive": ["ESTOQUE"],
    });
    expect(localizarPastaDrive(ID, d)).toEqual({
      situacao: "encontrada",
      caminho: "G:\\My Drive\\ESTOQUE",
    });
  });
});
