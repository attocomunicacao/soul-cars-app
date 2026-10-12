/** Regras (sem Electron) para reabrir o app sem aceleração de vídeo quando a GPU quebra. */

export const ARGUMENTO_SEM_GPU = "--sem-gpu";
const MOTIVOS_DE_QUEDA = new Set([
  "crashed",
  "abnormal-exit",
  "launch-failed",
  "integrity-failure",
]);

/** Só uma vez, só por queda de verdade da GPU e nunca enquanto o app está fechando. */
export function pedeReabrirSemGpu(
  tipo: string,
  motivo: string,
  argumentos: string[],
  saindo: boolean,
): boolean {
  return (
    !saindo &&
    tipo === "GPU" &&
    MOTIVOS_DE_QUEDA.has(motivo) &&
    !argumentos.includes(ARGUMENTO_SEM_GPU)
  );
}
