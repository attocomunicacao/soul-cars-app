/**
 * Build do app desktop (electron-vite).
 *
 * Três builds separados: processo principal (Node), preload (ponte em sandbox)
 * e renderer (interface React). `npm run dev` roda os três em paralelo, com
 * recarregamento automático; `npm run build` grava tudo em `out/`.
 */
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { politicaDoRenderer } from "./src/main/core/csp";

/**
 * Injeta a política de segurança de conteúdo no `index.html` do renderer, só no build de produção.
 * No `npm run dev` o servidor do Vite usa scripts inline para o recarregamento automático, e a
 * política os barraria. A política está em `src/main/core/csp.ts`.
 */
function cspDoRenderer(): Plugin {
  return {
    name: "soul-csp",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${politicaDoRenderer()}">`;
      // Depois do <meta charset>, que precisa estar nos primeiros 1024 bytes do arquivo.
      return /<meta charset[^>]*>/i.test(html)
        ? html.replace(/<meta charset[^>]*>/i, (m) => m + meta)
        : html.replace(/<head>/i, (m) => m + meta);
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve("src/main/index.ts") } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Preload em sandbox só aceita CommonJS.
      rollupOptions: {
        input: { index: resolve("src/preload/index.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: { "@": resolve("src/renderer/src") },
    },
    plugins: [react(), cspDoRenderer()],
    build: {
      // O padrão do electron-vite é não minificar; minificar encolhe o bundle em mais da metade.
      minify: "esbuild",
      rollupOptions: { input: { index: resolve("src/renderer/index.html") } },
    },
  },
});
