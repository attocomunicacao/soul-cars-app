/**
 * Tipos compartilhados da interface: balanço (Balanco) e a API da ponte `window.soul` (SoulApi).
 */
export type Contas = Record<string, Record<string, number>>;
export type Balanco = {
  contas: Contas;
  ativo: number;
  passivo: number;
  acumulados: number;
  bndv: {
    estoqueN: number;
    estoqueCusto: number;
    receita: number;
    margem: number;
  } | null;
};
export type SoulApi = {
  invocar<T = unknown>(
    comando: string,
    args?: unknown,
    cabecalhos?: Record<string, string>,
    corpo?: Uint8Array | null,
  ): Promise<T>;
  ouvir<T = unknown>(nome: string, retorno: (carga: T) => void): () => void;
  versoes: { app: string; electron: string; chrome: string; node: string };
};
