/**
 * Visão Kanban do CRM · Leads: um quadro com uma coluna por status.
 */
import {
  NENHUM,
  statusDoLead,
  type ConfigLeads,
  type LeadCrm,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { Vazio, fmt } from "../../app/components";
import { COR_ETIQUETA } from "./shared";
import { Etiquetas, etiquetasDeStatus, mapaSdr } from "./lead-helpers";

// ------------------------------------------------------------------ Kanban
export function Kanban({
  snap,
  cfg,
  leads,
  abrir,
}: {
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  leads: LeadCrm[];
  abrir: (l: LeadCrm) => void;
}) {
  const colunas = [
    ...etiquetasDeStatus(snap, cfg).map((t) => ({
      id: t.id,
      nome: `${t.emoji ?? ""} ${t.name}`.trim(),
      cor: COR_ETIQUETA[t.color ?? ""] ?? "#9a9389",
    })),
    { id: NENHUM, nome: "Sem status", cor: "var(--faint)" },
  ];
  const grupos = new Map<string, LeadCrm[]>(colunas.map((c) => [c.id, []]));
  for (const l of leads) grupos.get(statusDoLead(l, cfg.statusOrder))?.push(l);
  const sdr = mapaSdr(snap);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const LIMITE = 150;
  if (colunas.length === 1)
    return (
      <div className="panel">
        <Vazio titulo="Nenhuma etiqueta de status">
          As colunas do Kanban são as etiquetas de status do uTalk. Ajuste quais
          etiquetas são status em Configurações › CRM · Leads.
        </Vazio>
      </div>
    );
  return (
    <div className="kanban">
      {colunas.map((c) => {
        const ls = (grupos.get(c.id) ?? []).sort(
          (a, b) => Date.parse(b.lastActive) - Date.parse(a.lastActive),
        );
        return (
          <div key={c.id} className="kanban-coluna">
            <div className="kanban-topo">
              <i style={{ background: c.cor }} />
              <span>{c.nome}</span>
              <b>{ls.length}</b>
            </div>
            <div className="kanban-cartoes">
              {ls.slice(0, LIMITE).map((l) => {
                const nomeSdr = l.memberId ? sdr.get(l.memberId) : "";
                return (
                  <button
                    key={l.id}
                    className="kanban-cartao"
                    onClick={() => abrir(l)}
                  >
                    <span className="kanban-nome">
                      {l.name}
                      {Date.parse(l.createdAt) >= hoje.getTime() && (
                        <em>Novo</em>
                      )}
                    </span>
                    <Etiquetas lead={l} snap={snap} cfg={cfg} so="car" />
                    {l.waiting && (
                      <span className="etiqueta atencao">
                        Aguardando resposta
                      </span>
                    )}
                    <span className="kanban-rodape">
                      <span>{nomeSdr ? nomeSdr.split(" ")[0] : "sem SDR"}</span>
                      <span>{fmt.data(l.lastActive)}</span>
                    </span>
                  </button>
                );
              })}
              {ls.length > LIMITE && (
                <p className="hint">
                  +{ls.length - LIMITE} leads (use os filtros)
                </p>
              )}
              {!ls.length && <p className="hint">nenhum lead</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
