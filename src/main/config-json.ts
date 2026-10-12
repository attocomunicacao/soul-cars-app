/** Leitura tolerante do config.json (sem Electron, para poder ser testada). */

/**
 * Converte o texto do config.json em objeto. Aceita o BOM do UTF-8 (que o Bloco de Notas e o
 * PowerShell do Windows gravam). Devolve `null` se o texto não for um objeto JSON.
 */
export function lerConfigJson(texto: string): Record<string, unknown> | null {
  try {
    const dados: unknown = JSON.parse(texto.replace(/^\uFEFF/, ""));
    return typeof dados === "object" && dados !== null && !Array.isArray(dados)
      ? (dados as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
