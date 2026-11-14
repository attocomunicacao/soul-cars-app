/**
 * Painel de Configurações (botão no rodapé do menu lateral), aberto como folha modal
 * sobre a tela: fecha no X, no Esc ou clicando fora.
 *
 *  - Raiz dos dados: pasta com ESTOQUE/ e dados/ (comando `config_gravar`).
 *  - Motor Python: pasta do `engine`, diagnóstico (`motor_estado`) e instalação/reparo
 *    (`motor_instalar`, que baixa o uv e cria o ambiente sozinho).
 *  - Conexões (uTalk, Meta Ads, importação do Soul APP) e preferências dos painéis
 *    (componente `ConnectionsSettings`).
 *  - Dados da loja e integrações (componente `StoreSettings`).
 */
import { useEffect } from "react";
import { Icon } from "../../app/icons";
import { invoke, open } from "../../lib/desktop-bridge";
import { ConnectionsSettings } from "./ConnectionsSettings";
import { StoreSettings } from "./StoreSettings";

type Props = {
  /** Pasta raiz dos dados em uso. */
  raiz: string;
  /** Pasta do motor Python escolhida (vazia = automática). */
  motor: string;
  /** Há uma tarefa em andamento (desabilita botões que gravam). */
  ocupado: boolean;
  /** Executa uma tarefa mostrando "ocupado" e o erro, se houver. */
  tarefa: (fn: () => Promise<unknown>) => Promise<void>;
  /** Relê estoque, balanço e configuração depois de uma mudança. */
  recarregar: () => Promise<void>;
  /** Mostra um texto na caixa de atividade (diagnóstico). */
  mostrarAtividade: (linhas: string[]) => void;
  /** Fecha o painel. */
  fechar: () => void;
};

export function SettingsPanel({
  raiz,
  motor,
  ocupado,
  tarefa,
  recarregar,
  mostrarAtividade,
  fechar,
}: Props) {
  /** Abre o seletor de pasta e grava a escolha na configuração. */
  const escolherPasta = (chave: "raizDados" | "pastaMotor", titulo?: string) =>
    tarefa(async () => {
      const p = await open({ directory: true, title: titulo });
      if (typeof p === "string") {
        await invoke("config_gravar", { patch: { [chave]: p } });
        await recarregar();
      }
    });

  // Esc fecha a folha (o listener sai junto com o painel).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && fechar()}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-configuracoes"
      >
        <div className="sheet-head">
          <h2 id="titulo-configuracoes">Configurações</h2>
          <button
            className="icon-only"
            aria-label="Fechar configurações"
            title="Fechar (Esc)"
            autoFocus
            onClick={fechar}
          >
            <Icon nome="fechar" />
          </button>
        </div>
        <div className="sheet-body">
          <ConnectionsSettings />
          <section>
            <h3>Pasta de dados</h3>
            <p>
              Pasta com ESTOQUE e dados da loja. Trocar de pasta não apaga nada:
              as origens antigas continuam preservadas.
            </p>
            <div className="campo-com-botao">
              <label>
                Local atual
                <input value={raiz} readOnly />
              </label>
              <button
                disabled={ocupado}
                onClick={() => escolherPasta("raizDados")}
              >
                Escolher…
              </button>
            </div>
          </section>
          <section>
            <h3>Motor de automação</h3>
            <p>
              Lê documentos, recorta fotos e monta vídeos. Vazio = pasta
              automática.
            </p>
            <div className="campo-com-botao">
              <label>
                Pasta do motor (Python)
                <input value={motor} readOnly placeholder="Automática" />
              </label>
              <button
                onClick={() =>
                  escolherPasta("pastaMotor", "Selecione a pasta do motor")
                }
              >
                Escolher…
              </button>
            </div>
            <div className="actions" style={{ marginTop: 14 }}>
              <button
                disabled={ocupado}
                onClick={() => tarefa(() => invoke("motor_instalar"))}
              >
                Instalar ou reparar motor
              </button>
              <button
                className="plain"
                onClick={() =>
                  tarefa(async () => {
                    const r = await invoke("motor_estado");
                    mostrarAtividade([JSON.stringify(r, null, 2)]);
                  })
                }
              >
                Ver diagnóstico
              </button>
            </div>
          </section>
          <StoreSettings />
        </div>
      </div>
    </div>
  );
}
