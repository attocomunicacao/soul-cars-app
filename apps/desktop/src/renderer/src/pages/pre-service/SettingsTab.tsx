/**
 * Aba Configurações do Pré-atendimento: provedor e modelo, etiquetas do uTalk, intervalo e conexões.
 */
import { useEffect, useState } from "react";
import { type ConfigIa } from "../../../../shared/pre-service";
import { Segmentado, textoDoErro } from "../../app/components";
import { invoke } from "../../lib/desktop-bridge";
import { type Painel, type Agir } from "./shared";

// ------------------------------------------------------------------ Configurações
export function SettingsTab({
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
