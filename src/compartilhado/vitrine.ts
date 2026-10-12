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
  /** Dados da ficha do Studio, quando existe. */
  estudio: {
    id: number;
    versao: string | null;
    ano: string | null;
    km: number | null;
    cor: string | null;
    cambio: string | null;
    combustivel: string | null;
  } | null;
};
