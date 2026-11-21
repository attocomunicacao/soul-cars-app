/**
 * Vendas canceladas no BNDV.
 *
 * Quando uma venda é cancelada, a API de vendas do BNDV continua devolvendo o registro
 * (e o campo `status` da venda vem vazio), mas o VEÍCULO volta para "DISPONÍVEL ESTOQUE".
 * Por isso a fonte da verdade é o status do veículo: veículo ativo e disponível no estoque
 * está no estoque, e as vendas dele contam como canceladas (fora da receita, da margem,
 * das fichas e do lembrete de pausar anúncio). Parte pura, sem Electron.
 */

type Veiculo = { idVehicle?: string; status?: string; active?: string };
type Venda = { idVehicle?: string };

/** "DISPONÍVEL ESTOQUE" → "DISPONIVEL ESTOQUE" (sem acento, maiúsculas). */
const normalizar = (s: string | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/** Veículo ativo que o BNDV mostra como disponível no estoque. */
export const disponivelNoEstoque = (v: Veiculo) =>
  String(v.active ?? "").toLowerCase() === "true" &&
  normalizar(v.status).startsWith("DISPONIVEL");

/** Ids dos veículos cujas vendas registradas foram canceladas (o veículo voltou ao estoque). */
export function veiculosComVendaCancelada(
  veiculos: Veiculo[],
  vendas: Venda[],
): Set<string> {
  const comVenda = new Set(vendas.map((s) => String(s.idVehicle ?? "")));
  return new Set(
    veiculos
      .filter(
        (v) =>
          comVenda.has(String(v.idVehicle ?? "")) && disponivelNoEstoque(v),
      )
      .map((v) => String(v.idVehicle)),
  );
}

/** Só as vendas válidas: tira as dos veículos que voltaram ao estoque (venda cancelada). */
export function vendasValidas<T extends Venda>(
  veiculos: Veiculo[],
  vendas: T[],
): T[] {
  const canceladas = veiculosComVendaCancelada(veiculos, vendas);
  return canceladas.size
    ? vendas.filter((s) => !canceladas.has(String(s.idVehicle ?? "")))
    : vendas;
}
