/**
 * Aba Ensinar do Pré-atendimento: simulador de conversa para corrigir a IA e transformar a correção em exemplo.
 */
import { useState } from "react";
import { type MensagemIa } from "../../../../shared/pre-service";
import { textoDoErro } from "../../app/components";
import { invoke } from "../../lib/desktop-bridge";
import { type Painel, type Agir } from "./shared";

// ------------------------------------------------------------------ Ensinar
type Simulada = MensagemIa & { fotos?: string[]; nota?: string };
export function TeachTab({
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
