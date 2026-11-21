/**
 * Exemplos reais da equipe: pares pergunta/resposta tirados da memória das conversas da Soul IA.
 *
 * O que a IA mandou antes sai com o usuário do token, então é excluído para não virar "exemplo da
 * equipe". O resultado fica em cache até `zerarParesReais`.
 */
import { conversasDaMemoria } from "../soul-ai/soul-ai";
import { extrairPares, type ParReal } from "../../shared/pre-service";
import { carregar } from "./state";

// ------------------------------------------------------------ exemplos reais
let pares: ParReal[] | null = null;
export function paresReais(): ParReal[] {
  if (pares) return pares;
  const e = carregar();
  // O que a IA mandou sai com o usuário do token: não pode virar "exemplo da equipe".
  const daIa = new Set(
    Object.values(e.chats).flatMap((c) =>
      c.historico
        .filter((m) => m.role === "assistant")
        .map((m) => m.content.trim()),
    ),
  );
  try {
    pares = extrairPares(
      conversasDaMemoria().map((c) => ({
        id: c.id,
        direta: true, // a memória só guarda chats diretos (DirectMessage)
        etiquetas: c.etiquetas,
        mensagens: c.mensagens.map((m) => ({
          em: new Date(m.em).getTime(),
          // "externo" = enviada pelo celular da loja (equipe).
          de:
            m.origem === "lead"
              ? "lead"
              : m.origem === "robo"
                ? "robo"
                : "equipe",
          texto: m.texto ?? "",
          tipo: m.tipo,
          privada: m.privada,
        })),
      })),
      daIa,
    );
  } catch {
    pares = [];
  }
  return pares;
}

/** Descarta o cache: os exemplos reais são recalculados na próxima leitura (depois de sincronizar a Soul IA). */
export function zerarParesReais() {
  pares = null;
}
