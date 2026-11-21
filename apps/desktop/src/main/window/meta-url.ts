/**
 * Endereço do Gerenciador de Anúncios da Meta que o app mostra na página embutida "Gerenciador".
 *
 * O ID da conta de anúncios vem da configuração do usuário (`metaConta`, a mesma do painel Campanhas),
 * e não do código, que é público. Sem Electron, para ser testado.
 */

const BASE =
  "https://adsmanager.facebook.com/adsmanager/manage/all?nav_source=comet&nav_entry_point=comet_bookmark&placement=bkmk_admgr&extra_1=campaign";

/** IDs de conta têm até ~16 dígitos; passar disso é lixo, não um ID. */
const MAX_DIGITOS = 20;

/**
 * Gerenciador de Anúncios na conta informada (`act_123…` ou só os dígitos). Só dígitos entram na URL.
 * Sem conta válida, abre o Gerenciador sem escolher conta (a Meta usa a última do usuário).
 */
export function urlDoGerenciadorMeta(conta: string | undefined): string {
  const digitos = (conta ?? "").replace(/\D/g, "");
  return digitos && digitos.length <= MAX_DIGITOS
    ? `${BASE}&act=${digitos}`
    : BASE;
}
