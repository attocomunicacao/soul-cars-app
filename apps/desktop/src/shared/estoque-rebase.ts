/**
 * Troca da pasta ESTOQUE de lugar sem perder o vínculo dos veículos.
 *
 * O banco guarda o caminho absoluto da pasta de cada veículo (`<ESTOQUE>\<idBNDV>_MARCA_MODELO_PLACA`).
 * Ao vincular o ESTOQUE ao Google Drive (ou quando o Drive monta em outra letra de unidade),
 * o prefixo muda, mas o último trecho (o nome da pasta, que começa pelo ID do BNDV) é o mesmo.
 * Regra pura, sem Electron.
 */
import path from "node:path";

/**
 * Devolve o caminho da pasta do veículo sob a nova raiz do ESTOQUE, mantendo só o último trecho.
 * Devolve `null` se o caminho estiver vazio ou for a própria raiz de um disco.
 */
export function rebasearCaminhoEstoque(
  caminho: string,
  novaRaiz: string,
): string | null {
  const nome = caminho
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop();
  if (!nome || /^[A-Za-z]:$/.test(nome)) return null;
  return path.win32.join(novaRaiz, nome);
}

/** Compara caminhos do Windows sem diferenciar maiúsculas nem o tipo de barra. */
export function mesmoCaminho(a: string, b: string): boolean {
  const normaliza = (p: string) =>
    path.win32
      .normalize(p)
      .replace(/[\\/]+$/, "")
      .toLowerCase();
  return normaliza(a) === normaliza(b);
}
