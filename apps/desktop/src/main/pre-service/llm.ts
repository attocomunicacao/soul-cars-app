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

/** Quem respondeu de fato (preenchido por `gerar`): serve à auditoria. */
export type UsoModelo = { provedor: string; modelo: string; reserva: boolean };

class ErroModelo extends Error {
  constructor(
    mensagem: string,
    public status = 0,
  ) {
    super(mensagem);
  }
}

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Gera a resposta com o provedor configurado (e a reserva Ollama, se ligada). `avisar` registra a troca. */
export async function gerar(
  buscar: Buscar,
  mensagens: MensagemModelo[],
  cfg: ConfigIa,
  chaveGroq: string | null,
  avisar: (texto: string) => void = () => {},
  uso?: UsoModelo,
): Promise<string> {
  const doOllama = (reserva: boolean) => {
    if (uso)
      Object.assign(uso, {
        provedor: "ollama",
        modelo: cfg.modeloOllama,
        reserva,
      });
  };
  if (cfg.provedor !== "groq") {
    const r = await gerarOllama(buscar, mensagens, cfg);
    doOllama(false);
    return r;
  }
  try {
    const r = await gerarGroq(buscar, mensagens, cfg, chaveGroq);
    if (uso)
      Object.assign(uso, {
        provedor: "groq",
        modelo: cfg.modeloGroq,
        reserva: false,
      });
    return r;
  } catch (e) {
    const erro = e as ErroModelo;
    if (!cfg.reservaOllama || erro.status === 401) throw e;
    avisar(
      `Groq indisponível (${erro.message.slice(0, 120)}) — respondendo com o Ollama local`,
    );
    try {
      const r = await gerarOllama(buscar, mensagens, cfg);
      doOllama(true);
      return r;
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
) {
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
  const j = (await r.json()) as { message?: { content?: string } };
  return j.message?.content ?? "";
}

async function gerarGroq(
  buscar: Buscar,
  mensagens: MensagemModelo[],
  cfg: ConfigIa,
  chave: string | null,
  tentativa = 0,
): Promise<string> {
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
  const seg = Number(r.headers.get("retry-after")) || 5;
  if (r.status === 429 && tentativa < 2 && seg <= 20) {
    await espera(seg * 1000);
    return gerarGroq(buscar, mensagens, cfg, chave, tentativa + 1);
  }
  if (!r.ok) {
    const corpo = (await r.text()).slice(0, 300);
    if (r.status === 401)
      throw new ErroModelo(
        "O Groq recusou a chave da API (401). Confira a chave nas Configurações.",
        401,
      );
    if (r.status === 429)
      throw new ErroModelo(
        seg > 20
          ? "limite diário do plano grátis do Groq atingido"
          : "limite por minuto do Groq atingido",
        429,
      );
    throw new ErroModelo(`Groq ${r.status}: ${corpo}`, r.status);
  }
  const j = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return j.choices?.[0]?.message?.content ?? "";
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
