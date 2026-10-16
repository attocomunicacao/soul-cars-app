import { useCallback, useEffect, useRef, useState } from "react";
import { ask, invoke, listen } from "./lib/desktop";
import { haQuanto } from "./lib/tempo";

type Memoria = {
  leads: number;
  conversas: number;
  mensagens: number;
  mensagensDoLead: number;
  mensagensNossas: number;
  primeira: string | null;
  ultima: string | null;
  ultimaSincronizacao: string | null;
};
type Estado = { sincronizando: boolean; pasta: string; memoria: Memoria };
type Progresso = { fase: string; feito: number; total: number; texto: string };
type Resultado = {
  conversasVistas: number;
  conversasBaixadas: number;
  mensagensNovas: number;
  falhas: number;
  cancelado: boolean;
};
type Exportacao = {
  pasta: string;
  xlsx: string | null;
  avisoXlsx: string | null;
  arquivos: string[];
  padrao: string;
  analise: {
    conversas: number;
    semRespostaPct: number;
    medianaEsperaMin: number | null;
    p90EsperaMin: number | null;
    ate5minPct: number;
    medianaPalavras: number | null;
    comEmojiPct: number;
    exemplos: number;
    positivas: number;
  };
};

const mensagem = (e: unknown) => String(e instanceof Error ? e.message : e);
const numero = (n: number) => n.toLocaleString("pt-BR");
const minutos = (m: number | null) =>
  m === null
    ? "—"
    : m < 90
      ? `${Math.round(m)} min`
      : `${(m / 60).toFixed(1)} h`;
const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

/**
 * Soul IA: memória das conversas do CRM (uTalk) neste computador, planilha e o retrato de como a
 * loja atende. A sincronização só lê do uTalk; nada é enviado para fora.
 */
export function SouliaIa({ aoErro }: { aoErro: (mensagem: string) => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [exportacao, setExportacao] = useState<Exportacao | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [limite, setLimite] = useState("");
  const vivo = useRef(true);

  const carregar = useCallback(async () => {
    try {
      const e = await invoke<Estado>("soulia_estado");
      if (vivo.current) setEstado(e);
    } catch (e) {
      if (vivo.current) aoErro(mensagem(e));
    }
  }, [aoErro]);

  useEffect(() => {
    vivo.current = true;
    void carregar();
    let desligar: (() => void) | undefined;
    void listen<Progresso>("soulia:progresso", (ev) => {
      if (vivo.current) setProgresso(ev.payload);
    }).then((f) => {
      if (vivo.current) desligar = f;
      else f();
    });
    return () => {
      vivo.current = false;
      desligar?.();
    };
  }, [carregar]);

  async function sincronizar() {
    aoErro("");
    setSincronizando(true);
    setResultado(null);
    setProgresso({
      fase: "listando",
      feito: 0,
      total: 0,
      texto: "Conectando ao uTalk…",
    });
    try {
      const n = Number.parseInt(limite, 10);
      const r = await invoke<Resultado & Estado>("soulia_sincronizar", {
        limite: Number.isFinite(n) && n > 0 ? n : undefined,
      });
      if (!vivo.current) return;
      setResultado(r);
      setEstado(r);
    } catch (e) {
      if (vivo.current) aoErro(mensagem(e));
    } finally {
      if (vivo.current) {
        setSincronizando(false);
        void carregar();
      }
    }
  }

  async function exportar() {
    aoErro("");
    setExportando(true);
    try {
      const r = await invoke<Exportacao>("soulia_exportar");
      if (vivo.current) setExportacao(r);
    } catch (e) {
      if (vivo.current) aoErro(mensagem(e));
    } finally {
      if (vivo.current) setExportando(false);
    }
  }

  async function esquecer() {
    const sim = await ask(
      "Apagar toda a memória da Soul IA deste computador? As conversas continuam no uTalk e podem ser baixadas de novo. As planilhas já geradas não são apagadas.",
      { title: "Apagar memória", kind: "warning" },
    );
    if (!sim) return;
    try {
      const e = await invoke<Estado>("soulia_esquecer");
      if (vivo.current) {
        setEstado(e);
        setExportacao(null);
        setResultado(null);
      }
    } catch (e) {
      aoErro(mensagem(e));
    }
  }

  if (!estado) return <section className="panel">Carregando…</section>;
  const m = estado.memoria;
  const vazia = m.conversas === 0;
  const pct =
    progresso && progresso.total > 0
      ? Math.round((progresso.feito / progresso.total) * 100)
      : 0;

  return (
    <div className="soulia">
      <section className="panel">
        <h2>Memória</h2>
        <p className="dica-crm">
          Guarda neste computador as conversas do uTalk (mensagens, etiquetas,
          datas, setor, atendente e anúncio de origem). Só lê do CRM; não envia
          nada, não responde ninguém e não usa serviço pago.
        </p>
        <div className="cartoes-crm">
          <div className="cartao-crm">
            <b>{numero(m.leads)}</b>
            <span>leads</span>
          </div>
          <div className="cartao-crm">
            <b>{numero(m.conversas)}</b>
            <span>conversas</span>
          </div>
          <div className="cartao-crm">
            <b>{numero(m.mensagens)}</b>
            <span>mensagens</span>
          </div>
          <div className="cartao-crm">
            <b>{numero(m.mensagensNossas)}</b>
            <span>nossas</span>
          </div>
          <div className="cartao-crm">
            <b>{numero(m.mensagensDoLead)}</b>
            <span>dos leads</span>
          </div>
        </div>
        <p className="dica-crm">
          {vazia
            ? "A memória está vazia. Cadastre o token do uTalk na aba 02 · CRM e sincronize."
            : `Mensagens de ${dia(m.primeira)} a ${dia(m.ultima)}. Última sincronização ${haQuanto(m.ultimaSincronizacao)}.`}
        </p>
        <div className="actions">
          <label
            className="soulia-limite"
            title="Opcional: considera só as N conversas mais recentes. Vazio = todas."
          >
            Só as mais recentes
            <input
              type="number"
              min={1}
              value={limite}
              disabled={sincronizando}
              onChange={(e) => setLimite(e.target.value)}
              placeholder="todas"
            />
          </label>
          <button
            className="primary"
            disabled={sincronizando}
            onClick={() => void sincronizar()}
          >
            {sincronizando
              ? "Sincronizando…"
              : vazia
                ? "Criar memória"
                : "Atualizar memória"}
          </button>
          {sincronizando && (
            <button onClick={() => void invoke("soulia_cancelar")}>
              Cancelar
            </button>
          )}
          <button
            disabled={sincronizando || vazia}
            onClick={() => void esquecer()}
          >
            Apagar memória
          </button>
        </div>
        {sincronizando && progresso && (
          <div className="soulia-progresso" role="status">
            <progress value={pct} max={100} />
            <span>{progresso.texto}</span>
          </div>
        )}
        {resultado && !sincronizando && (
          <p className="dica-crm">
            {resultado.cancelado ? "Interrompida. " : ""}
            {numero(resultado.conversasVistas)} conversas vistas,{" "}
            {numero(resultado.conversasBaixadas)} atualizadas,{" "}
            {numero(resultado.mensagensNovas)} mensagens novas
            {resultado.falhas > 0
              ? `, ${resultado.falhas} com falha (rode de novo para completar)`
              : ""}
            .
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Planilha e padrão de atendimento</h2>
        <p className="dica-crm">
          Gera a planilha (resumo, leads, mensagens, eventos, assuntos e
          exemplos) e analisa como nós respondemos: tempo de resposta, tom,
          perguntas, aberturas e respostas por assunto. O resultado é um retrato
          para a equipe revisar, base do futuro agente de WhatsApp.
        </p>
        <div className="actions">
          <button
            className="primary"
            disabled={vazia || sincronizando || exportando}
            onClick={() => void exportar()}
          >
            {exportando ? "Gerando…" : "Gerar planilha e análise"}
          </button>
          <button
            onClick={() =>
              void invoke("soulia_abrir_pasta").catch((e) =>
                aoErro(mensagem(e)),
              )
            }
          >
            Abrir pasta
          </button>
        </div>
        {exportacao && (
          <>
            {exportacao.avisoXlsx && (
              <p className="dica-crm">{exportacao.avisoXlsx}</p>
            )}
            <div className="cartoes-crm">
              <div className="cartao-crm">
                <b>{minutos(exportacao.analise.medianaEsperaMin)}</b>
                <span>1ª resposta (mediana)</span>
              </div>
              <div className="cartao-crm">
                <b>{exportacao.analise.ate5minPct}%</b>
                <span>até 5 min</span>
              </div>
              <div className="cartao-crm">
                <b>{exportacao.analise.semRespostaPct}%</b>
                <span>sem resposta</span>
              </div>
              <div className="cartao-crm">
                <b>{exportacao.analise.medianaPalavras ?? "—"}</b>
                <span>palavras/mensagem</span>
              </div>
              <div className="cartao-crm">
                <b>{exportacao.analise.exemplos}</b>
                <span>exemplos</span>
              </div>
            </div>
            <p className="dica-crm">
              Arquivos em {exportacao.pasta}:{" "}
              {exportacao.xlsx ? "memoria-soul-ia.xlsx, " : ""}
              {exportacao.arquivos.join(", ")}.
            </p>
            <details>
              <summary>Ver padrão de atendimento</summary>
              <pre className="soulia-padrao">{exportacao.padrao}</pre>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
