/**
 * Aba Respostas-rápidas do Pré-atendimento: respostas cadastradas e a persona (regras do atendimento).
 */
import { useState } from "react";
import { type RespostaRapida } from "../../../../shared/pre-service";
import { type Painel, type Agir } from "./shared";

// ------------------------------------------------------------------ Respostas-rápidas e persona
const NOVA: RespostaRapida = { id: "", titulo: "", palavras: "", texto: "" };
export function RepliesTab({ p, agir }: { p: Painel; agir: Agir }) {
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
          aria-label="Persona e regras"
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
