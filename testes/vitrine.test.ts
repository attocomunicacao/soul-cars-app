import { describe, expect, it } from "vitest";
import {
  diasDesde,
  montarVitrine,
  type FichaMin,
} from "../src/main/estoque/vitrine-dados";
import type { LinhaVeiculo } from "../src/main/estoque/balanco";

const linha = (extra: Partial<LinhaVeiculo>): LinhaVeiculo => ({
  placa: "",
  marca: "",
  modelo: "",
  entrada: "2026-10-01",
  custo: 0,
  consignado: false,
  tabela: 0,
  id: "0",
  n: "",
  chassi: "",
  status: "DISPONÍVEL ESTOQUE",
  venda: "",
  preco: 0,
  cliente: "",
  dias: null,
  margem: null,
  margemPct: null,
  vendido: false,
  nVendas: 0,
  ...extra,
});
const ficha = (extra: Partial<FichaMin>): FichaMin => ({
  id: 1,
  placa: null,
  pasta: null,
  versao: null,
  ano: null,
  km: null,
  cor: null,
  cambio: null,
  combustivel: null,
  ...extra,
});
const hoje = new Date(2026, 9, 11);

describe("dias em estoque", () => {
  it("conta a partir da data de entrada e nunca fica negativo", () => {
    expect(diasDesde("2026-10-01", hoje)).toBe(10);
    expect(diasDesde("2026-10-11", hoje)).toBe(0);
    expect(diasDesde("2026-10-20", hoje)).toBe(0);
    expect(diasDesde("", hoje)).toBeNull();
  });
});

describe("vitrine do estoque atual", () => {
  const linhas = [
    linha({
      id: "20",
      marca: "Renault",
      modelo: "Duster",
      placa: "AXI5J53",
      tabela: 59900,
    }),
    linha({
      id: "10",
      marca: "Chevrolet",
      modelo: "Corsa Sedan",
      placa: "KHR2I22",
      consignado: true,
    }),
    linha({
      id: "30",
      marca: "Jeep",
      modelo: "Renegade",
      placa: "GAG1H55",
      vendido: true,
    }),
  ];
  const pastas = [
    {
      nome: "10_CHEVROLET_CORSA_SEDAN_KHR2I22",
      caminho: "C:/e/10",
      fotos: ["C:/e/10/FOTOS/1_sem_fundo.png", "C:/e/10/FOTOS/1.jpg"],
    },
    { nome: "20_RENAULT_DUSTER_AXI5J53", caminho: "C:/e/20", fotos: [] },
  ];

  it("só traz o que está em estoque, em ordem de marca e modelo", () => {
    const r = montarVitrine(linhas, pastas, [], () => "data:x", hoje);
    expect(r.map((c) => c.placa)).toEqual(["KHR2I22", "AXI5J53"]);
    expect(r[0].consignado).toBe(true);
    expect(r[1].tabela).toBe(59900);
    expect(r[1].dias).toBe(10);
  });

  it("usa a primeira foto de verdade (ignora o recorte) e aceita carro sem foto", () => {
    const pedidas: string[] = [];
    const r = montarVitrine(
      linhas,
      pastas,
      [],
      (arquivo) => {
        pedidas.push(arquivo);
        return "data:foto";
      },
      hoje,
    );
    expect(pedidas).toEqual(["C:/e/10/FOTOS/1.jpg"]);
    expect(r[0].foto).toBe("data:foto");
    expect(r[1].foto).toBeNull();
  });

  it("pula foto que não abre e usa a próxima", () => {
    const r = montarVitrine(
      linhas,
      [
        {
          ...pastas[0],
          fotos: ["C:/e/10/FOTOS/1.heic", "C:/e/10/FOTOS/2.jpg"],
        },
      ],
      [],
      (arquivo) => (arquivo.endsWith(".heic") ? null : "data:ok"),
      hoje,
    );
    expect(r.find((c) => c.placa === "KHR2I22")?.foto).toBe("data:ok");
  });

  it("liga a ficha do Studio pela pasta ou pela placa e deixa o resto vazio", () => {
    const fichas = [
      ficha({
        id: 7,
        pasta: "C:/e/10",
        versao: " MAXX 1.0 ",
        km: "82000",
        cor: "Bege",
        ano: 2006,
      }),
      ficha({ id: 8, placa: "axi5j53", combustivel: "Flex" }),
    ];
    const r = montarVitrine(linhas, pastas, fichas, () => null, hoje);
    expect(r[0].estudio).toEqual({
      id: 7,
      versao: "MAXX 1.0",
      ano: "2006",
      km: 82000,
      cor: "Bege",
      cambio: null,
      combustivel: null,
    });
    expect(r[1].estudio?.id).toBe(8);
    expect(r[1].estudio?.combustivel).toBe("Flex");
    expect(r[1].estudio?.km).toBeNull();
    expect(
      montarVitrine(linhas, pastas, [], () => null, hoje)[0].estudio,
    ).toBeNull();
  });

  it("acha a pasta pela placa se o id não bater", () => {
    const r = montarVitrine(
      [linha({ id: "999", marca: "Fiat", modelo: "Argo", placa: "RNO1I20" })],
      [{ nome: "01_FIAT_ARGO_RNO1I20", caminho: "C:/e/01", fotos: [] }],
      [],
      () => null,
      hoje,
    );
    expect(r[0].pasta).toBe("C:/e/01");
  });
});
