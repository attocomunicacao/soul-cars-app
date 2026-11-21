/**
 * Chamadas HTTP com nova tentativa, usadas pelas integrações (uTalk, Meta).
 *
 * - 429 (limite de pedidos): espera o `Retry-After` do servidor (ou uma espera crescente) e repete.
 *   É seguro para qualquer método, porque o servidor recusou o pedido antes de processá-lo.
 * - Falha de rede, timeout e 500/502/503/504: só em **leituras**. Repetir uma escrita poderia mandar
 *   a mesma mensagem duas vezes ao cliente; por isso, para escritas, o padrão é não repetir.
 * - Mensagens de erro nunca levam o corpo cru da resposta: ele pode ter nome, telefone ou e-mail.
 *
 * Sem Electron: o `fetch` e a espera são injetados, para testar sem rede nem tempo real.
 */

/** Forma do `fetch` que as integrações recebem (igual a `Buscar` em crm/utalk-api.ts). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Nenhum servidor segura o app por mais que isto numa única espera. */
export const ESPERA_MAXIMA_MS = 60_000;
// 500 entra para manter o comportamento antigo do uTalk: erro de servidor costuma passar sozinho.
const STATUS_TRANSITORIOS = new Set([500, 502, 503, 504]);

/** Converte o cabeçalho `Retry-After` (segundos ou data HTTP) em milissegundos; null se ausente ou ilegível. */
export function esperaDoRetryAfter(
  valor: string | null,
  agora = Date.now(),
): number | null {
  const texto = (valor ?? "").trim();
  if (!texto) return null;
  if (/^\d+$/.test(texto))
    return Math.min(Number(texto) * 1000, ESPERA_MAXIMA_MS);
  // Data HTTP sempre tem letras (dia da semana, mês, "GMT"); sem elas o V8 aceitaria até "-5" como data.
  if (!/[a-z]/i.test(texto)) return null;
  const data = Date.parse(texto);
  if (Number.isNaN(data)) return null;
  return Math.min(Math.max(data - agora, 0), ESPERA_MAXIMA_MS);
}

export type OpcoesRetentativa = {
  /** Novas tentativas após um 429 (padrão 4). */
  tentativas429?: number;
  /** Novas tentativas após falha de rede, timeout ou 500/502/503/504 (padrão 0: só ligue em leituras). */
  tentativasTransitorias?: number;
  /** Espera base após 429 sem `Retry-After`; cresce a cada tentativa (padrão 2000 ms). */
  esperaBase429Ms?: number;
  /** Espera base entre tentativas de rede/5xx (padrão 800 ms, cresce a cada tentativa). */
  esperaBaseTransitoriaMs?: number;
  /** Tempo limite de cada tentativa, se o chamador não passou um `signal`. */
  timeoutMs?: number;
  /** Espera injetável (testes). */
  espera?: (ms: number) => Promise<void>;
};

const esperaReal = (ms: number) =>
  new Promise<void>((ok) => setTimeout(ok, ms));

/** Descarta o corpo de uma resposta que não será usada, para liberar a conexão. */
async function descartar(r: Response) {
  try {
    await r.body?.cancel();
  } catch {
    /* já consumido */
  }
}

/**
 * Faz a chamada e repete conforme as opções. Devolve a última resposta (inclusive um 429 ou 5xx que
 * esgotou as tentativas) para o chamador decidir a mensagem; só lança em falha de rede sem tentativas.
 */
export async function buscarComRetentativa(
  buscar: FetchLike,
  url: string,
  init: RequestInit = {},
  opcoes: OpcoesRetentativa = {},
): Promise<Response> {
  const {
    tentativas429 = 4,
    tentativasTransitorias = 0,
    esperaBase429Ms = 2000,
    esperaBaseTransitoriaMs = 800,
    timeoutMs,
    espera = esperaReal,
  } = opcoes;
  let usadas429 = 0;
  let usadasTransitorias = 0;
  for (;;) {
    const tentativa: RequestInit =
      init.signal || timeoutMs === undefined
        ? init
        : { ...init, signal: AbortSignal.timeout(timeoutMs) };
    let resposta: Response;
    try {
      resposta = await buscar(url, tentativa);
    } catch (erro) {
      if (usadasTransitorias >= tentativasTransitorias) throw erro;
      usadasTransitorias++;
      await espera(esperaBaseTransitoriaMs * usadasTransitorias);
      continue;
    }
    if (resposta.status === 429 && usadas429 < tentativas429) {
      const quanto =
        esperaDoRetryAfter(resposta.headers.get("retry-after")) ??
        esperaBase429Ms * (usadas429 + 1);
      usadas429++;
      await descartar(resposta);
      await espera(quanto);
      continue;
    }
    if (
      STATUS_TRANSITORIOS.has(resposta.status) &&
      usadasTransitorias < tentativasTransitorias
    ) {
      usadasTransitorias++;
      await descartar(resposta);
      await espera(esperaBaseTransitoriaMs * usadasTransitorias);
      continue;
    }
    return resposta;
  }
}

/**
 * Da resposta de erro, só o campo de mensagem curto (`message`, `title` ou `error`), sem números longos
 * nem e-mails. Qualquer outra coisa (HTML, JSON grande, stack) vira texto vazio.
 */
export function resumoSeguroDoCorpo(corpo: string): string {
  let dados: unknown;
  try {
    dados = JSON.parse(corpo);
  } catch {
    return "";
  }
  if (!dados || typeof dados !== "object") return "";
  const o = dados as Record<string, unknown>;
  const candidato = [o.message, o.title, o.error].find(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  if (!candidato || candidato.length > 160) return "";
  return (
    candidato
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]")
      // Telefone e CPF costumam vir formatados ("(11) 99999-8888", "123.456.789-09"): dígitos separados
      // por espaço, ponto, hífen ou parênteses, com 7 ou mais no total.
      .replace(/\d(?:[\s.()-]?\d){6,}/g, "[número]")
      .trim()
  );
}

/** "<contexto>: erro 404 (mensagem curta)." sem o corpo da resposta. */
export async function mensagemDeErroHttp(
  resposta: Response,
  contexto: string,
): Promise<string> {
  const corpo = await resposta.text().catch(() => "");
  const resumo = resumoSeguroDoCorpo(corpo);
  return `${contexto}: erro ${resposta.status}${resumo ? ` (${resumo})` : ""}.`;
}
