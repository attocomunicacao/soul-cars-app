import type { LinhaVeiculo } from "./balanco";

/**
 * Do mais recente ao mais antigo, pela data e hora da entrada; se empatar, pelo ID do BNDV
 * (maior = cadastrado depois). Assim, carros que entraram no mesmo dia também ficam em ordem.
 */
export function ordenarPorEntrada(linhas: LinhaVeiculo[]): LinhaVeiculo[] {
  return linhas.sort(
    (a, b) =>
      b.registroEm.localeCompare(a.registroEm) || Number(b.id) - Number(a.id),
  );
}
