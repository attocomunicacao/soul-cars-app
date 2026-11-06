/**
 * Aba Produção: painel de fotos (ordenar, renomear, recortar fundo), Editor Mágico de
 * vídeo e versão leve para anúncio.
 */
import { useEffect, useState } from "react";
import { invoke } from "../../../lib/desktop-bridge";
import { aquecerRecorte } from "../../../lib/engine-client";
import { localizarFotosVitrine } from "../../../lib/vehicle-files";
import {
  statusProducao,
  renomearFotos,
  organizarFotos,
  recortarArquivo,
  type StatusProducao,
} from "../../../lib/production-status";

type Foto = { nome: string; miniatura: string };
const mb = (b: number) =>
  (b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) +
  " MB";
export function Production({
  pasta,
  vincular,
  video,
  onBusy,
}: {
  pasta: string | null;
  vincular: () => Promise<void>;
  video: () => Promise<void>;
  onBusy: (valor: boolean) => void;
}) {
  // Já deixa o modelo de recorte pronto enquanto a pessoa confere a ficha.
  useEffect(() => {
    if (pasta) aquecerRecorte();
  }, [pasta]);
  const [status, setStatus] = useState<StatusProducao | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [gerandoVideo, setGerandoVideo] = useState(false);
  /** Marca o trabalho como vídeo para mostrar o botão Cancelar enquanto ele roda. */
  const comoVideo = (fn: () => Promise<unknown>) => async () => {
    setGerandoVideo(true);
    try {
      return await fn();
    } finally {
      setGerandoVideo(false);
    }
  };

  useEffect(() => {
    let ativo = true;
    let consultando = false;
    setStatus(null);
    setFotos([]);
    async function verificar() {
      if (!pasta || consultando) return;
      consultando = true;
      try {
        const s = await statusProducao(pasta);
        if (ativo) setStatus(s);
      } catch (e) {
        if (ativo) setAviso(String(e));
      } finally {
        consultando = false;
      }
    }
    void verificar();
    const timer = setInterval(() => void verificar(), 5000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [pasta]);

  // Muda quando a lista de fotos da pasta muda (nomes/ordem), disparando a releitura das prévias.
  const chaveFotos = status?.fotos.join("|");
  useEffect(() => {
    if (!pasta) return;
    let ativo = true;
    void invoke<Foto[]>("producao_fotos", { pasta })
      .then((novas) => {
        if (!ativo) return;
        setFotos((atuais) => {
          const porNome = new Map(novas.map((f) => [f.nome, f]));
          return [
            ...atuais
              .filter((f) => porNome.has(f.nome))
              .map((f) => porNome.get(f.nome)!),
            ...novas.filter((f) => !atuais.some((a) => a.nome === f.nome)),
          ];
        });
      })
      .catch((e) => {
        if (ativo) setAviso(String(e));
      });
    return () => {
      ativo = false;
    };
  }, [pasta, chaveFotos]);

  async function verificar() {
    if (pasta) setStatus(await statusProducao(pasta));
  }
  async function tarefa(fn: () => Promise<unknown>, mensagem = "Concluído.") {
    setOcupado(true);
    onBusy(true);
    setAviso("");
    try {
      const resultado = await fn();
      await verificar();
      setAviso(resultado === false ? "Seleção cancelada." : mensagem);
    } catch (e) {
      setAviso(String(e));
    } finally {
      setOcupado(false);
      onBusy(false);
    }
  }
  /** Recorta as imagens 1, 2 e 4 (carrossel), uma de cada vez, mostrando o andamento. */
  async function recortarCarrossel() {
    if (!pasta) throw new Error("Vincule a pasta do veículo.");
    const { fotos, pastaFotos } = await localizarFotosVitrine(pasta);
    const faltam = fotos.filter((f) => !f.origem).map((f) => f.numero);
    if (faltam.length)
      throw new Error(
        `Faltam as imagens ${faltam.join(" e ")}. Renomeie as fotos pela ordem do painel (1, 2, 3…) e tente de novo.`,
      );
    for (const [i, foto] of fotos.entries()) {
      setAviso(
        `Recortando a imagem ${foto.numero} (${i + 1} de ${fotos.length})…`,
      );
      await recortarArquivo(
        foto.origem!,
        `${pastaFotos}\\${foto.numero}_sem_fundo.png`,
      );
    }
  }
  function mover(nome: string, destino: number) {
    setFotos((atuais) => {
      const origem = atuais.findIndex((f) => f.nome === nome);
      if (origem < 0 || destino < 0 || destino >= atuais.length) return atuais;
      const nova = [...atuais];
      const [foto] = nova.splice(origem, 1);
      nova.splice(destino, 0, foto);
      return nova;
    });
  }
  return (
    <div className="panel producao">
      <div className="actions">
        <h2>Fluxo de produção</h2>
        <button disabled={ocupado} onClick={() => tarefa(vincular)}>
          Vincular pasta existente
        </button>
      </div>
      <p>{pasta || "Vincule a pasta do veículo para iniciar."}</p>
      <p className="muted">
        Fotos e vídeo são verificados automaticamente a cada 5 segundos.
      </p>
      {aviso && (
        <p className="notice" role="status">
          {aviso}
        </p>
      )}
      <fieldset>
        <legend>2 · Fotos em FOTOS</legend>
        <p>
          {status?.fotos.length
            ? `✓ ${status.fotos.length} imagem(ns) encontrada(s)`
            : "○ Coloque as fotos na pasta FOTOS do veículo"}
        </p>
        <div className="actions">
          <button
            disabled={ocupado || !pasta}
            onClick={() =>
              tarefa(verificar, "Verificação das fotos atualizada.")
            }
          >
            Verificar fotos
          </button>
          <button
            disabled={ocupado || !fotos.length}
            onClick={() =>
              tarefa(async () => {
                const sugestao = await organizarFotos(pasta!);
                setFotos((atuais) => {
                  const nomes = sugestao.fotos.map((f) => f.atual);
                  return [...atuais].sort((a, b) => {
                    const ia = nomes.indexOf(a.nome),
                      ib = nomes.indexOf(b.nome);
                    return (
                      (ia < 0 ? nomes.length : ia) -
                      (ib < 0 ? nomes.length : ib)
                    );
                  });
                });
              }, "Ordem sugerida. Revise o painel antes de renomear.")
            }
          >
            Sugerir ordem das fotos
          </button>
        </div>
        <p>
          Arraste as fotos ou use as setas. A posição no painel define o nome:
          1, 2, 3… A extensão é preservada.
        </p>
        <div className="foto-painel">
          {fotos.map((f, i) => (
            <article
              key={f.nome}
              draggable={!ocupado}
              onDragStart={() => setArrastada(f.nome)}
              onDragEnd={() => setArrastada(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastada && !ocupado) mover(arrastada, i);
                setArrastada(null);
              }}
            >
              <strong>Posição {i + 1}</strong>
              <img src={f.miniatura} alt={`Foto ${f.nome}`} loading="lazy" />
              <small>{f.nome}</small>
              <div className="actions">
                <button
                  aria-label={`Mover ${f.nome} para antes`}
                  disabled={ocupado || i === 0}
                  onClick={() => mover(f.nome, i - 1)}
                >
                  ←
                </button>
                <button
                  aria-label={`Mover ${f.nome} para depois`}
                  disabled={ocupado || i === fotos.length - 1}
                  onClick={() => mover(f.nome, i + 1)}
                >
                  →
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button
            className="primary"
            disabled={ocupado || !fotos.length}
            onClick={() =>
              tarefa(async () => {
                await renomearFotos(
                  pasta!,
                  fotos.map((f) => f.nome),
                );
                setFotos(await invoke<Foto[]>("producao_fotos", { pasta }));
              }, "Fotos renomeadas pela ordem do painel.")
            }
          >
            Renomear pela ordem do painel
          </button>
          <button
            disabled={ocupado || !pasta}
            title="Recorta o fundo das imagens 1, 2 e 4 (as do carrossel)"
            onClick={() =>
              tarefa(recortarCarrossel, "Imagens 1, 2 e 4 recortadas.")
            }
          >
            Recortar imagens 1, 2 e 4
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>3 · Vídeo e Editor Mágico</legend>
        <p>
          {status?.video_bruto
            ? `✓ Vídeo encontrado: ${status.video_bruto.split(/[\\/]/).pop()}`
            : "○ Coloque o vídeo bruto em PROJETO ou VIDEO"}
        </p>
        <p>
          {status?.video_final
            ? "✓ Vídeo editado disponível na pasta do veículo"
            : "O Editor Mágico gera o vídeo com tarjas, legendas e trilha."}
        </p>
        <div className="actions">
          <button
            disabled={ocupado || !pasta}
            onClick={() =>
              tarefa(verificar, "Verificação do vídeo atualizada.")
            }
          >
            Verificar vídeo
          </button>
          <button
            className="primary"
            disabled={ocupado || !status?.video_bruto}
            onClick={() =>
              tarefa(comoVideo(video), "Vídeo editado pelo Editor Mágico.")
            }
          >
            {ocupado ? "Aguarde…" : "Editor Mágico"}
          </button>
          {gerandoVideo && (
            <button
              onClick={() =>
                void invoke("video_cancelar").catch((e) => setAviso(String(e)))
              }
            >
              Cancelar geração do vídeo
            </button>
          )}
        </div>
        {status?.video_final_bytes != null && (
          <p>Final: {mb(status.video_final_bytes)}</p>
        )}
      </fieldset>
    </div>
  );
}
