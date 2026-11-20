/**
 * Provedores de modelo do Pré-atendimento IA: Groq (API compatível com OpenAI, plano grátis) e Ollama
 * (local). Com o Groq escolhido, o Ollama entra sozinho como reserva quando o Groq não responde
 * (limite do plano, fora do ar, sem internet); chave recusada (401) não cai na reserva, porque é erro
 * de configuração. Sem Electron: o `fetch` é injetado para os testes.
 */
import type { ConfigIa } from "../../shared/pre-service";
import type { Buscar } from "../crm/utalk-api";

export const BASE_GROQ = "https://api.groq.com/openai/v1";

export type MensagemModelo = { role: string; content: string };

/** Quem respondeu de fato (preenchido por `gerar`): serve à auditoria e ao Laboratório. */
export type UsoModelo = {
  provedor: string;
  modelo: string;
  reserva: boolean;
  /** Tokens gastos na chamada (entrada + saída), quando o provedor informa. */
  tokens?: number;
};

/** Texto do modelo e tokens gastos (entrada + saída), quando o provedor informa. */
type Saida = { texto: string; tokens?: number };

/** Mensagem do erro de limite diário do Groq (o Laboratório para o lote quando a vê). */
export const LIMITE_DIARIO_GROQ =
  "limite diário do plano grátis do Groq atingido";

class ErroModelo extends Error {
  constructor(
    mensagem: string,
    public status = 0,
  ) {
    super(mensagem);
  }
}

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Texto sem conteúdo depois de tirar o raciocínio <think>…</think>. */
const vazio = (t: string) => !t.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

/**
 * Chama o provedor e, se ele devolver texto vazio (acontece às vezes com respostas curtas, como
 * "Salve."), tenta mais uma vez: sem isso o cliente fica sem resposta. Os tokens das duas somam.
 */
async function comNovaTentativaSeVazio(
  chamar: () => Promise<Saida>,
): Promise<Saida> {
  const r = await chamar();
  if (!vazio(r.texto)) return r;
  const r2 = await chamar();
  const tokens = (r.tokens ?? 0) + (r2.tokens ?? 0);
  return { texto: r2.texto, tokens: tokens || undefined };
}

const TIPOS_LIMITE: [RegExp, string, boolean][] = [
  [/tokens per day|\bTPD\b/i, "tokens/dia", true],
  [/requests per day|\bRPD\b/i, "pedidos/dia", true],
  [/tokens per minute|\bTPM\b/i, "tokens/minuto", false],
  [/requests per minute|\bRPM\b/i, "pedidos/minuto", false],
];

/** Converte "1h2m3.5s", "12m3s" ou "7.2s" em segundos (0 se não reconhecer). */
function duracao(texto: string): number {
  const m = /(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/.exec(texto);
  if (!m || !m[0]) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** "~12 min", "~1 h 5 min" ou "~40 s", para a mensagem ao usuário. */
function tempoLegivel(seg: number) {
  if (seg < 60) return `~${Math.ceil(seg)} s`;
  const min = Math.ceil(seg / 60);
  return min < 60
    ? `~${min} min`
    : `~${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
}

/**
 * Interpreta a resposta 429 do Groq: qual limite foi atingido (o corpo diz "tokens per day (TPD)…
 * Please try again in 12m3.5s") e em quanto tempo libera. Sem tipo no corpo, `retry-after` acima de
 * 20 s conta como diário. A mensagem do diário começa com `LIMITE_DIARIO_GROQ`.
 */
export function lerLimiteGroq(corpo: string, retryAfter: number) {
  let texto = corpo;
  try {
    texto =
      (JSON.parse(corpo) as { error?: { message?: string } }).error?.message ??
      corpo;
  } catch {
    /* corpo sem JSON */
  }
  const tipo = TIPOS_LIMITE.find(([re]) => re.test(texto));
  const pedido = /try again in\s+([\dhms.]+)/i.exec(texto);
  const segundos = (pedido && duracao(pedido[1])) || retryAfter || 5;
  const diario = tipo ? tipo[2] : segundos > 20;
  const nome = tipo ? ` (${tipo[1]})` : "";
  return {
    diario,
    segundos,
    mensagem: diario
      ? `${LIMITE_DIARIO_GROQ}${nome} — libera em ${tempoLegivel(segundos)}`
      : `limite por minuto do Groq atingido${nome}`,
  };
}

/** Gera a resposta com o provedor configurado (e a reserva Ollama, se ligada). `avisar` registra a troca. */
export async function gerar(
  buscar: Buscar,
  mensagens: MensagemModelo[],
  cfg: ConfigIa,
  chaveGroq: string | null,
  avisar: (texto: string) => void = () => {},
  uso?: UsoModelo,
): Promise<string> {
  const doOllama = (reserva: boolean, tokens?: number) => {
    if (uso)
      Object.assign(uso, {
        provedor: "ollama",
        modelo: cfg.modeloOllama,
        reserva,
        tokens,
      });
  };
  if (cfg.provedor !== "groq") {
    const r = await comNovaTentativaSeVazio(() =>
      gerarOllama(buscar, mensagens, cfg),
    );
    doOllama(false, r.tokens);
    return r.texto;
  }
  try {
    const r = await comNovaTentativaSeVazio(() =>
      gerarGroq(buscar, mensagens, cfg, chaveGroq),
    );
    if (uso)
      Object.assign(uso, {
        provedor: "groq",
        modelo: cfg.modeloGroq,
        reserva: false,
        tokens: r.tokens,
      });
    return r.texto;
  } catch (e) {
    const erro = e as ErroModelo;
    if (!cfg.reservaOllama || erro.status === 401) throw e;
    avisar(
      `Groq indisponível (${erro.message.slice(0, 120)}) — respondendo com o Ollama local`,
    );
    try {
      const r = await comNovaTentativaSeVazio(() =>
        gerarOllama(buscar, mensagens, cfg),
      );
      doOllama(true, r.tokens);
      return r.texto;
    } catch (e2) {
      throw new Error(
        `O Groq falhou (${erro.message.slice(0, 100)}) e a reserva Ollama também (${(e2 as Error).message.slice(0, 100)}).`,
        { cause: e2 },
      );
    }
  }
}

async function gerarOllama(
  buscar: Buscar,
  mensagens: MensagemModelo[],
  cfg: ConfigIa,
): Promise<Saida> {
  let r: Response;
  try {
    r = await buscar(`${cfg.urlOllama.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.modeloOllama,
        messages: mensagens,
        stream: false,
        keep_alive: "24h",
        options: { temperature: cfg.temperatura },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new ErroModelo(
      "o Ollama não respondeu (confira se ele está aberto neste computador)",
    );
  }
  if (!r.ok)
    throw new ErroModelo(
      `Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`,
      r.status,
    );
  const j = (await r.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const tokens = (j.prompt_eval_count ?? 0) + (j.eval_count ?? 0);
  return { texto: j.message?.content ?? "", tokens: tokens || undefined };
}

async function gerarGroq(
  buscar: Buscar,
  mensagens: MensagemModelo[],
  cfg: ConfigIa,
  chave: string | null,
  tentativa = 0,
): Promise<Saida> {
  if (!chave)
    throw new ErroModelo(
      "Cadastre a chave da API do Groq nas Configurações do Pré-atendimento.",
      401,
    );
  let r: Response;
  try {
    r = await buscar(`${BASE_GROQ}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.modeloGroq,
        messages: mensagens,
        temperature: cfg.temperatura,
        max_tokens: 400,
        // Qwen 3.x pensa por padrão: para respostas curtas de WhatsApp, modo direto (≈1 s e menos tokens).
        ...(/qwen3/i.test(cfg.modeloGroq) ? { reasoning_effort: "none" } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ErroModelo("sem conexão com o Groq");
  }
  // Limite por minuto: espera e tenta de novo (até 2 vezes). Limite diário: falha já, para a reserva assumir.
  if (r.status === 429) {
    const limite = lerLimiteGroq(
      await r.text(),
      Number(r.headers.get("retry-after")) || 0,
    );
    if (!limite.diario && tentativa < 2) {
      await espera(Math.min(Math.max(limite.segundos, 1), 20) * 1000);
      return gerarGroq(buscar, mensagens, cfg, chave, tentativa + 1);
    }
    throw new ErroModelo(limite.mensagem, 429);
  }
  if (!r.ok) {
    const corpo = (await r.text()).slice(0, 300);
    if (r.status === 401)
      throw new ErroModelo(
        "O Groq recusou a chave da API (401). Confira a chave nas Configurações.",
        401,
      );
    throw new ErroModelo(`Groq ${r.status}: ${corpo}`, r.status);
  }
  const j = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  return {
    texto: j.choices?.[0]?.message?.content ?? "",
    tokens: j.usage?.total_tokens,
  };
}

/** Modelos de conversa disponíveis no provedor configurado. */
export async function listarModelos(
  buscar: Buscar,
  cfg: ConfigIa,
  chaveGroq: string | null,
): Promise<string[]> {
  if (cfg.provedor === "groq") {
    if (!chaveGroq) return [];
    const r = await buscar(`${BASE_GROQ}/models`, {
      headers: { Authorization: `Bearer ${chaveGroq}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok)
      throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { data?: { id: string }[] };
    return (j.data ?? [])
      .map((m) => m.id)
      .filter((id) => !/whisper|tts|guard|playai|orpheus/i.test(id))
      .sort();
  }
  const r = await buscar(`${cfg.urlOllama.replace(/\/+$/, "")}/api/tags`, {
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json()) as { models?: { name: string }[] };
  return (j.models ?? []).map((m) => m.name);
}
