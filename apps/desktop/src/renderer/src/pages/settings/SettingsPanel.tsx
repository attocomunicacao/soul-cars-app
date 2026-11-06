/**
 * Painel de Configurações (botão no rodapé do menu lateral).
 *
 *  - Raiz dos dados: pasta com ESTOQUE/ e dados/ (comando `config_gravar`).
 *  - Motor Python: pasta do `engine`, diagnóstico (`motor_estado`) e instalação/reparo
 *    (`motor_instalar`, que baixa o uv e cria o ambiente sozinho).
 *  - Dados da loja e integrações (componente `StoreSettings`).
 */
import { invoke, open } from "../../lib/desktop-bridge";
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

  return (
    <section className="panel">
      <h2>Dados e motor</h2>
      <p>
        Escolha uma pasta própria para ESTOQUE e dados. As origens antigas
        continuam preservadas.
      </p>
      <label>
        Raiz dos dados
        <input value={raiz} readOnly />
      </label>
      <button disabled={ocupado} onClick={() => escolherPasta("raizDados")}>
        Escolher pasta de dados
      </button>
      <label>
        Motor Python
        <input value={motor} readOnly />
      </label>
      <button onClick={() => escolherPasta("pastaMotor", "Selecione engine")}>
        Escolher engine
      </button>
      <button
        onClick={() =>
          tarefa(async () => {
            const r = await invoke("motor_estado");
            mostrarAtividade([JSON.stringify(r, null, 2)]);
          })
        }
      >
        Diagnóstico do motor
      </button>
      <button
        disabled={ocupado}
        onClick={() => tarefa(() => invoke("motor_instalar"))}
      >
        Instalar / reparar motor Python
      </button>
      <button onClick={fechar}>Fechar</button>
      <StoreSettings />
    </section>
  );
}
