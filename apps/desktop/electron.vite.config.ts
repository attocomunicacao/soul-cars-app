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
    plugins: [react()],
    build: {
      rollupOptions: { input: { index: resolve("src/renderer/index.html") } },
    },
  },
});
