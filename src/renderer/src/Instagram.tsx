import { useEffect, useState } from "react";
import { invoke, openPath } from "./lib/desktop";
import type { Veiculo } from "./lib/db";
import type {
  PlanoInstagram,
  EstadoInstagram,
  RegistroInstagram,
} from "../../compartilhado/instagram";

const tituloEstado = {
  pendente: "Pendente",
  preparando: "Preparando",
  publicando: "Enviando",
  publicado: "✓ Publicado",
};
export function Instagram({
  veiculo,
  baixar,
  onBusy,
}: {
  veiculo: Veiculo;
  baixar: () => void;
  onBusy: (valor: boolean) => void;
}) {
  const [plano, setPlano] = useState<PlanoInstagram | null>(null);
  const [estado, setEstado] = useState<EstadoInstagram | null>(null);
  const [conta, setConta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  useEffect(() => {
    let ativo = true;
    void Promise.all([
      invoke<PlanoInstagram>("instagram_plano", { id: veiculo.id }),
      invoke<EstadoInstagram>("instagram_estado", { id: veiculo.id }),
    ])
      .then(([p, e]) => {
        if (ativo) {
          setPlano(p);
          setEstado(e);
          setConta(e.conta);
        }
      })
      .catch((e) => {
        if (ativo) setErro(String(e));
      });
    const offLog = window.soul.ouvir<string>("instagram:log", (texto) =>
      setLogs((prev) => [...prev.slice(-199), texto]),
    );
    const offRegistro = window.soul.ouvir<RegistroInstagram>(
      "instagram:registro",
      (registro) => {
        if (registro.veiculoId === veiculo.id)
          setEstado((prev) => (prev ? { ...prev, registro } : prev));
      },
    );
    const timer = setInterval(() => {
      void invoke<EstadoInstagram>("instagram_estado", { id: veiculo.id })
        .then((e) => {
          if (ativo) setEstado(e);
        })
        .catch((e) => {
          if (ativo) setErro(String(e));
        });
    }, 3000);
    return () => {
      ativo = false;
      offLog();
      offRegistro();
      clearInterval(timer);
    };
  }, [veiculo.id]);
  async function atualizar() {
    const [p, e] = await Promise.all([
      invoke<PlanoInstagram>("instagram_plano", { id: veiculo.id }),
      invoke<EstadoInstagram>("instagram_estado", { id: veiculo.id }),
    ]);
    setPlano(p);
    setEstado(e);
  }
  async function tarefa(fn: () => Promise<unknown>) {
    setOcupado(true);
    onBusy(true);
    setErro("");
    try {
      await fn();
      await atualizar();
    } catch (e) {
      setErro(String(e));
      await atualizar().catch(() => {});
    } finally {
      setOcupado(false);
      onBusy(false);
    }
  }
  const registro = estado?.registro;
  const terminou =
    registro?.carrossel === "publicado" && registro?.reels === "publicado";
  const trabalhando = ocupado || !!estado?.ocupado;
  // "Pendente" só quer dizer "ainda não publicado": com os arquivos conferidos, mostra que está pronto.
  const rotulo = (etapa: "carrossel" | "reels") => {
    const estadoEtapa = registro?.[etapa] || "pendente";
    if (estadoEtapa !== "pendente" || !plano) return tituloEstado[estadoEtapa];
    const tem = plano.arquivos.some((f) =>
      etapa === "carrossel" ? f.tipo === "carrossel" : f.tipo !== "carrossel",
    );
    return tem && !plano.pendencias.length
      ? "Arquivos conferidos · pronto para publicar"
      : tituloEstado.pendente;
  };
  // Diz por que o botão de publicar está desligado, na ordem em que a pessoa resolve.
  const motivoBloqueio = !plano
    ? "Carregando os arquivos…"
    : plano.pendencias.length
      ? 'Resolva os itens de "Antes de publicar".'
      : !estado?.conta
        ? "Informe e salve a conta do Instagram."
        : "";
  return (
    <section className="panel instagram">
      <div className="actions">
        <h2>Instagram</h2>
        <button disabled={trabalhando} onClick={() => tarefa(atualizar)}>
          Verificar arquivos e histórico
        </button>
        <button
          disabled={trabalhando || registro?.carrossel === "publicado"}
          onClick={baixar}
        >
          Baixar carrossel e capa
        </button>
      </div>
      <p>
        Publicação automática pelo navegador do app. Faça login na janela do
        Instagram; o app mantém a sessão para o próximo veículo.
      </p>
      <div className="actions">
        <label>
          Conta do Instagram
          <input
            placeholder="usuario, sem @"
            value={conta}
            disabled={trabalhando}
            onChange={(e) => setConta(e.target.value)}
          />
        </label>
        <button
          disabled={trabalhando || !conta.trim()}
          onClick={() =>
            tarefa(async () => {
              const salva = await invoke<string>("instagram_conta", { conta });
              setConta(salva);
            })
          }
        >
          Salvar conta
        </button>
        <button
          disabled={trabalhando}
          onClick={() => tarefa(() => invoke("instagram_abrir"))}
        >
          Abrir Instagram no app
        </button>
      </div>
      {erro && (
        <p role="alert" className="notice">
          {erro}
        </p>
      )}
      {!!plano?.pendencias.length && (
        <div className="notice">
          <strong>Antes de publicar</strong>
          <ul>
            {plano.pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <h3>1 · Carrossel — ordem 2 → 1 → 3</h3>
      <p className="badge">{rotulo("carrossel")}</p>
      <div className="instagram-midias">
        {plano?.arquivos
          .filter((f) => f.tipo === "carrossel")
          .map((f) => (
            <article key={f.nome}>
              <strong>{f.posicao}ª foto</strong>
              <img src={f.miniatura} alt={f.nome} />
              <small>{f.nome}</small>
            </article>
          ))}
      </div>
      <label>
        Legenda do 1. TEXTO PRINCIPAL
        <textarea readOnly value={plano?.carrossel || ""} />
      </label>
      <h3>2 · Reels — vídeo editado</h3>
      <p className="badge">{rotulo("reels")}</p>
      <div className="instagram-midias">
        {plano?.arquivos
          .filter((f) => f.tipo !== "carrossel")
          .map((f) => (
            <article key={f.nome}>
              <strong>
                {f.tipo === "capa"
                  ? "Capa · 01. Tráfego Pago"
                  : "Vídeo do Editor Mágico"}
              </strong>
              {f.miniatura && <img src={f.miniatura} alt={f.nome} />}
              <small>{f.nome}</small>
              <button
                disabled={trabalhando}
                onClick={() => tarefa(() => openPath(f.caminho))}
              >
                Visualizar arquivo
              </button>
            </article>
          ))}
      </div>
      <label>
        Legenda do 2. TEXTO PRINCIPAL
        <textarea readOnly value={plano?.reels || ""} />
      </label>
      <div className="actions">
        <button
          className="primary"
          disabled={
            trabalhando || !!plano?.pendencias.length || !plano || !estado?.conta
          }
          onClick={() =>
            tarefa(async () => {
              setLogs([]);
              await invoke("instagram_publicar", { id: veiculo.id });
            })
          }
        >
          {terminou
            ? "Publicar novamente carrossel e Reels"
            : registro?.carrossel === "publicado"
              ? "Retomar publicação do Reels"
              : "Publicar carrossel e depois Reels"}
        </button>
        {!trabalhando && motivoBloqueio && (
          <span role="status">{motivoBloqueio}</span>
        )}
        {!terminou && registro?.carrossel === "publicado" && !trabalhando && (
          <button
            onClick={() =>
              tarefa(() => invoke("instagram_reiniciar", { id: veiculo.id }))
            }
          >
            Recomeçar do carrossel
          </button>
        )}
        {trabalhando && (
          <button
            onClick={() => {
              void invoke("instagram_cancelar").catch((e) =>
                setErro(String(e)),
              );
            }}
          >
            Interromper automação
          </button>
        )}
      </div>
      {registro?.detalhe && <p role="status">{registro.detalhe}</p>}
      {!!logs.length && <pre aria-live="polite">{logs.join("\n")}</pre>}
    </section>
  );
}
