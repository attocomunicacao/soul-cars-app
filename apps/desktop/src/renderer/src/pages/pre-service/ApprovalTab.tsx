/**
 * Aba Aprovação do Pré-atendimento: rascunhos da IA para aprovar, editar ou descartar antes de enviar.
 */
import { useState } from "react";
import { Vazio, ha } from "../../app/components";
import { type Painel, type Agir } from "./shared";

// ------------------------------------------------------------------ Aprovação
export function ApprovalTab({
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
