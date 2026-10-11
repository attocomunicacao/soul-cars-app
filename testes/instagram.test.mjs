import { afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
vi.mock("../src/main/caminhos", () => ({}));
import { montarPlanoInstagram } from "../src/main/studio/instagram-plano";
import { janelasLucro } from "../src/main/estoque/relatorio";
import { slugInstagram } from "../src/compartilhado/instagram";
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-instagram-"));
const pasta = path.join(raiz, "veiculo");
fs.mkdirSync(path.join(pasta, "CRIATIVO"), { recursive: true });
const v = {
  id: 1,
  nome: "Jeep Renegade",
  ano: "2020",
  pasta,
  des_md:
    "# ANUNCIO\n## 1. TEXTO PRINCIPAL\nLegenda carrossel\n## 2. TEXTO PRINCIPAL\nLegenda reels",
};
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true }));
describe("plano Instagram", () => {
  it("mantém nome do editor e não repete o ano", () => {
    expect(slugInstagram("JEEP RENEGADE 2020", "2020")).toBe(
      "jeep-renegade-2020",
    );
  });
  it("seleciona 2, 1 e 3, as duas legendas, vídeo editado e capa de Tráfego Pago", () => {
    for (const n of [1, 2, 3])
      fs.writeFileSync(
        path.join(pasta, "CRIATIVO", `jeep-renegade-2020-carrossel-${n}.png`),
        "imagem",
      );
    fs.writeFileSync(
      path.join(pasta, "CRIATIVO", "jeep-renegade-2020-trafego-pago.png"),
      "capa",
    );
    fs.writeFileSync(path.join(pasta, "VIDEO_RENEGADE.mp4"), "editado");
    fs.writeFileSync(path.join(pasta, "bruto.mp4"), "bruto");
    const plano = montarPlanoInstagram(v);
    expect(plano.pendencias).toEqual([]);
    expect(
      plano.arquivos.filter((f) => f.tipo === "carrossel").map((f) => f.nome),
    ).toEqual([2, 1, 3].map((n) => `jeep-renegade-2020-carrossel-${n}.png`));
    expect(plano.carrossel).toBe("Legenda carrossel");
    expect(plano.reels).toBe("Legenda reels");
    expect(plano.arquivos.find((f) => f.tipo === "video")?.nome).toBe(
      "VIDEO_RENEGADE.mp4",
    );
    expect(plano.arquivos.find((f) => f.tipo === "capa")?.nome).toBe(
      "jeep-renegade-2020-trafego-pago.png",
    );
  });
  it("a versão leve em ANUNCIO não cria um segundo vídeo para publicar", () => {
    fs.mkdirSync(path.join(pasta, "ANUNCIO"), { recursive: true });
    fs.writeFileSync(
      path.join(pasta, "ANUNCIO", "ANUNCIO_RENEGADE.mp4"),
      "leve",
    );
    const plano = montarPlanoInstagram(v);
    expect(plano.pendencias).toEqual([]);
    expect(plano.arquivos.filter((f) => f.tipo === "video")).toHaveLength(1);
    expect(plano.arquivos.find((f) => f.tipo === "video")?.nome).toBe(
      "VIDEO_RENEGADE.mp4",
    );
  });
  it("interrompe se a legenda está ausente ou excede o limite", () => {
    expect(montarPlanoInstagram({ ...v, des_md: "" }).pendencias.length).toBe(
      2,
    );
    expect(
      montarPlanoInstagram({
        ...v,
        des_md: `# ANUNCIO\n## 1. TEXTO PRINCIPAL\n${"a".repeat(2201)}`,
      }).pendencias.join(),
    ).toContain("2.200");
  });
});
describe("lucro por mês", () => {
  it("começa nos últimos 12 meses e oferece todo o histórico anterior", () => {
    const janelas = janelasLucro(
      {
        "2024-01": { receita: 100, custo: 40, n: 1 },
        "2026-09": { receita: 200, custo: 120, n: 1 },
      },
      new Date(2026, 9, 9),
    );
    expect(Object.keys(janelas.at(-1))).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(Object.keys(janelas[0])[0]).toBe("2024-01");
    expect(Object.keys(janelas.at(-2))[0]).toBe("2025-10");
    expect(janelas.at(-1)["2026-10"]).toEqual({ receita: 0, custo: 0, n: 0 });
  });
  it("sem vendas mantém 12 meses e somente uma janela", () => {
    const janelas = janelasLucro({}, new Date(2026, 0, 5));
    expect(janelas).toHaveLength(1);
    expect(Object.keys(janelas[0])).toHaveLength(12);
  });
});
