/**
 * Detecta cópias de conflito criadas pelo Google Drive quando dois computadores gravam o mesmo
 * arquivo ao mesmo tempo (ex.: `1 (1).jpg` ao lado de `1.jpg`). Regra pura, sem Electron.
 */

const COPIA = /^(.+) \((\d+)\)(\.[^.]+)?$/;

/**
 * Nomes que parecem cópia de conflito: terminam em ` (N)` e o arquivo original (sem o sufixo)
 * também está na lista. Sem o original, `foto (1).jpg` é só um nome comum e não é apontado.
 */
export function copiasDeConflito(nomes: string[]): string[] {
  const existentes = new Set(nomes.map((n) => n.toLowerCase()));
  return nomes.filter((nome) => {
    const m = COPIA.exec(nome);
    if (!m) return false;
    return existentes.has(`${m[1]}${m[3] ?? ""}`.toLowerCase());
  });
}
