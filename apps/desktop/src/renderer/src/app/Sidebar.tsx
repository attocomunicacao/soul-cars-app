/**
 * Menu lateral do app: logo, páginas (lista em `navigation.ts`), botão de
 * Configurações e a versão instalada. Pode ser recolhido: os textos viram ícones
 * (a escolha fica guardada neste computador).
 */
import { useState } from "react";
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
      <img src="./soul-logo.jpg" alt="SOUL Cars" />
      <div className="aside-head">
        {!recolhido && <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>}
        <button
          className="aside-toggle"
          onClick={alternar}
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
        >
          {recolhido ? "»" : "«"}
        </button>
      </div>
      {MENU.map((item) => (
        <button
          key={item.pagina}
          className={itemSelecionado(pagina, item.pagina) ? "selected" : ""}
          onClick={() => aoNavegar(item.pagina)}
          title={item.rotulo}
          aria-label={item.rotulo}
        >
          {recolhido ? item.icone : item.rotulo}
        </button>
      ))}
      <div className="aside-bottom">
        <button
          onClick={aoAlternarConfiguracoes}
          title="Configurações"
          aria-label="Configurações"
        >
          {recolhido ? "⚙" : "Configurações"}
        </button>
        {!recolhido && (
          <small>
            SOUL Cars · {window.soul.versoes.app}
            <br />
            Electron + React
          </small>
        )}
      </div>
    </aside>
  );
}
