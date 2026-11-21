/**
 * Comando que executa o instalador do Launcher depois que o Launcher fecha.
 *
 * O instalador (NSIS) só consegue substituir os arquivos com o Launcher fechado, então o `cmd`
 * espera ~3 s e inicia o instalador. O caminho do instalador NÃO é colocado na string do
 * comando: vai por variável de ambiente e é lido com expansão atrasada (`!VAR!`), que acontece
 * depois da análise do `cmd`. Assim `%`, `&` e `^` no caminho (nome de usuário do Windows com
 * esses caracteres) não quebram nem alteram o comando.
 */

/** Variável de ambiente que leva o caminho do instalador. */
export const VARIAVEL_INSTALADOR = "SOUL_SETUP";

export type ComandoDeAtualizacao = {
  comando: string;
  args: string[];
  env: NodeJS.ProcessEnv;
};

/** Monta o comando; recusa caminhos com `!` ou aspas, que a expansão atrasada não suporta. */
export function comandoDeAtualizacao(
  instalador: string,
  ambiente: NodeJS.ProcessEnv = process.env,
): ComandoDeAtualizacao {
  if (/[!"]/.test(instalador))
    throw new Error(
      "O caminho da pasta de downloads tem '!' ou aspas, que impedem a atualização automática. Instale a nova versão do Launcher manualmente.",
    );
  return {
    comando: ambiente.ComSpec ?? "cmd.exe",
    args: [
      "/d",
      "/v:on",
      "/c",
      // /S = silencioso (NSIS one-click); --force-run reabre o Launcher ao terminar.
      `ping -n 4 127.0.0.1 >nul & start "" "!${VARIAVEL_INSTALADOR}!" /S --updated --force-run`,
    ],
    env: { ...ambiente, [VARIAVEL_INSTALADOR]: instalador },
  };
}
