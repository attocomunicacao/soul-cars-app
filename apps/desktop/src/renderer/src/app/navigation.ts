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
import type { NomeIcone } from "./icons";

/** Identificador de cada página do app. */
export type Pagina =
  | "estoque"
  | "studio"
  | "crm"
  | "leads"
  | "bndv"
  | "meta"
  | "financas"
  | "leadsCrm"
  | "metaPainel"
  | "funil";

/**
 * Item do menu lateral: página de destino, rótulo, ícone (ver app/icons.tsx) e o grupo
 * (título acima dos itens; sem grupo = topo do menu).
 */
export type ItemMenu = {
  pagina: Pagina;
  rotulo: string;
  icone: NomeIcone;
  grupo?: string;
};

/**
 * Itens do menu lateral, na ordem em que aparecem. Desde a 1.0.9 os rótulos não têm
 * numeração. Na 1.0.12 entraram os painéis do Soul APP: cada área tem o painel de dados
 * (Leads, Campanhas, Funil) e, ao lado, o site embutido para operar (uTalk, Gerenciador).
 */
export const MENU: readonly ItemMenu[] = [
  { pagina: "estoque", rotulo: "Estoque", icone: "estoque" },
  { pagina: "leadsCrm", rotulo: "Leads", icone: "leads", grupo: "CRM" },
  { pagina: "crm", rotulo: "Atendimento", icone: "crm", grupo: "CRM" },
  {
    pagina: "metaPainel",
    rotulo: "Campanhas",
    icone: "campanhas",
    grupo: "Meta Ads",
  },
  { pagina: "meta", rotulo: "Gerenciador", icone: "meta", grupo: "Meta Ads" },
  { pagina: "funil", rotulo: "Meta → CRM", icone: "funil", grupo: "Funil" },
];

/**
 * Páginas fora do menu desde a versão 1.0.3 (o CRM e o Meta Ads voltaram depois). O código delas continua no app
 * (pages/leads, pages/finance, pages/embedded); para trazer uma de volta, mova o
 * item para `MENU`. O login do BNDV não depende do item "BNDV": o botão
 * "Atualizar BNDV" abre a janela de login sozinho quando a sessão expira.
 */
export const MENU_OCULTO: readonly ItemMenu[] = [
  { pagina: "leads", rotulo: "Painel antigo e Soul IA", icone: "leads" },
  { pagina: "bndv", rotulo: "BNDV", icone: "bndv" },
  { pagina: "financas", rotulo: "Finanças", icone: "financas" },
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
