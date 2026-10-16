import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "./lib/desktop";
import { haQuanto } from "./lib/tempo";

type Contagem = {
  id: string;
  nome: string;
  emoji: string | null;
  leads: number;
};
type Metricas = { totalLeads: number; etiquetas: Contagem[] };
type Lead = {
  id: string;
  nome: string;
  desde: string | null;
  etiquetas: string[];
};
type Visao = {
  organizacao: string;
  atualizadoEm: string;
  totalLeads: number;
  conversasNovas7d: number;
  conversasAbertas: number;
  aguardando: number;
  temperatura: Record<"quente" | "morno" | "frio", number | null>;
  listaAguardando: Lead[];
  listaQuentes: Lead[];
};

const SEM_ACENTO = /\p{Diacritic}/gu;
const normalizar = (t: string) =>
  t.normalize("NFD").replace(SEM_ACENTO, "").toLowerCase();
const mensagem = (e: unknown) => String(e instanceof Error ? e.message : e);

function Cartao({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: number | null;
  tom?: "alerta" | "quente" | "morno" | "frio";
}) {
  return (
    <div className={`cartao-crm ${tom ?? ""}`}>
      <b>{valor === null ? "—" : valor}</b>
      <span>{rotulo}</span>
    </div>
  );
}

function ListaLeads({
  titulo,
  vazio,
  leads,
  rotuloTempo,
}: {
  titulo: string;
  vazio: string;
  leads: Lead[];
  rotuloTempo: string;
}) {
  return (
    <section className="panel">
      <h2>{titulo}</h2>
      {leads.length === 0 ? (
        <p>{vazio}</p>
      ) : (
        <ul className="lista-leads">
          {leads.map((l) => (
            <li key={l.id}>
              <span className="lead-nome">{l.nome}</span>
              <span className="lead-etiquetas">
                {l.etiquetas.slice(0, 3).join(" · ")}
              </span>
              <span className="lead-tempo" title={rotuloTempo}>
                {haQuanto(l.desde)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Visão geral do CRM em página própria: cartões, quem espera resposta, leads quentes e a contagem por
 * etiqueta, lidos da API do uTalk. "Quente/morno/frio" vêm das etiquetas que o vendedor aplica. O token é
 * cadastrado aqui e fica cifrado no computador; a interface nunca o recebe de volta.
 */
export function VisaoCrm({ aoErro }: { aoErro: (mensagem: string) => void }) {
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [visao, setVisao] = useState<Visao | null>(null);
  const [etiquetas, setEtiquetas] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const atualizar = useCallback(async () => {
    setCarregando(true);
    try {
      const v = await invoke<Visao>("utalk_visao");
      if (vivo.current) setVisao(v);
      const m = await invoke<Metricas>("utalk_metricas");
      if (vivo.current) setEtiquetas(m);
    } catch (e) {
      if (vivo.current) aoErro(mensagem(e));
    } finally {
      if (vivo.current) setCarregando(false);
    }
  }, [aoErro]);

  useEffect(() => {
    invoke<{ configurado: boolean }>("utalk_estado")
      .then((e) => {
        if (!vivo.current) return;
        setConfigurado(e.configurado);
        if (e.configurado) void atualizar();
      })
      .catch((e) => aoErro(String(e)));
  }, [atualizar, aoErro]);

  async function salvar() {
    try {
      await invoke("utalk_token_salvar", { token });
      setToken("");
      setConfigurado(true);
      await atualizar();
    } catch (e) {
      aoErro(mensagem(e));
    }
  }

  async function remover() {
    try {
      await invoke("utalk_token_remover");
      setConfigurado(false);
      setVisao(null);
      setEtiquetas(null);
    } catch (e) {
      aoErro(String(e));
    }
  }

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return (etiquetas?.etiquetas ?? []).filter(
      (e) => !q || normalizar(e.nome).includes(q),
    );
  }, [etiquetas, busca]);

  if (configurado === null) return null;

  if (!configurado)
    return (
      <section className="panel">
        <h2>Conectar ao uTalk</h2>
        <p>
          Cole o token gerado em account.umbler.com/profile. Ele fica só neste
          computador, cifrado, e o app só lê os dados (não altera nada no CRM).
        </p>
        <label>
          Token do uTalk
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="primary"
          disabled={token.trim().length < 10}
          onClick={salvar}
        >
          Salvar token
        </button>
      </section>
    );

  const t = visao?.temperatura;
  const faltam = t
    ? (["quente", "morno", "frio"] as const).filter((k) => t[k] === null)
    : [];

  return (
    <>
      <div className="acoes-linha">
        <button disabled={carregando} onClick={() => void atualizar()}>
          {carregando ? "Contando…" : "Atualizar"}
        </button>
        <button onClick={remover}>Trocar token</button>
        {visao && (
          <small>
            {visao.organizacao} · atualizado às{" "}
            {new Date(visao.atualizadoEm).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        )}
      </div>

      {visao && (
        <div className="cartoes-crm">
          <Cartao rotulo="leads" valor={visao.totalLeads} />
          <Cartao
            rotulo="conversas novas (7 dias)"
            valor={visao.conversasNovas7d}
          />
          <Cartao rotulo="conversas abertas" valor={visao.conversasAbertas} />
          <Cartao
            rotulo="aguardando sua resposta"
            valor={visao.aguardando}
            tom={visao.aguardando > 0 ? "alerta" : undefined}
          />
          <Cartao
            rotulo="leads quentes"
            valor={t?.quente ?? null}
            tom="quente"
          />
          <Cartao rotulo="leads mornos" valor={t?.morno ?? null} tom="morno" />
          <Cartao rotulo="leads frios" valor={t?.frio ?? null} tom="frio" />
        </div>
      )}

      {visao && faltam.length > 0 && (
        <div className="notice">
          Não achei no uTalk a etiqueta {faltam.join(", ").toUpperCase()}. Crie
          etiquetas com esses nomes e aplique nos leads para a contagem
          aparecer.
        </div>
      )}

      {visao && (
        <div className="grade-crm">
          <ListaLeads
            titulo="Esperando sua resposta (mais antigos primeiro)"
            vazio="Nenhuma conversa esperando resposta."
            leads={visao.listaAguardando}
            rotuloTempo="Tempo desde a última mensagem do cliente"
          />
          <ListaLeads
            titulo="Leads quentes (atividade mais recente primeiro)"
            vazio={
              t?.quente === null
                ? "Crie a etiqueta QUENTE no uTalk."
                : "Nenhum lead com a etiqueta QUENTE."
            }
            leads={visao.listaQuentes}
            rotuloTempo="Tempo desde a última atividade do lead"
          />
        </div>
      )}

      {etiquetas && (
        <section className="panel">
          <h2>Leads por etiqueta</h2>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar etiqueta (ex.: FIESTA 2016)"
          />
          <table className="tabela-etiquetas">
            <tbody>
              {filtradas.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.emoji ? `${e.emoji} ` : ""}
                    {e.nome}
                  </td>
                  <td>{e.leads}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={2}>Nenhuma etiqueta encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
