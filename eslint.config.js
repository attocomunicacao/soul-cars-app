import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Regras pensadas para pegar bugs reais (promessas esquecidas, efeitos do React),
// sem brigar com o estilo, que o Prettier já cuida.
const tipado = {
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.node.json", "./tsconfig.web.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
    "@typescript-eslint/await-thenable": "error",
  },
};

export default tseslint.config(
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      ".tmp/**",
      "legado/**",
      "dados-loja/**",
      "engine/**",
      // Editor de criativos: JavaScript próprio, fora do TypeScript.
      "src/renderer/public/**",
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
    files: [
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "src/compartilhado/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
    ...tipado,
  },
  {
    files: ["src/renderer/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    ...tipado,
    rules: {
      ...tipado.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["testes/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["testes/**/*.mjs", "scripts/**/*.{cjs,mjs}", "*.config.{js,ts}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      sourceType: "commonjs",
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["testes/**/*.mjs", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: { sourceType: "module" },
  },
);
