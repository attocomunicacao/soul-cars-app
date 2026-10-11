/**
 * Busca veículos e vendas no BNDV e grava os CSVs.
 *
 * O caminho é indireto por um motivo: a API exige um token que o app web do
 * BNDV renova sozinho e que não fica acessível de fora. Então abrimos o BNDV
 * numa janela do próprio Electron, interceptamos o cabeçalho `Authorization`
 * de uma requisição que o próprio app dispara, e reusamos esse token para
 * consultar a API direto daqui — muito mais rápido e completo do que raspar
 * a tela.
 *
 * Diferença em relação ao app Python antigo: não precisa mais do Chrome
 * instalado nem do Chrome DevTools Protocol. A janela é do app, e a sessão
 * fica salva numa partição persistente (`persist:bndv`), então o login é
 * pedido uma vez só.
 */
import { BrowserWindow, session } from "electron";
import fs from "node:fs";
import * as caminhos from "../caminhos";

export type Log = (
  texto: string,
  tom?: "normal" | "aviso" | "erro" | "ok",
) => void;

type Registro = Record<string, unknown>;
type Pagina = { itens: Registro[]; total: number };

/** Os campos "extras" são opcionais de propósito: o schema GraphQL declara
 *  vários como não-nuláveis, mas eles vêm nulos em registros antigos, e no
 *  GraphQL um campo assim derruba a consulta inteira — não só o registro
 *  ruim. Por isso, se a página falhar, refazemos sem eles. */
const CAMPOS_VEICULOS = `idVehicle vehicleNumber plate vin salePrice consigned active dateRegister
  purchasePrice envelopeNumber blocked vehicleStatus { name } brand { name }
  model { name } buyer { name }`;
const CAMPOS_VENDAS = `idSale saleNumber date price documentPrice saleWeb seller { name }
  customer { name } vehicle { idVehicle plate }`;
const EXTRAS_VENDAS = `status acquisitionType vehicle { daysInStock km yearModel }`;

export const COLUNAS_VEICULOS = [
  "idVehicle",
  "vehicleNumber",
  "plate",
  "vin",
  "envelopeNumber",
  "brand",
  "model",
  "dateRegister",
  "purchasePrice",
  "salePrice",
  "consigned",
  "blocked",
  "active",
  "status",
  "buyer",
] as const;
export const COLUNAS_VENDAS = [
  "idSale",
  "saleNumber",
  "date",
  "price",
  "documentPrice",
  "saleWeb",
  "status",
  "acquisitionType",
  "seller",
  "customer",
  "idVehicle",
  "plate",
  "daysInStock",
  "km",
  "yearModel",
] as const;

const campo = (d: unknown, ...chaves: string[]) => {
  let atual: unknown = d;
  for (const k of chaves) atual = (atual as Registro | null)?.[k];
  return atual;
};

/** True/False viram "true"/"false", como no JSON; o sync compara a forma minúscula. */
function celula(x: unknown) {
  const valor =
    typeof x === "boolean"
      ? x
        ? "true"
        : "false"
      : x === null || x === undefined
        ? ""
        : String(x);
  return '"' + valor.replace(/"/g, '""') + '"';
}

function csv(
  linhas: Registro[],
  colunas: readonly string[],
  extrair: (r: Registro) => unknown[],
) {
  return [
    colunas.join(";"),
    ...linhas.map((r) => extrair(r).map(celula).join(";")),
  ].join("\n");
}

export function gravarCsvs(veiculos: Registro[], vendas: Registro[]) {
  caminhos.garantir();
  const pares: [string, string][] = [
    [
      caminhos.CSV_VEICULOS(),
      csv(veiculos, COLUNAS_VEICULOS, (r) => [
        r.idVehicle,
        r.vehicleNumber,
        r.plate,
        r.vin,
        r.envelopeNumber,
        campo(r, "brand", "name"),
        campo(r, "model", "name"),
        r.dateRegister,
        r.purchasePrice,
        r.salePrice,
        r.consigned,
        r.blocked,
        r.active,
        campo(r, "vehicleStatus", "name"),
        campo(r, "buyer", "name"),
      ]),
    ],
    [
      caminhos.CSV_VENDAS(),
      csv(vendas, COLUNAS_VENDAS, (r) => [
        r.idSale,
        r.saleNumber,
        r.date,
        r.price,
        r.documentPrice,
        r.saleWeb,
        r.status,
        r.acquisitionType,
        campo(r, "seller", "name"),
        campo(r, "customer", "name"),
        campo(r, "vehicle", "idVehicle"),
        campo(r, "vehicle", "plate"),
        campo(r, "vehicle", "daysInStock"),
        campo(r, "vehicle", "km"),
        campo(r, "vehicle", "yearModel"),
      ]),
    ],
  ];
  // utf-8 com BOM: o Excel abre os acentos certos sem precisar importar.
  for (const [arquivo, conteudo] of pares)
    fs.writeFileSync(arquivo, "﻿" + conteudo, "utf8");
  return pares.map(([p]) => p);
}

// ------------------------------------------------------------------ token
const PARECE_LOGIN = (url: string) => /login|auth|signin/i.test(url);

/**
 * Abre o BNDV numa janela e espera o token aparecer.
 *
 * A janela começa escondida: se o login já estiver salvo, o usuário não vê
 * nada. Se o BNDV pedir login (ou se o token demorar), ela aparece para a
 * pessoa resolver e a espera continua.
 */
async function capturarToken(
  log: Log,
  segundos = 300,
): Promise<Record<string, string>> {
  const particao = session.fromPartition("persist:bndv", { cache: true });
  let cabecalhos: Record<string, string> | null = null;

  particao.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (detalhes, callback) => {
      try {
        if (detalhes.url.includes("vehicle-api")) {
          const achado = Object.entries(detalhes.requestHeaders).find(
            ([k]) => k.toLowerCase() === "authorization",
          );
          if (achado && !cabecalhos) {
            cabecalhos = {
              Authorization: String(achado[1]),
              "Content-Type": "application/json",
            };
          }
        }
      } catch {
        /* nada: interceptar não pode derrubar a navegação */
      }
      callback({ requestHeaders: detalhes.requestHeaders });
    },
  );

  const janela = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: "BNDV — login",
    autoHideMenuBar: true,
    webPreferences: {
      partition: "persist:bndv",
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  let visivel = false;
  const mostrar = (motivo: string) => {
    if (visivel || janela.isDestroyed()) return;
    visivel = true;
    janela.show();
    log(motivo, "aviso");
  };

  try {
    await janela.loadURL(caminhos.URL_BNDV);
    for (let tentativa = 0; tentativa * 0.5 < segundos; tentativa++) {
      if (cabecalhos) return cabecalhos;
      if (janela.isDestroyed())
        throw new Error("A janela do BNDV foi fechada antes de autenticar.");
      await new Promise((r) => setTimeout(r, 500));
      const url = janela.webContents.getURL();
      if (PARECE_LOGIN(url)) {
        mostrar(
          "Faça o login na janela do BNDV. Depois é só esperar, eu sigo sozinho.",
        );
      } else if (tentativa === 24) {
        mostrar(
          "O BNDV está demorando. Confira a janela aberta — talvez precise de login.",
        );
      }
      // De vez em quando a página fica em outra rota: volta para a lista,
      // que é a tela que dispara a consulta de onde vem o token.
      if (
        tentativa > 0 &&
        tentativa % 60 === 0 &&
        !url.includes("vehicles/search") &&
        !PARECE_LOGIN(url)
      ) {
        await janela.loadURL(caminhos.URL_BNDV).catch(() => {});
      }
    }
    throw new Error(
      `Não capturei o token em ${Math.round(segundos / 60)} minutos. ` +
        "A janela do BNDV chegou a mostrar a lista de veículos?",
    );
  } finally {
    particao.webRequest.onBeforeSendHeaders(null);
    if (!janela.isDestroyed()) janela.destroy();
  }
}

// -------------------------------------------------------------- consulta
async function puxar(
  cabecalhos: Record<string, string>,
  raiz: string,
  core: string,
  extra: string,
  chave: string,
): Promise<Pagina> {
  const itens: Registro[] = [];
  const vistos = new Set<unknown>();
  let total = 0;

  const consultar = async (selecao: string, pagina: number) => {
    const query = `query { ${raiz}(pagination:{page:${pagina},pageSize:20},filters:{}) { paginationOut { totalRows } items { ${selecao} } } }`;
    const resposta = await fetch(caminhos.API_BNDV, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resposta.ok)
      throw new Error(
        `O BNDV respondeu HTTP ${resposta.status}. Tente atualizar novamente.`,
      );
    return (await resposta.json()) as {
      data?: Record<
        string,
        { paginationOut: { totalRows: number }; items: Registro[] }
      >;
      errors?: { message: string }[];
    };
  };

  for (let pagina = 0; pagina <= 200; pagina++) {
    let r = await consultar(extra ? `${core} ${extra}` : core, pagina);
    if (r.errors && extra) r = await consultar(core, pagina);
    if (r.errors)
      throw new Error(
        `a API recusou a consulta de ${raiz}: ${r.errors[0].message}`,
      );
    const d = r.data?.[raiz];
    if (!d) throw new Error(`a API não devolveu ${raiz}.`);
    if (d.paginationOut?.totalRows) total = d.paginationOut.totalRows;
    if (!d.items.length) break;
    for (const it of d.items) {
      if (!vistos.has(it[chave])) {
        vistos.add(it[chave]);
        itens.push(it);
      }
    }
  }
  return { itens, total };
}

export type ResultadoExtracao = {
  veiculos: Pagina;
  vendas: Pagina;
  incompleto: boolean;
};

/** Abre o BNDV, pega o token, consulta a API e grava os CSVs. */
export async function extrair(
  log: Log,
  aoAutenticar?: () => void,
): Promise<ResultadoExtracao> {
  log("Abrindo o BNDV…");
  const cabecalhos = await capturarToken(log);
  log("Sessão autenticada.", "ok");
  aoAutenticar?.();

  log("Consultando veículos e vendas…");
  const veiculos = await puxar(
    cabecalhos,
    "vehicles_web_app",
    CAMPOS_VEICULOS,
    "",
    "idVehicle",
  );
  const vendas = await puxar(
    cabecalhos,
    "sales",
    CAMPOS_VENDAS,
    EXTRAS_VENDAS,
    "idSale",
  );

  const incompleto =
    veiculos.itens.length !== veiculos.total ||
    vendas.itens.length !== vendas.total;
  log(`veículos: ${veiculos.itens.length} de ${veiculos.total}`);
  log(`vendas  : ${vendas.itens.length} de ${vendas.total}`);
  gravarCsvs(veiculos.itens, vendas.itens);
  return { veiculos, vendas, incompleto };
}
