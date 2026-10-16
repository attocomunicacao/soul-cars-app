import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "./lib/desktop";
import { haQuanto } from "./lib/tempo";

type Contagem = {
  id: string;
  nome: string;
  emoji: string | null;
  leads: number;
};
type Metricas = {
  organizacao: string;
  totalLeads: number;
  etiquetas: Contagem[];
  atualizadoEm: string;
};
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
type Painel = "fechado" | "visao" | "etiquetas";

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
    <div className={`crm-cartao ${tom ?? ""}`}>
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
    <div className="crm-lista">
      <h3>{titulo}</h3>
      {leads.length === 0 ? (
        <p className="crm-metricas-dica">{vazio}</p>
      ) : (
        <ul>
          {leads.map((l) => (
            <li key={l.id}>
              <span className="crm-lead-nome">{l.nome}</span>
              <span className="crm-lead-etiquetas">
                {l.etiquetas.slice(0, 3).join(" · ")}
              </span>
              <span className="crm-lead-tempo" title={rotuloTempo}>
                {haQuanto(l.desde)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Faixa acima do CRM com a visão geral dos leads (cartões, quem espera resposta, leads quentes) e a
 * contagem por etiqueta, lidas da API do uTalk. "Quente/morno/frio" vêm das etiquetas que o vendedor
 * aplica. O token é cadastrado aqui e fica cifrado no computador; a interface nunca o recebe de volta.
 */
export function PainelCrm({ aoErro }: { aoErro: (mensagem: string) => void }) {
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [visao, setVisao] = useState<Visao | null>(null);
  const [etiquetas, setEtiquetas] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [painel, setPainel] = useState<Painel>("fechado");
  const [busca, setBusca] = useState("");
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const carregarVisao = useCallback(async () => {
    setCarregando(true);
    try {
      const v = await invoke<Visao>("utalk_visao");
      if (vivo.current) setVisao(v);
    } catch (e) {
      if (vivo.current) aoErro(mensagem(e));
    } finally {
      if (vivo.current) setCarregando(false);
    }
  }, [aoErro]);

  const carregarEtiquetas = useCallback(async () => {
    setCarregando(true);
    try {
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
        if (e.configurado) void carregarVisao();
      })
      .catch((e) => aoErro(String(e)));
  }, [carregarVisao, aoErro]);

  async function salvar() {
    try {
      await invoke("utalk_token_salvar", { token });
      setToken("");
      setConfigurado(true);
      await carregarVisao();
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
      setPainel("fechado");
    } catch (e) {
      aoErro(String(e));
    }
  }

  function atualizar() {
    void carregarVisao();
    if (painel === "etiquetas") void carregarEtiquetas();
  }

  function alternar(alvo: Exclude<Painel, "fechado">) {
    const novo = painel === alvo ? "fechado" : alvo;
    setPainel(novo);
    if (novo === "etiquetas" && !etiquetas) void carregarEtiquetas();
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
      <section className="crm-metricas" aria-label="Visão geral do CRM">
        <strong>Visão geral do CRM</strong>
        <span className="crm-metricas-dica">
          Cole o token gerado em account.umbler.com/profile. Ele fica só neste
          computador, cifrado.
        </span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token do uTalk"
          autoComplete="off"
        />
        <button
          type="button"
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
    <section className="crm-metricas" aria-label="Visão geral do CRM">
      <div className="crm-metricas-barra">
        <strong>Visão geral</strong>
        {visao && (
          <div className="crm-cartoes">
            <Cartao rotulo="leads" valor={visao.totalLeads} />
            <Cartao rotulo="novas 7 dias" valor={visao.conversasNovas7d} />
            <Cartao rotulo="abertas" valor={visao.conversasAbertas} />
            <Cartao
              rotulo="aguardando você"
              valor={visao.aguardando}
              tom={visao.aguardando > 0 ? "alerta" : undefined}
            />
            <Cartao rotulo="quentes" valor={t?.quente ?? null} tom="quente" />
            <Cartao rotulo="mornos" valor={t?.morno ?? null} tom="morno" />
            <Cartao rotulo="frios" valor={t?.frio ?? null} tom="frio" />
          </div>
        )}
        <button type="button" disabled={carregando} onClick={atualizar}>
          {carregando ? "Contando…" : "Atualizar"}
        </button>
        <button
          type="button"
          disabled={!visao}
          onClick={() => alternar("visao")}
        >
          {painel === "visao" ? "Recolher" : "Leads"}
        </button>
        <button type="button" onClick={() => alternar("etiquetas")}>
          {painel === "etiquetas" ? "Recolher" : "Etiquetas"}
        </button>
        <button type="button" onClick={remover}>
          Trocar token
        </button>
      </div>

      {visao && faltam.length > 0 && (
        <p className="crm-metricas-dica">
          Não achei no uTalk a etiqueta {faltam.join(", ").toUpperCase()}. Crie
          etiquetas com esses nomes e aplique nos leads para a contagem
          aparecer.
        </p>
      )}

      {visao && painel === "visao" && (
        <div className="crm-listas">
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

      {painel === "etiquetas" && (
        <div className="crm-metricas-lista">
          {!etiquetas ? (
            <p className="crm-metricas-dica">Contando as etiquetas…</p>
          ) : (
            <>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar etiqueta (ex.: FIESTA 2016)"
              />
              <table>
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
            </>
          )}
        </div>
      )}
    </section>
  );
}
