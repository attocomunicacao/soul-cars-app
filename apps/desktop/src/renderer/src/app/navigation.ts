/**
 * Navegação principal do app (menu lateral).
 *
 * Cada item do menu é uma página. A ordem e os rótulos ficam aqui, num lugar só,
 * para o menu, o roteamento do `App` e os testes usarem a mesma lista.
 *
 *  - "estoque"  → lista de veículos, vitrine e relatório completo (página inicial)
 *  - "studio"   → ficha de um veículo (aberta a partir do estoque; não aparece no menu)
 *  - "crm" / "bndv" / "meta" → sites embutidos (WebContentsView no processo principal)
 *  - "leads"    → painel do CRM e memória da Soul IA
 *  - "financas" → planilha financeira do mês
 */

/** Identificador de cada página do app. */
export type Pagina =
  "estoque" | "studio" | "crm" | "leads" | "bndv" | "meta" | "financas";

/** Item do menu lateral: página de destino e rótulo exibido. */
export type ItemMenu = { pagina: Pagina; rotulo: string };

/** Itens do menu lateral, na ordem em que aparecem (desde a 1.0.3, só o Estoque). */
export const MENU: readonly ItemMenu[] = [
  { pagina: "estoque", rotulo: "01 · Estoque" },
];

/**
 * Páginas fora do menu desde a versão 1.0.3. O código delas continua no app
 * (pages/leads, pages/finance, pages/embedded); para trazer uma de volta, mova o
 * item para `MENU`. O login do BNDV não depende do item "04 · BNDV": o botão
 * "Atualizar BNDV" abre a janela de login sozinho quando a sessão expira.
 */
export const MENU_OCULTO: readonly ItemMenu[] = [
  { pagina: "crm", rotulo: "02 · CRM" },
  { pagina: "leads", rotulo: "03 · Leads e Soul IA" },
  { pagina: "bndv", rotulo: "04 · BNDV" },
  { pagina: "meta", rotulo: "05 · Meta ADS" },
  { pagina: "financas", rotulo: "06 · Finanças" },
];

/** Páginas que mostram um site externo embutido (ocupam a área inteira). */
export const PAGINAS_EMBUTIDAS = ["crm", "bndv", "meta"] as const;

/** Verdadeiro quando a página é um site embutido (CRM, BNDV ou Meta Ads). */
export function ehEmbutida(
  pagina: Pagina,
): pagina is (typeof PAGINAS_EMBUTIDAS)[number] {
  return (PAGINAS_EMBUTIDAS as readonly string[]).includes(pagina);
}

/** O item do menu fica marcado também quando a ficha (studio) está aberta a partir do estoque. */
export function itemSelecionado(atual: Pagina, item: Pagina): boolean {
  if (item === "estoque") return atual === "estoque" || atual === "studio";
  return atual === item;
}
