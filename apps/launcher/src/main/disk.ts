/**
 * `fs` para mexer nas pastas dos apps instalados.
 *
 * Dentro do Electron, o `node:fs` trata arquivos `.asar` como pastas: só de conferir se
 * `resources/app.asar` existe, o Electron abre o arquivo e o mantém aberto no processo do
 * Launcher. Com esse arquivo preso, o Windows recusa renomear ou apagar a pasta da versão
 * (EPERM em `<versão>.extraindo`, versão 1.0.10). O `original-fs` do Electron é o `fs` puro,
 * sem esse tratamento. Fora do Electron (testes), usa o `node:fs` normal.
 */
import { createRequire } from "node:module";
import path from "node:path";
import type nodeFs from "node:fs";

const requerer = createRequire(import.meta.url);

/** `fs` sem suporte a `.asar` (original-fs no Electron, node:fs nos testes). */
export const fsSemAsar: typeof nodeFs = process.versions.electron
  ? (requerer("original-fs") as typeof nodeFs)
  : (requerer("node:fs") as typeof nodeFs);

/**
 * Bytes livres no disco que contém `pasta` (sobe até o primeiro ancestral que existe).
 * Devolve null se não der para saber: nesse caso a instalação segue sem a checagem.
 */
export function espacoLivre(pasta: string): number | null {
  let atual = path.resolve(pasta);
  for (;;) {
    try {
      const s = fsSemAsar.statfsSync(atual);
      return Number(s.bavail) * Number(s.bsize);
    } catch {
      const pai = path.dirname(atual);
      if (pai === atual) return null;
      atual = pai;
    }
  }
}

/** Falha com uma mensagem clara se o disco de `pasta` tem menos de `bytes` livres. */
export function exigirEspaco(
  pasta: string,
  bytes: number,
  livre: number | null = espacoLivre(pasta),
): void {
  if (livre === null || livre >= bytes) return;
  const mb = (n: number) => Math.ceil(n / 1_048_576);
  throw new Error(
    `Falta espaço no disco: a instalação precisa de cerca de ${mb(bytes)} MB livres e há ${mb(livre)} MB. Libere espaço e tente de novo.`,
  );
}

/**
 * Renomeia a pasta extraída para a definitiva. O antivírus costuma analisar o executável
 * recém-copiado e segurá-lo por alguns segundos: tenta de novo por até ~15 s antes de falhar.
 */
export async function renomearComPaciencia(
  de: string,
  para: string,
  tentativas = 30,
  espera = 500,
): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      fsSemAsar.renameSync(de, para);
      return;
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException).code;
      if (!["EPERM", "EBUSY", "EACCES"].includes(codigo ?? "")) throw erro;
      if (i >= tentativas)
        throw new Error(
          `O Windows não deixou terminar a instalação (${codigo}): algum programa está usando a pasta ${de}. Aguarde alguns segundos e clique em Atualizar de novo.`,
          { cause: erro },
        );
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}
