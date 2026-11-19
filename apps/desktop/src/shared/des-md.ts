/**
 * Leitura mínima do DES.md do veículo para o Pré-atendimento IA: só a quilometragem e o valor de
 * venda (seções "## QUILOMETRAGEM" e "## VALOR"). Regra pura, sem disco nem Electron; o formato do
 * DES.md está em `tests/fixtures/DES.md` e não é alterado aqui.
 */

/** Conteúdo da seção `## TÍTULO` (até a linha em branco, outra seção ou `---`). */
function secao(texto: string, titulo: string): string {
  const m = texto
    .replace(/\r\n?/g, "\n")
    .match(
      new RegExp(`^## ${titulo}\\n([\\s\\S]*?)(?=\\n\\n|\\n## |\\n---|$)`, "m"),
    );
  return m?.[1].trim() ?? "";
}

/** "R$48.900,00" → "48.900"; "84.000" → "84.000"; vazio ou "não informado" → "". */
function numeroBr(bruto: string): string {
  const limpo = bruto.replace(/R\$|km/gi, "").trim();
  if (!/\d/.test(limpo)) return "";
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";
  return Math.round(n).toLocaleString("pt-BR");
}

/** Quilometragem e valor de venda do DES.md (texto já formatado em pt-BR, ou "" se faltar). */
export function lerKmEValor(texto: string): { km: string; valor: string } {
  return {
    km: numeroBr(secao(texto, "QUILOMETRAGEM")),
    valor: numeroBr(secao(texto, "VALOR")),
  };
}
