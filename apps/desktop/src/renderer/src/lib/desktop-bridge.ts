/**
 * Fachada da ponte `window.soul` (preload): invoke, listen, diálogos (abrir/salvar/perguntar)
 * e atalhos do sistema (abrir pasta, abrir link). Único ponto de contato da interface com o main.
 */
import type { SoulApi } from "../types";
declare global {
  interface Window {
    soul: SoulApi;
  }
}
export async function invoke<T = unknown>(
  command: string,
  args: unknown = {},
  options?: { headers?: Record<string, string> },
): Promise<T> {
  const binary = args instanceof Uint8Array;
  const result = await window.soul.invocar<unknown>(
    command,
    binary ? {} : args,
    options?.headers,
    binary ? args : null,
  );
  if (result instanceof Uint8Array) return result.slice().buffer as T;
  return result as T;
}
export const ask = async (message: string, _options?: unknown) =>
  window.confirm(message);
type Options = {
  directory?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  multiple?: boolean;
};
export const open = (options: Options = {}) =>
  invoke<string | string[] | null>("dialog", { ...options, mode: "open" });
export const save = (options: Options = {}) =>
  invoke<string | null>("dialog", { ...options, mode: "save" });
export const revealItemInDir = (path: string) => invoke("reveal", { path });
export const openPath = (path: string) => invoke("open_path", { path });
export const openUrl = (url: string) => invoke("open_url", { url });
export const appDataDir = () => invoke<string>("app_data");
export const getVersion = async () => window.soul.versoes.app;
export const getTauriVersion = async () => window.soul.versoes.electron;
export async function listen<T>(
  name: string,
  callback: (event: { payload: T }) => void,
) {
  return window.soul.ouvir<T>(name, (payload) => callback({ payload }));
}
