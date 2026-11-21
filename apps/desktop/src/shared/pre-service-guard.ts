/**
 * Guarda de saída do Pré-atendimento IA (puro, sem Electron): impede texto duplicado e "sujo" antes
 * de a mensagem chegar ao cliente. Remove frases repetidas dentro da própria resposta, frases já ditas
 * nas últimas respostas da IA (igualdade e quase-igualdade), palavras coladas em dobro, pontuação
 * repetida e espaços sobrando; também detecta CPF em claro. Usado pelo pipeline, pela aprovação de
 * rascunhos, pela auditoria e pelo Laboratório.
 */
import { cpfValido } from "./lead-profile";

/** Quantas respostas anteriores da IA entram na comparação. */
export const JANELA_REPETICAO = 5;
/** Semelhança (0-1) a partir da qual duas frases/respostas contam como a mesma. */
export const LIMIAR_QUASE_IGUAL = 0.85;
/** Frases curtas ("Certo!", "Combinado") podem repetir sem problema: só compara frases com tokens suficientes. */
const MIN_TOKENS_FRASE = 5;

/** Minúsculas, sem acento e sem pontuação de milhar, igual ao `normalizar` do módulo principal. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d)\.(\d{3})/g, "$1$2");

/** Palavras normalizadas (o conjunto usado nas comparações). */
export const tokens = (s: string): string[] =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 || /^\d$/.test(t));

/** Semelhança de Jaccard entre os conjuntos de palavras de dois textos (1 = mesmas palavras). */
export function similaridade(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size && !B.size) return 1;
  let comum = 0;
  for (const t of A) if (B.has(t)) comum++;
  const uniao = A.size + B.size - comum;
  return uniao ? comum / uniao : 0;
}

/** Divide em frases mantendo a pontuação; linhas de lista ("- ...") ficam inteiras e intactas. */
export function dividirFrases(texto: string): string[] {
  const saida: string[] = [];
  for (const linha of texto.split(/\n/)) {
    if (/^\s*[-•*]\s/.test(linha) || !linha.trim()) {
      saida.push(linha);
      continue;
    }
    // Só divide em pontuação seguida de espaço: "84.000 km" e "R$ 79.900" não se partem.
    for (const p of linha.split(/(?<=[.!?])\s+/))
      if (p.trim()) saida.push(p.trim());
  }
  return saida;
}

const ehLista = (f: string) => /^\s*[-•*]\s/.test(f);
const ehVazia = (f: string) => !f.trim();

/** Remonta as frases respeitando quebras de linha (frases da mesma linha ficam separadas por espaço). */
function juntar(frases: { texto: string; linha: number }[]): string {
  const porLinha = new Map<number, string[]>();
  for (const f of frases) {
    const l = porLinha.get(f.linha) ?? [];
    l.push(f.texto);
    porLinha.set(f.linha, l);
  }
  return [...porLinha.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, l]) => l.join(" "))
    .join("\n");
}

/** Divide em frases guardando de qual linha cada uma veio. */
function frasesPorLinha(texto: string) {
  const r: { texto: string; linha: number }[] = [];
  texto.split(/\n/).forEach((linha, i) => {
    for (const f of dividirFrases(linha)) r.push({ texto: f, linha: i });
  });
  return r;
}

/** Há frase (fora de listas) que aparece duas vezes no mesmo texto? */
export function temFraseDuplicada(texto: string): boolean {
  const vistas = new Set<string>();
  for (const f of frasesPorLinha(texto)) {
    if (ehLista(f.texto) || ehVazia(f.texto)) continue;
    const chave = tokens(f.texto).join(" ");
    if (!chave) continue;
    if (vistas.has(chave)) return true;
    vistas.add(chave);
  }
  return false;
}

/** Remove frases que se repetem dentro da mesma resposta (igualdade normalizada), mantendo a primeira. */
export function deduplicarFrases(texto: string): string {
  const vistas = new Set<string>();
  const mantidas = frasesPorLinha(texto).filter((f) => {
    if (ehLista(f.texto) || ehVazia(f.texto)) return true;
    const chave = tokens(f.texto).join(" ");
    if (!chave) return true;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
  return juntar(mantidas);
}

/**
 * Remove frases (com tokens suficientes) que já apareceram, iguais ou quase iguais, nas últimas
 * respostas da IA. O que sobra é só informação nova. Pode devolver "" se nada de novo restou.
 */
export function removerJaDito(
  texto: string,
  anteriores: string[],
  janela = JANELA_REPETICAO,
): string {
  const ditas = anteriores
    .slice(-janela)
    .flatMap((t) => dividirFrases(t))
    .filter((f) => !ehLista(f) && tokens(f).length >= MIN_TOKENS_FRASE);
  if (!ditas.length) return texto;
  const mantidas = frasesPorLinha(texto).filter((f) => {
    if (ehLista(f.texto) || ehVazia(f.texto)) return true;
    if (tokens(f.texto).length < MIN_TOKENS_FRASE) return true;
    return !ditas.some((d) => similaridade(d, f.texto) >= LIMIAR_QUASE_IGUAL);
  });
  return juntar(mantidas).trim();
}

/** Palavras que podem aparecer em dobro de propósito ("bem bem", "muito muito"). */
const DOBRO_PERMITIDO = new Set(["bem", "muito", "pouco", "ha", "kk", "rs"]);

/** Palavra repetida em seguida ("de de", "o o"): devolve a palavra, ou null. */
export function palavraRepetida(texto: string): string | null {
  const re = /(^|[^\p{L}\d])(\p{L}{1,})\s+\2(?![\p{L}\d])/giu;
  for (const m of texto.matchAll(re)) {
    const p = norm(m[2]);
    if (!DOBRO_PERMITIDO.has(p)) return m[2];
  }
  return null;
}

/** CPF válido escrito por extenso no texto (com ou sem máscara): a IA nunca deve ecoar o CPF do cliente. */
export function cpfEmClaro(texto: string): boolean {
  for (const m of texto.matchAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g))
    if (cpfValido(m[0].replace(/\D/g, ""))) return true;
  return false;
}

/** Arruma espaços, pontuação em dobro e palavra repetida; não mexe no conteúdo das frases. */
export function limpar(texto: string): string {
  let t = texto.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  t = t.replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  t = t.replace(/ +([,.!?;:])/g, "$1");
  t = t.replace(/([!?]){2,}/g, "$1").replace(/(?<!\.)\.\.(?!\.)/g, ".");
  t = t.replace(/,{2,}/g, ",");
  t = t.replace(/(^|[^\p{L}\d])(\p{L}{1,})\s+\2(?![\p{L}\d])/giu, (m, a, w) =>
    DOBRO_PERMITIDO.has(norm(w)) ? m : `${a}${w}`,
  );
  return t.trim();
}

/** Passa o texto do modelo por todas as limpezas, na ordem certa. */
export function guardarTexto(texto: string, anteriores: string[]): string {
  return limpar(removerJaDito(deduplicarFrases(texto), anteriores));
}

/** A resposta nova repete uma das últimas respostas da IA (igual ou quase)? */
export function respostaRepetida(
  texto: string,
  anteriores: string[],
  janela = JANELA_REPETICAO,
): boolean {
  if (!tokens(texto).length) return false;
  return anteriores
    .slice(-janela)
    .some((a) => similaridade(a, texto) >= LIMIAR_QUASE_IGUAL);
}

export type Achado =
  | "frase-duplicada"
  | "quase-repetida"
  | "palavra-repetida"
  | "cpf-em-claro"
  | "texto-sujo";

/** Problemas que ainda restam num texto final (a auditoria e o Laboratório mostram como alerta). */
export function achados(texto: string, anteriores: string[] = []): Achado[] {
  const r: Achado[] = [];
  if (temFraseDuplicada(texto)) r.push("frase-duplicada");
  if (respostaRepetida(texto, anteriores)) r.push("quase-repetida");
  if (palavraRepetida(texto)) r.push("palavra-repetida");
  if (cpfEmClaro(texto)) r.push("cpf-em-claro");
  if (/ {2,}|\n{3,}|[!?]{2,}|\s[,.!?]/.test(texto)) r.push("texto-sujo");
  return r;
}
