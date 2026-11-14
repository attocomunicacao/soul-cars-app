/**
 * Cria uma pasta por veículo e mantém as fichas em dia.
 *
 * Entrada: `dados/bndv_veiculos.csv` e `dados/bndv_vendas.csv`, produzidos
 * pela extração. Saída: `ESTOQUE/<id>_<MARCA>_<MODELO>_<PLACA>/`, cada uma
 * com `INFO.md`, `INFO.txt` e as subpastas `CRIATIVO`, `FOTOS` e `VIDEO`.
 *
 * É seguro rodar quantas vezes quiser: só cria o que falta e só reescreve a
 * ficha quando o dado mudou. Nunca apaga nem renomeia pasta existente — ela
 * pode ter arquivos seus dentro. Pastas sem veículo correspondente são
 * apenas listadas no resultado.
 *
 * Porta fiel do `soul_estoque/sync.py` do app Python.
 */
import { vendasValidas } from "./canceled-sales";
import fs from "node:fs";
import path from "node:path";
import * as caminhos from "../core/paths";
import type { Log } from "./bndv-extraction";

export const SUBPASTAS = ["CRIATIVO", "FOTOS", "VIDEO"] as const;

export type LinhaCsv = Record<string, string>;

/** Tira acento e pontuação: nomes seguros no Windows e na nuvem. */
export function slug(s: string) {
  const semAcento = (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return semAcento
    .toUpperCase()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/** 1234.5 → 1.234,50 */
export function brl(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const [inteiro, dec] = Math.abs(n).toFixed(2).split(".");
  const comPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? "-" : "") + comPontos + "," + dec;
}

/** Aceita true/True/1/sim — o valor já chegou em formatos diferentes
 *  conforme quem gerou o CSV. */
export const ehAtivo = (v: LinhaCsv) =>
  ["true", "1", "sim"].includes(
    String(v.active ?? "")
      .trim()
      .toLowerCase(),
  );
export const ehConsignado = (v: LinhaCsv) =>
  ["true", "1", "sim"].includes(
    String(v.consigned ?? "")
      .trim()
      .toLowerCase(),
  );

export const dataBr = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

export function diasEntre(inicio: string, fim: string): number | null {
  const a = Date.parse(inicio?.slice(0, 10));
  const b = Date.parse(fim?.slice(0, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

// ------------------------------------------------------------------- CSV
/** Leitor de CSV com `;` e campos entre aspas — o formato que a extração grava. */
export function lerCsv(arquivo: string): LinhaCsv[] {
  if (!fs.existsSync(arquivo)) {
    throw new Error(
      `Não encontrei ${path.basename(arquivo)}.\nRode a atualização primeiro.`,
    );
  }
  const texto = fs.readFileSync(arquivo, "utf8").replace(/^\uFEFF/, "");
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentro) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else dentro = false;
      } else campo += c;
      continue;
    }
    if (c === '"') dentro = true;
    else if (c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const cabecalho = linhas.shift() ?? [];
  return linhas
    .filter((l) => l.some((x) => x !== ""))
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, l[i] ?? ""])));
}

function gravarCsv(arquivo: string, linhas: Record<string, string | number>[]) {
  const colunas = Object.keys(linhas[0] ?? {});
  const corpo = [
    colunas.join(";"),
    ...linhas.map((l) =>
      colunas
        .map((c) => `"${String(l[c] ?? "").replace(/"/g, '""')}"`)
        .join(";"),
    ),
  ].join("\r\n");
  fs.writeFileSync(arquivo, "﻿" + corpo, "utf8");
}

// ----------------------------------------------------------------- fichas
/**
 * Monta o INFO.md do veículo.
 *
 * É um espelho do BNDV: reescrito a cada execução, então anotações feitas
 * nele se perdem — guarde-as em outro arquivo da pasta.
 */
export function ficha(v: LinhaCsv, vds: LinhaCsv[]) {
  const cons = ehConsignado(v);
  const ult = vds.at(-1);
  const dias = ult ? diasEntre(v.dateRegister, ult.date) : null;

  const L: string[] = [
    `# ${v.brand} ${v.model} — ${v.plate.toUpperCase()}`,
    "",
  ];
  L.push("| | |", "|---|---|");
  const linha = (k: string, x: unknown) =>
    L.push(
      `| **${k}** | ${x === null || x === undefined || x === "" ? "—" : x} |`,
    );

  linha("Placa", v.plate.toUpperCase());
  linha("Marca / modelo", `${v.brand} ${v.model}`);
  linha("Chassi", v.vin);
  linha("Nº interno", v.vehicleNumber);
  linha("Envelope", v.envelopeNumber);
  linha("ID BNDV", v.idVehicle);
  L.push("");

  L.push("## Entrada", "", "| | |", "|---|---|");
  linha("Data de entrada", dataBr(v.dateRegister));
  linha(
    "Valor de compra",
    cons ? "— (consignado)" : "R$ " + brl(v.purchasePrice),
  );
  linha("Comprador", v.buyer);
  linha("Aquisição", cons ? "Consignação" : "Compra");
  L.push("");

  L.push("## Situação", "", "| | |", "|---|---|");
  linha("Status", v.status);
  linha(
    "Preço de tabela",
    ["", "0"].includes(v.salePrice) ? "—" : "R$ " + brl(v.salePrice),
  );
  linha("Registro ativo", ehAtivo(v) ? "Sim" : "Não (cancelado/re-entrada)");
  linha("Bloqueado", v.blocked === "true" ? "Sim" : "Não");
  if (dias !== null) linha("Dias em estoque", dias);
  L.push("");

  if (vds.length) {
    L.push("## Venda" + (vds.length > 1 ? `s (${vds.length})` : ""), "");
    if (vds.length > 1) {
      L.push(
        "> Este veículo tem mais de uma venda — devolução seguida de",
        "> revenda. A última é a que vale.",
        "",
      );
    }
    L.push("| Data | Valor | Cliente | Vendedor |", "|---|---|---|---|");
    for (const s of vds) {
      L.push(
        `| ${dataBr(s.date)} | R$ ${brl(s.price)} | ${(s.customer || "").trim() || "—"} | ${(s.seller || "").trim() || "—"} |`,
      );
    }
    L.push("");
    const c = Number(v.purchasePrice || 0);
    const p = Number(ult?.price || 0);
    if (c > 0 && p > 0 && !cons) {
      L.push(
        `**Margem:** R$ ${brl(p - c)} (${(((p - c) / c) * 100).toFixed(1).replace(".", ",")}%)`,
        "",
      );
    }
  } else {
    L.push("## Venda", "", "Ainda não vendido.", "");
  }

  L.push(
    "---",
    "",
    "*Gerado pelo SOUL Cars (Estoque) a partir do BNDV. Este arquivo é reescrito a cada sincronização.*",
    "",
  );
  return L.join("\n");
}

/** Mesma ficha em texto puro, para quem abrir no Bloco de Notas. */
export function fichaTxt(v: LinhaCsv, vds: LinhaCsv[]) {
  const cons = ehConsignado(v);
  const ult = vds.at(-1);
  const dias = ult ? diasEntre(v.dateRegister, ult.date) : null;
  const semAcento = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const titulo = semAcento(`${v.brand} ${v.model} - ${v.plate.toUpperCase()}`);

  const L: string[] = [titulo, "=".repeat(titulo.length), ""];
  const item = (k: string, x: unknown) => {
    const valor = x === null || x === undefined || x === "" ? "-" : String(x);
    L.push("  " + semAcento(k + ":").padEnd(18) + " " + semAcento(valor));
  };

  L.push("IDENTIFICACAO");
  item("Placa", v.plate.toUpperCase());
  item("Marca / modelo", `${v.brand} ${v.model}`);
  item("Chassi", v.vin);
  item("N interno", v.vehicleNumber);
  item("Envelope", v.envelopeNumber);
  item("ID BNDV", v.idVehicle);
  L.push("");

  L.push("ENTRADA");
  item("Data de entrada", dataBr(v.dateRegister));
  item(
    "Valor de compra",
    cons ? "- (consignado)" : "R$ " + brl(v.purchasePrice),
  );
  item("Comprador", v.buyer);
  item("Aquisicao", cons ? "Consignacao" : "Compra");
  L.push("");

  L.push("SITUACAO");
  item("Status", v.status);
  item(
    "Preco de tabela",
    ["", "0"].includes(v.salePrice) ? "-" : "R$ " + brl(v.salePrice),
  );
  item("Registro ativo", ehAtivo(v) ? "Sim" : "Nao (cancelado/re-entrada)");
  item("Bloqueado", v.blocked === "true" ? "Sim" : "Nao");
  if (dias !== null) item("Dias em estoque", dias);
  L.push("");

  if (vds.length) {
    L.push("VENDA" + (vds.length > 1 ? `S (${vds.length})` : ""));
    if (vds.length > 1) {
      L.push(
        "  (mais de uma venda - devolucao seguida de revenda; a ultima e a que vale)",
      );
    }
    for (const s of vds) {
      L.push(
        `  ${dataBr(s.date)}  R$ ${brl(s.price).padEnd(14)} ${semAcento((s.customer || "").trim() || "-")}`,
      );
      L.push(
        `  ${"".padEnd(12)} vendedor: ${semAcento((s.seller || "").trim() || "-")}`,
      );
    }
    const c = Number(v.purchasePrice || 0);
    const p = Number(ult?.price || 0);
    if (c > 0 && p > 0 && !cons) {
      L.push("");
      item(
        "Margem",
        `R$ ${brl(p - c)} (${(((p - c) / c) * 100).toFixed(1).replace(".", ",")}%)`,
      );
    }
  } else {
    L.push("VENDA", "  Ainda nao vendido.");
  }
  L.push(
    "",
    "-".repeat(60),
    "Gerado pelo SOUL Cars (Estoque) a partir do BNDV.",
    "Este arquivo e reescrito a cada sincronizacao.",
    "",
  );
  return L.join("\n");
}

// ------------------------------------------------------------- seleção
/**
 * Decide quais registros viram pasta.
 *
 * O BNDV guarda cadastros cancelados e refeitos: o antigo fica com
 * `active = false` e repete a placa do bom. Esses saem. Um inativo de placa
 * única, porém, é um veículo real que foi desativado — esse entra.
 */
export function selecionar(veiculos: LinhaCsv[], todos = false) {
  if (todos) return { escolhidos: [...veiculos], descartados: 0 };
  const escolhidos: LinhaCsv[] = [];
  const placas = new Set<string>();
  const ordenados = [...veiculos].sort((a, b) => {
    const pa = ehAtivo(a) ? 0 : 1;
    const pb = ehAtivo(b) ? 0 : 1;
    return pa - pb || Number(a.idVehicle) - Number(b.idVehicle);
  });
  for (const v of ordenados) {
    const p = slug(v.plate);
    if (placas.has(p)) continue;
    placas.add(p);
    escolhidos.push(v);
  }
  return { escolhidos, descartados: veiculos.length - escolhidos.length };
}

export type ResumoSync = {
  veiculos: number;
  registros: number;
  criadas: string[];
  renomeados: [string, string][];
  orfas: string[];
  fichas: number;
  destino: string;
};

/** Cria as pastas que faltam e atualiza as fichas. */
export function sincronizar(log: Log, todos = false): ResumoSync {
  caminhos.garantir();
  const veiculos = lerCsv(caminhos.CSV_VEICULOS());
  // Vendas canceladas (veículo de volta ao estoque no BNDV) não entram na ficha.
  const vendas = vendasValidas(veiculos, lerCsv(caminhos.CSV_VENDAS()));

  // última venda de cada veículo; o idSale desempata vendas no mesmo dia
  const porVeiculo = new Map<string, LinhaCsv[]>();
  for (const v of vendas) {
    const lista = porVeiculo.get(v.idVehicle) ?? [];
    lista.push(v);
    porVeiculo.set(v.idVehicle, lista);
  }
  for (const lista of porVeiculo.values()) {
    lista.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || Number(a.idSale) - Number(b.idSale),
    );
  }

  const { escolhidos, descartados } = selecionar(veiculos, todos);
  escolhidos.sort((a, b) => Number(a.idVehicle) - Number(b.idVehicle));

  const destino = caminhos.ESTOQUE();
  const existentes = new Set(
    fs
      .readdirSync(destino, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
  // o id é a chave: se a placa ou o modelo mudarem no BNDV, a pasta continua
  // sendo reconhecida
  const porId = new Map<string, string>();
  for (const d of existentes) {
    const chave = d.split("_", 1)[0];
    if (/^\d+$/.test(chave)) porId.set(chave, d);
  }

  const linhas: Record<string, string | number>[] = [];
  const criadas: string[] = [];
  const renomeados: [string, string][] = [];
  let fichas = 0;

  escolhidos.forEach((v, indice) => {
    let nome = `${v.idVehicle}_${slug(v.brand)}_${slug(v.model)}_${slug(v.plate)}`;
    const anterior = porId.get(v.idVehicle);
    if (anterior && anterior !== nome) {
      renomeados.push([anterior, nome]);
      nome = anterior;
    } else if (!anterior) {
      fs.mkdirSync(path.join(destino, nome), { recursive: true });
      criadas.push(nome);
    }

    const pasta = path.join(destino, nome);
    for (const sub of SUBPASTAS)
      fs.mkdirSync(path.join(pasta, sub), { recursive: true });

    const vds = porVeiculo.get(v.idVehicle) ?? [];
    // .md para ler formatado, .txt para o Bloco de Notas (CRLF, sem acento)
    const arquivos: [string, string, string][] = [
      ["INFO.md", ficha(v, vds), "\n"],
      ["INFO.txt", fichaTxt(v, vds), "\r\n"],
    ];
    for (const [arquivo, conteudo, nl] of arquivos) {
      const caminho = path.join(pasta, arquivo);
      const esperado = conteudo.replace(/\n/g, nl);
      let atual = "";
      try {
        atual = fs.readFileSync(caminho, "utf8");
      } catch {
        /* não existe ainda */
      }
      if (atual !== esperado) {
        fs.writeFileSync(caminho, esperado, "utf8");
        fichas++;
      }
    }

    const u = vds.at(-1);
    linhas.push({
      PASTA: nome,
      SEQ: indice + 1,
      PLACA: v.plate.toUpperCase(),
      MARCA: v.brand,
      MODELO: v.model,
      DATA_ENTRADA: dataBr(v.dateRegister),
      DATA_VENDA: u ? dataBr(u.date) : "",
      VALOR_COMPRA: brl(v.purchasePrice),
      VALOR_VENDA: u ? brl(u.price) : "",
      SITUACAO: v.status,
      CHASSI: v.vin,
      ID: v.idVehicle,
    });
  });

  if (linhas.length) gravarCsv(caminhos.INDICE_CSV(), linhas);

  const nomesGerados = new Set(linhas.map((l) => String(l.PASTA)));
  const orfas = [...existentes].filter((n) => !nomesGerados.has(n)).sort();

  log(
    `veículos        : ${escolhidos.length} de ${veiculos.length} registros` +
      (todos ? "" : ` (${descartados} duplicatas de placa descartadas)`),
  );
  log(`pastas novas    : ${criadas.length}`);
  for (const n of criadas) log("   + " + n, "ok");
  if (renomeados.length) {
    log("dados mudaram no BNDV (pasta mantida como está):", "aviso");
    for (const [a, b] of renomeados)
      log(`   ${a} -> deveria ser ${b}`, "aviso");
  }
  if (orfas.length) {
    log("pastas sem veículo correspondente (nada foi apagado):", "aviso");
    for (const n of orfas) log("   ? " + n, "aviso");
  }
  log(`fichas          : ${fichas} arquivos escritos/atualizados`);
  log(`índice          : ${linhas.length} linhas`);

  return {
    veiculos: escolhidos.length,
    registros: veiculos.length,
    criadas,
    renomeados,
    orfas,
    fichas,
    destino,
  };
}
