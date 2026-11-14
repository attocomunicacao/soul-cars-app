/**
 * Menu lateral do app (estilo barra lateral do macOS): marca, páginas com ícone
 * (lista em `navigation.ts`), botão de Configurações e a versão instalada. Pode ser
 * recolhido: ficam só os ícones (a escolha fica guardada neste computador).
 */
import { useState } from "react";
import { Icon } from "./icons";
import { MENU, itemSelecionado, type Pagina } from "./navigation";

type Props = {
  /** Página aberta agora (marca o item correspondente). */
  pagina: Pagina;
  /** Chamado ao clicar num item do menu. */
  aoNavegar: (pagina: Pagina) => void;
  /** Abre ou fecha o painel de configurações. */
  aoAlternarConfiguracoes: () => void;
};

const CHAVE_RECOLHIDO = "soul:menu-recolhido";

/** Lê se o menu estava recolhido (falha do armazenamento = expandido). */
function lerRecolhido(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDO) === "1";
  } catch {
    return false;
  }
}

export function Sidebar({ pagina, aoNavegar, aoAlternarConfiguracoes }: Props) {
  const [recolhido, setRecolhido] = useState(lerRecolhido);

  /** Recolhe ou expande o menu e lembra a escolha. */
  function alternar() {
    const novo = !recolhido;
    setRecolhido(novo);
    try {
      localStorage.setItem(CHAVE_RECOLHIDO, novo ? "1" : "0");
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }

  return (
    <aside className={recolhido ? "collapsed" : ""}>
      <div className="aside-brand">
        <img src="./soul-logo.jpg" alt="" />
        {!recolhido && <strong>Soul Cars</strong>}
        <button
          className="aside-toggle"
          onClick={alternar}
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
        >
          <Icon nome="menu" />
        </button>
      </div>
      {MENU.map((item, i) => (
        <div key={item.pagina} className="aside-item">
          {item.grupo &&
            item.grupo !== MENU[i - 1]?.grupo &&
            (recolhido ? (
              <hr className="aside-separador" />
            ) : (
              <p className="aside-section eyebrow">{item.grupo}</p>
            ))}
          <button
            className={itemSelecionado(pagina, item.pagina) ? "selected" : ""}
            aria-current={
              itemSelecionado(pagina, item.pagina) ? "page" : undefined
            }
            onClick={() => aoNavegar(item.pagina)}
            title={
              recolhido
                ? `${item.grupo ? `${item.grupo} · ` : ""}${item.rotulo}`
                : undefined
            }
            aria-label={
              item.grupo ? `${item.grupo}: ${item.rotulo}` : item.rotulo
            }
          >
            <Icon nome={item.icone} />
            {!recolhido && item.rotulo}
          </button>
        </div>
      ))}
      <div className="aside-bottom">
        <button
          onClick={aoAlternarConfiguracoes}
          title={recolhido ? "Configurações" : undefined}
          aria-label="Configurações"
        >
          <Icon nome="ajustes" />
          {!recolhido && "Configurações"}
        </button>
        {!recolhido && <small>Versão {window.soul.versoes.app}</small>}
      </div>
    </aside>
  );
}
