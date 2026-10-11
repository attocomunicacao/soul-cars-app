/**
 * A ponte entre a interface e o processo principal.
 *
 * Este é o único lugar por onde a parte HTML alcança o computador, e ele não
 * expõe nada além de `invocar` e `ouvir`. Nenhum módulo do Node vaza para a
 * janela — é o que impede uma página de escrever em disco por conta própria.
 */
import { contextBridge, ipcRenderer } from "electron";

export type Cabecalhos = Record<string, string>;

const api = {
  /**
   * Pede um comando ao processo principal (a lista está em `src/main/ipc.ts`).
   *
   * `corpo` é para arquivos: a foto ou o criativo vão como bytes, e os dados
   * curtos que acompanham (nome, slot) vão em `cabecalhos`.
   */
  invocar<T = unknown>(
    comando: string,
    args: unknown = {},
    cabecalhos: Cabecalhos = {},
    corpo: Uint8Array | null = null,
  ) {
    return ipcRenderer.invoke(
      "soul:invoke",
      comando,
      args,
      cabecalhos,
      corpo,
    ) as Promise<T>;
  },

  /** Escuta um evento do processo principal. Devolve a função que desliga. */
  ouvir<T = unknown>(nome: string, retorno: (carga: T) => void) {
    const ouvinte = (_e: unknown, pacote: { nome: string; carga: T }) => {
      if (pacote?.nome === nome) retorno(pacote.carga);
    };
    ipcRenderer.on("soul:evento", ouvinte);
    return () => {
      ipcRenderer.off("soul:evento", ouvinte);
    };
  },

  versoes: {
    app:
      process.argv.find((a) => a.startsWith("--soul-versao="))?.slice(14) ??
      "desconhecida",
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
};

contextBridge.exposeInMainWorld("soul", api);

export type SoulApi = typeof api;
