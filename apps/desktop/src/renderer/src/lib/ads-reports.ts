/**
 * Relatórios Meta Ads para WhatsApp. Regras idênticas às skills da Atto Comunicação:
 * - relatorio-diario-veiculos (Conversas por mensagem iniciadas)
 * - relatorio-trafego-sindeprestem (Visualizações da página de destino)
 */
import type { Celula } from "./xlsx";

export type Registro = Record<string, Celula>;
export type Bloco = { titulo: string; texto: string };
export type Relatorio = {
  tipo: "veiculos" | "sindeprestem";
  periodo: { inicio: string; fim: string };
  blocos: Bloco[];
  observacoes: string[];
  /** Resumo por item, para comparar com o próximo relatório. */
  resumo: Record<
    string,
    { custo: number | null; status: string; resultados: number }
  >;
  ordem: string[];
};

// ---------------- utilitários ----------------

const COLUNAS = {
  campanha: "Nome da campanha",
  conjunto: "Nome do conjunto de anúncios",
  dia: "Dia",
  gasto: "Valor gasto (BRL)",
  tipo: "Tipo de resultado",
  resultados: "Resultados",
  alcance: "Alcance",
  impressoes: "Impressões",
  frequencia: "Frequência",
  cliques: "Cliques no link",
  custoResultado: "Custo por resultado",
  inicio: "Início dos relatórios",
  fim: "Encerramento dos relatórios",
};

export function numero(v: Celula): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string" || !v.trim()) return 0;
  let s = v.trim().replace(/^R\$\s*/i, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // 1.234,56
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const vazio = (v: Celula) =>
  v === null || v === undefined || String(v).trim() === "";

/** Aceita "2026-08-01", "2026-08-01 00:00:00", "01/08/2026". Retorna "AAAA-MM-DD" ou null. */
export function dataIso(v: Celula): string | null {
  if (vazio(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const dmy = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return { d, m, y };
};

const milharBr = (n: number) =>
  Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function tipoDoArquivo(
  cabecalho: string[],
  registros: Registro[],
): Relatorio["tipo"] | null {
  if (
    !cabecalho.includes(COLUNAS.campanha) ||
    !cabecalho.includes(COLUNAS.tipo)
  )
    return null;
  const tipos = new Map<string, number>();
  for (const r of registros) {
    const t = String(r[COLUNAS.tipo] ?? "").trim();
    if (t) tipos.set(t, (tipos.get(t) ?? 0) + 1);
  }
  const principal =
    [...tipos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  if (/conversas por mensagem/i.test(principal)) return "veiculos";
  if (/visualiza[cç][oõ]es da p[aá]gina de destino/i.test(principal))
    return "sindeprestem";
  return null;
}

// ---------------- Veículos ----------------

export function limparNomeVeiculo(nome: string) {
  // Prefixo do objetivo da campanha ([VENDA], [LEAD], …) e o sufixo de preço saem fora.
  return nome
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .trim();
}

export const formatarDataVeiculos = (inicio: string, fim: string) => {
  const a = dmy(inicio),
    b = dmy(fim);
  return a.m === b.m && a.y === b.y
    ? `${a.d} a ${b.d}/${b.m}/${b.y}`
    : `${a.d}/${a.m} a ${b.d}/${b.m}/${b.y}`;
};
const escalaVeiculos = (n: number) =>
  n >= 1000 ? `${milharBr(Math.floor(n / 1000))} mil` : String(Math.trunc(n));
const reaisTruncados = (n: number) => `R$ ${milharBr(Math.floor(n))},00`;

export function statusCusto(custo: number | null): string {
  if (custo === null) return "⚪ Status: Sem resultados ainda";
  if (custo <= 5) return "🟢 Status: Custo baixo";
  if (custo <= 8) return "🟡 Status: Custo moderado";
  return "🔴 Status: Custo alto";
}

type Metricas = {
  gasto: number;
  resultados: number;
  alcance: number;
  impressoes: number;
};

function blocoVeiculo(
  titulo: string,
  data: string,
  extra: string | null,
  m: Metricas,
) {
  const custo = m.resultados > 0 ? m.gasto / m.resultados : null;
  const linhas = [
    [`📊 ${titulo}`, `📅 Data: ${data}`, ...(extra ? [extra] : [])].join("\n"),
    `💬 Conversas iniciadas: ${Math.round(m.resultados)}`,
    [
      `👥 Alcance: ${escalaVeiculos(m.alcance)} pessoas`,
      `📺 Impressões: ${escalaVeiculos(m.impressoes)}`,
    ].join("\n"),
    [
      `📉 Custo por conversa: ${custo === null ? "—" : reaisTruncados(custo)}`,
      `💰 Investimento: ${reaisTruncados(m.gasto)}`,
    ].join("\n"),
    statusCusto(custo),
  ];
  return { texto: linhas.join("\n\n"), custo, status: statusCusto(custo) };
}

export function relatorioVeiculos(
  cabecalho: string[],
  registros: Registro[],
  anterior?: Relatorio | null,
): Relatorio {
  const formatoB = cabecalho.includes(COLUNAS.dia);
  const ehTotal = (r: Registro) =>
    vazio(r[COLUNAS.campanha]) && (!formatoB || vazio(r[COLUNAS.dia]));
  const total = registros.find(ehTotal) ?? null;
  const linhas = registros.filter((r) => !vazio(r[COLUNAS.campanha]));
  if (!linhas.length)
    throw new Error("Nenhuma campanha encontrada na planilha.");

  const inicios = registros
    .map((r) => dataIso(r[COLUNAS.inicio]))
    .filter(Boolean) as string[];
  const fins = registros
    .map((r) => dataIso(r[COLUNAS.fim]))
    .filter(Boolean) as string[];
  const dias = linhas
    .map((r) => dataIso(r[COLUNAS.dia]))
    .filter(Boolean) as string[];
  const inicio = [...inicios, ...dias].sort()[0];
  const fim = [...fins, ...dias].sort().at(-1)!;
  if (!inicio || !fim)
    throw new Error(
      "Não encontrei as datas do relatório (Início/Encerramento dos relatórios).",
    );
  const data = formatarDataVeiculos(inicio, fim);
  const observacoes: string[] = [];

  // Agrupa por veículo (no Formato A cada linha já é um veículo).
  const grupos = new Map<
    string,
    { m: Metricas; primeiroDiaComGasto: string | null; dias: Set<string> }
  >();
  for (const r of linhas) {
    const nome = limparNomeVeiculo(String(r[COLUNAS.campanha]));
    const g = grupos.get(nome) ?? {
      m: { gasto: 0, resultados: 0, alcance: 0, impressoes: 0 },
      primeiroDiaComGasto: null,
      dias: new Set<string>(),
    };
    const gasto = numero(r[COLUNAS.gasto]);
    g.m.gasto += gasto;
    g.m.resultados += numero(r[COLUNAS.resultados]);
    g.m.alcance += numero(r[COLUNAS.alcance]);
    g.m.impressoes += numero(r[COLUNAS.impressoes]);
    const dia = dataIso(r[COLUNAS.dia]);
    if (dia) {
      g.dias.add(dia);
      if (gasto > 0 && (!g.primeiroDiaComGasto || dia < g.primeiroDiaComGasto))
        g.primeiroDiaComGasto = dia;
    }
    grupos.set(nome, g);
  }

  const diaMaisRecente = dias.sort().at(-1) ?? null;
  const ativos =
    formatoB && diaMaisRecente
      ? [...grupos.values()].filter((g) => g.dias.has(diaMaisRecente)).length
      : grupos.size;

  let geral: Metricas;
  if (total) {
    geral = {
      gasto: numero(total[COLUNAS.gasto]),
      resultados: numero(total[COLUNAS.resultados]),
      alcance: numero(total[COLUNAS.alcance]),
      impressoes: numero(total[COLUNAS.impressoes]),
    };
  } else {
    geral = [...grupos.values()].reduce(
      (s, g) => ({
        gasto: s.gasto + g.m.gasto,
        resultados: s.resultados + g.m.resultados,
        alcance: s.alcance + g.m.alcance,
        impressoes: s.impressoes + g.m.impressoes,
      }),
      { gasto: 0, resultados: 0, alcance: 0, impressoes: 0 },
    );
    observacoes.push(
      "Sem linha de total na planilha: o Alcance geral é uma soma aproximada.",
    );
  }
  if (formatoB)
    observacoes.push(
      "O Alcance por veículo é uma soma aproximada dos dias (pode estar inflado por sobreposição de público).",
    );

  // Ordem: a mesma do relatório anterior; veículos novos no fim, na ordem da planilha.
  const nomes = [...grupos.keys()];
  const ordem = [
    ...(anterior?.ordem ?? []).filter((n) => grupos.has(n)),
    ...nomes.filter((n) => !anterior?.ordem.includes(n)),
  ];

  const blocos: Bloco[] = [
    {
      titulo: "RELATÓRIO GERAL",
      texto: blocoVeiculo(
        "RELATÓRIO GERAL",
        data,
        `🚗 Carros ativos: ${ativos}`,
        geral,
      ).texto,
    },
  ];
  const resumo: Relatorio["resumo"] = {};
  for (const nome of ordem) {
    const g = grupos.get(nome)!;
    const extra =
      formatoB && g.primeiroDiaComGasto && diaMaisRecente
        ? `🗓️ Dias anunciados: ${diasEntre(g.primeiroDiaComGasto, diaMaisRecente) + 1}`
        : null;
    const b = blocoVeiculo(nome, data, extra, g.m);
    blocos.push({ titulo: nome, texto: b.texto });
    resumo[nome] = {
      custo: b.custo,
      status: b.status,
      resultados: g.m.resultados,
    };
  }

  observacoes.unshift(...compararVeiculos(resumo, anterior));
  return {
    tipo: "veiculos",
    periodo: { inicio, fim },
    blocos,
    observacoes,
    resumo,
    ordem,
  };
}

function compararVeiculos(
  atual: Relatorio["resumo"],
  anterior?: Relatorio | null,
): string[] {
  const obs: string[] = [];
  const nomes = Object.keys(atual);
  const comCusto = nomes
    .filter((n) => atual[n].custo !== null)
    .sort((a, b) => atual[a].custo! - atual[b].custo!);
  if (comCusto.length > 1)
    obs.push(
      `Melhor custo: ${comCusto[0]} (${reaisTruncados(atual[comCusto[0]].custo!)}). Maior custo: ${comCusto.at(-1)} (${reaisTruncados(atual[comCusto.at(-1)!].custo!)}).`,
    );
  if (!anterior || anterior.tipo !== "veiculos") return obs;
  const novos = nomes.filter((n) => !(n in anterior.resumo));
  const sairam = Object.keys(anterior.resumo).filter((n) => !(n in atual));
  if (novos.length) obs.push(`Novo(s): ${novos.join(", ")}.`);
  if (sairam.length) obs.push(`Saiu/saíram: ${sairam.join(", ")}.`);
  for (const n of nomes) {
    const antes = anterior.resumo[n]?.status;
    if (antes && antes !== atual[n].status)
      obs.push(
        `${n}: ${antes.replace(" Status:", "")} → ${atual[n].status.replace(" Status:", "")}.`,
      );
  }
  const igual =
    nomes.length === Object.keys(anterior.resumo).length &&
    nomes.every(
      (n) =>
        anterior.resumo[n] &&
        anterior.resumo[n].resultados === atual[n].resultados &&
        anterior.resumo[n].custo === atual[n].custo,
    );
  if (igual)
    obs.unshift(
      "⚠️ Os números são iguais ao relatório anterior: a planilha pode não ter sido atualizada.",
    );
  return obs;
}

// ---------------- SINDEPRESTEM ----------------

const PROJETO = "[TRAFEGO] SINDEPRESTEM CONECTA";
const dataCompleta = (iso: string) => {
  const { d, m, y } = dmy(iso);
  return `${d}/${m}/${y}`;
};
const decimalBr = (n: number, casas: number) =>
  n.toFixed(casas).replace(".", ",");
const reaisBr = (n: number) => `R$ ${decimalBr(Math.round(n * 100) / 100, 2)}`;
const escalaTrafego = (n: number, sufixo = "") =>
  n >= 1000
    ? `${decimalBr(Math.round(n / 100) / 10, 1)} mil${sufixo}`
    : `${Math.round(n)}${sufixo ? " pessoas" : ""}`;

type Trafego = {
  nome: string;
  inicio: string;
  fim: string;
  alcance: number;
  impressoes: number;
  frequencia: number;
  cliques: number;
  visualizacoes: number;
  gasto: number;
  custo: number | null;
};

function blocoTrafego(titulo: string, nome: string, t: Trafego) {
  return [
    `📊 ${titulo}`,
    `🌐 *${nome}*\n📅 *RESULTADO DA CAMPANHA*`,
    `* 📅 Período analisado: *${dataCompleta(t.inicio)} a ${dataCompleta(t.fim)}*\n* ⏳ Duração da campanha: *${diasEntre(t.inicio, t.fim) + 1} dias*`,
    `📊 *ALCANCE E VISIBILIDADE*\n* 👥 Alcance total: *${escalaTrafego(t.alcance, " pessoas")}*\n* 📱 Impressões totais: *${escalaTrafego(t.impressoes)}*\n* 🔄 Frequência média: *${decimalBr(t.frequencia, 2)}*`,
    `🎯 *TRÁFEGO PARA O SITE*\n* 🌐 Cliques no link: *${Math.round(t.cliques)}*\n* 🌐 Visualizações da página de destino: *${Math.round(t.visualizacoes)}*`,
    `💰 *INVESTIMENTO E CUSTOS*\n* 💰 Investimento total: *${reaisBr(t.gasto)}*\n* 🎯 Custo por visualização: *${t.custo === null ? "sem dados" : reaisBr(t.custo)}*`,
  ].join("\n\n");
}

export function relatorioSindeprestem(
  cabecalho: string[],
  registros: Registro[],
): Relatorio {
  const temConjunto = cabecalho.includes(COLUNAS.conjunto);
  const chave = temConjunto ? COLUNAS.conjunto : COLUNAS.campanha;
  const ehTotal = (r: Registro) =>
    vazio(r[COLUNAS.campanha]) && (!temConjunto || vazio(r[COLUNAS.conjunto]));
  const total = registros.find(ehTotal) ?? null;
  const ativas = registros.filter(
    (r) => !ehTotal(r) && !vazio(r[chave]) && numero(r[COLUNAS.alcance]) > 0,
  );
  if (!ativas.length)
    throw new Error("Nenhuma linha com veiculação (Alcance > 0) encontrada.");

  const grupos = new Map<string, Trafego>();
  for (const r of ativas) {
    const nome = String(r[chave]).trim();
    const dia = dataIso(r[COLUNAS.dia]) ?? dataIso(r[COLUNAS.inicio]);
    if (!dia) continue;
    const g = grupos.get(nome) ?? {
      nome,
      inicio: dia,
      fim: dia,
      alcance: 0,
      impressoes: 0,
      frequencia: 0,
      cliques: 0,
      visualizacoes: 0,
      gasto: 0,
      custo: null,
    };
    g.inicio = dia < g.inicio ? dia : g.inicio;
    g.fim = dia > g.fim ? dia : g.fim;
    g.alcance += numero(r[COLUNAS.alcance]);
    g.impressoes += numero(r[COLUNAS.impressoes]);
    g.cliques += numero(r[COLUNAS.cliques]);
    g.visualizacoes += numero(r[COLUNAS.resultados]);
    g.gasto += numero(r[COLUNAS.gasto]);
    grupos.set(nome, g);
  }
  for (const g of grupos.values()) {
    g.frequencia = g.alcance > 0 ? g.impressoes / g.alcance : 0;
    g.custo = g.visualizacoes > 0 ? g.gasto / g.visualizacoes : null;
  }
  const lista = [...grupos.values()];
  const inicio = lista.map((g) => g.inicio).sort()[0];
  const fim = lista
    .map((g) => g.fim)
    .sort()
    .at(-1)!;
  const observacoes: string[] = [];

  let geral: Trafego;
  if (total) {
    const visualizacoes = numero(total[COLUNAS.resultados]);
    const gasto = numero(total[COLUNAS.gasto]);
    const alcance = numero(total[COLUNAS.alcance]);
    const impressoes = numero(total[COLUNAS.impressoes]);
    geral = {
      nome: PROJETO,
      inicio,
      fim,
      alcance,
      impressoes,
      frequencia:
        numero(total[COLUNAS.frequencia]) ||
        (alcance ? impressoes / alcance : 0),
      cliques: numero(total[COLUNAS.cliques]),
      visualizacoes,
      gasto,
      custo:
        visualizacoes > 0
          ? numero(total[COLUNAS.custoResultado]) || gasto / visualizacoes
          : null,
    };
  } else {
    const s = lista.reduce(
      (a, g) => ({
        alcance: a.alcance + g.alcance,
        impressoes: a.impressoes + g.impressoes,
        cliques: a.cliques + g.cliques,
        visualizacoes: a.visualizacoes + g.visualizacoes,
        gasto: a.gasto + g.gasto,
      }),
      { alcance: 0, impressoes: 0, cliques: 0, visualizacoes: 0, gasto: 0 },
    );
    geral = {
      nome: PROJETO,
      inicio,
      fim,
      ...s,
      frequencia: s.alcance ? s.impressoes / s.alcance : 0,
      custo: s.visualizacoes ? s.gasto / s.visualizacoes : null,
    };
    observacoes.push(
      "Sem linha de total na planilha: o Alcance geral é uma soma aproximada e pode haver sobreposição de público entre conjuntos/dias.",
    );
  }

  const porInicio = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const blocos: Bloco[] = [
    {
      titulo: "RELATÓRIO GERAL",
      texto: blocoTrafego("RELATÓRIO GERAL", PROJETO, geral),
    },
    ...porInicio.map((g) => ({
      titulo: g.nome,
      texto: blocoTrafego("RELATÓRIO INDIVIDUAL", g.nome, g),
    })),
  ];

  const ranking = lista
    .filter((g) => g.custo !== null)
    .sort((a, b) => a.custo! - b.custo!);
  const semEntrega = lista.filter((g) => g.custo === null);
  const medalha = (i: number) =>
    ["🥇", "🥈", "🥉"][i] ?? (i < 9 ? `${i + 1}️⃣` : `${i + 1}.`);
  const item = (g: Trafego, prefixo: string) =>
    [
      `${prefixo}*${g.nome}*`,
      `🎯 Custo por visualização: *${g.custo === null ? "sem dados" : reaisBr(g.custo)}*`,
      `👥 Alcance: *${escalaTrafego(g.alcance)}* | 📱 Impressões: *${escalaTrafego(g.impressoes)}*`,
      `🌐 Visualizações: *${Math.round(g.visualizacoes)}* | 💰 Investimento: *${reaisBr(g.gasto)}*`,
    ].join("\n");
  blocos.push({
    titulo: "RELATÓRIO COMPARATIVO",
    texto: [
      "📊 RELATÓRIO COMPARATIVO — CONJUNTOS DE ANÚNCIOS",
      `🌐 *${PROJETO}*\n📅 *Período analisado: ${dataCompleta(inicio)} a ${dataCompleta(fim)}*`,
      ...ranking.map((g, i) => item(g, `${medalha(i)} `)),
      ...semEntrega.map((g) => item(g, "")),
    ].join("\n\n"),
  });

  const resumo = Object.fromEntries(
    lista.map((g) => [
      g.nome,
      { custo: g.custo, status: "", resultados: g.visualizacoes },
    ]),
  );
  return {
    tipo: "sindeprestem",
    periodo: { inicio, fim },
    blocos,
    observacoes,
    resumo,
    ordem: porInicio.map((g) => g.nome),
  };
}

export function gerarRelatorio(
  cabecalho: string[],
  registros: Registro[],
  anterior?: Relatorio | null,
): Relatorio {
  const tipo = tipoDoArquivo(cabecalho, registros);
  if (tipo === "veiculos")
    return relatorioVeiculos(cabecalho, registros, anterior);
  if (tipo === "sindeprestem")
    return relatorioSindeprestem(cabecalho, registros);
  throw new Error(
    "Planilha não reconhecida: esperado Raw Data Report com 'Conversas por mensagem iniciadas' (veículos) ou 'Visualizações da página de destino' (SINDEPRESTEM).",
  );
}
