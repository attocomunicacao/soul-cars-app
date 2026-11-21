/**
 * Transforma erros reais do atendimento (turnos da auditoria com sinal) em cenários do Laboratório
 * (sem Electron, só funções puras). Cada cenário repete as falas do cliente até o turno que deu errado,
 * ANONIMIZADAS (CPF, datas, telefone, e-mail, links, números longos e o nome do contato), e espera
 * que o mesmo sinal não volte a aparecer. O resultado fica só no computador (`<raizDados>/lab-ia/`),
 * fora do git, como os cenários do histórico.
 */
import type { Cenario } from "../../shared/lab";
import { mascararConversa } from "../../shared/lead-profile";
import type { MensagemIa } from "../../shared/pre-service";
import type {
  SinalAuditoria,
  TurnoAuditado,
} from "../../shared/pre-service-audit";
import { anonimizar } from "./history-analysis";

/** Histórico de um chat no estado do atendimento (mensagens com o horário em ms). */
export type HistoricoChat = (MensagemIa & { em: number })[];

/** Quantas falas do cliente, no máximo, entram em cada cenário (as últimas antes do erro). */
const MAX_FALAS = 6;

/** Tira o nome do contato (cada palavra com 3+ letras) do texto, sem diferenciar maiúsculas. */
function semNome(texto: string, nome: string) {
  let t = texto;
  for (const parte of nome.split(/\s+/).filter((p) => p.length >= 3)) {
    const seguro = parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\b${seguro}\\b`, "gi"), "Cliente");
  }
  return t;
}

/**
 * Cria um cenário por turno com sinal (o mais recente primeiro, até `limite`). `historicos` é o
 * histórico de cada chat; sem ele, usa só as mensagens recebidas naquele turno.
 */
export function cenariosDaAuditoria(
  turnos: TurnoAuditado[],
  historicos: Record<string, HistoricoChat>,
  limite = 40,
): Cenario[] {
  const saida: Cenario[] = [];
  const vistos = new Set<string>();
  const ordenados = [...turnos].sort((a, b) => b.em.localeCompare(a.em));
  for (const t of ordenados) {
    if (saida.length >= limite) break;
    if (!t.sinais.length || t.origem !== "laco") continue;
    const ate = Date.parse(t.em);
    const historico = (t.chatId && historicos[t.chatId]) || [];
    // A conversa até o turno (com as falas da IA, para a máscara saber quando foi pedido CPF/data).
    const conversa: MensagemIa[] = historico.length
      ? historico
          .filter((m) => !Number.isFinite(ate) || m.em <= ate)
          .map(({ role, content }) => ({ role, content }))
      : t.recebidas.map((content) => ({ role: "user" as const, content }));
    const falas = mascararConversa(conversa)
      .filter((m) => m.role === "user")
      .map((m) => anonimizar(semNome(m.content, t.nome || "")))
      .filter((s) => s.trim())
      .slice(-MAX_FALAS);
    if (!falas.length) continue;
    const chave = falas.join("\n");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const sinais = [...new Set(t.sinais)] as SinalAuditoria[];
    saida.push({
      id: `auditoria-${String(saida.length + 1).padStart(3, "0")}`,
      categoria: "auditoria",
      titulo: `Erro real: ${sinais.join(", ")}`,
      turnos: falas,
      esperado: { semSinais: sinais },
      origem: "auditoria",
    });
  }
  return saida;
}
