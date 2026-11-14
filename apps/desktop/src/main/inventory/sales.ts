/**
 * Última venda de cada veículo, lida do `dados/bndv_vendas.csv` que o "Atualizar BNDV" grava.
 *
 * Serve ao lembrete de pausa dos anúncios. O arquivo só muda quando a atualização é feita,
 * então devolvemos também quando ele foi gerado: dado velho não garante o aviso.
 */
import fs from "node:fs";
import * as caminhos from "../core/paths";
import { vendasValidas } from "./canceled-sales";
import { lerCsv } from "./folder-sync";

const lerCsvSeExistir = (arquivo: string) => {
  try {
    return lerCsv(arquivo);
  } catch {
    return [];
  }
};

export type UltimasVendas = {
  /** id do BNDV → data ISO da última venda. */
  vendas: Record<string, string>;
  /** Quando o CSV foi gravado pela última vez (ISO); null se ele não existe. */
  atualizadoEm: string | null;
};

export function ultimasVendas(): UltimasVendas {
  const arquivo = caminhos.CSV_VENDAS();
  let atualizadoEm: string;
  try {
    atualizadoEm = fs.statSync(arquivo).mtime.toISOString();
  } catch {
    return { vendas: {}, atualizadoEm: null };
  }
  const vendas: Record<string, string> = {};
  // Venda cancelada (veículo de volta ao estoque) não pede pausa de anúncio.
  const validas = vendasValidas(
    lerCsvSeExistir(caminhos.CSV_VEICULOS()),
    lerCsv(arquivo),
  );
  for (const linha of validas) {
    const id = String(linha.idVehicle ?? "").trim();
    const data = String(linha.date ?? "").trim();
    if (!id || !data) continue;
    if (!vendas[id] || data > vendas[id]) vendas[id] = data;
  }
  return { vendas, atualizadoEm };
}
