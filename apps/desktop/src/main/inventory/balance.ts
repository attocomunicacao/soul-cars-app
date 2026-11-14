/**
 * Balanço patrimonial.
 *
 * O BNDV só conhece os veículos: ele diz quanto custou o estoque e quanto
 * cada carro foi vendido. Caixa, bancos, dívidas, capital social e
 * imobilizado não existem lá — essas contas você preenche na tela Balanço e
 * ficam salvas em `dados/balanco.json`.
 *
 * Então o balanço aqui é metade automático, metade seu:
 *
 *   automático : Estoque de veículos (custo das unidades não vendidas)
 *   seu        : todo o resto
 *
 * Lucros acumulados é calculado por diferença (Ativo − Passivo − Capital −
 * Reservas), que é o que fecha a equação contábil. Se os números que você
 * lançar estiverem errados, o erro aparece ali — não é um lucro apurado de
 * verdade, é o saldo que falta para o balanço bater.
 *
 * Porta fiel do `soul_estoque/balanco.py` do app Python.
 */
import { vendasValidas } from "./canceled-sales";
import fs from "node:fs";
import * as caminhos from "../core/paths";
import { ordenarPorEntrada } from "./ordering";
import {
  diasEntre,
  ehAtivo,
  ehConsignado,
  lerCsv,
  type LinhaCsv,
} from "./folder-sync";

/** Conta automática, calculada a partir do BNDV — não editável na tela. */
export const AUTO = "Estoque de veículos (custo)";

export const GRUPOS_ATIVO = [
  "Ativo circulante",
  "Ativo não circulante",
] as const;
export const GRUPOS_PASSIVO = [
  "Passivo circulante",
  "Passivo não circulante",
] as const;

/** Ordem das contas na tela: a ordem deste objeto é a ordem exibida. */
export const MODELO: Record<string, Record<string, number>> = {
  "Ativo circulante": {
    "Caixa e equivalentes": 0,
    Bancos: 0,
    "Contas a receber": 0,
    "Adiantamentos a fornecedores": 0,
    [AUTO]: 0,
  },
  "Ativo não circulante": {
    Imobilizado: 0,
    "(-) Depreciação acumulada": 0,
    Intangível: 0,
  },
  "Passivo circulante": {
    Fornecedores: 0,
    "Empréstimos e financiamentos": 0,
    "Obrigações fiscais": 0,
    "Salários e encargos": 0,
    "Outras contas a pagar": 0,
  },
  "Passivo não circulante": {
    "Empréstimos de longo prazo": 0,
    "Outras obrigações": 0,
  },
  "Patrimônio líquido": {
    "Capital social": 0,
    "Reservas de lucros": 0,
  },
};

export type Contas = Record<string, Record<string, number>>;

// ------------------------------------------------------------------ formato
export function moedaBr(v: number) {
  const sinal = v < 0 ? "-" : "";
  const [inteiro, dec] = Math.abs(v).toFixed(2).split(".");
  return `${sinal}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/** Aceita "1.234,56", "1234.56", 1234.56 e devolve número. */
export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "")
    .trim()
    .replace(/R\$/g, "")
    .replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ----------------------------------------------------------------- arquivos
export function carregar(): Contas {
  const dados: Contas = Object.fromEntries(
    Object.entries(MODELO).map(([g, contas]) => [g, { ...contas }]),
  );
  try {
    const salvo = JSON.parse(
      fs.readFileSync(caminhos.BALANCO_JSON(), "utf8"),
    ) as Contas;
    for (const [grupo, contas] of Object.entries(salvo)) {
      dados[grupo] ??= {};
      for (const [conta, valor] of Object.entries(contas))
        dados[grupo][conta] = num(valor);
    }
  } catch {
    /* arquivo ausente ou corrompido: usa o modelo */
  }
  return dados;
}

export function salvar(dados: Contas) {
  caminhos.garantir();
  const limpo: Contas = {};
  for (const [grupo, contas] of Object.entries(dados)) {
    limpo[grupo] = Object.fromEntries(
      Object.entries(contas)
        .filter(([c]) => c !== AUTO)
        .map(([c, v]) => [c, Math.round(num(v) * 100) / 100]),
    );
  }
  fs.writeFileSync(
    caminhos.BALANCO_JSON(),
    JSON.stringify(limpo, null, 2),
    "utf8",
  );
}

const lerCsvOpcional = (arquivo: string) => {
  try {
    return lerCsv(arquivo);
  } catch {
    return [];
  }
};

// ------------------------------------------------------------------ cálculo
export type LinhaVeiculo = {
  /** Data e hora do cadastro no BNDV (ISO), usada para ordenar do mais recente ao mais antigo. */
  registroEm: string;
  placa: string;
  marca: string;
  modelo: string;
  entrada: string;
  custo: number;
  consignado: boolean;
  tabela: number;
  id: string;
  n: string;
  chassi: string;
  status: string;
  venda: string;
  preco: number;
  cliente: string;
  dias: number | null;
  margem: number | null;
  margemPct: number | null;
  vendido: boolean;
  nVendas: number;
  /** Extras que o BNDV informa (texto; vazio se não vieram). */
  km: string;
  anoModelo: string;
  anoFab: string;
  cor: string;
  cambio: string;
  combustivel: string;
  versao: string;
};

export type DadosBndv = {
  total: number;
  ignorados: { placa: string }[];
  estoqueN: number;
  estoqueCusto: number;
  estoquePotencial: number;
  vendidosN: number;
  receita: number;
  custoVendido: number;
  margem: number;
  porMes: Record<string, { receita: number; custo: number; n: number }>;
  linhas: LinhaVeiculo[];
};

/** Estoque, vendas e margem a partir dos CSVs do BNDV. */
export function dadosBndv(): DadosBndv | null {
  const veic = lerCsvOpcional(caminhos.CSV_VEICULOS());
  // Venda cancelada no BNDV: o veículo voltou para "disponível"; a venda não conta.
  const vend = vendasValidas(veic, lerCsvOpcional(caminhos.CSV_VENDAS()));
  if (!veic.length) return null;

  // mesma regra do sync: sem as duplicatas de placa
  const escolhidos: LinhaCsv[] = [];
  const placas = new Set<string>();
  const ordenados = [...veic].sort((a, b) => {
    const pa = ehAtivo(a) ? 0 : 1;
    const pb = ehAtivo(b) ? 0 : 1;
    return pa - pb || Number(a.idVehicle) - Number(b.idVehicle);
  });
  for (const v of ordenados) {
    const p = (v.plate || "").trim().toUpperCase();
    if (placas.has(p)) continue;
    placas.add(p);
    escolhidos.push(v);
  }

  const porVeic = new Map<string, LinhaCsv[]>();
  for (const s of vend) {
    const lista = porVeic.get(s.idVehicle) ?? [];
    lista.push(s);
    porVeic.set(s.idVehicle, lista);
  }
  for (const lista of porVeic.values()) {
    lista.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || Number(a.idSale) - Number(b.idSale),
    );
  }

  let custoEstoque = 0;
  let potencial = 0;
  let receita = 0;
  let custoVendido = 0;
  let estoqueN = 0;
  let vendidosN = 0;
  const porMes: Record<string, { receita: number; custo: number; n: number }> =
    {};
  const ignorados: { placa: string }[] = [];
  const linhas: LinhaVeiculo[] = [];
  const hoje = new Date().toISOString().slice(0, 10);

  for (const v of escolhidos) {
    // Registro desativado não é patrimônio: o BNDV tira do estoque da loja
    // mesmo que o campo de status tenha ficado em "DISPONIVEL ESTOQUE".
    // São cadastros encerrados cujo status nunca foi atualizado.
    if (!ehAtivo(v)) {
      ignorados.push({ placa: (v.plate || "").toUpperCase() });
      continue;
    }
    const vs = porVeic.get(v.idVehicle) ?? [];
    const custo = num(v.purchasePrice);
    const consig = ehConsignado(v);
    const linha: LinhaVeiculo = {
      placa: (v.plate || "").toUpperCase(),
      marca: v.brand ?? "",
      modelo: v.model ?? "",
      registroEm: v.dateRegister || "",
      entrada: (v.dateRegister || "").slice(0, 10),
      custo,
      consignado: consig,
      tabela: num(v.salePrice),
      id: v.idVehicle,
      n: v.vehicleNumber,
      chassi: v.vin ?? "",
      status: v.status ?? "",
      venda: "",
      preco: 0,
      cliente: "",
      dias: null,
      margem: null,
      margemPct: null,
      vendido: vs.length > 0,
      nVendas: vs.length,
      km: (v.km ?? "").trim(),
      anoModelo: (v.anoModelo ?? "").trim(),
      anoFab: (v.anoFab ?? "").trim(),
      cor: (v.cor ?? "").trim(),
      cambio: (v.cambio ?? "").trim(),
      combustivel: (v.combustivel ?? "").trim(),
      versao: (v.versao ?? "").trim(),
    };

    if (vs.length) {
      const ult = vs.at(-1)!;
      const preco = num(ult.price);
      linha.venda = (ult.date || "").slice(0, 10);
      linha.preco = preco;
      linha.cliente = (ult.customer || "").trim();
      linha.dias = diasEntre(linha.entrada, linha.venda);
      if (preco && custo && !consig) {
        linha.margem = preco - custo;
        linha.margemPct = ((preco - custo) / custo) * 100;
      }
      vendidosN++;
      receita += preco;
      if (!consig) custoVendido += custo;
      const mes = (ult.date || "").slice(0, 7);
      if (mes) {
        porMes[mes] ??= { receita: 0, custo: 0, n: 0 };
        porMes[mes].receita += preco;
        porMes[mes].n++;
        if (!consig) porMes[mes].custo += custo;
      }
    } else {
      linha.dias = diasEntre(linha.entrada, hoje);
      if (linha.tabela && custo && !consig) {
        linha.margem = linha.tabela - custo;
        linha.margemPct = ((linha.tabela - custo) / custo) * 100;
      }
      estoqueN++;
      if (!consig) custoEstoque += custo;
      potencial += num(v.salePrice);
    }
    linhas.push(linha);
  }

  const porMesOrdenado = Object.fromEntries(
    Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    total: escolhidos.length - ignorados.length,
    ignorados,
    estoqueN,
    estoqueCusto: custoEstoque,
    estoquePotencial: potencial,
    vendidosN,
    receita,
    custoVendido,
    margem: receita - custoVendido,
    porMes: porMesOrdenado,
    linhas: ordenarPorEntrada(linhas),
  };
}

export type Balanco = {
  contas: Contas;
  bndv: DadosBndv | null;
  ativo: number;
  passivo: number;
  plLancado: number;
  acumulados: number;
  plTotal: number;
  confere: boolean;
};

/** Junta o que você lançou com o que veio do BNDV e fecha o balanço. */
export function montar(dados?: Contas): Balanco {
  const contas = dados ?? carregar();
  const bndv = dadosBndv();
  if (bndv) {
    contas["Ativo circulante"] ??= {};
    contas["Ativo circulante"][AUTO] = bndv.estoqueCusto;
  }

  const soma = (grupos: readonly string[]) =>
    grupos.reduce(
      (t, g) =>
        t + Object.values(contas[g] ?? {}).reduce((a, b) => a + num(b), 0),
      0,
    );

  const ativo = soma(GRUPOS_ATIVO);
  const passivo = soma(GRUPOS_PASSIVO);
  const plLancado = Object.values(contas["Patrimônio líquido"] ?? {}).reduce(
    (a, b) => a + num(b),
    0,
  );
  const acumulados = ativo - passivo - plLancado;

  return {
    contas,
    bndv,
    ativo,
    passivo,
    plLancado,
    acumulados,
    plTotal: plLancado + acumulados,
    confere: Math.abs(ativo - (passivo + plLancado + acumulados)) < 0.01,
  };
}
