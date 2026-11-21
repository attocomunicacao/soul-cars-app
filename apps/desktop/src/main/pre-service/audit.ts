/**
 * Gravação da auditoria do Pré-atendimento IA: um arquivo JSONL (`pre-atendimento-auditoria.jsonl`)
 * na pasta interna do app, com um registro por resposta da IA e outro por mudança de desfecho
 * (rascunho aprovado ou descartado). Sem Electron: o caminho do arquivo vem de fora, para os testes.
 * Nunca guarda token nem chave; o telefone entra mascarado. Passando de ~5 MB, o arquivo vira `.1`.
 */
import fs from "node:fs";
import type { Desfecho, TurnoAuditado } from "../../shared/pre-service-audit";

const LIMITE_BYTES = 5 * 1024 * 1024;

type Linha =
  | { tipo: "turno"; turno: TurnoAuditado }
  | { tipo: "desfecho"; id: string; desfecho: Desfecho; em: string };

function anexar(arquivo: string, linha: Linha) {
  try {
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).size > LIMITE_BYTES)
      fs.renameSync(arquivo, `${arquivo}.1`);
    fs.appendFileSync(arquivo, JSON.stringify(linha) + "\n", "utf8");
  } catch {
    /* a auditoria nunca pode derrubar o atendimento */
  }
}

/** Grava um turno auditado. */
export const gravarTurno = (arquivo: string, turno: TurnoAuditado) =>
  anexar(arquivo, { tipo: "turno", turno });

/** Registra o novo desfecho de um turno já gravado (ex.: rascunho → aprovado). */
export const gravarDesfecho = (
  arquivo: string,
  id: string,
  desfecho: Desfecho,
) =>
  anexar(arquivo, {
    tipo: "desfecho",
    id,
    desfecho,
    em: new Date().toISOString(),
  });

/** Lê os turnos mais recentes (mais novo primeiro), já com o último desfecho aplicado. */
export function lerTurnos(arquivo: string, limite = 200): TurnoAuditado[] {
  const turnos = new Map<string, TurnoAuditado>();
  for (const f of [`${arquivo}.1`, arquivo]) {
    let conteudo: string;
    try {
      conteudo = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const l of conteudo.split("\n")) {
      if (!l.trim()) continue;
      try {
        const x = JSON.parse(l) as Linha;
        if (x.tipo === "turno") turnos.set(x.turno.id, x.turno);
        else {
          const t = turnos.get(x.id);
          if (t) t.desfecho = x.desfecho;
        }
      } catch {
        /* linha cortada: ignora */
      }
    }
  }
  return [...turnos.values()]
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, limite);
}
