/**
 * Página Pré-atendimento IA (portada do Soul IA): a IA atende pelo WhatsApp (uTalk) os leads com a
 * etiqueta de gatilho, envia fotos das pastas do ESTOQUE e passa para a equipe quando o lead quer
 * visitar ou falar com alguém. Abas: Visão geral, Aprovação, Auditoria, Ensinar (simulador), Respostas-rápidas,
 * Loja e Configurações. Tudo passa pelos comandos `pre_*` do processo principal; a chave do Groq e o
 * token do uTalk nunca chegam aqui.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ROTULO_SINAL,
  type TurnoAuditado,
} from "../../../../shared/pre-service-audit";
import type {
  ConfigIa,
  ExemploIa,
  LojaIa,
  MensagemIa,
  RespostaRapida,
} from "../../../../shared/pre-service";
import {
  Kpi,
  Segmentado,
  Selo,
  Vazio,
  ha,
  textoDoErro,
} from "../../app/components";
import { Icon } from "../../app/icons";
import { invoke, listen } from "../../lib/desktop-bridge";

type Rascunho = {
  id: string;
  chatId: string;
  nome: string;
  pergunta: string;
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  fotos: string[];
  veiculoFotos: string | null;
  em: number;
};
type Painel = {
  config: ConfigIa;
  loja: LojaIa;
  persona: string;
  respostas: RespostaRapida[];
  exemplos: ExemploIa[];
  rascunhos: Rascunho[];
  chats: {
    chatId: string;
    nome: string;
    status: "ativo" | "humano" | "encerrado";
    mensagens: number;
    ultima: { role: string; content: string; em: number } | null;
    ultimaIaEm: number | null;
  }[];
  registros: { em: string; tipo: string; texto: string }[];
  laco: {
    rodando: boolean;
    ultimaRodada: string | null;
    ultimoErro: string | null;
  };
  conexoes: { utalk: boolean; groq: boolean };
  estoque: number;
  exemplosReais: number;
};
type Aba =
  | "visao"
  | "aprovacao"
  | "auditoria"
  | "ensinar"
  | "respostas"
  | "loja"
  | "config";

const ABAS = [
  ["visao", "Visão geral"],
  ["aprovacao", "Aprovação"],
  ["auditoria", "Auditoria"],
  ["ensinar", "Ensinar"],
  ["respostas", "Respostas-rápidas"],
  ["loja", "Loja"],
  ["config", "Configurações"],
] as const;

const STATUS = {
  ativo: ["info", "Com a IA"],
  humano: ["atencao", "Com a equipe"],
  encerrado: ["neutro", "Encerrado"],
} as const;

export function PreServicePage({
  aoErro,
  abrirConfiguracoes,
}: {
  aoErro: (m: string) => void;
  abrirConfiguracoes: () => void;
}) {
  const [p, setP] = useState<Painel | null>(null);
  const [aba, setAba] = useState<Aba>("visao");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setP(await invoke<Painel>("pre_painel"));
    } catch (e) {
      aoErro(textoDoErro(e));
    }
  }, [aoErro]);

  useEffect(() => {
    void carregar();
    let desligar: (() => void) | null = null;
    let vivo = true;
    void listen("preatendimento:mudou", () => void carregar()).then((d) => {
      if (vivo) desligar = d;
      else d();
    });
    return () => {
      vivo = false;
      desligar?.();
    };
  }, [carregar]);

  /** Roda um comando que devolve o painel novo, mostrando o erro se falhar. */
  const agir = useCallback(
    async (comando: string, args: Record<string, unknown> = {}) => {
      setOcupado(true);
      try {
        const r = await invoke<Painel | { painel: Painel }>(comando, args);
        if (r && "painel" in r) setP(r.painel);
        else if (r && "config" in r) setP(r);
        else await carregar();
        return true;
      } catch (e) {
        aoErro(textoDoErro(e));
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [aoErro, carregar],
  );

  if (!p) return <p className="empty">Carregando…</p>;

  return (
    <section className="pre-atendimento">
      <div className="page-head">
        <div>
          <p className="eyebrow">CRM · uTalk</p>
          <h1>Pré-atendimento IA</h1>
          <p>
            {p.config.ligado ? "Atendimento ligado" : "Atendimento desligado"} ·{" "}
            {p.config.enviarSemAprovacao
              ? "envia sem aprovação"
              : "pede aprovação"}{" "}
            ·{" "}
            {p.config.provedor === "groq"
              ? `Groq ${p.config.modeloGroq}`
              : `Ollama ${p.config.modeloOllama}`}
          </p>
        </div>
        <div className="actions">
          <button
            disabled={ocupado || !p.config.etiquetaGatilhoId}
            title={
              p.config.etiquetaGatilhoId
                ? "Verifica os leads agora"
                : "Escolha a etiqueta de gatilho nas Configurações"
            }
            onClick={() => void agir("pre_rodar")}
          >
            <Icon nome="recarregar" />
            Verificar agora
          </button>
        </div>
      </div>

      {!p.conexoes.utalk && (
        <div className="notice com-fechar">
          <span>
            Cadastre o token do uTalk para a IA ler e responder os leads.
          </span>
          <button className="plain small" onClick={abrirConfiguracoes}>
            Conexões
          </button>
        </div>
      )}
      {p.laco.ultimoErro && (
        <div role="alert" className="notice error">
          <span>{p.laco.ultimoErro}</span>
        </div>
      )}

      <div className="filtros">
        <Segmentado rotulo="Seção" opcoes={ABAS} valor={aba} aoMudar={setAba} />
      </div>

      {aba === "visao" && <Visao p={p} agir={agir} />}
      {aba === "aprovacao" && <Aprovacao p={p} agir={agir} ocupado={ocupado} />}
      {aba === "auditoria" && <Auditoria p={p} aoErro={aoErro} />}
      {aba === "ensinar" && <Ensinar p={p} agir={agir} aoErro={aoErro} />}
      {aba === "respostas" && <Respostas p={p} agir={agir} />}
      {aba === "loja" && <Loja p={p} agir={agir} />}
      {aba === "config" && <Configuracoes p={p} agir={agir} aoErro={aoErro} />}
    </section>
  );
}

type Agir = (
  comando: string,
  args?: Record<string, unknown>,
) => Promise<boolean>;

// ------------------------------------------------------------------ Visão geral
function Visao({ p, agir }: { p: Painel; agir: Agir }) {
  const comIa = p.chats.filter((c) => c.status === "ativo").length;
  const comEquipe = p.chats.filter((c) => c.status === "humano").length;
  return (
    <>
      <div className="kpis">
        <Kpi
          destaque
          rotulo="Leads com a IA"
          valor={comIa}
          apoio={`${p.chats.length} no total`}
        />
        <Kpi rotulo="Passados à equipe" valor={comEquipe} />
        <Kpi rotulo="Aguardando aprovação" valor={p.rascunhos.length} />
        <Kpi
          rotulo="Estoque disponível"
          valor={p.estoque}
          apoio={`${p.exemplos.length} exemplos ensinados · ${p.exemplosReais} reais`}
        />
      </div>
      <div className="duas-colunas">
        <div className="panel">
          <h2>Leads</h2>
          <p className="hint">
            {p.laco.rodando ? "Verificando" : "Parado"}
            {p.laco.ultimaRodada
              ? ` · última verificação ${ha(p.laco.ultimaRodada)}`
              : ""}
          </p>
          {p.chats.length === 0 ? (
            <Vazio titulo="Nenhum lead ainda">
              Os leads aparecem aqui quando recebem a etiqueta de gatilho no
              uTalk.
            </Vazio>
          ) : (
            <ul className="lista-leads">
              {p.chats.map((c) => (
                <li key={c.chatId}>
                  <div>
                    <strong>{c.nome}</strong>{" "}
                    <Selo tom={STATUS[c.status][0]}>{STATUS[c.status][1]}</Selo>
                    {c.ultima && (
                      <p className="hint">
                        {c.ultima.role === "user" ? "Lead: " : "IA: "}
                        {c.ultima.content.slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <span className="actions">
                    {c.status !== "ativo" && (
                      <button
                        className="small"
                        onClick={() =>
                          void agir("pre_reativar", { chatId: c.chatId })
                        }
                      >
                        Devolver à IA
                      </button>
                    )}
                    <button
                      className="plain small"
                      title="Tira o lead só deste app; nada é apagado no uTalk"
                      onClick={() =>
                        void agir("pre_esquecer", { chatId: c.chatId })
                      }
                    >
                      Esquecer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Registro</h2>
          {p.registros.length === 0 ? (
            <p className="hint">Nada registrado ainda.</p>
          ) : (
            <ul className="registro-ia">
              {p.registros.map((r, i) => (
                <li key={i} className={r.tipo === "erro" ? "erro" : ""}>
                  <span className="hint">
                    {new Date(r.em).toLocaleString("pt-BR")} · {r.tipo}
                  </span>
                  <span>{r.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Auditoria
const DESFECHO = {
  enviado: ["info", "Enviado"],
  rascunho: ["atencao", "Aguardando aprovação"],
  aprovado: ["bom", "Aprovado e enviado"],
  descartado: ["neutro", "Descartado"],
  erro: ["ruim", "Erro"],
  simulado: ["neutro", "Simulador"],
} as const;

/** Cada resposta da IA com o que chegou, o que o modelo devolveu e os sinais de alerta. */
function Auditoria({ p, aoErro }: { p: Painel; aoErro: (m: string) => void }) {
  const [turnos, setTurnos] = useState<TurnoAuditado[] | null>(null);
  const [soAlerta, setSoAlerta] = useState(false);
  // Recarrega quando o painel muda (novo registro = nova ação da IA).
  const marca = p.registros[0]?.em ?? "";

  useEffect(() => {
    let vivo = true;
    invoke<TurnoAuditado[]>("pre_auditoria", { limite: 200 })
      .then((t) => {
        if (vivo) setTurnos(t);
      })
      .catch((e) => aoErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [marca, aoErro]);

  if (!turnos) return <p className="empty">Carregando…</p>;
  const lista = soAlerta ? turnos.filter((t) => t.sinais.length) : turnos;
  const comAlerta = turnos.filter((t) => t.sinais.length).length;

  function exportar() {
    const blob = new Blob([JSON.stringify(turnos, null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "auditoria-pre-atendimento.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="panel">
      <h2>Auditoria das respostas da IA</h2>
      <p className="hint">
        {turnos.length} respostas registradas · {comAlerta} com alerta. Fica só
        neste computador (telefone mascarado).
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={soAlerta}
            onChange={(e) => setSoAlerta(e.target.checked)}
          />{" "}
          Só com alerta
        </label>{" "}
        <button onClick={exportar} disabled={!turnos.length}>
          Exportar JSON
        </button>
      </p>
      {lista.length === 0 ? (
        <p className="hint">Nada para mostrar.</p>
      ) : (
        <ul className="registro-ia">
          {lista.map((t) => (
            <li key={t.id}>
              <span className="hint">
                {new Date(t.em).toLocaleString("pt-BR")} · {t.nome} ·{" "}
                {t.origem === "simulador" ? "simulador" : "WhatsApp"}
              </span>
              <span>
                <Selo tom={DESFECHO[t.desfecho][0]}>
                  {DESFECHO[t.desfecho][1]}
                </Selo>{" "}
                {t.sinais.map((s) => (
                  <Selo key={s} tom="atencao">
                    {ROTULO_SINAL[s]}
                  </Selo>
                ))}
              </span>
              {t.recebidas.length > 0 && (
                <span className="hint">Cliente: {t.recebidas.join(" / ")}</span>
              )}
              <span>{t.texto || "(sem texto)"}</span>
              <details>
                <summary className="hint">Detalhes</summary>
                <pre className="auditoria-bruto">
                  {[
                    `Modelo: ${t.provedor} ${t.modelo}${t.reserva ? " (reserva)" : ""} · ${t.latenciaMs} ms`,
                    `Estoque: ${t.estoque} · usados: ${t.usados.veiculos} veículos, ${t.usados.exemplos} exemplos, ${t.usados.reais} reais`,
                    `Transferir: ${t.transferir ? "sim" : "não"} · Encerrar: ${t.encerrar ? "sim" : "não"}`,
                    t.fotos.veiculo
                      ? `Fotos: ${t.fotos.qtd} do ${t.fotos.veiculo}${t.fotos.semFotos ? " (sem fotos na pasta)" : ""}`
                      : "",
                    t.erro ? `Erro: ${t.erro}` : "",
                    "",
                    "Saída bruta do modelo:",
                    t.bruto || "(nenhuma)",
                  ]
                    .filter((x, i) => x || i === 5)
                    .join("\n")}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Aprovação
function Aprovacao({
  p,
  agir,
  ocupado,
}: {
  p: Painel;
  agir: Agir;
  ocupado: boolean;
}) {
  const [editado, setEditado] = useState<Record<string, string>>({});
  if (!p.rascunhos.length)
    return (
      <div className="panel">
        <Vazio titulo="Nada para aprovar">
          Com "enviar sem aprovação" desligado, cada resposta da IA espera aqui.
          Texto corrigido vira exemplo.
        </Vazio>
      </div>
    );
  return (
    <div className="pilha">
      {p.rascunhos.map((r) => {
        const texto = editado[r.id] ?? r.texto;
        return (
          <div key={r.id} className="panel">
            <h2>
              {r.nome}{" "}
              <span className="hint">{ha(new Date(r.em).toISOString())}</span>
            </h2>
            {r.pergunta && <p className="bolha lead">{r.pergunta}</p>}
            <label>
              Resposta da IA
              <textarea
                rows={3}
                value={texto}
                onChange={(e) =>
                  setEditado({ ...editado, [r.id]: e.target.value })
                }
              />
            </label>
            <p className="hint">
              {r.fotos.length
                ? `Depois do texto: ${r.fotos.length} fotos do ${r.veiculoFotos}. `
                : ""}
              {r.transferir ? "Passa para a equipe. " : ""}
              {r.encerrar ? "Encerra o atendimento. " : ""}
            </p>
            <div className="actions">
              <button
                className="primary"
                disabled={ocupado || !texto.trim()}
                onClick={() => void agir("pre_aprovar", { id: r.id, texto })}
              >
                {texto === r.texto ? "Aprovar e enviar" : "Enviar corrigido"}
              </button>
              <button
                disabled={ocupado}
                onClick={() => void agir("pre_descartar", { id: r.id })}
              >
                Descartar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Ensinar
type Simulada = MensagemIa & { fotos?: string[]; nota?: string };
function Ensinar({
  p,
  agir,
  aoErro,
}: {
  p: Painel;
  agir: Agir;
  aoErro: (m: string) => void;
}) {
  const [conversa, setConversa] = useState<Simulada[]>([]);
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("Cliente Teste");
  const [enviadas, setEnviadas] = useState<Record<string, number>>({});
  const [pensando, setPensando] = useState(false);
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [correcao, setCorrecao] = useState("");

  async function perguntar(nova: Simulada[]) {
    setPensando(true);
    try {
      const r = await invoke<{
        texto: string;
        transferir: boolean;
        encerrar: boolean;
        fotos: string[];
        veiculoFotos: string | null;
        veiculoFotosId: string | null;
        inicioFotos: number;
        semFotos: boolean;
      }>("pre_simular", {
        conversa: nova.map(({ role, content }) => ({ role, content })),
        nome,
        enviadas,
      });
      if (r.veiculoFotosId && r.fotos.length)
        setEnviadas({
          ...enviadas,
          [r.veiculoFotosId]: r.inicioFotos + r.fotos.length,
        });
      const nota = [
        r.transferir && "passaria para a equipe",
        r.encerrar && "encerraria o atendimento",
        r.fotos.length &&
          `enviaria ${r.fotos.length} fotos do ${r.veiculoFotos}`,
        r.semFotos && `${r.veiculoFotos} sem fotos na pasta`,
      ]
        .filter(Boolean)
        .join(" · ");
      setConversa([
        ...nova,
        { role: "assistant", content: r.texto, fotos: r.fotos, nota },
      ]);
    } catch (e) {
      aoErro(textoDoErro(e));
      setConversa(nova);
    } finally {
      setPensando(false);
    }
  }

  function enviar() {
    if (!texto.trim()) return;
    const nova: Simulada[] = [
      ...conversa,
      { role: "user", content: texto.trim() },
    ];
    setTexto("");
    setConversa(nova);
    void perguntar(nova);
  }

  async function salvarCorrecao(i: number) {
    const pergunta = conversa
      .slice(0, i)
      .reverse()
      .find((m) => m.role === "user")?.content;
    if (!pergunta || !correcao.trim()) return;
    if (
      await agir("pre_exemplo_salvar", {
        item: { pergunta, resposta: correcao.trim(), origem: "correcao" },
      })
    ) {
      setConversa(
        conversa.map((m, j) =>
          j === i
            ? {
                ...m,
                content: correcao.trim(),
                nota: "corrigida · virou exemplo",
              }
            : m,
        ),
      );
      setCorrigindo(null);
    }
  }

  return (
    <div className="duas-colunas larga-estreita">
      <div className="panel">
        <h2>Simulador</h2>
        <p className="hint">
          Converse como se fosse o lead. Nada é enviado pelo WhatsApp. Corrija
          uma resposta e ela vira exemplo.
        </p>
        <div className="campo-com-botao">
          <label>
            Nome do lead
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <button
            onClick={() => {
              setConversa([]);
              setEnviadas({});
            }}
          >
            Nova conversa
          </button>
          <button
            disabled={pensando || conversa.length > 0}
            onClick={() => void perguntar([])}
            title="Primeira mensagem de retomada"
          >
            Abertura
          </button>
        </div>
        <div className="conversa-ia">
          {conversa.length === 0 && !pensando && (
            <p className="empty">
              Escreva a mensagem do lead abaixo ou peça a Abertura.
            </p>
          )}
          {conversa.map((m, i) => (
            <div
              key={i}
              className={`bolha ${m.role === "user" ? "lead" : "ia"}`}
            >
              {corrigindo === i ? (
                <>
                  <textarea
                    rows={3}
                    value={correcao}
                    onChange={(e) => setCorrecao(e.target.value)}
                  />
                  <div className="actions">
                    <button
                      className="primary small"
                      onClick={() => void salvarCorrecao(i)}
                    >
                      Salvar como exemplo
                    </button>
                    <button
                      className="small"
                      onClick={() => setCorrigindo(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span>{m.content}</span>
                  {!!m.fotos?.length && (
                    <span className="fotos-ia">
                      {m.fotos.map((f, j) =>
                        f ? <img key={j} src={f} alt="" /> : null,
                      )}
                    </span>
                  )}
                  {m.nota && <span className="hint">{m.nota}</span>}
                  {m.role === "assistant" && i > 0 && (
                    <button
                      className="plain small"
                      onClick={() => {
                        setCorrigindo(i);
                        setCorrecao(m.content);
                      }}
                    >
                      Corrigir
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {pensando && <p className="hint">Pensando…</p>}
        </div>
        <div className="campo-com-botao">
          <label>
            Mensagem do lead
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              placeholder="Ex.: ainda tem o Renegade? manda fotos"
            />
          </label>
          <button
            className="primary"
            disabled={pensando || !texto.trim()}
            onClick={enviar}
          >
            Enviar
          </button>
        </div>
      </div>
      <div className="panel">
        <h2>Exemplos ensinados</h2>
        {p.exemplos.length === 0 ? (
          <p className="hint">Nenhum exemplo ainda.</p>
        ) : (
          <ul className="registro-ia">
            {p.exemplos.map((x) => (
              <li key={x.id}>
                <span className="hint">Lead: {x.pergunta}</span>
                <span>{x.resposta}</span>
                <button
                  className="plain small"
                  onClick={() => void agir("pre_exemplo_remover", { id: x.id })}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Respostas-rápidas e persona
const NOVA: RespostaRapida = { id: "", titulo: "", palavras: "", texto: "" };
function Respostas({ p, agir }: { p: Painel; agir: Agir }) {
  const [item, setItem] = useState<RespostaRapida>(NOVA);
  const [persona, setPersona] = useState(p.persona);
  return (
    <div className="duas-colunas">
      <div className="panel">
        <h2>Respostas-rápidas</h2>
        <p className="hint">
          Use {"{nome}"}, {"{agente}"}, {"{loja}"}, {"{horario}"},{" "}
          {"{endereco}"}. A que tiver "Saudação" no título abre a conversa.
        </p>
        <ul className="registro-ia">
          {p.respostas.map((q) => (
            <li key={q.id}>
              <strong>{q.titulo}</strong>
              <span>{q.texto}</span>
              <span className="actions">
                <button className="plain small" onClick={() => setItem(q)}>
                  Editar
                </button>
                <button
                  className="plain small"
                  onClick={() =>
                    void agir("pre_resposta_remover", { id: q.id })
                  }
                >
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
        <fieldset>
          <legend>{item.id ? "Editar resposta" : "Nova resposta"}</legend>
          <label>
            Título
            <input
              value={item.titulo}
              onChange={(e) => setItem({ ...item, titulo: e.target.value })}
            />
          </label>
          <label>
            Palavras-chave
            <input
              value={item.palavras}
              onChange={(e) => setItem({ ...item, palavras: e.target.value })}
            />
          </label>
          <label>
            Texto
            <textarea
              rows={3}
              value={item.texto}
              onChange={(e) => setItem({ ...item, texto: e.target.value })}
            />
          </label>
          <div className="actions">
            <button
              className="primary"
              disabled={!item.titulo.trim() || !item.texto.trim()}
              onClick={() =>
                void agir("pre_resposta_salvar", { item }).then(
                  (ok) => ok && setItem(NOVA),
                )
              }
            >
              Salvar
            </button>
            <button onClick={() => void agir("pre_respostas_importar")}>
              Importar do uTalk
            </button>
          </div>
        </fieldset>
      </div>
      <div className="panel">
        <h2>Persona e regras</h2>
        <p className="hint">
          Como a IA se apresenta e o que ela pode ou não fazer. [TRANSFERIR] e
          [ENCERRAR] controlam as etiquetas.
        </p>
        <textarea
          rows={18}
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
        />
        <div className="actions">
          <button
            className="primary"
            disabled={persona === p.persona || !persona.trim()}
            onClick={() => void agir("pre_persona_salvar", { persona })}
          >
            Salvar persona
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Loja
const CAMPOS_LOJA: [keyof LojaIa, string, boolean][] = [
  ["nome", "Nome", false],
  ["endereco", "Endereço", false],
  ["horario", "Horário", true],
  ["telefone", "Telefone", false],
  ["site", "Site", false],
  ["financiamento", "Financiamento", true],
  ["troca", "Troca", true],
  ["extra", "Outras informações", true],
];
function Loja({ p, agir }: { p: Painel; agir: Agir }) {
  const [loja, setLoja] = useState(p.loja);
  return (
    <div className="panel">
      <h2>Dados da loja</h2>
      <p className="hint">
        A IA só fala de horário, endereço e condições com o que está aqui. O
        último horário de visita (16h em dia útil, 15h no sábado) é conferido à
        parte.
      </p>
      {/* Campos curtos em duas colunas; textos longos na largura toda. */}
      <div className="grid grid-2">
        {CAMPOS_LOJA.filter(([, , longo]) => !longo).map(([k, rotulo]) => (
          <label key={k}>
            {rotulo}
            <input
              value={loja[k]}
              onChange={(e) => setLoja({ ...loja, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {CAMPOS_LOJA.filter(([, , longo]) => longo).map(([k, rotulo]) => (
        <label key={k}>
          {rotulo}
          <textarea
            rows={2}
            value={loja[k]}
            onChange={(e) => setLoja({ ...loja, [k]: e.target.value })}
          />
        </label>
      ))}
      <div className="actions">
        <button
          className="primary"
          onClick={() => void agir("pre_loja_salvar", { patch: loja })}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Configurações
function Configuracoes({
  p,
  agir,
  aoErro,
}: {
  p: Painel;
  agir: Agir;
  aoErro: (m: string) => void;
}) {
  const [c, setC] = useState(p.config);
  const [chave, setChave] = useState("");
  const [etiquetas, setEtiquetas] = useState<{ id: string; nome: string }[]>(
    [],
  );
  const [modelos, setModelos] = useState<string[]>([]);

  useEffect(() => {
    if (!p.conexoes.utalk) return;
    let vivo = true;
    invoke<{ id: string; nome: string }[]>("pre_etiquetas")
      .then((t) => vivo && setEtiquetas(t))
      .catch((e) => vivo && aoErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [p.conexoes.utalk, aoErro]);

  const buscarModelos = () =>
    invoke<string[]>("pre_modelos")
      .then(setModelos)
      .catch((e) => aoErro(textoDoErro(e)));

  const mudou = JSON.stringify(c) !== JSON.stringify(p.config);
  // Interruptor no padrão do app (button.chave, como o "Só em estoque").
  const marcar = (k: keyof ConfigIa, rotulo: string, dica?: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={!!c[k]}
      className={c[k] ? "chave ligada" : "chave"}
      title={dica}
      onClick={() => setC({ ...c, [k]: !c[k] })}
    >
      <span className="chave-trilho" aria-hidden="true" />
      {rotulo}
    </button>
  );
  const etiqueta = (
    k: "etiquetaGatilhoId" | "etiquetaTransferenciaId",
    rotulo: string,
  ) => (
    <label>
      {rotulo}
      <select
        value={c[k]}
        onChange={(e) => setC({ ...c, [k]: e.target.value })}
      >
        <option value="">(nenhuma)</option>
        {etiquetas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
        {c[k] && !etiquetas.some((t) => t.id === c[k]) && (
          <option value={c[k]}>{c[k]}</option>
        )}
      </select>
    </label>
  );

  return (
    <div className="duas-colunas">
      <div className="panel">
        <h2>Atendimento</h2>
        {marcar(
          "ligado",
          "Atendimento automático ligado",
          "Verifica os leads com a etiqueta de gatilho no intervalo abaixo",
        )}
        {marcar("enviarSemAprovacao", "Enviar sem aprovação (tempo real)")}
        {marcar(
          "enviarAbertura",
          "Mandar a primeira mensagem para quem ainda não falou com a IA",
        )}
        {marcar(
          "usarHistoricoCrm",
          "Usar exemplos reais das conversas do CRM (memória da Soul IA)",
        )}
        {etiqueta("etiquetaGatilhoId", "Etiqueta de gatilho (no contato)")}
        {etiqueta(
          "etiquetaTransferenciaId",
          "Etiqueta de transferência para a equipe",
        )}
        <div className="grid grid-2">
          <label>
            Intervalo (segundos)
            <input
              type="number"
              min={5}
              value={c.intervaloSeg}
              onChange={(e) =>
                setC({
                  ...c,
                  intervaloSeg: Math.max(
                    5,
                    Math.round(Number(e.target.value) || 5),
                  ),
                })
              }
            />
          </label>
          <label>
            Fotos por pedido
            <input
              type="number"
              min={1}
              max={20}
              value={c.maxFotos}
              onChange={(e) =>
                setC({
                  ...c,
                  maxFotos: Math.min(
                    20,
                    Math.max(1, Math.round(Number(e.target.value) || 6)),
                  ),
                })
              }
            />
          </label>
          <label>
            Nome da atendente
            <input
              value={c.nomeAgente}
              onChange={(e) => setC({ ...c, nomeAgente: e.target.value })}
            />
          </label>
        </div>
        <div className="actions">
          <button
            className="primary"
            disabled={!mudou}
            onClick={() => void agir("pre_config_salvar", { patch: c })}
          >
            Salvar
          </button>
          {mudou && <button onClick={() => setC(p.config)}>Desfazer</button>}
        </div>
      </div>
      <div className="panel">
        <h2>Modelo de IA</h2>
        <Segmentado
          pequeno
          rotulo="Provedor"
          opcoes={[
            ["groq", "Groq (nuvem, grátis)"],
            ["ollama", "Ollama (local)"],
          ]}
          valor={c.provedor}
          aoMudar={(v) => setC({ ...c, provedor: v })}
        />
        {c.provedor === "groq" && (
          <>
            <div className="campo-com-botao">
              <label>
                Chave da API do Groq {p.conexoes.groq ? "(cadastrada)" : ""}
                <input
                  type="password"
                  autoComplete="off"
                  value={chave}
                  placeholder={
                    p.conexoes.groq ? "•••• guardada cifrada" : "gsk_…"
                  }
                  onChange={(e) => setChave(e.target.value)}
                />
              </label>
              <button
                disabled={!chave.trim()}
                onClick={() =>
                  void agir("pre_chave_groq_salvar", { chave }).then(
                    (ok) => ok && setChave(""),
                  )
                }
              >
                Guardar
              </button>
              {p.conexoes.groq && (
                <button
                  className="plain"
                  onClick={() =>
                    void agir("pre_chave_groq_salvar", { chave: "" })
                  }
                >
                  Remover
                </button>
              )}
            </div>
            <label>
              Modelo do Groq
              <input
                list="modelos-ia"
                value={c.modeloGroq}
                onChange={(e) => setC({ ...c, modeloGroq: e.target.value })}
              />
            </label>
            {marcar(
              "reservaOllama",
              "Se o Groq falhar, responder com o Ollama local",
            )}
          </>
        )}
        <label>
          Endereço do Ollama
          <input
            value={c.urlOllama}
            onChange={(e) => setC({ ...c, urlOllama: e.target.value })}
          />
        </label>
        <label>
          Modelo do Ollama
          <input
            list="modelos-ia"
            value={c.modeloOllama}
            onChange={(e) => setC({ ...c, modeloOllama: e.target.value })}
          />
        </label>
        <datalist id="modelos-ia">
          {modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <label>
          Temperatura
          <input
            type="number"
            step={0.1}
            min={0}
            max={1.5}
            value={c.temperatura}
            onChange={(e) =>
              setC({ ...c, temperatura: Number(e.target.value) || 0 })
            }
          />
        </label>
        <div className="actions">
          <button
            disabled={!mudou}
            className="primary"
            onClick={() => void agir("pre_config_salvar", { patch: c })}
          >
            Salvar
          </button>
          <button
            onClick={() => void buscarModelos()}
            title="Lista os modelos do provedor salvo"
          >
            Listar modelos
          </button>
          <button
            className="plain"
            onClick={() => void agir("pre_exemplos_recalcular")}
          >
            Recalcular exemplos reais
          </button>
        </div>
      </div>
    </div>
  );
}
