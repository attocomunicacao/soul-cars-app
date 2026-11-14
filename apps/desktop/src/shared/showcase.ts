/**
 * Formato do cartão da vitrine (estoque atual no BNDV) e a regra que liga um cartão à
 * ficha do Studio. Regras puras, usadas pelo main e pela interface.
 */
/** Cartão do estoque atual (main e interface usam o mesmo formato). */
export type CartaoVitrine = {
  idBndv: string;
  marca: string;
  modelo: string;
  placa: string;
  /** Preço de tabela no BNDV (0 quando ainda não foi definido). */
  tabela: number;
  consignado: boolean;
  /** Dias desde a entrada no estoque. */
  dias: number | null;
  entrada: string;
  pasta: string | null;
  /** Foto reduzida (data URL) ou null. */
  foto: string | null;
  /** Detalhes mostrados: da ficha do Studio quando preenchida, senão do BNDV; null se nenhum tem. */
  detalhes: {
    km: number | null;
    cor: string | null;
    cambio: string | null;
    combustivel: string | null;
    ano: string | null;
    versao: string | null;
  };
  /** Ficha do Studio ligada ao veículo (para o botão Abrir no Studio), quando existe. */
  estudio: { id: number } | null;
};

/** Dados mínimos de uma ficha para achar o cartão do BNDV correspondente. */
export type FichaParaCartao = {
  id: number;
  pasta?: string | null;
  placa?: string | null;
};

/**
 * Acha o cartão da vitrine que corresponde a uma ficha: pela pasta, pelo id da ficha
 * ligada ou pela placa (sem diferenciar maiúsculas). Devolve undefined se nenhum casar.
 */
export function cartaoDaFicha(
  cartoes: readonly CartaoVitrine[],
  ficha: FichaParaCartao,
): CartaoVitrine | undefined {
  const placa = (ficha.placa ?? "").trim().toUpperCase();
  return cartoes.find(
    (c) =>
      (!!ficha.pasta && c.pasta === ficha.pasta) ||
      c.estudio?.id === ficha.id ||
      (!!placa && !!c.placa && c.placa.toUpperCase() === placa),
  );
}
