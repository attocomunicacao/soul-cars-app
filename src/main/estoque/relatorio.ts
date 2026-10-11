/**
 * Relatório HTML completo: balanço, gráficos e a ficha de cada carro.
 *
 * Tudo em SVG e CSS escritos à mão — nenhuma biblioteca, nenhum link
 * externo. O arquivo abre offline, imprime e pode ser mandado por e-mail.
 *
 * Porta fiel do `soul_estoque/relatorio.py` do app Python. As cores são os
 * tokens do app (`src/renderer/src/estilo.css`), declarados em `:root`.
 */
import fs from "node:fs";
import * as caminhos from "../caminhos";
import {
  AUTO,
  montar,
  moedaBr,
  type Balanco,
  type DadosBndv,
  type LinhaVeiculo,
} from "./balanco";

const ACENTO = "#885b33";
const ACENTO_ESC = "#714921";
const VERDE = "#3c7a3f";
const VERMELHO = "#a33227";
const CUSTO_BG = "#e8d9c4"; // tom suave do acento, para a base das barras

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** 12345 → "12k"; abaixo de mil, o número inteiro. */
const curto = (v: number) =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;

const dataBr = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

// ------------------------------------------------------------------ gráficos
/**
 * Barra empilhada por mês: custo embaixo, LUCRO por cima.
 *
 * A altura total é a receita; o pedaço verde no topo é o que sobrou. O valor
 * do lucro vai escrito acima de cada barra, que é a leitura que interessa —
 * quanto o mês deu de resultado.
 */
function barrasMes(porMes: DadosBndv["porMes"], limite = 12) {
  const itens = Object.entries(porMes).slice(-limite);
  if (!itens.length) return '<p class="vazio">Sem vendas registradas.</p>';

  const topo = Math.max(...itens.map(([, m]) => m.receita)) || 1;
  // arredonda a escala para um número redondo acima do maior mês
  const passo = 10 ** (String(Math.trunc(topo)).length - 1) / 2;
  const teto = (Math.trunc(topo / passo) + 1) * passo;
  const lg = 54,
    gap = 20,
    alt = 230,
    esq = 68,
    cima = 34;
  const w = esq + itens.length * (lg + gap) + 24;
  const p: string[] = [];

  // grade horizontal com os valores
  for (let k = 0; k < 5; k++) {
    const v = (teto * k) / 4;
    const y = cima + alt - (v / teto) * alt;
    p.push(
      `<line x1="${esq - 8}" y1="${y.toFixed(1)}" x2="${w - 12}" y2="${y.toFixed(1)}" stroke="${k ? "#eceff1" : "#dadce0"}" stroke-width="1"/>`,
      `<text x="${esq - 14}" y="${(y + 4).toFixed(1)}" class="ey">${v ? curto(v) : "0"}</text>`,
    );
  }

  itens.forEach(([mes, m], i) => {
    const x = esq + i * (lg + gap);
    const cx = x + lg / 2;
    const lucro = m.receita - m.custo;
    const hr = (m.receita / teto) * alt;
    const hc = m.custo ? (m.custo / teto) * alt : 0;
    const hl = Math.max(hr - hc, 0);
    const pct = m.receita ? (lucro / m.receita) * 100 : 0;
    const dica =
      `${mes} · ${m.n} venda${m.n === 1 ? "" : "s"}\nreceita ${moedaBr(m.receita)}\n` +
      `custo ${moedaBr(m.custo)}\nlucro ${moedaBr(lucro)} (${pct.toFixed(1)}%)`;

    p.push(`<g><title>${esc(dica)}</title>`);
    if (hc)
      p.push(
        `<rect x="${x}" y="${(cima + alt - hc).toFixed(1)}" width="${lg}" height="${hc.toFixed(1)}" fill="${CUSTO_BG}"/>`,
      );
    p.push(
      `<rect x="${x}" y="${(cima + alt - hr).toFixed(1)}" width="${lg}" height="${hl.toFixed(1)}" rx="3" fill="${VERDE}"/>`,
    );
    if (hc)
      p.push(
        `<rect x="${x}" y="${(cima + alt - hc - 2).toFixed(1)}" width="${lg}" height="4" fill="${CUSTO_BG}"/>`,
      );
    p.push("</g>");

    p.push(
      `<text x="${cx.toFixed(0)}" y="${(cima + alt - hr - 14).toFixed(1)}" class="lucro">${curto(lucro)}</text>`,
      `<text x="${cx.toFixed(0)}" y="${(cima + alt - hr - 3).toFixed(1)}" class="pct">${Math.round(pct)}%</text>`,
    );
    const [ano, mm] = mes.split("-");
    p.push(
      `<text x="${cx.toFixed(0)}" y="${cima + alt + 20}" class="eixo">${MESES[Number(mm) - 1]}</text>`,
      `<text x="${cx.toFixed(0)}" y="${cima + alt + 34}" class="ano">${ano}</text>`,
    );
  });

  const totR = itens.reduce((s, [, m]) => s + m.receita, 0);
  const totC = itens.reduce((s, [, m]) => s + m.custo, 0);
  const melhor = itens.reduce((a, b) =>
    b[1].receita - b[1].custo > a[1].receita - a[1].custo ? b : a,
  );
  const ml = melhor[1].receita - melhor[1].custo;

  return (
    `<svg viewBox="0 0 ${w} ${cima + alt + 44}" class="gr">${p.join("")}</svg>` +
    `<p class="leg"><i style="background:${VERDE}"></i>Lucro` +
    `<i style="background:${CUSTO_BG}"></i>Custo das unidades` +
    ` &middot; o número acima de cada barra é o lucro do mês` +
    `<br><b>Nos ${itens.length} meses:</b> receita ${moedaBr(totR)} &middot; lucro ${moedaBr(totR - totC)} ` +
    `(${(totR ? ((totR - totC) / totR) * 100 : 0).toFixed(1)}%) &middot; melhor mês ` +
    `${MESES[Number(melhor[0].slice(5, 7)) - 1]}/${melhor[0].slice(0, 4)} com ${moedaBr(ml)}</p>`
  );
}

/** Janelas de 12 meses consecutivos, inclusive meses sem venda. */
export function janelasLucro(porMes: DadosBndv["porMes"], hoje = new Date()) {
  const final = hoje.getFullYear() * 12 + hoje.getMonth();
  const converter = (mes: string) =>
    Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5)) - 1;
  const chaves = Object.keys(porMes)
    .filter((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && converter(m) <= final)
    .sort();
  const inicio = Math.min(
    chaves.length ? converter(chaves[0]) : final - 11,
    final - 11,
  );
  const meses: string[] = [];
  for (let n = inicio; n <= final; n++)
    meses.push(
      `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`,
    );
  return Array.from({ length: meses.length - 11 }, (_, i) =>
    Object.fromEntries(
      meses
        .slice(i, i + 12)
        .map((m) => [m, porMes[m] ?? { receita: 0, custo: 0, n: 0 }]),
    ),
  );
}

function lucroNavegavel(porMes: DadosBndv["porMes"]) {
  const janelas = janelasLucro(porMes);
  const rotulo = (m: string) =>
    `${MESES[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;
  const paineis = janelas
    .map((meses, i) => {
      const chaves = Object.keys(meses);
      const periodo = `${rotulo(chaves[0])} — ${rotulo(chaves.at(-1)!)}`;
      return `<div class="mes-janela" data-periodo="${esc(periodo)}" ${i === janelas.length - 1 ? "" : "hidden"}>${barrasMes(meses)}</div>`;
    })
    .join("");
  return `<div class="mes-navegacao"><button id="mes-anterior" aria-label="Meses anteriores" ${janelas.length === 1 ? "disabled" : ""}>←</button><span id="mes-periodo" aria-live="polite"></span><button id="mes-proximo" aria-label="Meses seguintes" disabled>→</button></div>${paineis}`;
}

/** Barras horizontais: [[rótulo, valor], …] */
function barrasH(
  pares: [string, number][],
  fmt: (v: number) => string = curto,
  cor = ACENTO,
  limite = 10,
) {
  const lista = pares.slice(0, limite);
  if (!lista.length) return '<p class="vazio">Sem dados.</p>';
  const topo = Math.max(...lista.map(([, v]) => Math.abs(v))) || 1;
  const linhas = lista.map(([rot, v]) => {
    const pc = (Math.abs(v) / topo) * 100;
    return (
      `<div class="hb"><span class="rot">${esc(rot)}</span>` +
      `<span class="tr"><b style="width:${pc.toFixed(1)}%;background:${v < 0 ? VERMELHO : cor}"></b></span>` +
      `<span class="vl">${fmt(v)}</span></div>`
    );
  });
  return `<div class="hbs">${linhas.join("")}</div>`;
}

function histograma(
  valores: number[],
  faixas: [string, number | null, number | null][],
  tituloX: string,
) {
  const cont = new Map(faixas.map(([r]) => [r, 0]));
  for (const v of valores) {
    for (const [rot, a, b] of faixas) {
      if ((a === null || v >= a) && (b === null || v < b)) {
        cont.set(rot, (cont.get(rot) ?? 0) + 1);
        break;
      }
    }
  }
  const topo = Math.max(...cont.values()) || 1;
  const lg = 56,
    gap = 18,
    alt = 150,
    esq = 40;
  const w = esq + cont.size * (lg + gap) + 20;
  const p: string[] = [];
  [...cont.entries()].forEach(([rot, n], i) => {
    const x = esq + i * (lg + gap);
    const h = (n / topo) * alt;
    p.push(
      `<rect x="${x}" y="${(20 + alt - h).toFixed(1)}" width="${lg}" height="${h.toFixed(1)}" rx="3" fill="${ACENTO}"/>`,
      `<text x="${x + Math.floor(lg / 2)}" y="${(14 + alt - h).toFixed(1)}" class="val">${n}</text>`,
      `<text x="${x + Math.floor(lg / 2)}" y="${alt + 40}" class="eixo">${esc(rot)}</text>`,
    );
  });
  return (
    `<svg viewBox="0 0 ${w} ${alt + 58}" class="gr">` +
    `<line x1="${esq - 6}" y1="${20 + alt}" x2="${w - 10}" y2="${20 + alt}" stroke="#dadce0"/>${p.join("")}</svg>` +
    `<p class="leg">${esc(tituloX)}</p>`
  );
}

// -------------------------------------------------------------------- tabela
function tabelaCarros(linhas: LinhaVeiculo[]) {
  return linhas
    .map((r) => {
      let m = '<span class="dim">—</span>';
      let mp = "";
      if (r.consignado) {
        m = '<span class="dim">consignado</span>';
      } else if (r.margem !== null) {
        const cor = r.margem >= 0 ? "pos" : "neg";
        m = `<span class="${cor}">${moedaBr(r.margem)}</span>`;
        mp = `<span class="${cor}">${(r.margemPct ?? 0).toFixed(1)}%</span>`;
      }
      const sit = r.vendido
        ? '<span class="tag v">vendido</span>'
        : '<span class="tag e">em estoque</span>';
      const dias =
        r.dias === null
          ? "—"
          : r.vendido
            ? `${r.dias} d`
            : `<b>${r.dias} d</b>`;
      const busca = esc(
        `${r.placa} ${r.marca} ${r.modelo} ${r.cliente}`.toLowerCase(),
      );
      const venda = r.vendido
        ? moedaBr(r.preco)
        : `<span class="dim">${moedaBr(r.tabela)}</span>`;
      return (
        `<tr data-b="${busca}">` +
        `<td class="pl">${esc(r.placa)}</td><td>${esc(r.marca)} ${esc(r.modelo)}</td>` +
        `<td>${dataBr(r.entrada)}</td><td>${dataBr(r.venda) || "—"}</td>` +
        `<td class="n">${dias}</td><td class="n">${moedaBr(r.custo)}</td>` +
        `<td class="n">${venda}</td><td class="n">${m}</td><td class="n">${mp}</td>` +
        `<td>${sit}</td></tr>`
      );
    })
    .join("");
}

// --------------------------------------------------------------------- página
export function render(b: Balanco): string {
  const d = b.bndv;
  const hoje = new Date()
    .toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    .replace(",", " às");

  const bloco = (grupos: readonly string[]) => {
    const out: string[] = [];
    let total = 0;
    for (const g of grupos) {
      out.push(`<tr class="g"><td colspan="2">${esc(g)}</td></tr>`);
      for (const [c, v] of Object.entries(b.contas[g] ?? {})) {
        total += v;
        const tag = c === AUTO ? ' <span class="auto">BNDV</span>' : "";
        out.push(
          `<tr><td>${esc(c)}${tag}</td><td class="n">${moedaBr(v)}</td></tr>`,
        );
      }
    }
    return { html: out.join(""), total };
  };

  const at = bloco(["Ativo circulante", "Ativo não circulante"]);
  const pa = bloco(["Passivo circulante", "Passivo não circulante"]);
  let pl = Object.entries(b.contas["Patrimônio líquido"] ?? {})
    .map(
      ([c, v]) => `<tr><td>${esc(c)}</td><td class="n">${moedaBr(v)}</td></tr>`,
    )
    .join("");
  pl +=
    '<tr><td>Lucros/prejuízos acumulados <span class="auto">saldo</span></td>' +
    `<td class="n">${moedaBr(b.acumulados)}</td></tr>`;

  const linhas = d?.linhas ?? [];
  const vendidas = linhas.filter((r) => r.vendido && r.margem !== null);
  const estoque = linhas.filter((r) => !r.vendido);

  // margem média e giro
  const diasV = vendidas
    .map((r) => r.dias)
    .filter((x): x is number => x !== null);
  const giro = diasV.length
    ? diasV.reduce((a, c) => a + c, 0) / diasV.length
    : 0;
  const mpct = vendidas.map((r) => r.margemPct ?? 0);
  const mediaPct = mpct.length
    ? mpct.reduce((a, c) => a + c, 0) / mpct.length
    : 0;

  const cards = d
    ? (
        [
          [`${d.estoqueN}`, "em estoque"],
          [moedaBr(d.estoqueCusto), "custo do estoque"],
          [moedaBr(d.estoquePotencial), "valor potencial"],
          [`${d.vendidosN}`, "vendidos"],
          [moedaBr(d.receita), "receita acumulada"],
          [moedaBr(d.margem), "margem bruta"],
          [`${mediaPct.toFixed(1)}%`, "margem média"],
          [`${Math.round(giro)} dias`, "giro médio"],
        ] as [string, string][]
      )
        .map(
          ([a, bb]) => `<div class="card"><b>${a}</b><span>${bb}</span></div>`,
        )
        .join("")
    : "";

  // por marca
  const marca = new Map<string, [number, number]>();
  for (const r of vendidas) {
    const [soma, n] = marca.get(r.marca) ?? [0, 0];
    marca.set(r.marca, [soma + (r.margem ?? 0), n + 1]);
  }
  const porMarca = [...marca.entries()]
    .map(([k, [v]]) => [k, v] as [string, number])
    .sort((a, c) => c[1] - a[1]);
  // modelos mais vendidos
  const mod = new Map<string, number>();
  for (const r of vendidas) {
    const k = `${r.marca} ${r.modelo}`;
    mod.set(k, (mod.get(k) ?? 0) + 1);
  }
  const topMod = [...mod.entries()]
    .sort((a, c) => c[1] - a[1])
    .slice(0, 10) as [string, number][];
  // margem média % por marca (só com 3+ vendas)
  const pctMarca = [...marca.entries()]
    .filter(([, [, n]]) => n >= 3)
    .map(([k, [, n]]) => {
      const soma = vendidas
        .filter((r) => r.marca === k)
        .reduce((a, r) => a + (r.margemPct ?? 0), 0);
      return [k, soma / n] as [string, number];
    })
    .sort((a, c) => c[1] - a[1]);

  const alerta = b.confere
    ? ""
    : '<p class="alerta">O balanço não fecha — confira os lançamentos.</p>';
  const nota = d?.ignorados.length
    ? `<p class="nota"><b>${d.ignorados.length} registros desativados</b> ficaram fora de ` +
      `todos os números (${esc(d.ignorados.map((v) => v.placa).join(", "))}). O status deles ainda diz ` +
      "“disponível estoque”, mas o cadastro foi encerrado no BNDV.</p>"
    : "";

  const parados = [...estoque].sort((a, c) => (c.dias ?? 0) - (a.dias ?? 0));

  const vars: Record<string, string> = {
    hoje,
    cards,
    alerta,
    nota,
    at: at.html,
    at_t: moedaBr(at.total),
    pa: pa.html,
    pa_t: moedaBr(pa.total),
    pl,
    pl_t: moedaBr(b.plTotal),
    soma: moedaBr(pa.total + b.plTotal),
    g_mes: d ? lucroNavegavel(d.porMes) : "",
    g_marca: barrasH(porMarca, moedaBr),
    g_modelo: barrasH(topMod, (v) => `${v}`, ACENTO_ESC),
    g_pct: barrasH(pctMarca, (v) => `${v.toFixed(1)}%`, VERDE),
    g_dias: histograma(
      diasV,
      [
        ["0–7", null, 8],
        ["8–15", 8, 16],
        ["16–30", 16, 31],
        ["31–60", 31, 61],
        ["61–90", 61, 91],
        ["90+", 91, null],
      ],
      "dias entre a entrada e a venda",
    ),
    g_parado: barrasH(
      parados.map(
        (r) =>
          [`${r.placa} · ${r.marca} ${r.modelo}`, r.dias ?? 0] as [
            string,
            number,
          ],
      ),
      (v) => `${v} d`,
      VERMELHO,
    ),
    tabela: tabelaCarros(linhas),
    n_linhas: String(linhas.length),
  };

  return PAGINA.replace(/%\((\w+)\)s/g, (_, k: string) => vars[k] ?? "");
}

export function gerarHtml(destino = caminhos.RELATORIO_HTML()) {
  caminhos.garantir();
  fs.writeFileSync(destino, render(montar()), "utf8");
  return destino;
}

const PAGINA = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório — SOUL CARS</title>
<style>
*{box-sizing:border-box}
:root{
  --canvas:#f5f3ef; --surface:#fff; --field:#faf9f6; --ink:#262420;
  --muted:#706b63; --line:#e3ded5; --accent:#885b33; --accent-soft:#f3e9dc;
  --ok:#3c7a3f; --danger:#a33227; --ouro:#a9803c; --ouro-soft:#faf1de;
  --radius:16px;
}
body{margin:0;padding:30px 24px 60px;background:var(--canvas);color:var(--ink);
     font:14px/1.55 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;
     -webkit-font-smoothing:antialiased}
.w{max-width:1180px;margin:0 auto}
h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.2px}
.sub{color:var(--muted);font-size:13px;margin:4px 0 24px}
section{background:var(--surface);border:1px solid var(--line);
        border-radius:var(--radius);margin-bottom:16px;overflow:hidden}
h2{margin:0;padding:14px 18px;font-size:11px;letter-spacing:.07em;
   text-transform:uppercase;color:var(--muted);
   border-bottom:1px solid var(--line);background:var(--field)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
       gap:14px;margin-bottom:18px}
.card{background:var(--surface);border:1px solid var(--line);
      border-radius:12px;padding:16px 18px}
.card b{display:block;font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.card span{color:var(--muted);font-size:12px}
.cols,.cols3{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
@media(max-width:820px){.cols,.cols3{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;font-size:13.5px}
td,th{padding:9px 16px;border-bottom:1px solid var(--line);text-align:left}
th{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;
   color:var(--muted);background:var(--field);position:sticky;top:0;
   cursor:pointer;user-select:none;white-space:nowrap}
th:hover{color:var(--accent)}
tr.g td{background:var(--field);font-weight:600;font-size:10.5px;
        letter-spacing:.06em;text-transform:uppercase;color:var(--muted);
        padding-top:12px}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.pl{font-family:Consolas,monospace;font-weight:600}
tr.t td{font-weight:700;border-top:2px solid var(--line);background:var(--field)}
tbody tr:hover{background:var(--field)}
.auto{font-size:10px;background:var(--accent-soft);color:var(--accent);
      padding:2px 7px;border-radius:9px;margin-left:6px}
.tag{font-size:11px;padding:2px 9px;border-radius:10px;white-space:nowrap}
.tag.v{background:#e8f0e6;color:var(--ok)}
.tag.e{background:var(--ouro-soft);color:var(--ouro)}
.pos{color:var(--ok);font-weight:600}.neg{color:var(--danger);font-weight:600}
.dim{color:var(--muted);opacity:.7}
.alerta{background:#fff0ec;color:var(--danger);border:1px solid #f0cfc8;
        border-radius:12px;padding:12px 16px;margin:0 0 16px}
.nota{background:var(--ouro-soft);color:#6b5223;border:1px solid #ecd9b2;
      border-radius:12px;padding:12px 16px;margin:0 0 16px;font-size:13px}
.gr{width:100%;height:auto;display:block;padding:16px 12px 0}
.mes-navegacao{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 18px;color:var(--muted)}
.mes-navegacao button{border:1px solid #ddd;border-radius:8px;background:#fff;color:var(--acento);font-size:24px;cursor:pointer;padding:2px 14px}
.mes-navegacao button:disabled{opacity:.3;cursor:default}
.mes-janela[hidden]{display:none}
.eixo{font-size:12px;fill:var(--ink);text-anchor:middle;font-weight:600}
.ano{font-size:10px;fill:var(--muted);text-anchor:middle}
.ey{font-size:10px;fill:var(--muted);text-anchor:end}
.lucro{font-size:13px;fill:var(--ok);text-anchor:middle;font-weight:700}
.pct{font-size:9px;fill:var(--muted);text-anchor:middle}
.val{font-size:10px;fill:var(--muted);text-anchor:middle}
.leg{font-size:12px;color:var(--muted);padding:4px 18px 16px;margin:0}
.leg i{display:inline-block;width:10px;height:10px;border-radius:3px;
       margin:0 5px 0 14px}
.hbs{padding:16px 18px}
.hb{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:13px}
.rot{width:34%;color:var(--ink);overflow:hidden;text-overflow:ellipsis;
     white-space:nowrap}
.tr{flex:1;background:var(--field);border:1px solid var(--line);
    border-radius:5px;height:16px;overflow:hidden}
.tr b{display:block;height:100%}
.vl{width:88px;text-align:right;font-variant-numeric:tabular-nums;
    color:var(--muted)}
.vazio{padding:18px;color:var(--muted)}
.busca{padding:12px 18px;border-bottom:1px solid var(--line);
       background:var(--field)}
.busca input{width:260px;padding:8px 12px;border:1px solid var(--line);
             border-radius:8px;background:var(--surface);color:var(--ink);
             font:14px "Segoe UI Variable Text","Segoe UI",sans-serif;outline:none}
.busca input:focus{border-color:var(--accent);
                   box-shadow:0 0 0 2px var(--accent-soft)}
.busca span{color:var(--muted);font-size:12px;margin-left:10px}
.rol{max-height:620px;overflow:auto}
.rod{color:var(--muted);font-size:12px;line-height:1.8;margin-top:22px}
@media print{body{background:#fff;padding:0}section{break-inside:avoid}
             .rol{max-height:none}.busca{display:none}}
</style><div class="w">
<h1>Relatório de veículos</h1>
<p class="sub">Gerado em %(hoje)s &middot; dados do BNDV</p>
%(alerta)s%(nota)s
<div class="cards">%(cards)s</div>

<section><h2>Lucro por mês</h2>%(g_mes)s</section>

<div class="cols">
  <section><h2>Margem bruta por marca</h2>%(g_marca)s</section>
  <section><h2>Modelos mais vendidos</h2>%(g_modelo)s</section>
</div>
<div class="cols">
  <section><h2>Margem média % por marca (3+ vendas)</h2>%(g_pct)s</section>
  <section><h2>Tempo até a venda</h2>%(g_dias)s</section>
</div>

<section><h2>Estoque atual — há quanto tempo parado</h2>%(g_parado)s</section>

<div class="cols">
  <section><h2>Ativo</h2><table>%(at)s
    <tr class="t"><td>Total do ativo</td><td class="n">%(at_t)s</td></tr></table></section>
  <div>
    <section><h2>Passivo</h2><table>%(pa)s
      <tr class="t"><td>Total do passivo</td><td class="n">%(pa_t)s</td></tr></table></section>
    <section><h2>Patrimônio líquido</h2><table>%(pl)s
      <tr class="t"><td>Total do PL</td><td class="n">%(pl_t)s</td></tr></table></section>
    <section><h2>Passivo + patrimônio líquido</h2><table>
      <tr class="t"><td>Total</td><td class="n">%(soma)s</td></tr></table></section>
  </div>
</div>

<section>
  <h2>Balanço por veículo</h2>
  <div class="busca">
    <input id="q" placeholder="filtrar por placa, modelo ou cliente…">
    <span id="cnt">%(n_linhas)s veículos</span>
  </div>
  <div class="rol"><table id="tb"><thead><tr>
    <th>Placa</th><th>Veículo</th><th>Entrada</th><th>Venda</th><th>Dias</th>
    <th class="n">Compra</th><th class="n">Venda</th><th class="n">Margem</th>
    <th class="n">%</th><th>Situação</th></tr></thead>
  <tbody>%(tabela)s</tbody></table></div>
</section>

<p class="rod">
<b>Estoque de veículos</b> soma o valor de compra das unidades não vendidas,
sem os consignados — eles estão no pátio mas não são patrimônio da loja.<br>
<b>Margem</b> é venda menos compra, sem despesas, comissões ou preparação.
Nos veículos em estoque ela é <i>potencial</i>, calculada sobre o preço de tabela.<br>
<b>Dias</b> é o intervalo entre a entrada e a venda; no estoque, até hoje.<br>
<b>Lucros/prejuízos acumulados</b> é o saldo que fecha a equação contábil
(Ativo − Passivo − Capital − Reservas), não um resultado apurado.
</p></div>
<script>
var janelasMes=[].slice.call(document.querySelectorAll('.mes-janela')),indiceMes=janelasMes.length-1;
var anteriorMes=document.getElementById('mes-anterior'),proximoMes=document.getElementById('mes-proximo');
function mostrarMes(indice){
  if(!janelasMes.length)return;
  indiceMes=Math.max(0,Math.min(indice,janelasMes.length-1));
  janelasMes.forEach(function(p,i){p.hidden=i!==indiceMes;});
  document.getElementById('mes-periodo').textContent=janelasMes[indiceMes].dataset.periodo;
  anteriorMes.disabled=indiceMes===0;proximoMes.disabled=indiceMes===janelasMes.length-1;
}
if(anteriorMes){anteriorMes.addEventListener('click',function(){mostrarMes(indiceMes-1);});proximoMes.addEventListener('click',function(){mostrarMes(indiceMes+1);});mostrarMes(indiceMes);}
var q=document.getElementById('q'),tb=document.getElementById('tb'),
    cnt=document.getElementById('cnt'),
    ls=[].slice.call(tb.tBodies[0].rows);
q.addEventListener('input',function(){
  var t=q.value.toLowerCase().trim(),n=0;
  ls.forEach(function(r){
    var ok=!t||r.dataset.b.indexOf(t)>=0;
    r.style.display=ok?'':'none'; if(ok)n++;
  });
  cnt.textContent=n+' veículo'+(n==1?'':'s');
});
// ordenar clicando no cabecalho
[].forEach.call(tb.tHead.rows[0].cells,function(th,i){
  var desc=false;
  th.addEventListener('click',function(){
    desc=!desc;
    var val=function(tr){
      var c=tr.cells[i],s=c.textContent.trim();
      var num=s.replace(/[^0-9,\\-]/g,'').replace(/\\./g,'').replace(',','.');
      if(/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(s))
        return s.slice(6)+s.slice(3,5)+s.slice(0,2);
      return (num!==''&&!isNaN(parseFloat(num)))?parseFloat(num):s.toLowerCase();
    };
    ls.sort(function(a,b){
      var x=val(a),y=val(b);
      if(x<y)return desc?1:-1; if(x>y)return desc?-1:1; return 0;
    });
    ls.forEach(function(r){tb.tBodies[0].appendChild(r)});
  });
});
</script></html>`;
