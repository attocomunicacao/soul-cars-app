import { useCallback, useEffect, useRef, useState } from "react";
import { ask, invoke, open } from "./lib/desktop";
import {
  CONTAS_VARIAVEIS,
  lerPlanilhaFinancas,
  lerValorDigitado,
  resumirMes,
  valorVariavel,
  type Conta,
  type Mes,
} from "./lib/financas";
import { moeda } from "./lib/format";

type Estado = { caminho: string | null; nome: string | null; existe: boolean };
type Lida = Estado & {
  base64: string;
  pagos: Record<string, boolean>;
  modificado: number;
};
type Operacao = {
  op: "celula" | "novo_mes";
  aba: string;
  linha?: number;
  coluna?: number;
  valor?: string | null;
  tipo?: "numero";
  variaveis?: string[][];
};

const NOMES_MES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function hojeIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const dataBr = (iso: string | null, vazio = "—") =>
  iso ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : vazio;

const numeroBr = (n: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ou = (texto: string) => (texto && texto !== "-" ? texto : "—");

/** Caixa de "pago": clique, ou clique e arraste por várias linhas. */
function CaixaPago({
  marcado,
  rotulo,
  aoPressionar,
  aoEntrar,
  aoAlternar,
}: {
  marcado: boolean;
  rotulo: string;
  aoPressionar?: () => void;
  aoEntrar?: () => void;
  aoAlternar?: () => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      tabIndex={0}
      className={`caixa-pago${marcado ? " marcado" : ""}`}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        aoPressionar?.();
      }}
      onMouseEnter={aoEntrar}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          aoAlternar?.();
        }
      }}
    >
      {marcado ? "✓" : ""}
    </span>
  );
}

/** Finanças: abas mensais da planilha vinculada; aqui se lança o valor das contas variáveis e o que foi pago. */
export function Financas({ aoErro }: { aoErro: (mensagem: string) => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [meses, setMeses] = useState<Mes[]>([]);
  const [pagos, setPagos] = useState<Record<string, boolean>>({});
  const [mesAtual, setMesAtual] = useState("");
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiada, setCopiada] = useState("");
  const lidoEm = useRef(0);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const montado = useRef(true);
  /** Arrasto de "pago": valor aplicado às linhas por onde o mouse passa e o que mudou. */
  const arrasto = useRef<{ valor: boolean; chaves: Set<string> } | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const aplicar = useCallback(async (lida: Lida) => {
    const lidos = await lerPlanilhaFinancas(lida.base64);
    if (!montado.current) return lidos;
    lidoEm.current = lida.modificado;
    setMeses(lidos);
    setPagos(lida.pagos);
    setMesAtual((atual) => {
      if (lidos.some((m) => m.nome === atual)) return atual;
      const doMes = NOMES_MES[new Date().getMonth()];
      return (lidos.find((m) => m.nome.toUpperCase() === doMes) ?? lidos[0])
        .nome;
    });
    return lidos;
  }, []);

  const carregar = useCallback(async () => {
    setOcupado(true);
    aoErro("");
    try {
      const e = await invoke<Estado>("financas_estado");
      if (!montado.current) return;
      setEstado(e);
      if (!e.caminho) {
        setMeses([]);
        return;
      }
      if (!e.existe)
        throw new Error(
          "A planilha vinculada não está mais no lugar. Vincule de novo.",
        );
      await aplicar(await invoke<Lida>("financas_ler"));
    } catch (e) {
      aoErro(String(e));
    } finally {
      if (montado.current) setOcupado(false);
    }
  }, [aoErro, aplicar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Edições entram numa fila: o motor grava uma de cada vez e a tela lê o resultado. */
  const editar = useCallback(
    (operacoes: Operacao[]) => {
      const tarefa = fila.current.then(async () => {
        setOcupado(true);
        try {
          aoErro("");
          const lidos = await aplicar(
            await invoke<Lida>("financas_editar", {
              operacoes,
              lidoEm: lidoEm.current,
            }),
          );
          // Mês novo: já abre nele.
          if (operacoes.some((o) => o.op === "novo_mes") && montado.current)
            setMesAtual(lidos[lidos.length - 1].nome);
        } catch (e) {
          aoErro(String(e).replace(/^Error: /, ""));
          // A planilha pode ter mudado: lê de novo para a tela não mostrar o que não está no arquivo.
          try {
            await aplicar(await invoke<Lida>("financas_ler"));
          } catch {
            /* o erro acima já está na tela */
          }
        } finally {
          if (montado.current) setOcupado(false);
        }
      });
      fila.current = tarefa;
      return tarefa;
    },
    [aoErro, aplicar],
  );

  async function vincular() {
    try {
      const origem = await open({
        title: "Escolha a planilha de finanças",
        filters: [{ name: "Planilha Excel", extensions: ["xlsx"] }],
      });
      if (typeof origem !== "string") return;
      await invoke("financas_vincular", { origem });
      await carregar();
    } catch (e) {
      aoErro(String(e));
    }
  }

  /** Marca na tela já e grava em lote (um clique, um arrasto ou "todos"). */
  const gravarPagos = useCallback(
    async (chaves: string[], pago: boolean) => {
      if (!chaves.length) return;
      setPagos((atual) => {
        const novo = { ...atual };
        for (const c of chaves) {
          if (pago) novo[c] = true;
          else delete novo[c];
        }
        return novo;
      });
      try {
        await invoke("financas_pago", { chaves, pago });
      } catch (e) {
        aoErro(String(e));
        void carregar();
      }
    },
    [aoErro, carregar],
  );

  // Soltar o mouse em qualquer lugar encerra o arrasto e grava o que foi marcado.
  useEffect(() => {
    const soltar = () => {
      const a = arrasto.current;
      arrasto.current = null;
      if (a) void gravarPagos([...a.chaves], a.valor);
    };
    window.addEventListener("mouseup", soltar);
    return () => window.removeEventListener("mouseup", soltar);
  }, [gravarPagos]);

  function comecarArrasto(conta: Conta) {
    const valor = !pagos[conta.id];
    arrasto.current = { valor, chaves: new Set([conta.id]) };
    setPagos((atual) => {
      const novo = { ...atual };
      if (valor) novo[conta.id] = true;
      else delete novo[conta.id];
      return novo;
    });
  }

  function passarPor(conta: Conta) {
    const a = arrasto.current;
    if (!a || a.chaves.has(conta.id)) return;
    a.chaves.add(conta.id);
    setPagos((atual) => {
      const novo = { ...atual };
      if (a.valor) novo[conta.id] = true;
      else delete novo[conta.id];
      return novo;
    });
  }

  /** Grava o valor se o texto mudou; entrada inválida volta ao valor anterior. */
  function confirmarValor(aba: string, conta: Conta, campo: HTMLInputElement) {
    const digitado = campo.value.trim();
    if (digitado === campo.defaultValue) return;
    const n = lerValorDigitado(digitado);
    if (n === undefined) {
      aoErro("Valor inválido. Use números, como 1.234,56.");
      campo.value = campo.defaultValue;
      return;
    }
    void editar([
      {
        op: "celula",
        aba,
        linha: conta.linha,
        coluna: 4,
        valor: n === null ? null : String(n),
        tipo: "numero",
      },
    ]);
  }

  /** Enter desce uma linha, setas sobem e descem, Esc desfaz — como numa planilha. */
  function teclar(e: React.KeyboardEvent<HTMLInputElement>, conta: Conta) {
    const campo = e.currentTarget;
    const coluna = campo.dataset.coluna;
    const mover = (delta: number) => {
      const campos = [
        ...document.querySelectorAll<HTMLInputElement>(
          `input[data-coluna="${coluna}"]`,
        ),
      ];
      const alvo = campos[campos.indexOf(campo) + delta];
      if (alvo) {
        e.preventDefault();
        alvo.focus();
        alvo.select();
      }
    };
    if (e.key === "Enter") {
      mover(1);
      campo.blur();
    } else if (e.key === "ArrowDown") mover(1);
    else if (e.key === "ArrowUp") mover(-1);
    else if (e.key === "Escape") {
      campo.value = campo.defaultValue;
      campo.blur();
    }
    void conta;
  }

  async function copiarChave(chave: string) {
    try {
      await invoke("copiar_texto", { texto: chave });
      setCopiada(chave);
      setTimeout(() => montado.current && setCopiada(""), 1500);
    } catch (e) {
      aoErro(String(e));
    }
  }

  async function novoMes(ultimo: Mes) {
    const sim = await ask(
      `Criar o mês seguinte a ${ultimo.nome}? As contas e os valores fixos vêm de ${ultimo.nome}; os valores variáveis ficam em branco para você lançar. Uma cópia de segurança da planilha é guardada antes.`,
    );
    if (sim)
      void editar([
        { op: "novo_mes", aba: ultimo.nome, variaveis: CONTAS_VARIAVEIS },
      ]);
  }

  if (!estado) return <section className="panel">Carregando…</section>;

  if (!estado.caminho || !estado.existe)
    return (
      <section className="panel">
        <h2>Vincule a planilha de finanças</h2>
        <p>
          A planilha tem uma aba por mês (julho, agosto…), com as contas por
          vencimento. Aqui você lança o valor das contas variáveis e marca o que
          já foi pago; o resto da planilha é editado só no Excel.
        </p>
        <button className="primary" onClick={() => void vincular()}>
          Vincular planilha
        </button>
      </section>
    );

  const hoje = hojeIso();
  const mes = meses.find((m) => m.nome === mesAtual) ?? meses[0];
  const resumo = mes ? resumirMes(mes, pagos, hoje) : null;
  const termo = busca.trim().toLowerCase();

  return (
    <>
      <div className="actions">
        <button
          disabled={ocupado}
          onClick={() => void carregar()}
          title="Lê a planilha de novo, depois de salvar no Excel."
        >
          {ocupado ? "Aguarde…" : "Reler planilha"}
        </button>
        <button
          onClick={() =>
            void invoke("financas_abrir").catch((e) => aoErro(String(e)))
          }
          title="Abre no Excel. Feche antes de lançar valores aqui: o Excel trava o arquivo."
        >
          Abrir no Excel
        </button>
        <button onClick={() => void vincular()}>Trocar planilha</button>
      </div>
      <nav>
        {meses.map((m) => (
          <button
            key={m.nome}
            className={m.nome === mes?.nome ? "selected" : ""}
            onClick={() => setMesAtual(m.nome)}
          >
            {m.nome.charAt(0) + m.nome.slice(1).toLowerCase()}
          </button>
        ))}
        {meses.length > 0 && (
          <button
            disabled={ocupado}
            title="Cria o mês seguinte com as contas do último mês"
            onClick={() => void novoMes(meses[meses.length - 1])}
          >
            + Novo mês
          </button>
        )}
      </nav>
      {mes && resumo && (
        <>
          <div className="metrics">
            {[
              ["Total do mês", moeda(resumo.total)],
              ["Pago", moeda(resumo.pago)],
              ["A pagar", moeda(resumo.aPagar)],
              [
                "Próximo vencimento",
                resumo.proxima
                  ? `${dataBr(resumo.proxima.vencimento)} · ${resumo.proxima.destinatario}`
                  : resumo.atrasadas
                    ? `${resumo.atrasadas} em atraso`
                    : "Tudo em dia",
              ],
            ].map(([rotulo, valor]) => (
              <div key={rotulo}>
                <span>{rotulo}</span>
                <strong>{valor}</strong>
              </div>
            ))}
          </div>
          <input
            placeholder="Buscar destinatário, via ou local"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {mes.blocos.map((bloco, indice) => {
            const contas = bloco.contas.filter((c) =>
              [c.destinatario, c.via, c.local, c.acesso]
                .join(" ")
                .toLowerCase()
                .includes(termo),
            );
            const todosPagos =
              bloco.contas.length > 0 && bloco.contas.every((c) => pagos[c.id]);
            return (
              <section className="panel" key={bloco.linhaTotal}>
                <h2>{bloco.rotulo}</h2>
                <div style={{ overflowX: "auto" }}>
                  <table className="grade-financas">
                    <thead>
                      <tr>
                        <th>
                          <span className="pago-titulo">
                            <CaixaPago
                              marcado={todosPagos}
                              rotulo="Marcar todos como pagos"
                              aoAlternar={() =>
                                void gravarPagos(
                                  bloco.contas.map((c) => c.id),
                                  !todosPagos,
                                )
                              }
                              aoPressionar={() =>
                                void gravarPagos(
                                  bloco.contas.map((c) => c.id),
                                  !todosPagos,
                                )
                              }
                            />
                            Pago
                          </span>
                        </th>
                        <th>Vencimento</th>
                        <th>Destinatário</th>
                        <th>Valor</th>
                        <th>Chave</th>
                        <th>Via</th>
                        <th>Acesso</th>
                        <th>Local</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contas.map((c) => {
                        const paga = !!pagos[c.id];
                        const atrasada =
                          !paga && !!c.vencimento && c.vencimento < hoje;
                        const variavel = valorVariavel(indice, c.destinatario);
                        return (
                          <tr key={c.linha} className={paga ? "paga" : ""}>
                            <td>
                              <CaixaPago
                                marcado={paga}
                                rotulo={`Marcar ${c.destinatario} como pago`}
                                aoPressionar={() => comecarArrasto(c)}
                                aoEntrar={() => passarPor(c)}
                                aoAlternar={() =>
                                  void gravarPagos([c.id], !paga)
                                }
                              />
                            </td>
                            <td
                              className={atrasada ? "fixa atrasada" : "fixa"}
                              title={
                                atrasada
                                  ? "Vencida e ainda não paga"
                                  : undefined
                              }
                            >
                              {dataBr(c.vencimento)}
                            </td>
                            <td className="fixa">
                              <strong>{c.destinatario}</strong>
                            </td>
                            <td className={variavel ? undefined : "fixa"}>
                              {variavel ? (
                                <input
                                  key={c.valor ?? ""}
                                  defaultValue={
                                    c.valor === null ? "" : numeroBr(c.valor)
                                  }
                                  placeholder="lançar"
                                  disabled={ocupado}
                                  data-coluna={4}
                                  aria-label={`Valor de ${c.destinatario}`}
                                  style={{ minWidth: 110, textAlign: "right" }}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onKeyDown={(e) => teclar(e, c)}
                                  onBlur={(e) =>
                                    confirmarValor(mes.nome, c, e.currentTarget)
                                  }
                                />
                              ) : (
                                <span
                                  style={{
                                    display: "block",
                                    textAlign: "right",
                                  }}
                                >
                                  {c.valor === null ? "—" : moeda(c.valor)}
                                </span>
                              )}
                            </td>
                            <td className="fixa copiavel">
                              {ou(c.chave)}
                              {c.chave && c.chave !== "-" && (
                                <button
                                  className="copiar-chave"
                                  title="Copiar chave"
                                  aria-label={`Copiar chave de ${c.destinatario}`}
                                  onClick={() => void copiarChave(c.chave)}
                                >
                                  {copiada === c.chave ? "Copiado" : "Copiar"}
                                </button>
                              )}
                            </td>
                            <td className="fixa">{ou(c.via)}</td>
                            <td className="fixa">{ou(c.acesso)}</td>
                            <td className="fixa">{ou(c.local)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p>
                  Total: <strong>{moeda(bloco.total)}</strong>
                </p>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
