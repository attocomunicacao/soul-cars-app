import { describe, expect, it } from "vitest";
import {
  diasDesde,
  montarVitrine,
  ordemDeFotos,
  type FichaMin,
} from "../src/main/estoque/vitrine-dados";
import type { LinhaVeiculo } from "../src/main/estoque/balanco";
import { ordenarPorEntrada } from "../src/main/estoque/ordem";

const linha = (extra: Partial<LinhaVeiculo>): LinhaVeiculo => ({
  registroEm: "2026-10-01T10:00:00",
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
  km: "",
  anoModelo: "",
  anoFab: "",
  cor: "",
  cambio: "",
  combustivel: "",
  versao: "",
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

  it("a foto do cartão é a imagem 2 do Studio (ignora o recorte) e aceita carro sem foto", () => {
    const pedidas: string[] = [];
    const doisFotos = [
      {
        ...pastas[0],
        fotos: [
          "C:/e/10/FOTOS/1.jpg",
          "C:/e/10/FOTOS/1_sem_fundo.png",
          "C:/e/10/FOTOS/2.jpg",
          "C:/e/10/FOTOS/3.jpg",
        ],
      },
      pastas[1],
    ];
    const r = montarVitrine(
      linhas,
      doisFotos,
      [],
      (arquivo) => {
        pedidas.push(arquivo);
        return "data:foto";
      },
      hoje,
    );
    expect(pedidas).toEqual(["C:/e/10/FOTOS/2.jpg"]);
    expect(r[0].foto).toBe("data:foto");
    expect(r[1].foto).toBeNull();
  });

  it("com uma foto só, usa ela", () => {
    expect(ordemDeFotos(["C:/f/1.jpg"])).toEqual(["C:/f/1.jpg"]);
    expect(ordemDeFotos([])).toEqual([]);
    expect(ordemDeFotos(["C:/f/1.jpg", "C:/f/2.jpg", "C:/f/3.jpg"])).toEqual([
      "C:/f/2.jpg",
      "C:/f/3.jpg",
      "C:/f/1.jpg",
    ]);
  });

  it("pula foto que não abre e usa a próxima", () => {
    const r = montarVitrine(
      linhas,
      [
        {
          ...pastas[0],
          fotos: ["C:/e/10/FOTOS/1.jpg", "C:/e/10/FOTOS/2.heic"],
        },
      ],
      [],
      (arquivo) => (arquivo.endsWith(".heic") ? null : "data:" + arquivo),
      hoje,
    );
    expect(r.find((c) => c.placa === "KHR2I22")?.foto).toBe(
      "data:C:/e/10/FOTOS/1.jpg",
    );
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
    expect(r[0].estudio).toEqual({ id: 7 });
    expect(r[0].detalhes).toEqual({
      versao: "MAXX 1.0",
      ano: "2006",
      km: 82000,
      cor: "Bege",
      cambio: null,
      combustivel: null,
    });
    expect(r[1].estudio?.id).toBe(8);
    expect(r[1].detalhes.combustivel).toBe("Flex");
    expect(r[1].detalhes.km).toBeNull();
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

  it("usa os dados do BNDV quando a ficha do Studio não tem (e a ficha tem prioridade quando tem)", () => {
    const doBndv = linha({
      id: "40",
      marca: "Fiat",
      modelo: "Argo",
      placa: "RNO1I20",
      km: "35000",
      cor: "Prata",
      cambio: "Manual",
      combustivel: "Flex",
      anoFab: "2021",
      anoModelo: "2022",
      versao: "ARGO 1.0 6V FLEX.",
    });
    const sem = montarVitrine([doBndv], [], [], () => null, hoje)[0];
    expect(sem.detalhes).toEqual({
      km: 35000,
      cor: "Prata",
      cambio: "Manual",
      combustivel: "Flex",
      ano: "2021/2022",
      versao: "ARGO 1.0 6V FLEX.",
    });
    expect(sem.estudio).toBeNull();
    const com = montarVitrine(
      [doBndv],
      [],
      [ficha({ id: 9, placa: "RNO1I20", cor: "Cinza", km: 41000 })],
      () => null,
      hoje,
    )[0];
    expect(com.detalhes.cor).toBe("Cinza");
    expect(com.detalhes.km).toBe(41000);
    expect(com.detalhes.cambio).toBe("Manual");
  });

  it("ano igual do BNDV vira um só", () => {
    const l = linha({
      id: "50",
      placa: "AAA1A11",
      anoFab: "2020",
      anoModelo: "2020",
    });
    expect(montarVitrine([l], [], [], () => null, hoje)[0].detalhes.ano).toBe(
      "2020",
    );
  });
});

describe("ordem do balanço por veículo", () => {
  it("do mais recente ao mais antigo, com hora e ID para desempatar o mesmo dia", () => {
    const l = (id: string, registroEm: string) =>
      linha({ id, placa: "P" + id, registroEm });
    const r = ordenarPorEntrada([
      l("1", "2026-10-08T13:43:13"),
      l("2", "2026-09-30T09:00:00"),
      l("3", "2026-10-08T15:45:46"),
      l("4", "2026-10-08T15:45:46"),
      l("5", ""),
    ]);
    expect(r.map((x) => x.id)).toEqual(["4", "3", "1", "2", "5"]);
  });
});
