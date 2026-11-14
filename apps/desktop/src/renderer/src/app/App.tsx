/**
 * Shell do app: menu lateral, roteamento entre páginas e estado do estoque.
 *
 * Cada página mora em `pages/<área>/`. Aqui fica só o que é comum a várias delas:
 *  - a lista de veículos lida das pastas e o balanço (recarregados a cada 60 s),
 *  - o veículo aberto na ficha (Studio),
 *  - o aviso de erro e a caixa de atividade do processo principal (`estoque:log`).
 *
 * Fluxo: Estoque (lista/vitrine/relatório) → "Abrir ficha →" → Studio (VehiclePage).
 */
import { useCallback, useEffect, useState } from "react";
import { type Veiculo, manutencaoBanco } from "../lib/database";
import { invoke } from "../lib/desktop-bridge";
import { importarEstoque } from "../lib/inventory-import";
import { AdPauseAlerts } from "../pages/inventory/AdPauseAlerts";
import { FullReport } from "../pages/inventory/FullReport";
import {
  FolderBar,
  InventoryMetrics,
} from "../pages/inventory/InventoryHeader";
import { Showcase } from "../pages/inventory/Showcase";
import { VehicleTable } from "../pages/inventory/VehicleTable";
import { EmbeddedSite } from "../pages/embedded/EmbeddedSite";
import { FinancePage } from "../pages/finance/FinancePage";
import { LeadsPage } from "../pages/leads/LeadsPage";
import { SettingsPanel } from "../pages/settings/SettingsPanel";
import { VehiclePage } from "../pages/vehicle/VehiclePage";
import type { Balanco } from "../types";
import { Sidebar } from "./Sidebar";
import { ehEmbutida, type Pagina } from "./navigation";

/** Abas da página Estoque. */
type AbaEstoque = "veiculos" | "vitrine" | "completo";

export function App() {
  const [pagina, setPagina] = useState<Pagina>("estoque");
  const [aba, setAba] = useState<AbaEstoque>("veiculos");
  const [lista, setLista] = useState<Veiculo[]>([]);
  const [selecionado, setSelecionado] = useState<Veiculo | null>(null);
  const [balanco, setBalanco] = useState<Balanco | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState(false);
  const [raiz, setRaiz] = useState("");
  const [motor, setMotor] = useState("");
  const [relatorio, setRelatorio] = useState("");

  /** Relê balanço, veículos das pastas e a configuração (raiz dos dados e motor). */
  const carregar = useCallback(async () => {
    setBalanco(await invoke<Balanco>("balanco_montar"));
    setLista(await importarEstoque());
    const c = await invoke<{ raizDados: string; pastaMotor?: string }>(
      "config_ler",
    );
    setRaiz(c.raizDados);
    setMotor(c.pastaMotor || "");
  }, []);

  /** Executa uma operação marcando "ocupado" e mostrando o erro ao usuário, se houver. */
  const tarefa = useCallback(async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    setErro("");
    try {
      await fn();
    } catch (e) {
      setErro(String(e));
    } finally {
      setOcupado(false);
    }
  }, []);

  // Primeira carga, manutenção do banco (backup diário) e o log do processo principal.
  useEffect(() => {
    const off = window.soul.ouvir<{ texto: string }>("estoque:log", (v) =>
      setLogs((l) => [...l.slice(-199), v.texto]),
    );
    void carregar().catch((e) => setErro(String(e)));
    void manutencaoBanco()
      .then((r) => {
        if (!r.ok || r.detalhe !== "ok") setErro(r.detalhe);
      })
      .catch((e) => setErro(String(e)));
    return off;
  }, [carregar]);

  // Relê as pastas a cada 60 s enquanto ninguém está numa ficha ou numa tarefa.
  useEffect(() => {
    if (selecionado || ocupado) return;
    let ativo = true;
    const timer = setInterval(() => {
      void importarEstoque()
        .then((v) => ativo && setLista(v))
        .catch((e) => ativo && setErro(String(e)));
    }, 60_000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [selecionado, ocupado]);

  /** Troca de página pelo menu: fecha a ficha e volta para a lista. */
  function navegar(destino: Pagina) {
    setPagina(destino);
    setSelecionado(null);
    setAba("veiculos");
    if (destino !== "estoque") setErro("");
  }

  /** Abre a ficha (Studio) de um veículo. */
  function abrirFicha(veiculo: Veiculo) {
    setPagina("studio");
    setAba("veiculos");
    setSelecionado(veiculo);
  }

  const noEstoque = pagina === "estoque" || pagina === "studio";

  return (
    <div className="app">
      <Sidebar
        pagina={pagina}
        aoNavegar={navegar}
        aoAlternarConfiguracoes={() => setConfig(!config)}
      />
      <main className={ehEmbutida(pagina) ? "crm" : ""}>
        {ehEmbutida(pagina) && (
          <EmbeddedSite key={pagina} id={pagina} aoErro={setErro} />
        )}
        {noEstoque && (
          <FolderBar
            titulo={selecionado && pagina === "studio" ? "Studio" : "Estoque"}
            selecionado={selecionado}
            mostrarAtualizar={pagina === "estoque"}
            ocupado={ocupado}
            reler={() => void tarefa(carregar)}
            atualizarBndv={() =>
              void tarefa(async () => {
                setLogs([]);
                await invoke("estoque_atualizar");
                await carregar();
              })
            }
            aoErro={setErro}
          />
        )}
        {(pagina === "financas" || pagina === "leads") && (
          <header>
            <div>
              <p className="eyebrow">SOUL CARS</p>
              <h1>{pagina === "financas" ? "Finanças" : "Leads"}</h1>
              <p>
                {pagina === "financas"
                  ? "Contas do mês a partir da planilha financeira."
                  : "Painel do CRM com o desempenho do atendimento e, em aba à parte, a memória da Soul IA."}
              </p>
            </div>
          </header>
        )}
        {erro && (
          <div role="alert" className="notice error com-fechar">
            <span>{erro}</span>
            <button
              className="plain small"
              aria-label="Fechar aviso"
              onClick={() => setErro("")}
            >
              Fechar
            </button>
          </div>
        )}
        <AdPauseAlerts veiculos={lista} abrir={abrirFicha} />
        {config && (
          <SettingsPanel
            raiz={raiz}
            motor={motor}
            ocupado={ocupado}
            tarefa={tarefa}
            recarregar={carregar}
            mostrarAtividade={setLogs}
            fechar={() => setConfig(false)}
          />
        )}
        {pagina === "estoque" && (
          <InventoryMetrics
            balanco={balanco}
            totalLista={lista.length}
            aba={aba}
            ocupado={ocupado}
            abrirVitrine={() => setAba("vitrine")}
            abrirLista={() => setAba("veiculos")}
            abrirRelatorio={() =>
              void tarefa(async () => {
                setRelatorio(await invoke<string>("relatorio_abrir"));
                setAba("completo");
              })
            }
          />
        )}
        {pagina === "financas" ? (
          <FinancePage aoErro={setErro} />
        ) : pagina === "leads" ? (
          <LeadsPage aoErro={setErro} />
        ) : aba === "vitrine" && pagina === "estoque" ? (
          <Showcase lista={lista} abrir={abrirFicha} />
        ) : aba === "completo" && pagina === "estoque" ? (
          <FullReport html={relatorio} aoErro={setErro} />
        ) : selecionado && pagina === "studio" ? (
          <VehiclePage
            key={selecionado.id}
            veiculo={selecionado}
            voltar={() => {
              setSelecionado(null);
              setPagina("estoque");
              void tarefa(carregar);
            }}
          />
        ) : noEstoque ? (
          <VehicleTable
            lista={lista}
            abrirFicha={abrirFicha}
            aoErro={setErro}
          />
        ) : null}
        {!!logs.length && (
          <details open={ocupado}>
            <summary>Atividade · {logs.length} mensagens</summary>
            <pre aria-live="polite">{logs.join("\n")}</pre>
          </details>
        )}
      </main>
    </div>
  );
}
