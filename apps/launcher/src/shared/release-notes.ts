/**
 * Notas da versão no Launcher (regras puras, testadas em tests/release-notes.test.ts).
 *
 * As notas vêm do CHANGELOG.md, escrito em Markdown. O Launcher não usa innerHTML: cada
 * linha vira uma lista de trechos (texto comum, **negrito** ou `código`) que a interface
 * transforma em elementos do DOM, sem risco de injetar HTML.
 */

/** Um pedaço de uma linha das notas, com o estilo a aplicar. */
export type Trecho = { texto: string; estilo: "normal" | "negrito" | "codigo" };

/** Linhas da lista de novidades: sem o marcador "- " / "* " e sem linhas vazias. */
export function linhasDasNotas(notas: string): string[] {
  return notas
    .split("\n")
    .map((l) => l.replace(/^\s*[-*+]\s+/, "").trim())
    .filter(Boolean);
}

/**
 * Divide uma linha em trechos: `**texto**` (ou `__texto__`) vira negrito, `` `texto` `` vira
 * código e links `[rótulo](url)` ficam só com o rótulo. Marcação sem par fica como texto.
 */
export function trechosDaLinha(linha: string): Trecho[] {
  const semLinks = linha.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const trechos: Trecho[] = [];
  const padrao = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`/g;
  let inicio = 0;
  for (const m of semLinks.matchAll(padrao)) {
    if (m.index > inicio)
      trechos.push({
        texto: semLinks.slice(inicio, m.index),
        estilo: "normal",
      });
    if (m[3] !== undefined) trechos.push({ texto: m[3], estilo: "codigo" });
    else trechos.push({ texto: m[1] ?? m[2], estilo: "negrito" });
    inicio = m.index + m[0].length;
  }
  if (inicio < semLinks.length)
    trechos.push({ texto: semLinks.slice(inicio), estilo: "normal" });
  return trechos;
}
