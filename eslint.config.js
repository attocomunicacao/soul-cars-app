/**
 * ESLint do monorepo (apps/desktop e apps/launcher).
 *
 * Regras pensadas para pegar bugs reais (promessas esquecidas, efeitos do React),
 * sem brigar com o estilo, que o Prettier já cuida. Rode com `npm run lint`.
 */
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/** Regras que exigem informação de tipos (cada app aponta para os seus tsconfig). */
const tipado = (projetos) => ({
  languageOptions: {
    parserOptions: { project: projetos, tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
    "@typescript-eslint/await-thenable": "error",
  },
});
const DESKTOP = tipado([
  "./apps/desktop/tsconfig.node.json",
  "./apps/desktop/tsconfig.web.json",
]);
const LAUNCHER = tipado([
  "./apps/launcher/tsconfig.node.json",
  "./apps/launcher/tsconfig.web.json",
]);

export default tseslint.config(
  {
    ignores: [
      "**/out/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/.tmp/**",
      ".restructure/**",
      "legado/**",
      "dados-loja/**",
      "apps/engine/**",
      // Editor de criativos: JavaScript próprio, fora do TypeScript.
      "apps/desktop/src/renderer/public/**",
      "website/**",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Variáveis com "_" são ignoradas de propósito (argumentos obrigatórios não usados).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      // O IPC e o motor trocam dados sem forma fixa; os esquemas validam na entrada.
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["apps/desktop/src/{main,preload,shared}/**/*.ts"],
    languageOptions: { globals: globals.node },
    ...DESKTOP,
  },
  {
    files: ["apps/desktop/src/renderer/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    ...DESKTOP,
    rules: {
      ...DESKTOP.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/launcher/src/{main,preload,shared}/**/*.ts"],
    languageOptions: { globals: globals.node },
    ...LAUNCHER,
  },
  {
    files: ["apps/launcher/src/renderer/src/**/*.ts"],
    languageOptions: { globals: globals.browser },
    ...LAUNCHER,
  },
  {
    files: ["apps/*/tests/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      "apps/*/tests/**/*.mjs",
      "apps/*/scripts/**/*.{cjs,mjs}",
      "scripts/**/*.{cjs,mjs}",
      "**/*.config.{js,ts}",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      sourceType: "commonjs",
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["apps/*/tests/**/*.mjs", "scripts/**/*.mjs", "**/*.config.js"],
    languageOptions: { sourceType: "module" },
  },
);
