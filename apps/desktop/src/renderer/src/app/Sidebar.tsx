/**
 * Menu lateral do app: logo, páginas (lista em `navigation.ts`), botão de
 * Configurações e a versão instalada.
 */
import { MENU, itemSelecionado, type Pagina } from "./navigation";

type Props = {
  /** Página aberta agora (marca o item correspondente). */
  pagina: Pagina;
  /** Chamado ao clicar num item do menu. */
  aoNavegar: (pagina: Pagina) => void;
  /** Abre ou fecha o painel de configurações. */
  aoAlternarConfiguracoes: () => void;
};

export function Sidebar({ pagina, aoNavegar, aoAlternarConfiguracoes }: Props) {
  return (
    <aside>
      <img src="./soul-logo.jpg" alt="SOUL Cars" />
      <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>
      {MENU.map((item) => (
        <button
          key={item.pagina}
          className={itemSelecionado(pagina, item.pagina) ? "selected" : ""}
          onClick={() => aoNavegar(item.pagina)}
        >
          {item.rotulo}
        </button>
      ))}
      <div className="aside-bottom">
        <button onClick={aoAlternarConfiguracoes}>Configurações</button>
        <small>
          SOUL Cars · {window.soul.versoes.app}
          <br />
          Electron + React
        </small>
      </div>
    </aside>
  );
}
