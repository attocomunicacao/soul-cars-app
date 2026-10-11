import { useEffect, useState } from "react";
import { invoke, open } from "./lib/desktop";
import { importarEstoque } from "./lib/importacao";
import { type Veiculo, manutencaoBanco } from "./lib/db";
import type { Balanco, Contas } from "./types";
import { Ficha } from "./Ficha";
import { Relatorios } from "./Relatorios";
import { Configuracoes } from "./Configuracoes";
import { Entrada } from "./Entrada";

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function App() {
  const [pagina, setPagina] = useState<"estoque" | "studio">("estoque");
  const [lista, setLista] = useState<Veiculo[]>([]),
    [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Veiculo | null>(null);
  const [balanco, setBalanco] = useState<Balanco | null>(null),
    [contas, setContas] = useState<Contas>({});
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState(false),
    [raiz, setRaiz] = useState(""),
    [motor, setMotor] = useState("");
  const [aba, setAba] = useState("veiculos");
  const [relatorio, setRelatorio] = useState("");
  async function carregar() {
    const b = await invoke<Balanco>("balanco_montar");
    setBalanco(b);
    setContas(b.contas);
    setLista(await importarEstoque());
    const c = await invoke<{ raizDados: string; pastaMotor?: string }>(
      "config_ler",
    );
    setRaiz(c.raizDados);
    setMotor(c.pastaMotor || "");
  }
  async function tarefa(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await fn();
    } catch (e) {
      setErro(String(e));
    } finally {
      setOcupado(false);
    }
  }
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
  }, []);
  useEffect(() => {
    if (selecionado || ocupado) return;
    let ativo = true;
    const timer = setInterval(() => {
      void importarEstoque()
        .then((v) => {
          if (ativo) setLista(v);
        })
        .catch((e) => {
          if (ativo) setErro(String(e));
        });
    }, 60_000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [selecionado, ocupado]);
  const filtrados = lista.filter((v) =>
    [v.nome, v.placa, v.versao, v.ano]
      .join(" ")
      .toLowerCase()
      .includes(busca.toLowerCase()),
  );
  return (
    <div className="app">
      <aside>
        <img src="./logo-soul.jpg" alt="SOUL Cars" />
        <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>
        <button
          className={pagina === "estoque" ? "selected" : ""}
          onClick={() => {
            setPagina("estoque");
            setSelecionado(null);
            setAba("veiculos");
          }}
        >
          01 · Estoque
        </button>
        <button
          className={pagina === "studio" ? "selected" : ""}
          onClick={() => {
            setPagina("studio");
            setSelecionado(null);
            setAba("veiculos");
          }}
        >
          02 · Studio
        </button>
        <div className="aside-bottom">
          <button onClick={() => setConfig(!config)}>Configurações</button>
          <small>
            SOUL Cars · {window.soul.versoes.app}
            <br />
            Electron + React
          </small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">SOUL CARS</p>
            <h1>{pagina === "estoque" ? "Estoque" : "Studio"}</h1>
            <p>
              {pagina === "estoque"
                ? "Veículos, sincronização e balanço da loja."
                : "Ficha, produção, criativos e publicação em um só lugar."}
            </p>
          </div>
          <div className="actions">
            <button disabled={ocupado} onClick={() => tarefa(carregar)}>
              Reler pastas
            </button>
            {pagina === "estoque" && (
              <button
                className="primary"
                disabled={ocupado}
                onClick={() =>
                  tarefa(async () => {
                    setLogs([]);
                    await invoke("estoque_atualizar");
                    await carregar();
                  })
                }
              >
                {ocupado ? "Processando…" : "Atualizar BNDV"}
              </button>
            )}
          </div>
        </header>
        {erro && (
          <div role="alert" className="notice error">
            {erro}
          </div>
        )}
        {config && (
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
            <button
              disabled={ocupado}
              onClick={() =>
                tarefa(async () => {
                  const p = await open({ directory: true });
                  if (typeof p === "string") {
                    await invoke("config_gravar", { patch: { raizDados: p } });
                    await carregar();
                  }
                })
              }
            >
              Escolher pasta de dados
            </button>
            <label>
              Motor Python
              <input value={motor} readOnly />
            </label>
            <button
              onClick={() =>
                tarefa(async () => {
                  const p = await open({
                    directory: true,
                    title: "Selecione engine",
                  });
                  if (typeof p === "string") {
                    await invoke("config_gravar", { patch: { pastaMotor: p } });
                    await carregar();
                  }
                })
              }
            >
              Escolher engine
            </button>
            <button
              onClick={() =>
                tarefa(async () => {
                  const r = await invoke("motor_estado");
                  setLogs([JSON.stringify(r, null, 2)]);
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
            <button onClick={() => setConfig(false)}>Fechar</button>
            <Configuracoes />
          </section>
        )}
        {pagina === "estoque" && (
          <>
            <div className="metrics">
              {[
                ["Veículos", balanco?.bndv?.estoqueN ?? lista.length],
                ["Custo do estoque", moeda(balanco?.bndv?.estoqueCusto ?? 0)],
                ["Receita de vendas", moeda(balanco?.bndv?.receita ?? 0)],
                ["Margem bruta", moeda(balanco?.bndv?.margem ?? 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <nav>
              <button
                className={aba === "veiculos" ? "selected" : ""}
                onClick={() => setAba("veiculos")}
              >
                Veículos
              </button>
              <button
                className={aba === "balanco" ? "selected" : ""}
                onClick={() => setAba("balanco")}
              >
                Balanço
              </button>
              <button
                className={aba === "entrada" ? "selected" : ""}
                onClick={() => setAba("entrada")}
              >
                Entrada
              </button>
              <button
                disabled={ocupado}
                onClick={() =>
                  tarefa(async () => {
                    setRelatorio(await invoke<string>("relatorio_abrir"));
                    setAba("completo");
                  })
                }
              >
                Abrir relatório completo
              </button>
            </nav>
          </>
        )}
        {pagina === "studio" && !selecionado && (
          <nav>
            <button onClick={() => setAba("veiculos")}>Veículos</button>
            <button onClick={() => setAba("relatorios")}>
              Relatórios Meta Ads
            </button>
          </nav>
        )}
        {aba === "completo" && pagina === "estoque" ? (
          <section className="panel">
            <div className="actions">
              <h2>Relatório completo</h2>
              <button onClick={() => setAba("veiculos")}>
                ← Voltar ao estoque
              </button>
            </div>
            <iframe
              className="relatorio-completo"
              title="Relatório completo do estoque"
              sandbox="allow-scripts"
              srcDoc={relatorio}
            />
          </section>
        ) : aba === "entrada" && pagina === "estoque" ? (
          <Entrada />
        ) : aba === "relatorios" && pagina === "studio" ? (
          <Relatorios />
        ) : selecionado && pagina === "studio" ? (
          <Ficha
            key={selecionado.id}
            veiculo={selecionado}
            voltar={() => {
              setSelecionado(null);
              void tarefa(carregar);
            }}
          />
        ) : aba === "balanco" ? (
          <section className="panel">
            <h2>Balanço patrimonial</h2>
            <p>
              Estoque é automático. Lucros acumulados fecham o saldo por
              diferença.
            </p>
            <div className="grid">
              {Object.entries(contas).map(([grupo, linhas]) => (
                <fieldset key={grupo}>
                  <legend>{grupo}</legend>
                  {Object.entries(linhas).map(([conta, valor]) => (
                    <label key={conta}>
                      {conta}
                      <input
                        type="number"
                        step="0.01"
                        disabled={conta === "Estoque de veículos (custo)"}
                        value={valor}
                        onChange={(e) =>
                          setContas({
                            ...contas,
                            [grupo]: {
                              ...linhas,
                              [conta]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <button
              className="primary"
              disabled={ocupado}
              onClick={() =>
                tarefa(async () => {
                  setBalanco(
                    await invoke<Balanco>("balanco_salvar", { contas }),
                  );
                })
              }
            >
              Salvar balanço
            </button>
            <p>
              Ativo: {moeda(balanco?.ativo ?? 0)} · Passivo:{" "}
              {moeda(balanco?.passivo ?? 0)} · Acumulados:{" "}
              {moeda(balanco?.acumulados ?? 0)}
            </p>
          </section>
        ) : (
          <section className="panel">
            <div className="actions">
              <h2>
                {pagina === "studio"
                  ? "Escolha um veículo para produzir"
                  : "Veículos nas pastas"}
              </h2>
              <input
                aria-label="Buscar veículo"
                placeholder="Buscar nome, placa ou versão"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <table>
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Placa</th>
                  <th>Ano</th>
                  <th>Preço</th>
                  <th>Produção</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.nome}</strong>
                      <small>{v.versao}</small>
                    </td>
                    <td>{v.placa || "—"}</td>
                    <td>{v.ano || "—"}</td>
                    <td>{v.preco == null ? "—" : moeda(v.preco)}</td>
                    <td>
                      <span className="badge">{v.status}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setPagina("studio");
                          setSelecionado(v);
                        }}
                      >
                        Abrir Studio →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtrados.length && (
              <p className="empty">
                Nenhum veículo encontrado. Atualize o BNDV ou escolha a raiz que
                contém ESTOQUE nas configurações.
              </p>
            )}
          </section>
        )}
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
