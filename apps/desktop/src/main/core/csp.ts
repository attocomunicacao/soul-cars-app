/**
 * Política de segurança de conteúdo (CSP) da janela principal.
 *
 * A janela principal é a que tem a ponte para o disco, o banco e os processos. A política garante que
 * ela só carrega e executa o que é do próprio app: nada de script, estilo remoto, imagem, fonte,
 * conexão ou frame vindo da internet, e nada de plugins. Como o app carrega por `file://`, a política
 * vai numa `<meta http-equiv>` no `index.html` (o build injeta; veja `electron.vite.config.ts`).
 *
 * O relatório completo roda num iframe `srcDoc`, que HERDA esta política e tem dois scripts inline:
 * o que avisa a altura (`report-script.ts`) e o da própria página, com busca, ordenação e navegação
 * entre meses (`report-page-script.ts`). Cada um é liberado por hash SHA-256, em vez de abrir
 * `'unsafe-inline'`.
 *
 * Sem Electron: só `node:crypto`, para poder ser usado pelo build e testado.
 */
import { createHash } from "node:crypto";
import { SCRIPT_DA_PAGINA_DO_RELATORIO } from "../../shared/report-page-script";
import { CORPO_DO_SCRIPT_DE_ALTURA } from "../../shared/report-script";

/** Fonte de hash para a CSP: `'sha256-<base64>'` do texto exato do script. */
export function hashDoScript(corpo: string): string {
  return `'sha256-${createHash("sha256").update(corpo, "utf8").digest("base64")}'`;
}

/** A política, como texto de uma `<meta http-equiv="Content-Security-Policy">`. */
export function politicaDoRenderer(): string {
  return [
    "default-src 'self'",
    // Só o app e os dois scripts do relatório (por hash). Sem 'unsafe-inline' nem 'unsafe-eval'.
    `script-src 'self' ${hashDoScript(CORPO_DO_SCRIPT_DE_ALTURA)} ${hashDoScript(SCRIPT_DA_PAGINA_DO_RELATORIO)}`,
    // O React usa o atributo `style` em vários componentes, o que exige 'unsafe-inline' em estilos.
    "style-src 'self' 'unsafe-inline'",
    // Fotos chegam como data: (miniaturas do main) e blob: (arquivos escolhidos pelo usuário).
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    "connect-src 'self' data: blob:",
    "frame-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
