/**
 * Testes (Vitest) de src/main/core/http-retry.ts: nova tentativa com espera crescente, respeito ao
 * `Retry-After` em 429, retry de rede/5xx só em leituras e mensagens de erro sem o corpo da resposta.
 * O `fetch` e a espera são falsos: nada de rede de verdade nem de tempo real.
 */
import { describe, expect, it, vi } from "vitest";
import {
  buscarComRetentativa,
  esperaDoRetryAfter,
  mensagemDeErroHttp,
  resumoSeguroDoCorpo,
} from "../src/main/core/http-retry";

const resp = (
  status: number,
  corpo = "",
  cabecalhos: Record<string, string> = {},
) => new Response(corpo, { status, headers: cabecalhos });

/** Fetch falso: devolve (ou lança) o que estiver na fila, uma coisa por chamada. */
function falso(fila: (Response | Error)[]) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const buscar = vi.fn(async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const proximo = fila.shift();
    if (!proximo) throw new Error("fila vazia");
    if (proximo instanceof Error) throw proximo;
    return proximo;
  });
  return { buscar, chamadas };
}
const esperas = () => {
  const lista: number[] = [];
  return { lista, espera: async (ms: number) => void lista.push(ms) };
};

describe("esperaDoRetryAfter", () => {
  it("lê segundos", () => expect(esperaDoRetryAfter("3")).toBe(3000));
  it("lê uma data HTTP no futuro", () => {
    const agora = Date.parse("2026-01-01T00:00:00Z");
    expect(esperaDoRetryAfter("Thu, 01 Jan 2026 00:00:07 GMT", agora)).toBe(
      7000,
    );
  });
  it("limita a espera máxima (um servidor não prende o app por minutos)", () => {
    expect(esperaDoRetryAfter("9999")).toBe(60_000);
  });
  it.each([null, "", "abc", "-5"])("ignora %s", (v) =>
    expect(esperaDoRetryAfter(v)).toBeNull(),
  );
});

describe("429 (limite de pedidos)", () => {
  it("espera o Retry-After e tenta de novo, em qualquer método", async () => {
    const { buscar, chamadas } = falso([
      resp(429, "", { "Retry-After": "2" }),
      resp(200, "ok"),
    ]);
    const e = esperas();
    const r = await buscarComRetentativa(
      buscar,
      "https://x/y",
      { method: "POST", body: "{}" },
      { espera: e.espera },
    );
    expect(r.status).toBe(200);
    expect(chamadas).toHaveLength(2);
    expect(e.lista).toEqual([2000]);
    expect(chamadas[1].init.body).toBe("{}"); // o corpo é reenviado
  });

  it("sem Retry-After, a espera cresce", async () => {
    const { buscar } = falso([resp(429), resp(429), resp(200)]);
    const e = esperas();
    await buscarComRetentativa(
      buscar,
      "https://x",
      {},
      { espera: e.espera, esperaBase429Ms: 1000 },
    );
    expect(e.lista).toEqual([1000, 2000]);
  });

  it("desiste depois do limite e devolve o 429 para quem chamou tratar", async () => {
    const { buscar, chamadas } = falso([resp(429), resp(429), resp(429)]);
    const r = await buscarComRetentativa(
      buscar,
      "https://x",
      {},
      { espera: esperas().espera, tentativas429: 2 },
    );
    expect(r.status).toBe(429);
    expect(chamadas).toHaveLength(3); // 1 + 2 tentativas
  });
});

describe("erro de rede e 5xx", () => {
  it("leitura: tenta de novo em falha de rede e em 503", async () => {
    const { buscar, chamadas } = falso([
      new Error("ECONNRESET"),
      resp(503),
      resp(200, "ok"),
    ]);
    const e = esperas();
    const r = await buscarComRetentativa(
      buscar,
      "https://x",
      { method: "GET" },
      { espera: e.espera, tentativasTransitorias: 2 },
    );
    expect(r.status).toBe(200);
    expect(chamadas).toHaveLength(3);
    expect(e.lista).toHaveLength(2);
  });

  it("escrita (padrão): NÃO repete em falha de rede nem 5xx, para não duplicar uma mensagem", async () => {
    const { buscar, chamadas } = falso([new Error("ECONNRESET")]);
    await expect(
      buscarComRetentativa(
        buscar,
        "https://x",
        { method: "POST", body: "{}" },
        { espera: esperas().espera },
      ),
    ).rejects.toThrow("ECONNRESET");
    expect(chamadas).toHaveLength(1);

    const outro = falso([resp(503)]);
    const r = await buscarComRetentativa(
      outro.buscar,
      "https://x",
      { method: "POST" },
      { espera: esperas().espera },
    );
    expect(r.status).toBe(503);
    expect(outro.chamadas).toHaveLength(1);
  });

  it("repete 500, 502, 503 e 504; erro do cliente (400, 401, 404) volta direto", async () => {
    const opcoes = () => ({
      espera: esperas().espera,
      tentativasTransitorias: 2,
    });
    for (const status of [500, 502, 503, 504]) {
      const { buscar, chamadas } = falso([resp(status), resp(200)]);
      const r = await buscarComRetentativa(buscar, "https://x", {}, opcoes());
      expect(r.status, String(status)).toBe(200);
      expect(chamadas, String(status)).toHaveLength(2);
    }
    for (const status of [400, 401, 404]) {
      const { buscar, chamadas } = falso([resp(status)]);
      const r = await buscarComRetentativa(buscar, "https://x", {}, opcoes());
      expect(r.status).toBe(status);
      expect(chamadas).toHaveLength(1);
    }
  });

  it("depois de esgotar as tentativas de rede, repassa o erro original", async () => {
    const { buscar } = falso([new Error("a"), new Error("b"), new Error("c")]);
    await expect(
      buscarComRetentativa(
        buscar,
        "https://x",
        {},
        { espera: esperas().espera, tentativasTransitorias: 2 },
      ),
    ).rejects.toThrow("c");
  });
});

describe("tempo limite", () => {
  it("põe um sinal de tempo limite quando quem chamou não passou um", async () => {
    const { buscar, chamadas } = falso([resp(200)]);
    await buscarComRetentativa(
      buscar,
      "https://x",
      {},
      { espera: esperas().espera, timeoutMs: 5000 },
    );
    expect(chamadas[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it("respeita o sinal que quem chamou já passou", async () => {
    const { buscar, chamadas } = falso([resp(200)]);
    const meu = new AbortController().signal;
    await buscarComRetentativa(
      buscar,
      "https://x",
      { signal: meu },
      { espera: esperas().espera, timeoutMs: 5000 },
    );
    expect(chamadas[0].init.signal).toBe(meu);
  });
});

describe("mensagens de erro sem o corpo da resposta", () => {
  it("não reproduz o corpo cru (pode ter nome, telefone ou e-mail de cliente)", async () => {
    const corpo = JSON.stringify({
      message: "Contato 11999998888 joao@gmail.com não encontrado",
      stack: "x".repeat(2000),
    });
    const texto = await mensagemDeErroHttp(
      resp(404, corpo),
      "uTalk GET /v1/chats/",
    );
    expect(texto).toContain("uTalk GET /v1/chats/");
    expect(texto).toContain("404");
    expect(texto).not.toMatch(/11999998888|joao@gmail\.com|xxxx/);
    expect(texto.length).toBeLessThan(260);
  });

  it("usa só o campo de mensagem curto do JSON, nunca o texto inteiro", () => {
    expect(
      resumoSeguroDoCorpo('{"title":"Limite excedido","detail":"ignorado"}'),
    ).toBe("Limite excedido");
    expect(resumoSeguroDoCorpo("<html>" + "a".repeat(5000))).toBe("");
    expect(resumoSeguroDoCorpo("")).toBe("");
    expect(
      resumoSeguroDoCorpo('{"message":"x@y.com 12345678901"}'),
    ).not.toMatch(/x@y\.com|12345678901/);
  });

  it("telefone e CPF formatados também não passam", () => {
    const r = resumoSeguroDoCorpo(
      '{"message":"Ligar (11) 99999-8888, CPF 123.456.789-09, fixo 11 3333 4444"}',
    );
    expect(r).not.toMatch(/9999|456\.789|3333/);
    expect(r).toContain("[número]");
  });

  it("sem mensagem útil, devolve só o status", async () => {
    expect(
      await mensagemDeErroHttp(resp(502, "<html>bad gateway</html>"), "Meta"),
    ).toBe("Meta: erro 502.");
  });
});
