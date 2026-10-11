import { describe, expect, it } from "vitest";
import { comoRegistros, lerXlsx } from "../src/renderer/src/lib/xlsx";
import {
  formatarDataVeiculos,
  gerarRelatorio,
  limparNomeVeiculo,
  statusCusto,
} from "../src/renderer/src/lib/relatorios";
import { gerarXlsx } from "./helpers/xlsx-fixture";

const d = (data: string) => ({ data });
const CONV = "Conversas por mensagem iniciadas";
const LPV = "Visualizações da página de destino";

async function planilha(linhas: Parameters<typeof gerarXlsx>[0]) {
  const [aba] = await lerXlsx(await gerarXlsx(linhas));
  return comoRegistros(aba);
}

describe("relatório diário de veículos", () => {
  it("regras de formatação", () => {
    expect(limparNomeVeiculo("[VENDA] FIAT CRONOS 2024 [R$ 74.900]")).toBe(
      "FIAT CRONOS 2024",
    );
    expect(limparNomeVeiculo("[LEAD] MERCEDES BENZ 2016")).toBe(
      "MERCEDES BENZ 2016",
    );
    expect(formatarDataVeiculos("2026-08-01", "2026-08-21")).toBe(
      "01 a 21/08/2026",
    );
    expect(formatarDataVeiculos("2026-08-01", "2026-09-05")).toBe(
      "01/08 a 05/09/2026",
    );
    expect(statusCusto(5)).toBe("🟢 Status: Custo baixo");
    expect(statusCusto(5.01)).toBe("🟡 Status: Custo moderado");
    expect(statusCusto(8.01)).toBe("🔴 Status: Custo alto");
    expect(statusCusto(null)).toBe("⚪ Status: Sem resultados ainda");
  });

  it("Formato A (uma linha por veículo) com linha de total", async () => {
    const H = [
      "Nome da campanha",
      "Valor gasto (BRL)",
      "Tipo de resultado",
      "Resultados",
      "Alcance",
      "Impressões",
      "Custo por resultado",
      "Início dos relatórios",
      "Encerramento dos relatórios",
    ];
    const { cabecalho, registros } = await planilha([
      H,
      [
        "",
        1567.95,
        CONV,
        250,
        29634,
        81234,
        6.27,
        d("2026-08-01"),
        d("2026-08-21"),
      ],
      [
        "[VENDA] FORD FIESTA 2016",
        642.3,
        CONV,
        100,
        12500,
        30100,
        6.42,
        d("2026-08-01"),
        d("2026-08-21"),
      ],
      [
        "FIAT CRONOS 2024 [R$ 74.900]",
        925.65,
        CONV,
        150,
        945,
        51134,
        6.17,
        d("2026-08-01"),
        d("2026-08-21"),
      ],
      [
        "CHEV ONIX",
        0,
        CONV,
        null,
        0,
        0,
        null,
        d("2026-08-01"),
        d("2026-08-21"),
      ],
    ]);
    const r = gerarRelatorio(cabecalho, registros);
    expect(r.tipo).toBe("veiculos");
    expect(r.blocos[0].texto).toBe(
      "📊 RELATÓRIO GERAL\n📅 Data: 01 a 21/08/2026\n🚗 Carros ativos: 3\n\n💬 Conversas iniciadas: 250\n\n👥 Alcance: 29 mil pessoas\n📺 Impressões: 81 mil\n\n📉 Custo por conversa: R$ 6,00\n💰 Investimento: R$ 1.567,00\n\n🟡 Status: Custo moderado",
    );
    expect(r.blocos[2].texto).toBe(
      "📊 FIAT CRONOS 2024\n📅 Data: 01 a 21/08/2026\n\n💬 Conversas iniciadas: 150\n\n👥 Alcance: 945 pessoas\n📺 Impressões: 51 mil\n\n📉 Custo por conversa: R$ 6,00\n💰 Investimento: R$ 925,00\n\n🟡 Status: Custo moderado",
    );
    expect(r.blocos[3].texto).toContain("💬 Conversas iniciadas: 0");
    expect(r.blocos[3].texto).toContain("📉 Custo por conversa: —");
    expect(r.blocos[3].texto).toContain("⚪ Status: Sem resultados ainda");
    expect(r.blocos[1].texto).not.toContain("Dias anunciados");
  });

  it("Formato B (por dia): soma, dias anunciados, carros ativos e comparação", async () => {
    const H = [
      "Nome da campanha",
      "Dia",
      "Valor gasto (BRL)",
      "Tipo de resultado",
      "Resultados",
      "Alcance",
      "Impressões",
      "Custo por resultado",
      "Status de veiculação",
      "Início dos relatórios",
      "Encerramento dos relatórios",
    ];
    const linhas = [
      H,
      [
        "",
        null,
        90,
        CONV,
        10,
        5000,
        9000,
        9,
        "",
        d("2026-08-01"),
        d("2026-08-03"),
      ],
      [
        "[VENDA] FIESTA",
        d("2026-08-01"),
        0,
        CONV,
        0,
        0,
        0,
        null,
        "active",
        d("2026-08-01"),
        d("2026-08-01"),
      ],
      [
        "[VENDA] FIESTA",
        d("2026-08-02"),
        20,
        CONV,
        5,
        1200,
        2000,
        4,
        "active",
        d("2026-08-02"),
        d("2026-08-02"),
      ],
      [
        "[VENDA] FIESTA",
        d("2026-08-03"),
        20,
        CONV,
        3,
        900,
        1500,
        6.66,
        "active",
        d("2026-08-03"),
        d("2026-08-03"),
      ],
      [
        "[VENDA] PUNTO",
        d("2026-08-01"),
        30,
        CONV,
        2,
        600,
        1000,
        15,
        "active",
        d("2026-08-01"),
        d("2026-08-01"),
      ],
      [
        "[VENDA] PUNTO",
        d("2026-08-02"),
        20,
        CONV,
        0,
        400,
        900,
        null,
        "active",
        d("2026-08-02"),
        d("2026-08-02"),
      ],
    ];
    const { cabecalho, registros } = await planilha(linhas);
    const r = gerarRelatorio(cabecalho, registros);
    // Geral usa a linha de total; só FIESTA tem linha no dia mais recente.
    expect(r.blocos[0].texto).toContain(
      "📅 Data: 01 a 03/08/2026\n🚗 Carros ativos: 1",
    );
    expect(r.blocos[0].texto).toContain(
      "📉 Custo por conversa: R$ 9,00\n💰 Investimento: R$ 90,00\n\n🔴 Status: Custo alto",
    );
    // FIESTA: primeiro gasto em 02/08 → 2 dias; custo 40/8 = 5,00 → baixo.
    expect(r.blocos[1].texto).toBe(
      "📊 FIESTA\n📅 Data: 01 a 03/08/2026\n🗓️ Dias anunciados: 2\n\n💬 Conversas iniciadas: 8\n\n👥 Alcance: 2 mil pessoas\n📺 Impressões: 3 mil\n\n📉 Custo por conversa: R$ 5,00\n💰 Investimento: R$ 40,00\n\n🟢 Status: Custo baixo",
    );
    // PUNTO: 50/2 = 25 → alto; dias = 03 − 01 + 1 = 3.
    expect(r.blocos[2].texto).toContain("🗓️ Dias anunciados: 3");
    expect(r.blocos[2].texto).toContain("🔴 Status: Custo alto");
    expect(r.observacoes.join(" ")).toMatch(/soma aproximada/);

    // Dia seguinte: PUNTO sai, ONIX entra, FIESTA muda de status; ordem anterior mantida.
    const amanha = [
      H,
      [
        "[VENDA] ONIX",
        d("2026-08-04"),
        10,
        CONV,
        1,
        100,
        200,
        10,
        "active",
        d("2026-08-04"),
        d("2026-08-04"),
      ],
      [
        "[VENDA] FIESTA",
        d("2026-08-04"),
        30,
        CONV,
        1,
        300,
        500,
        30,
        "active",
        d("2026-08-04"),
        d("2026-08-04"),
      ],
    ];
    const p2 = await planilha(amanha);
    const r2 = gerarRelatorio(p2.cabecalho, p2.registros, r);
    expect(r2.blocos.map((b) => b.titulo)).toEqual([
      "RELATÓRIO GERAL",
      "FIESTA",
      "ONIX",
    ]);
    const obs = r2.observacoes.join(" ");
    expect(obs).toContain("Novo(s): ONIX");
    expect(obs).toContain("Saiu/saíram: PUNTO");
    expect(obs).toContain("FIESTA: 🟢 Custo baixo → 🔴 Custo alto");
  });
});

describe("relatório SINDEPRESTEM", () => {
  const H = [
    "Nome da campanha",
    "Dia",
    "Nome do conjunto de anúncios",
    "Alcance",
    "Impressões",
    "Frequência",
    "Tipo de resultado",
    "Resultados",
    "Valor gasto (BRL)",
    "Custo por resultado",
    "Cliques no link",
    "Início dos relatórios",
    "Encerramento dos relatórios",
  ];

  it("geral pela linha de total, individuais por conjunto e comparativo ranqueado", async () => {
    const { cabecalho, registros } = await planilha([
      H,
      [
        "",
        null,
        "",
        45990,
        63909,
        1.39,
        LPV,
        1500,
        750.5,
        0.5003,
        2100,
        d("2026-07-01"),
        d("2026-07-31"),
      ],
      [
        "[TRAFEGO] SC",
        d("2026-07-02"),
        "Conjunto B",
        20000,
        30000,
        1.5,
        LPV,
        900,
        300,
        0.33,
        1200,
        d("2026-07-02"),
        d("2026-07-02"),
      ],
      [
        "[TRAFEGO] SC",
        d("2026-07-05"),
        "Conjunto A",
        25000,
        32000,
        1.28,
        LPV,
        600,
        450.5,
        0.75,
        850,
        d("2026-07-05"),
        d("2026-07-05"),
      ],
      [
        "[TRAFEGO] SC",
        d("2026-07-06"),
        "Conjunto A",
        0,
        0,
        0,
        LPV,
        null,
        0,
        null,
        0,
        d("2026-07-06"),
        d("2026-07-06"),
      ],
      [
        "[TRAFEGO] SC",
        d("2026-07-10"),
        "Conjunto C",
        500,
        700,
        1.4,
        LPV,
        null,
        10,
        null,
        3,
        d("2026-07-10"),
        d("2026-07-10"),
      ],
      [
        "[TRAFEGO] SC",
        d("2026-07-01"),
        "Conjunto A",
        990,
        1100,
        1.1,
        LPV,
        50,
        20,
        0.4,
        60,
        d("2026-07-01"),
        d("2026-07-01"),
      ],
    ]);
    const r = gerarRelatorio(cabecalho, registros);
    expect(r.tipo).toBe("sindeprestem");
    expect(r.blocos[0].texto).toBe(
      [
        "📊 RELATÓRIO GERAL",
        "🌐 *[TRAFEGO] SINDEPRESTEM CONECTA*\n📅 *RESULTADO DA CAMPANHA*",
        "* 📅 Período analisado: *01/07/2026 a 10/07/2026*\n* ⏳ Duração da campanha: *10 dias*",
        "📊 *ALCANCE E VISIBILIDADE*\n* 👥 Alcance total: *46,0 mil pessoas*\n* 📱 Impressões totais: *63,9 mil*\n* 🔄 Frequência média: *1,39*",
        "🎯 *TRÁFEGO PARA O SITE*\n* 🌐 Cliques no link: *2100*\n* 🌐 Visualizações da página de destino: *1500*",
        "💰 *INVESTIMENTO E CUSTOS*\n* 💰 Investimento total: *R$ 750,50*\n* 🎯 Custo por visualização: *R$ 0,50*",
      ].join("\n\n"),
    );
    // Individuais em ordem de início: A (01/07), B (02/07), C (10/07). A ignora o dia sem veiculação.
    expect(r.blocos.slice(1, 4).map((b) => b.titulo)).toEqual([
      "Conjunto A",
      "Conjunto B",
      "Conjunto C",
    ]);
    const a = r.blocos[1].texto;
    expect(a).toContain("📊 RELATÓRIO INDIVIDUAL\n\n🌐 *Conjunto A*");
    expect(a).toContain(
      "*01/07/2026 a 05/07/2026*\n* ⏳ Duração da campanha: *5 dias*",
    );
    expect(a).toContain("* 👥 Alcance total: *26,0 mil pessoas*"); // 25990
    expect(a).toContain("* 🔄 Frequência média: *1,27*"); // 33100/25990
    expect(a).toContain("* 🎯 Custo por visualização: *R$ 0,72*"); // 470,50/650
    expect(r.blocos[3].texto).toContain("* 👥 Alcance total: *500 pessoas*");
    expect(r.blocos[3].texto).toContain("*sem dados*");
    // Comparativo: B (0,33) 🥇, A (0,72) 🥈, C sem entrega no fim sem medalha.
    expect(r.blocos[4].texto).toBe(
      [
        "📊 RELATÓRIO COMPARATIVO — CONJUNTOS DE ANÚNCIOS",
        "🌐 *[TRAFEGO] SINDEPRESTEM CONECTA*\n📅 *Período analisado: 01/07/2026 a 10/07/2026*",
        "🥇 *Conjunto B*\n🎯 Custo por visualização: *R$ 0,33*\n👥 Alcance: *20,0 mil* | 📱 Impressões: *30,0 mil*\n🌐 Visualizações: *900* | 💰 Investimento: *R$ 300,00*",
        "🥈 *Conjunto A*\n🎯 Custo por visualização: *R$ 0,72*\n👥 Alcance: *26,0 mil* | 📱 Impressões: *33,1 mil*\n🌐 Visualizações: *650* | 💰 Investimento: *R$ 470,50*",
        "*Conjunto C*\n🎯 Custo por visualização: *sem dados*\n👥 Alcance: *500* | 📱 Impressões: *700*\n🌐 Visualizações: *0* | 💰 Investimento: *R$ 10,00*",
      ].join("\n\n"),
    );
    expect(r.observacoes).toEqual([]);
  });

  it("sem linha de total: soma e avisa; sem coluna de conjunto agrupa por campanha", async () => {
    const H2 = H.filter((h) => h !== "Nome do conjunto de anúncios");
    const { cabecalho, registros } = await planilha([
      H2,
      [
        "Campanha X",
        d("2026-07-01"),
        800,
        1000,
        1.25,
        LPV,
        40,
        20,
        0.5,
        50,
        d("2026-07-01"),
        d("2026-07-01"),
      ],
      [
        "Campanha X",
        d("2026-07-02"),
        700,
        900,
        1.28,
        LPV,
        30,
        15,
        0.5,
        40,
        d("2026-07-02"),
        d("2026-07-02"),
      ],
    ]);
    const r = gerarRelatorio(cabecalho, registros);
    expect(r.blocos.map((b) => b.titulo)).toEqual([
      "RELATÓRIO GERAL",
      "Campanha X",
      "RELATÓRIO COMPARATIVO",
    ]);
    expect(r.blocos[0].texto).toContain(
      "* 👥 Alcance total: *1,5 mil pessoas*",
    );
    expect(r.blocos[0].texto).toContain(
      "* 🎯 Custo por visualização: *R$ 0,50*",
    );
    expect(r.observacoes[0]).toMatch(/soma aproximada/);
  });

  it("recusa planilha de outro tipo", async () => {
    const { cabecalho, registros } = await planilha([
      ["Nome da campanha", "Tipo de resultado"],
      ["Reels", "Reproduções de vídeo"],
    ]);
    expect(() => gerarRelatorio(cabecalho, registros)).toThrow(
      /não reconhecida/,
    );
  });
});
