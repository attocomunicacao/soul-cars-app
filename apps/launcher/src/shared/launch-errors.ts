/**
 * Mensagens quando um app não abre (regras puras, testadas em tests/launch.test.ts).
 *
 * O caso mais comum no Windows 11 é o Smart App Control: ele só deixa rodar programas
 * com assinatura digital ou já conhecidos pela Microsoft, e o Soul Cars ainda não é
 * assinado. O bloqueio é intermitente (depende da reputação do arquivo na nuvem), então
 * o Launcher confirma pelo registro de segurança do Windows antes de culpá-lo.
 */

/** Marcador que a interface usa para mostrar o botão "Como liberar". */
export const MARCA_SMART_APP_CONTROL = "Smart App Control";

/** Página de ajuda (no repositório) sobre o bloqueio. */
export const AJUDA_SMART_APP_CONTROL =
  "https://github.com/attocomunicacao/soul-cars-app/blob/main/docs/guides/smart-app-control.md";

/** O que se sabe da tentativa de abrir o app. */
export type FalhaAoAbrir =
  /** O Windows recusou criar o processo (evento "error" do spawn). */
  | { tipo: "nao-iniciou"; codigo?: string; errno?: number; mensagem: string }
  /** O processo começou mas terminou logo em seguida. */
  | { tipo: "fechou-logo"; codigoSaida: number | null; ms: number };

/**
 * Só números específicos de bloqueio por política contam (ERROR_APPLICATION_CONTROL_BLOCKED,
 * 4551, e STATUS_INVALID_IMAGE_HASH, 0xC0000428). Códigos genéricos como EACCES ou UNKNOWN
 * não bastam: aí o Launcher confirma pelo registro de segurança do Windows.
 */
const NUMEROS_DE_BLOQUEIO = [4551, 0xc0000428];

/** Indícios de bloqueio só pelo erro (sem consultar o registro do Windows). */
export function pareceBloqueio(falha: FalhaAoAbrir): boolean {
  if (falha.tipo === "fechou-logo")
    return (
      falha.codigoSaida !== null &&
      NUMEROS_DE_BLOQUEIO.includes(falha.codigoSaida >>> 0)
    );
  if (
    falha.errno !== undefined &&
    NUMEROS_DE_BLOQUEIO.includes(Math.abs(falha.errno))
  )
    return true;
  return /\b4551\b|application control|code integrity/i.test(falha.mensagem);
}

/**
 * Texto mostrado ao usuário. `bloqueadoPeloWindows` vem do registro de segurança
 * (CodeIntegrity) e tem a palavra final; sem ele, usa os indícios do próprio erro.
 */
export function mensagemDeFalha(
  nomeApp: string,
  falha: FalhaAoAbrir,
  bloqueadoPeloWindows: boolean,
): string {
  if (
    bloqueadoPeloWindows ||
    (falha.tipo === "nao-iniciou" && pareceBloqueio(falha))
  )
    return (
      `O Windows bloqueou o ${nomeApp} (${MARCA_SMART_APP_CONTROL}). ` +
      `O app ainda não tem assinatura digital, e o ${MARCA_SMART_APP_CONTROL} só deixa abrir ` +
      "programas assinados ou já conhecidos pela Microsoft. Clique em Como liberar para ver as opções."
    );
  if (falha.tipo === "nao-iniciou")
    return falha.codigo === "ENOENT"
      ? `O ${nomeApp} não foi encontrado na pasta de instalação. Instale de novo pelo Launcher.`
      : `Não foi possível abrir o ${nomeApp}: ${falha.mensagem}`;
  return (
    `O ${nomeApp} fechou logo ao abrir (código ${falha.codigoSaida ?? "desconhecido"}). ` +
    "Tente abrir de novo; se continuar, reinstale pelo Launcher."
  );
}
