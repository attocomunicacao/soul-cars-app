/**
 * Regra do foco circular em diálogos: com Tab no último item o foco volta ao primeiro, e com
 * Shift+Tab no primeiro vai ao último. Fica fora do componente para ser testada sem navegador.
 */

/**
 * Índice do item que deve receber o foco, ou null se o navegador pode seguir normalmente.
 * `atual` é o índice do item focado (-1 se o foco está fora do diálogo).
 */
export function proximoIndiceDeFoco(
  total: number,
  atual: number,
  voltar: boolean,
): number | null {
  if (total <= 0) return null;
  if (atual < 0) return voltar ? total - 1 : 0;
  if (voltar && atual === 0) return total - 1;
  if (!voltar && atual === total - 1) return 0;
  return null;
}
