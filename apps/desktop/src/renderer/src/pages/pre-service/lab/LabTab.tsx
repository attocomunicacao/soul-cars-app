/**
 * Aba "Laboratório" do Pré-atendimento IA: roda cenários de teste (frases e situações de clientes)
 * pelo mesmo caminho do atendimento real, mostra a resposta da IA com os alertas automáticos
 * (repetição, CPF em claro, pergunta repetida…) e deixa o usuário dar nota e marcar o tipo de erro.
 * O relatório com as notas vai para o chat, para melhorar a IA. Nada é enviado ao uTalk.
 * Ciclo rápido: conjunto rápido, só as falhas, erros reais da auditoria e estimativa de tokens (o
 * plano grátis do Groq tem limite diário).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ETIQUETAS_ERRO, type EtiquetaErro } from "../../../../../shared/lab";
import { ROTULO_SINAL } from "../../../../../shared/pre-service-audit";
import { Selo, textoDoErro } from "../../../app/components";
import { listen } from "../../../lib/desktop-bridge";
import {
  lab,
  type CenariosLab,
  type ExecucaoLab,
  type ResultadoLab,
  type ResumoExecucao,
} from "../../../lib/lab-client";
import type { Avaliacao } from "../../../../../shared/lab";

type Progresso = { feito: number; total: number };

/** Tokens por chamada quando ainda não há execução medida (prompt com persona, regras e contexto). */
const TOKENS_POR_CHAMADA_PADRAO = 2500;
/** Limite diário aproximado do plano grátis do Groq (confira no painel do Groq). */
const LIMITE_DIARIO_TOKENS = 200_000;

const milhar = (n: number) => n.toLocaleString("pt-BR");

/** Chave de uma resposta avaliável dentro da execução. */
const chave = (id: string, repeticao: number, turno: number) =>
  `${id}|${repeticao}|${turno}`;

export function LabTab({ aoErro }: { aoErro: (m: string) => void }) {
  const [cen, setCen] = useState<CenariosLab | null>(null);
  const [categoria, setCategoria] = useState("");
  const [repeticoes, setRepeticoes] = useState(1);
  const [exec, setExec] = useState<ExecucaoLab | null>(null);
  const [execucoes, setExecucoes] = useState<ResumoExecucao[]>([]);
  const [notas, setNotas] = useState<Map<string, Avaliacao>>(new Map());
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [soFalhas, setSoFalhas] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [relatorio, setRelatorio] = useState("");

  const carregar = useCallback(async () => {
    try {
      setCen(await lab.cenarios());
      setExecucoes(await lab.execucoes());
    } catch (e) {
      aoErro(textoDoErro(e));
    }
  }, [aoErro]);

  useEffect(() => {
    void carregar();
    let desligar: (() => void) | null = null;
    let vivo = true;
    void listen<Progresso>("lab:progresso", (ev) =>
      setProgresso(ev.payload),
    ).then((d) => {
      if (vivo) desligar = d;
      else d();
    });
    return () => {
      vivo = false;
      desligar?.();
    };
  }, [carregar]);

  /** Abre uma execução e carrega as notas já dadas a ela. */
  const abrir = useCallback(
    async (e: ExecucaoLab) => {
      setExec(e);
      setRelatorio("");
      try {
        const lista = await lab.avaliacoes(e.id);
        setNotas(
          new Map(
            lista.map((a) => [chave(a.cenarioId, a.repeticao, a.turno), a]),
          ),
        );
      } catch (err) {
        aoErro(textoDoErro(err));
      }
    },
    [aoErro],
  );

  async function tarefa(nome: string, fn: () => Promise<void>) {
    setOcupado(nome);
    setAviso("");
    try {
      await fn();
    } catch (e) {
      aoErro(textoDoErro(e));
    } finally {
      setOcupado(null);
      setProgresso(null);
    }
  }

  /** Roda a categoria escolhida ou, se vier `ids`, só esses cenários. */
  const rodar = (ids?: string[]) =>
    tarefa("rodar", async () => {
      const e = await lab.rodar(
        ids
          ? { ids, repeticoes }
          : { categoria: categoria || undefined, repeticoes },
      );
      await abrir(e);
      setExecucoes(await lab.execucoes());
      if (e.interrompida)
        setAviso(
          `${e.interrompida} (${e.resultados.length} de ${e.pedidos ?? e.resultados.length} rodados)`,
        );
    });

  /** Cenários da execução aberta com falha automática ou nota 3 ou menos. */
  const idsComProblema = useMemo(() => {
    if (!exec) return [];
    const ruins = new Set(
      [...notas.values()].filter((a) => a.nota <= 3).map((a) => a.cenarioId),
    );
    return [
      ...new Set(
        exec.resultados
          .filter((r) => r.falhas.length || ruins.has(r.id))
          .map((r) => r.id),
      ),
    ];
  }, [exec, notas]);

  /** Média de tokens por chamada nas execuções anteriores (ou o padrão, se nada foi medido). */
  const tokensPorChamada = useMemo(() => {
    const chamadas = execucoes.reduce((s, x) => s + (x.chamadas ?? 0), 0);
    const tokens = execucoes.reduce((s, x) => s + (x.tokens ?? 0), 0);
    return chamadas ? Math.round(tokens / chamadas) : TOKENS_POR_CHAMADA_PADRAO;
  }, [execucoes]);

  /** Estimativa de chamadas e tokens para uma lista de cenários (cada turno = 1 chamada). */
  const estimar = (ids: Set<string> | null) => {
    const lista = (cen?.cenarios ?? []).filter((c) =>
      ids ? ids.has(c.id) : !categoria || c.categoria === categoria,
    );
    const chamadas = lista.reduce((s, c) => s + c.turnos, 0) * repeticoes;
    return {
      cenarios: lista.length,
      chamadas,
      tokens: chamadas * tokensPorChamada,
    };
  };

  const gerarRelatorio = () =>
    tarefa("relatorio", async () => {
      if (exec) setRelatorio(await lab.relatorio(exec.id));
    });

  const resultados = useMemo(() => {
    const todos = exec?.resultados ?? [];
    return soFalhas ? todos.filter((r) => r.falhas.length) : todos;
  }, [exec, soFalhas]);

  if (!cen) return <p className="empty">Carregando…</p>;
  const comFalhas = exec?.resultados.filter((r) => r.falhas.length).length ?? 0;
  const est = estimar(null);
  const daAuditoria = cen.cenarios.filter((c) => c.categoria === "auditoria");

  return (
    <div className="panel">
      <h2>Laboratório de testes da IA</h2>
      <p className="hint">
        {cen.total} cenários ({cen.base} escritos à mão). Cada um roda pelo
        mesmo caminho do atendimento real, com o modelo configurado, e nada é
        enviado ao uTalk. Dê nota às respostas e exporte o relatório para
        melhorar a IA.
      </p>

      <h3>Histórico do uTalk</h3>
      <p className="hint">
        Baixa todas as conversas para este computador e gera uma análise
        anonimizada (perguntas frequentes e respostas repetidas) que vira novos
        cenários. Dados reais ficam fora do git.
      </p>
      <p>
        <button
          disabled={!!ocupado}
          onClick={() =>
            tarefa("sync", async () => {
              await lab.sincronizarHistorico();
              setAviso("Histórico sincronizado.");
            })
          }
        >
          {ocupado === "sync" ? "Sincronizando…" : "Sincronizar histórico"}
        </button>{" "}
        {ocupado === "sync" && (
          <button onClick={() => void lab.cancelarSincronizacao()}>
            Cancelar
          </button>
        )}{" "}
        <button
          disabled={!!ocupado}
          onClick={() =>
            tarefa("analisar", async () => {
              const r = await lab.analisarHistorico();
              setAviso(
                `Análise pronta: ${r.analise.conversas} conversas, ${r.analise.mensagens} mensagens. Relatório em ${r.pasta}.`,
              );
              await carregar();
            })
          }
        >
          Analisar histórico
        </button>{" "}
        <button onClick={() => void lab.abrirPasta()}>Abrir pasta</button>
      </p>
      {aviso && <p className="hint">{aviso}</p>}

      {cen.atendimentoLigado && (
        <div role="alert" className="notice error">
          <span>
            O atendimento ao vivo está ligado e usa a mesma cota grátis do Groq
            que o Laboratório. Testes longos podem esgotar a cota e deixar os
            clientes sem resposta rápida.
          </span>
        </div>
      )}

      <h3>Ciclo rápido</h3>
      <p className="hint">
        Para corrigir os poucos pontos em que a IA erra: rode o conjunto rápido
        ou os erros reais, ajuste e rode só as falhas de novo. Cada resposta usa
        ~{milhar(tokensPorChamada)} tokens; o plano grátis do Groq dá ~
        {milhar(LIMITE_DIARIO_TOKENS)} por dia.
      </p>
      <p>
        <button
          disabled={!!ocupado || !cen.rapido.length}
          onClick={() => void rodar(cen.rapido)}
          title={`~${milhar(estimar(new Set(cen.rapido)).tokens)} tokens`}
        >
          Conjunto rápido ({cen.rapido.length})
        </button>{" "}
        <button
          disabled={!!ocupado}
          onClick={() =>
            tarefa("auditoria", async () => {
              const r = await lab.cenariosDaAuditoria();
              await carregar();
              setAviso(
                r.cenarios
                  ? `${r.cenarios} cenários criados a partir de erros reais (categoria "auditoria"), anonimizados.`
                  : "Nenhum erro com alerta na auditoria do atendimento.",
              );
            })
          }
        >
          Cenários da auditoria
        </button>{" "}
        {daAuditoria.length > 0 && (
          <button
            disabled={!!ocupado}
            onClick={() => void rodar(daAuditoria.map((c) => c.id))}
          >
            Rodar erros reais ({daAuditoria.length})
          </button>
        )}{" "}
        {exec && idsComProblema.length > 0 && (
          <button
            disabled={!!ocupado}
            onClick={() => void rodar(idsComProblema)}
            title="Cenários desta execução com falha automática ou nota até 3"
          >
            Rodar só as falhas ({idsComProblema.length})
          </button>
        )}
      </p>

      <h3>Executar cenários</h3>
      <p>
        <label>
          Categoria{" "}
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas ({cen.total})</option>
            {cen.categorias.map((c) => (
              <option key={c} value={c}>
                {c} ({cen.cenarios.filter((x) => x.categoria === c).length})
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          Repetições{" "}
          <select
            value={repeticoes}
            onChange={(e) => setRepeticoes(Number(e.target.value))}
          >
            {[1, 2, 3, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>{" "}
        <button disabled={!!ocupado} onClick={() => void rodar()}>
          {ocupado === "rodar" ? "Rodando…" : "Rodar"}
        </button>{" "}
        {ocupado === "rodar" && (
          <button onClick={() => void lab.cancelar()}>Parar</button>
        )}
      </p>
      <p className="hint">
        {est.cenarios} cenários × {repeticoes} ≈ {milhar(est.chamadas)} chamadas
        (~{milhar(est.tokens)} tokens)
        {est.tokens > LIMITE_DIARIO_TOKENS &&
          " — passa do limite diário do Groq grátis: escolha uma categoria ou o conjunto rápido."}
      </p>
      {progresso && (
        <progress
          max={progresso.total}
          value={progresso.feito}
          aria-label="Progresso da execução"
        />
      )}

      {execucoes.length > 0 && (
        <p>
          <label>
            Execuções anteriores{" "}
            <select
              value={exec?.id ?? ""}
              onChange={(e) => {
                if (e.target.value)
                  void tarefa("abrir", async () =>
                    abrir(await lab.execucao(e.target.value)),
                  );
              }}
            >
              <option value="">Escolher…</option>
              {execucoes.map((x) => (
                <option key={x.id} value={x.id}>
                  {new Date(x.em).toLocaleString("pt-BR")} · {x.cenarios}{" "}
                  cenários · {x.comFalhas} com falha
                  {x.tokens ? ` · ${milhar(x.tokens)} tokens` : ""}
                  {x.interrompida ? " · interrompida" : ""}
                </option>
              ))}
            </select>
          </label>
        </p>
      )}

      {exec && (
        <>
          <h3>
            Resultado{" "}
            <Selo tom={comFalhas ? "atencao" : "bom"}>
              {comFalhas
                ? `${comFalhas} com falha automática`
                : "Sem falhas automáticas"}
            </Selo>
          </h3>
          <p className="hint">
            Modelo {exec.modelo} · {exec.resultados.length} execuções
            {exec.tokens ? ` · ${milhar(exec.tokens)} tokens` : ""}.
          </p>
          {exec.interrompida && (
            <div role="alert" className="notice error">
              <span>
                {exec.interrompida} ({exec.resultados.length} de{" "}
                {exec.pedidos ?? exec.resultados.length})
              </span>
            </div>
          )}
          <p>
            <label>
              <input
                type="checkbox"
                checked={soFalhas}
                onChange={(e) => setSoFalhas(e.target.checked)}
              />{" "}
              Só com falha automática
            </label>{" "}
            <button disabled={!!ocupado} onClick={() => void gerarRelatorio()}>
              Gerar relatório (com notas)
            </button>
          </p>
          {relatorio && (
            <>
              <p className="hint">
                Copie e cole no chat para eu ajustar a IA com base nas suas
                notas.
              </p>
              <textarea readOnly rows={12} value={relatorio} />
              <p>
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(relatorio)
                      .then(() => setAviso("Relatório copiado."))
                  }
                >
                  Copiar
                </button>
              </p>
            </>
          )}
          {resultados.length === 0 ? (
            <p className="hint">Nada para mostrar.</p>
          ) : (
            <ul className="registro-ia">
              {resultados.slice(0, 200).map((r) => (
                <Resultado
                  key={`${r.id}|${r.repeticao}`}
                  r={r}
                  execucaoId={exec.id}
                  notas={notas}
                  aoSalvar={(a) =>
                    setNotas((m) =>
                      new Map(m).set(
                        chave(a.cenarioId, a.repeticao, a.turno),
                        a,
                      ),
                    )
                  }
                  aoErro={aoErro}
                />
              ))}
            </ul>
          )}
          {resultados.length > 200 && (
            <p className="hint">
              Mostrando 200 de {resultados.length}. Use a categoria para
              filtrar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Um cenário executado: cada turno com a resposta da IA, os alertas e o formulário de nota. */
function Resultado({
  r,
  execucaoId,
  notas,
  aoSalvar,
  aoErro,
}: {
  r: ResultadoLab;
  execucaoId: string;
  notas: Map<string, Avaliacao>;
  aoSalvar: (a: Avaliacao) => void;
  aoErro: (m: string) => void;
}) {
  return (
    <li>
      <strong>{r.id}</strong> · {r.titulo}
      {r.repeticao > 1 && (
        <span className="hint"> · repetição {r.repeticao}</span>
      )}
      {r.falhas.map((f) => (
        <div key={f} role="alert" className="notice error">
          <span>{f}</span>
        </div>
      ))}
      {r.turnos.map((t, i) => (
        <div key={i} className="turno-lab">
          <p>
            <b>Cliente:</b> {t.cliente}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            <b>IA:</b> {t.texto || "(vazio)"}
            {t.transferir && <Selo tom="info">Transferiu</Selo>}
            {t.omitido && <Selo tom="atencao">Seria omitida</Selo>}
          </p>
          {t.sinais.length > 0 && (
            <p className="hint">
              {t.sinais.map((s) => ROTULO_SINAL[s] ?? s).join(" · ")}
            </p>
          )}
          <p className="hint">
            {[
              t.uso && `${t.uso.provedor}${t.uso.reserva ? " (reserva)" : ""}`,
              t.uso?.tokens && `${milhar(t.uso.tokens)} tokens`,
              t.reais ? `${t.reais} exemplos reais` : null,
              `${milhar(t.latenciaMs)} ms`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Nota
            execucaoId={execucaoId}
            cenarioId={r.id}
            repeticao={r.repeticao}
            turno={i}
            atual={notas.get(chave(r.id, r.repeticao, i))}
            aoSalvar={aoSalvar}
            aoErro={aoErro}
          />
        </div>
      ))}
    </li>
  );
}

/** Formulário de avaliação de uma resposta: nota de 1 a 5, tipos de erro e comentário. */
function Nota({
  execucaoId,
  cenarioId,
  repeticao,
  turno,
  atual,
  aoSalvar,
  aoErro,
}: {
  execucaoId: string;
  cenarioId: string;
  repeticao: number;
  turno: number;
  atual?: Avaliacao;
  aoSalvar: (a: Avaliacao) => void;
  aoErro: (m: string) => void;
}) {
  const [nota, setNota] = useState<number>(atual?.nota ?? 0);
  const [etiquetas, setEtiquetas] = useState<EtiquetaErro[]>(
    atual?.etiquetas ?? [],
  );
  const [comentario, setComentario] = useState(atual?.comentario ?? "");
  const [salvo, setSalvo] = useState(!!atual);

  async function salvar() {
    if (!nota) return;
    try {
      const a = await lab.avaliar({
        execucaoId,
        cenarioId,
        repeticao,
        turno,
        nota,
        etiquetas,
        comentario,
      });
      aoSalvar(a);
      setSalvo(true);
    } catch (e) {
      aoErro(textoDoErro(e));
    }
  }

  return (
    <details>
      <summary>
        {salvo ? `Avaliada: ${nota}/5` : "Avaliar esta resposta"}
      </summary>
      <p>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-pressed={nota === n}
            onClick={() => {
              setNota(n);
              setSalvo(false);
            }}
          >
            {n}
          </button>
        ))}
      </p>
      <p>
        {ETIQUETAS_ERRO.map((e) => (
          <label key={e} style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={etiquetas.includes(e)}
              onChange={(ev) => {
                setSalvo(false);
                setEtiquetas((l) =>
                  ev.target.checked ? [...l, e] : l.filter((x) => x !== e),
                );
              }}
            />{" "}
            {e}
          </label>
        ))}
      </p>
      <p>
        <input
          value={comentario}
          maxLength={1000}
          placeholder="Comentário (o que estava errado ou como deveria ser)"
          onChange={(e) => {
            setComentario(e.target.value);
            setSalvo(false);
          }}
        />{" "}
        <button disabled={!nota || salvo} onClick={() => void salvar()}>
          Salvar
        </button>
      </p>
    </details>
  );
}
