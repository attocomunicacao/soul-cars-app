/**
 * Estilo de impressão (A4) do relatório completo. Sem Electron, para poder ser testado.
 *
 * O HTML do relatório é uma página de tela (cartões, filtros, setas de mês). Para o PDF ele ganha,
 * no fim, regras `@media print`: página A4 com margens, cartões e gráficos sem quebrar no meio,
 * tabela grande quebrando entre as linhas (com o cabeçalho repetido a cada página), sem botões e filtros.
 */

export const ESTILO_IMPRESSAO = `<style>
@page { size: A4; margin: 12mm 9mm 16mm; }
@media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #fff !important; }
  body { padding: 0 !important; font-size: 11.5px; line-height: 1.45; }
  .w { max-width: none !important; }
  h1 { font-size: 20px; }
  .sub { margin-bottom: 14px; }
  .cards { grid-template-columns: repeat(4, 1fr) !important; gap: 8px; margin-bottom: 12px; }
  .card { padding: 10px 12px; border-radius: 8px; }
  .card b { font-size: 15px; }
  .cols, .cols3 { grid-template-columns: 1fr 1fr !important; gap: 10px; }
  section { border-radius: 8px; margin-bottom: 10px; break-inside: avoid; }
  section:has(#tb) { break-inside: auto; }
  h2 { padding: 8px 12px; break-after: avoid; }
  .alerta, .nota { break-inside: avoid; }
  .hbs { padding: 10px 12px; }
  .hb { margin-bottom: 5px; font-size: 11px; }
  .gr { padding: 8px 6px 0; }
  table { font-size: 10px; }
  td, th { padding: 4px 7px; }
  th { position: static !important; cursor: default; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  tbody tr:hover { background: none; }
  .rol { max-height: none !important; overflow: visible !important; }
  .busca, .mes-navegacao button { display: none !important; }
  .mes-navegacao { justify-content: center; }
  .rod { font-size: 10px; margin-top: 12px; break-inside: avoid; }
}
</style>`;

/** Acrescenta o estilo de impressão ao HTML do relatório (no fim, para vencer as regras da tela). */
export function comEstiloDeImpressao(html: string): string {
  return html + "\n" + ESTILO_IMPRESSAO;
}

/** Nome sugerido para o arquivo: Relatorio-SOUL-Cars-AAAA-MM-DD.pdf (data local). */
export function nomeDoPdf(hoje = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `Relatorio-SOUL-Cars-${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}.pdf`;
}

/** Rodapé de cada página (o Chromium preenche o número e o total). */
export const RODAPE_PDF = `<div style="font-size:8px;width:100%;text-align:center;color:#8a8478;font-family:'Segoe UI',sans-serif">SOUL Cars · Relatório de veículos · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`;
