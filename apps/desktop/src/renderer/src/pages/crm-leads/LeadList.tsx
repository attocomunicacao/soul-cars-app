/**
 * Visão Leads do CRM · Leads: tabela filtrável e ordenável, com exportação em CSV.
 */
import { useState } from "react";
import {
  NENHUM,
  categoria,
  statusDoLead,
  type ConfigLeads,
  type LeadCrm,
  type SnapshotCrm,
} from "../../../../shared/crm-leads";
import { Avatar, Vazio, baixarCsv, fmt } from "../../app/components";
import { Etiquetas, mapaEtiquetas, mapaSdr } from "./lead-helpers";

// ------------------------------------------------------------------ Leads
type ColunaOrdem = "name" | "car" | "status" | "member" | "lastActive";

export function LeadList({
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
  const [ordem, setOrdem] = useState<{ k: ColunaOrdem; dir: 1 | -1 }>({
    k: "lastActive",
    dir: -1,
  });
  const etiq = mapaEtiquetas(snap);
  const sdr = mapaSdr(snap);
  const linha = (l: LeadCrm) => {
    const st = statusDoLead(l, cfg.statusOrder);
    return {
      name: l.name,
      car: l.tagIds
        .filter((t) => categoria(cfg, t) === "car")
        .map((t) => etiq.get(t)?.name)
        .filter(Boolean)
        .join(", "),
      status: st === NENHUM ? "" : (etiq.get(st)?.name ?? ""),
      member: l.memberId ? (sdr.get(l.memberId) ?? "") : "",
      lastActive: l.lastActive,
    };
  };
  const linhas = leads
    .map((l) => ({ l, r: linha(l) }))
    .sort((a, b) => {
      const x = a.r[ordem.k];
      const y = b.r[ordem.k];
      return (
        (ordem.k === "lastActive"
          ? Date.parse(x) - Date.parse(y)
          : x.localeCompare(y, "pt-BR")) * ordem.dir
      );
    });
  const cab = (k: ColunaOrdem, r: string) => (
    <th>
      <button
        className="ordenar"
        onClick={() =>
          setOrdem({ k, dir: ordem.k === k ? (-ordem.dir as 1 | -1) : 1 })
        }
      >
        {r}
        {ordem.k === k ? (ordem.dir > 0 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const exportar = () =>
    baixarCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Lead",
        "Telefone",
        "Carro",
        "Status",
        "SDR",
        "Criado em",
        "Última atividade",
      ],
      ...linhas.map(({ l, r }) => [
        r.name,
        l.phone,
        r.car,
        r.status,
        r.member,
        fmt.data(l.createdAt),
        fmt.data(l.lastActive),
      ]),
    ]);
  return (
    <div className="panel">
      <div className="actions">
        <h2>
          Leads{" "}
          <span className="vitrine-total">· {fmt.int(linhas.length)}</span>
        </h2>
        <button onClick={exportar} disabled={!linhas.length}>
          Exportar CSV
        </button>
      </div>
      <div
        className="tabela-rolavel"
        tabIndex={0}
        role="region"
        aria-label="Tabela rolável"
      >
        <table>
          <thead>
            <tr>
              {cab("name", "Lead")}
              {cab("car", "Carro")}
              {cab("status", "Status")}
              {cab("member", "SDR")}
              {cab("lastActive", "Última atividade")}
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 500).map(({ l, r }) => (
              <tr
                key={l.id}
                className="clicavel"
                tabIndex={0}
                onClick={() => abrir(l)}
                onKeyDown={(e) => e.key === "Enter" && abrir(l)}
              >
                <td>
                  <span className="quem">
                    <Avatar nome={l.name} />
                    <span>
                      {l.name}
                      <small>{l.phone}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <Etiquetas lead={l} snap={snap} cfg={cfg} so="car" />
                </td>
                <td>
                  <Etiquetas lead={l} snap={snap} cfg={cfg} so="status" />
                </td>
                <td>{r.member || <span className="hint">—</span>}</td>
                <td className="num">{fmt.data(l.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length > 500 && (
        <p className="hint">
          Mostrando 500 de {fmt.int(linhas.length)}. Use os filtros ou exporte o
          CSV.
        </p>
      )}
      {!linhas.length && <Vazio titulo="Nenhum lead com esses filtros" />}
    </div>
  );
}
