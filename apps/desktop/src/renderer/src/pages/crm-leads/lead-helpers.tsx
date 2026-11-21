/**
 * Ajudantes da página CRM · Leads: mapas de etiquetas e SDRs, etiquetas de status e o componente que desenha as etiquetas de um lead.
 */
import {
  categoria,
  type ConfigLeads,
  type LeadCrm,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { COR_ETIQUETA } from "./shared";

// ------------------------------------------------------------------ ajudantes
export const mapaEtiquetas = (s: SnapshotCrm) =>
  new Map(s.tags.map((t) => [t.id, t]));
export const mapaSdr = (s: SnapshotCrm) =>
  new Map(s.members.map((m) => [m.id, m.name]));
export const etiquetasDeStatus = (s: SnapshotCrm, cfg: ConfigLeads) => {
  const m = mapaEtiquetas(s);
  return cfg.statusOrder
    .map((id) => m.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t);
};

export function Etiquetas({
  lead,
  snap,
  cfg,
  so,
}: {
  lead: LeadCrm;
  snap: SnapshotCrm;
  cfg: ConfigLeads;
  so?: "car" | "status";
}) {
  const m = mapaEtiquetas(snap);
  const lista = lead.tagIds
    .map((id) => m.get(id))
    .filter(
      (t): t is NonNullable<typeof t> =>
        !!t &&
        categoria(cfg, t.id) !== "ignore" &&
        (!so || categoria(cfg, t.id) === so),
    );
  if (!lista.length)
    return (
      <span className="hint">
        {so === "car" ? "sem carro" : so === "status" ? "sem status" : "—"}
      </span>
    );
  return (
    <span className="etiquetas">
      {lista.map((t) =>
        categoria(cfg, t.id) === "car" ? (
          <span key={t.id} className="etiqueta carro">
            {t.name}
          </span>
        ) : (
          <span key={t.id} className="etiqueta">
            <i
              style={{ background: COR_ETIQUETA[t.color ?? ""] ?? "#9a9389" }}
            />
            {t.emoji}
            {t.name}
          </span>
        ),
      )}
    </span>
  );
}
