import { useEffect, useRef, useState } from "react";
import { invoke, open, openPath } from "./lib/desktop";
import { alturaDaMensagem, comAvisoDeAltura } from "./lib/relatorio-frame";
import { Vitrine } from "./Vitrine";
import { importarEstoque } from "./lib/importacao";
import { type Veiculo, manutencaoBanco } from "./lib/db";
import type { Balanco } from "./types";
import { Ficha } from "./Ficha";
import { Configuracoes } from "./Configuracoes";
import { Embutida } from "./Embutida";
import { PainelCrm } from "./PainelCrm";
import { Financas } from "./Financas";
import { AvisosAnuncio } from "./AvisosAnuncio";
import { statusProducao, type StatusProducao } from "./lib/producao";
import type { CartaoVitrine } from "../../compartilhado/vitrine";

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function SelosAnexos({ status }: { status?: StatusProducao }) {
  if (!status) return null;
  const itens: [string, boolean, string][] = [
    [
      "Fotos",
      status.fotos.length > 0,
      status.fotos.length
        ? `${status.fotos.length} foto(s) na pasta`
        : "Sem fotos",
    ],
    [
      "Vídeo",
      !!(status.video_bruto || status.video_final),
      status.video_final
        ? "Vídeo final gerado"
        : status.video_bruto
          ? "Vídeo bruto na pasta"
          : "Sem vídeo",
    ],
    [
      "Documento",
      status.doc_pdf,
      status.doc_pdf ? "PDF do documento na pasta" : "Sem documento",
    ],
  ];
  return (
    <span className="selos-anexos">
      {itens.map(([nome, ok, dica]) => (
        <span key={nome} className={ok ? "selo ok" : "selo falta"} title={dica}>
          {ok ? "✓" : "✗"} {nome}
        </span>
      ))}
    </span>
  );
}
export function App() {
  const [pagina, setPagina] = useState<
    "estoque" | "studio" | "crm" | "bndv" | "meta" | "financas"
  >("estoque");
  const [lista, setLista] = useState<Veiculo[]>([]),
    [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Veiculo | null>(null);
  const [balanco, setBalanco] = useState<Balanco | null>(null);
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState(false),
    [raiz, setRaiz] = useState(""),
    [motor, setMotor] = useState("");
  const [aba, setAba] = useState("veiculos");
  const [relatorio, setRelatorio] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [avisoPdf, setAvisoPdf] = useState("");
  const [alturaRelatorio, setAlturaRelatorio] = useState<number | null>(null);
  const quadroRelatorio = useRef<HTMLIFrameElement>(null);
  // Se a página do relatório não informar a altura, o quadro volta a rolar por dentro (nada fica preso).
  const [semAlturaRelatorio, setSemAlturaRelatorio] = useState(false);
  async function carregar() {
    const b = await invoke<Balanco>("balanco_montar");
    setBalanco(b);
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
  // O relatório avisa a própria altura: o iframe cresce e só a página rola.
  useEffect(() => {
    const aoReceber = (e: MessageEvent) => {
      if (e.source !== quadroRelatorio.current?.contentWindow) return;
      const altura = alturaDaMensagem(e.data);
      if (altura) setAlturaRelatorio(altura);
    };
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, []);
  useEffect(() => {
    setSemAlturaRelatorio(false);
    if (aba !== "completo" || alturaRelatorio) return;
    const t = setTimeout(() => setSemAlturaRelatorio(true), 2500);
    return () => clearTimeout(t);
  }, [aba, alturaRelatorio, relatorio]);
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
  // Situação de fotos, vídeo e documento de cada pasta, relida a cada 15 s na lista.
  const [anexos, setAnexos] = useState<Record<string, StatusProducao>>({});
  useEffect(() => {
    if (selecionado || aba !== "veiculos") return;
    let ativo = true;
    const ler = async () => {
      const pastas = lista.map((v) => v.pasta).filter((p): p is string => !!p);
      const lidos = await Promise.all(
        pastas.map((p) =>
          statusProducao(p)
            .then((s) => [p, s] as const)
            .catch(() => null),
        ),
      );
      if (!ativo) return;
      setAnexos(
        Object.fromEntries(
          lidos.filter((l): l is [string, StatusProducao] => !!l),
        ),
      );
    };
    void ler();
    const timer = setInterval(() => void ler(), 15_000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [lista, selecionado, pagina, aba]);
  // Filtro "só em estoque no BNDV": usa a mesma lista da vitrine (veículos não vendidos).
  const [soEstoque, setSoEstoque] = useState(true);
  const [noEstoque, setNoEstoque] = useState<CartaoVitrine[] | null>(null);
  useEffect(() => {
    if (!soEstoque) return;
    let ativo = true;
    invoke<CartaoVitrine[]>("estoque_vitrine")
      .then((c) => ativo && setNoEstoque(c))
      .catch((e) => {
        if (!ativo) return;
        setErro(String(e));
        setSoEstoque(false);
      });
    return () => {
      ativo = false;
    };
  }, [soEstoque, lista]);
  const emEstoque = (v: Veiculo) =>
    !!noEstoque?.some(
      (c) =>
        (v.pasta && c.pasta === v.pasta) ||
        (c.estudio && c.estudio.id === v.id) ||
        (!!c.placa &&
          (v.placa ?? "").trim().toUpperCase() === c.placa.toUpperCase()),
    );
  const filtrados = lista
    .filter((v) => !soEstoque || !noEstoque || emEstoque(v))
    .filter((v) =>
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
          className={
            pagina === "estoque" || pagina === "studio" ? "selected" : ""
          }
          onClick={() => {
            setPagina("estoque");
            setSelecionado(null);
            setAba("veiculos");
          }}
        >
          01 · Estoque
        </button>
        <button
          className={pagina === "crm" ? "selected" : ""}
          onClick={() => {
            setPagina("crm");
            setSelecionado(null);
            setAba("veiculos");
            setErro("");
          }}
        >
          02 · CRM
        </button>
        <button
          className={pagina === "bndv" ? "selected" : ""}
          onClick={() => {
            setPagina("bndv");
            setSelecionado(null);
            setAba("veiculos");
            setErro("");
          }}
        >
          03 · BNDV
        </button>
        <button
          className={pagina === "meta" ? "selected" : ""}
          onClick={() => {
            setPagina("meta");
            setSelecionado(null);
            setAba("veiculos");
            setErro("");
          }}
        >
          04 · Meta ADS
        </button>
        <button
          className={pagina === "financas" ? "selected" : ""}
          onClick={() => {
            setPagina("financas");
            setSelecionado(null);
            setAba("veiculos");
            setErro("");
          }}
        >
          05 · Finanças
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
      <main
        className={
          pagina === "crm" || pagina === "bndv" || pagina === "meta"
            ? "crm"
            : ""
        }
      >
        {pagina === "crm" && <PainelCrm aoErro={setErro} />}
        {(pagina === "crm" || pagina === "bndv" || pagina === "meta") && (
          <Embutida key={pagina} id={pagina} aoErro={setErro} />
        )}
        <header>
          <div>
            <p className="eyebrow">SOUL CARS</p>
            <h1>
              {pagina === "estoque"
                ? "Estoque"
                : pagina === "financas"
                  ? "Finanças"
                  : "Estoque"}
            </h1>
            <p>
              {pagina === "estoque"
                ? "Veículos, sincronização e balanço da loja."
                : pagina === "financas"
                  ? "Contas do mês a partir da planilha financeira."
                  : "Ficha, produção, criativos e publicação em um só lugar."}
            </p>
          </div>
          <div
            className="actions"
            style={pagina === "financas" ? { display: "none" } : undefined}
          >
            <button disabled={ocupado} onClick={() => tarefa(carregar)}>
              Reler pastas
            </button>
            <button
              title="Abre no Explorador de Arquivos a pasta ESTOQUE, com uma pasta por veículo."
              onClick={() => {
                setErro("");
                invoke<{ estoque: string }>("caminhos_app")
                  .then((c) => openPath(c.estoque))
                  .catch((e) => setErro(String(e)));
              }}
            >
              Abrir pasta do estoque
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
        <AvisosAnuncio
          veiculos={lista}
          abrir={(veiculo) => {
            setPagina("studio");
            setAba("veiculos");
            setSelecionado(veiculo);
          }}
        />
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
                ["Estoque", balanco?.bndv?.estoqueN ?? lista.length],
                ["Custo do estoque", moeda(balanco?.bndv?.estoqueCusto ?? 0)],
                ["Receita de vendas", moeda(balanco?.bndv?.receita ?? 0)],
                ["Margem bruta", moeda(balanco?.bndv?.margem ?? 0)],
              ].map(([label, value]) =>
                label === "Estoque" ? (
                  <button
                    key={label}
                    className="metric-link"
                    title="Ver os veículos em estoque"
                    onClick={() => setAba("vitrine")}
                  >
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </button>
                ) : (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ),
              )}
            </div>
            <nav>
              <button
                className={aba === "veiculos" ? "selected" : ""}
                onClick={() => setAba("veiculos")}
              >
                Veículos
              </button>
              <button
                disabled={ocupado}
                onClick={() =>
                  tarefa(async () => {
                    setAlturaRelatorio(null);
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
        {pagina === "financas" ? (
          <Financas aoErro={setErro} />
        ) : aba === "vitrine" && pagina === "estoque" ? (
          <Vitrine
            lista={lista}
            voltar={() => setAba("veiculos")}
            abrir={(veiculo) => {
              setPagina("studio");
              setAba("veiculos");
              setSelecionado(veiculo);
            }}
          />
        ) : aba === "completo" && pagina === "estoque" ? (
          <section className="panel">
            <div className="actions">
              <h2>Relatório completo</h2>
              <button
                className="primary"
                disabled={gerandoPdf}
                title="Gera o relatório inteiro em PDF, em folhas A4, pronto para imprimir"
                onClick={() => {
                  setGerandoPdf(true);
                  setAvisoPdf("");
                  setErro("");
                  invoke<{ cancelado: boolean; caminho?: string }>(
                    "relatorio_pdf",
                  )
                    .then((r) => {
                      if (!r.cancelado) setAvisoPdf("PDF salvo e aberto.");
                    })
                    .catch((e) => setErro(String(e)))
                    .finally(() => setGerandoPdf(false));
                }}
              >
                {gerandoPdf ? "Gerando PDF…" : "PDF"}
              </button>
              <button onClick={() => setAba("veiculos")}>
                ← Voltar ao estoque
              </button>
            </div>
            {avisoPdf && <p role="status">{avisoPdf}</p>}
            <iframe
              ref={quadroRelatorio}
              className="relatorio-completo"
              title="Relatório completo do estoque"
              sandbox="allow-scripts"
              scrolling={semAlturaRelatorio ? "yes" : "no"}
              style={
                alturaRelatorio
                  ? { height: alturaRelatorio }
                  : semAlturaRelatorio
                    ? { height: "calc(100vh - 220px)" }
                    : undefined
              }
              srcDoc={comAvisoDeAltura(relatorio)}
            />
          </section>
        ) : selecionado && pagina === "studio" ? (
          <Ficha
            key={selecionado.id}
            veiculo={selecionado}
            voltar={() => {
              setSelecionado(null);
              setPagina("estoque");
              void tarefa(carregar);
            }}
          />
        ) : (
          <section className="panel">
            <div className="actions">
              <h2>Veículos nas pastas</h2>
              <button
                role="switch"
                aria-checked={soEstoque}
                className={soEstoque ? "chave ligada" : "chave"}
                title="Mostra só os veículos que estão em estoque no BNDV (não vendidos)"
                onClick={() => setSoEstoque(!soEstoque)}
              >
                <span className="chave-trilho" aria-hidden="true" />
                BNDV
              </button>
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
                      <SelosAnexos
                        status={v.pasta ? anexos[v.pasta] : undefined}
                      />
                    </td>
                    <td>
                      <div className="acoes-linha">
                        <button
                          onClick={() => {
                            setPagina("studio");
                            setSelecionado(v);
                          }}
                        >
                          Abrir ficha →
                        </button>
                        <button
                          disabled={!v.pasta}
                          title={
                            v.pasta
                              ? "Abre a pasta do veículo no Explorador de Arquivos"
                              : "Veículo sem pasta vinculada"
                          }
                          onClick={() => {
                            setErro("");
                            openPath(v.pasta!).catch((e) => setErro(String(e)));
                          }}
                        >
                          Abrir pasta
                        </button>
                      </div>
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
