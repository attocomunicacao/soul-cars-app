/**
 * Ajustes do editor de criativos guardados no veículo (`veiculos.ajustes`, um JSON em texto).
 *
 * Lê esse texto sem derrubar o editor: um valor corrompido (edição manual, gravação
 * interrompida) vira "sem ajustes" e a tela avisa, em vez de impedir que as fotos carreguem.
 */

export type AjustesLidos = {
  /** Objeto dos ajustes, ou null quando não há ajustes ou o texto estava corrompido. */
  ajustes: unknown;
  /** true se havia texto, mas ele não era um JSON de objeto válido. */
  corrompido: boolean;
};

/** Converte o texto guardado em ajustes; nunca lança erro. */
export function lerAjustes(texto: string | null | undefined): AjustesLidos {
  if (!texto) return { ajustes: null, corrompido: false };
  try {
    const valor: unknown = JSON.parse(texto);
    if (valor !== null && typeof valor === "object" && !Array.isArray(valor))
      return { ajustes: valor, corrompido: false };
  } catch {
    /* cai no retorno de corrompido */
  }
  return { ajustes: null, corrompido: true };
}
