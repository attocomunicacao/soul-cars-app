/**
 * Gaveta de detalhe de um lead do CRM · Leads.
 */
import {
  type ConfigLeads,
  type LeadCrm,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { Avatar, Gaveta, fmt } from "../../app/components";
import { openUrl } from "../../lib/desktop-bridge";
import { Etiquetas, mapaSdr } from "./lead-helpers";

// ------------------------------------------------------------------ Detalhe
export function LeadDetail({
  lead: l,
  snap,
  cfg,
  fechar,
}: {
  lead: LeadCrm;
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  fechar: () => void;
}) {
  const sdr = mapaSdr(snap);
  const digitos = l.phone.replace(/\D/g, "");
  return (
    <Gaveta titulo={`Lead ${l.name}`} fechar={fechar}>
      <Avatar nome={l.name} />
      <h2>{l.name}</h2>
      <p className="hint">
        {l.chatOpen ? "Atendimento aberto" : "Atendimento fechado"}
        {l.waiting ? " · aguardando resposta" : ""}
      </p>
      <Etiquetas lead={l} snap={snap} cfg={cfg} />
      {digitos && (
        <p>
          <button
            className="primary"
            onClick={() => void openUrl(`https://wa.me/${digitos}`)}
          >
            Abrir no WhatsApp
          </button>
        </p>
      )}
      <dl className="ficha-lead">
        <dt>Telefone</dt>
        <dd>{l.phone || "—"}</dd>
        <dt>E-mail</dt>
        <dd>{l.email || "—"}</dd>
        <dt>SDR</dt>
        <dd>{(l.memberId && sdr.get(l.memberId)) || "—"}</dd>
        <dt>Setor</dt>
        <dd>{l.sector || "—"}</dd>
        <dt>Criado em</dt>
        <dd>{fmt.data(l.createdAt)}</dd>
        <dt>Última atividade</dt>
        <dd>{fmt.data(l.lastActive)}</dd>
        <dt>Atendimentos</dt>
        <dd>{l.totalChats}</dd>
      </dl>
      {l.actions.length > 0 && (
        <>
          <h3>Ações dos SDRs</h3>
          <ul className="linha-tempo">
            {[...l.actions]
              .reverse()
              .slice(0, 30)
              .map((a, i) => (
                <li key={i}>
                  <time>{fmt.data(a.at)}</time>
                  {sdr.get(a.memberId) ?? "SDR"} acionou <b>{a.title}</b>
                  {a.trigger && a.trigger !== a.title ? ` → ${a.trigger}` : ""}
                </li>
              ))}
          </ul>
        </>
      )}
    </Gaveta>
  );
}
