import { useEffect, useState } from "react";
import { invoke, open } from "./lib/desktop";
import {
  copiarComoDoc,
  documentoNaPasta,
  statusProducao,
  renomearFotos,
  organizarFotos,
  recortarArquivo,
  type StatusProducao,
} from "./lib/producao";

type Foto = { nome: string; miniatura: string };
export function Producao({
  pasta,
  vincular,
  documento,
  video,
  onBusy,
}: {
  pasta: string | null;
  vincular: () => Promise<void>;
  documento: (origem: string, senha: string) => Promise<void>;
  video: () => Promise<void>;
  onBusy: (valor: boolean) => void;
}) {
  const [status, setStatus] = useState<StatusProducao | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [arrastada, setArrastada] = useState<string | null>(null);

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
  }, [pasta, status?.fotos.join("|")]);

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
        Documento, fotos e vídeo são verificados automaticamente a cada 5
        segundos.
      </p>
      {aviso && (
        <p className="notice" role="status">
          {aviso}
        </p>
      )}
      <fieldset>
        <legend>1 · Documento (CRLV)</legend>
        <p>
          {status?.doc_pdf
            ? "✓ Documento encontrado na pasta"
            : "○ Nenhum documento PDF encontrado"}
          {status?.doc_md ? " · DOC.md já gerado" : ""}
        </p>
        <div className="actions">
          <button
            disabled={ocupado || !pasta}
            onClick={() =>
              tarefa(verificar, "Verificação do documento atualizada.")
            }
          >
            Verificar documento
          </button>
          <button
            className="primary"
            disabled={ocupado || !pasta}
            onClick={() =>
              tarefa(async () => {
                const p = await open({
                  title: "Anexar documento do veículo",
                  filters: [{ name: "CRLV", extensions: ["pdf"] }],
                });
                if (typeof p !== "string") return false;
                await copiarComoDoc(pasta!, p);
              }, "Seleção concluída. O documento escolhido foi anexado como DOC.pdf.")
            }
          >
            Anexar documento
          </button>
          <button
            disabled={ocupado || !status?.doc_pdf}
            onClick={() =>
              tarefa(async () => {
                const d = await documentoNaPasta(pasta!);
                await documento(d.caminho, senha);
              })
            }
          >
            Ler documento e preencher ficha
          </button>
        </div>
        <label>
          Senha do CRLV (se necessário)
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
      </fieldset>
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
          disabled={ocupado || !status?.principal}
          onClick={() => tarefa(() => recortarArquivo(status!.principal!))}
        >
          Recortar foto principal
        </button>
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
            onClick={() => tarefa(video, "Vídeo editado pelo Editor Mágico.")}
          >
            {ocupado ? "Aguarde…" : "Editor Mágico"}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
