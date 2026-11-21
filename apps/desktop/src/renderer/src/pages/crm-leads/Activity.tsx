/**
 * Visão Atividade do CRM · Leads: o que mudou a cada atualização (status, etiquetas, troca de SDR).
 */
import { useState } from "react";
import { type EventoCrm } from "../../../../shared/crm-leads";
import { Segmentado, Vazio, fmt } from "../../app/components";

// ------------------------------------------------------------------ Atividade
const FILTROS_ATIVIDADE = [
  ["", "Tudo"],
  ["novo", "Novos leads"],
  ["tag", "Etiquetas"],
  ["sdr", "Troca de SDR"],
] as const;

export function Activity({
  eventos,
  intervalo,
}: {
  eventos: EventoCrm[];
  intervalo: number;
}) {
  const [f, setF] = useState<(typeof FILTROS_ATIVIDADE)[number][0]>("");
  const lista = eventos.filter(
    (e) => !f || (f === "tag" ? e.type.startsWith("tag") : e.type === f),
  );
  return (
    <div className="panel">
      <div className="actions">
        <h2>Atividade</h2>
        <Segmentado
          pequeno
          rotulo="Tipo de evento"
          opcoes={FILTROS_ATIVIDADE}
          valor={f}
          aoMudar={setF}
        />
      </div>
      <p className="dica-crm">
        {fmt.int(lista.length)} eventos · confere o uTalk a cada {intervalo} s
        enquanto esta página está aberta.
      </p>
      {lista.length ? (
        <ul className="feed">
          {lista.slice(0, 300).map((e, i) => (
            <li
              key={i}
              className={
                e.type === "novo"
                  ? "novo"
                  : e.type === "sdr"
                    ? "sdr"
                    : e.type === "tag+"
                      ? "mais"
                      : "menos"
              }
            >
              <b aria-hidden="true">
                {e.type === "novo"
                  ? "★"
                  : e.type === "sdr"
                    ? "↻"
                    : e.type === "tag+"
                      ? "+"
                      : "−"}
              </b>
              <span>
                {e.text}
                {e.tags?.length ? ` · ${e.tags.join(", ")}` : ""}
              </span>
              <time>{fmt.data(e.at)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio titulo="Nada mudou ainda">
          Novos leads, troca de etiqueta e troca de SDR aparecem aqui a cada
          atualização.
        </Vazio>
      )}
    </div>
  );
}
