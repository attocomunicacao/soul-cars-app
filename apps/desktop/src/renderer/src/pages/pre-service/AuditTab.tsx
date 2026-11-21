/**
 * Aba Auditoria do Pré-atendimento: cada resposta da IA com o que chegou, o que o modelo devolveu e os sinais de alerta.
 */
import { useEffect, useState } from "react";
import {
  ROTULO_SINAL,
  type TurnoAuditado,
} from "../../../../shared/pre-service-audit";
import { Selo, textoDoErro } from "../../app/components";
import { invoke } from "../../lib/desktop-bridge";
import { type Painel } from "./shared";

// ------------------------------------------------------------------ Auditoria
const DESFECHO = {
  enviado: ["info", "Enviado"],
  rascunho: ["atencao", "Aguardando aprovação"],
  aprovado: ["bom", "Aprovado e enviado"],
  descartado: ["neutro", "Descartado"],
  erro: ["ruim", "Erro"],
  simulado: ["neutro", "Simulador"],
} as const;

/** Cada resposta da IA com o que chegou, o que o modelo devolveu e os sinais de alerta. */
export function AuditTab({
  p,
  aoErro,
}: {
  p: Painel;
  aoErro: (m: string) => void;
}) {
  const [turnos, setTurnos] = useState<TurnoAuditado[] | null>(null);
  const [soAlerta, setSoAlerta] = useState(false);
  // Recarrega quando o painel muda (novo registro = nova ação da IA).
  const marca = p.registros[0]?.em ?? "";

  useEffect(() => {
    let vivo = true;
    invoke<TurnoAuditado[]>("pre_auditoria", { limite: 200 })
      .then((t) => {
        if (vivo) setTurnos(t);
      })
      .catch((e) => aoErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [marca, aoErro]);

  if (!turnos) return <p className="empty">Carregando…</p>;
  const lista = soAlerta ? turnos.filter((t) => t.sinais.length) : turnos;
  const comAlerta = turnos.filter((t) => t.sinais.length).length;

  function exportar() {
    const blob = new Blob([JSON.stringify(turnos, null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "auditoria-pre-atendimento.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="panel">
      <h2>Auditoria das respostas da IA</h2>
      <p className="hint">
        {turnos.length} respostas registradas · {comAlerta} com alerta. Fica só
        neste computador (telefone mascarado).
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={soAlerta}
            onChange={(e) => setSoAlerta(e.target.checked)}
          />{" "}
          Só com alerta
        </label>{" "}
        <button onClick={exportar} disabled={!turnos.length}>
          Exportar JSON
        </button>
      </p>
      {lista.length === 0 ? (
        <p className="hint">Nada para mostrar.</p>
      ) : (
        <ul className="registro-ia">
          {lista.map((t) => (
            <li key={t.id}>
              <span className="hint">
                {new Date(t.em).toLocaleString("pt-BR")} · {t.nome} ·{" "}
                {t.origem === "simulador" ? "simulador" : "WhatsApp"}
              </span>
              <span>
                <Selo tom={DESFECHO[t.desfecho][0]}>
                  {DESFECHO[t.desfecho][1]}
                </Selo>{" "}
                {t.sinais.map((s) => (
                  <Selo key={s} tom="atencao">
                    {ROTULO_SINAL[s]}
                  </Selo>
                ))}
              </span>
              {t.recebidas.length > 0 && (
                <span className="hint">Cliente: {t.recebidas.join(" / ")}</span>
              )}
              <span>{t.texto || "(sem texto)"}</span>
              <details>
                <summary className="hint">Detalhes</summary>
                <pre className="auditoria-bruto">
                  {[
                    `Modelo: ${t.provedor} ${t.modelo}${t.reserva ? " (reserva)" : ""} · ${t.latenciaMs} ms`,
                    `Estoque: ${t.estoque} · usados: ${t.usados.veiculos} veículos, ${t.usados.exemplos} exemplos, ${t.usados.reais} reais`,
                    `Transferir: ${t.transferir ? "sim" : "não"} · Encerrar: ${t.encerrar ? "sim" : "não"}`,
                    t.fotos.veiculo
                      ? `Fotos: ${t.fotos.qtd} do ${t.fotos.veiculo}${t.fotos.semFotos ? " (sem fotos na pasta)" : ""}`
                      : "",
                    t.erro ? `Erro: ${t.erro}` : "",
                    "",
                    "Saída bruta do modelo:",
                    t.bruto || "(nenhuma)",
                  ]
                    .filter((x, i) => x || i === 5)
                    .join("\n")}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
