/**
 * Testes (Vitest) de src/main/pre-service/utalk-writer.ts, o único ponto que escreve no uTalk.
 * Com `fetch` falso, provam o que importa para o cliente da loja: uma mensagem nunca é enviada duas
 * vezes por causa de uma nova tentativa, o limite de pedidos (429) é respeitado e o erro não carrega
 * o corpo da resposta (que pode ter nome, telefone ou e-mail).
 */
import { describe, expect, it, vi } from "vitest";
import { clienteEscrita } from "../src/main/pre-service/utalk-writer";

const resp = (
  status: number,
  corpo = "",
  cabecalhos: Record<string, string> = {},
) => new Response(corpo, { status, headers: cabecalhos });

function cliente(fila: (Response | Error)[]) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const buscar = vi.fn(async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const proximo = fila.shift();
    if (!proximo) throw new Error("fila vazia");
    if (proximo instanceof Error) throw proximo;
    return proximo;
  });
  return { c: clienteEscrita(buscar, "token-de-teste", "org1"), chamadas };
}

describe("enviar mensagem (escrita)", () => {
  it("envia o texto uma vez, com o token no cabeçalho e a organização no corpo", async () => {
    const { c, chamadas } = cliente([resp(200, "{}")]);
    await c.enviar("chat1", "Olá!");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain("/v1/messages/");
    expect(
      (chamadas[0].init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer token-de-teste");
    expect(JSON.parse(String(chamadas[0].init.body))).toMatchObject({
      organizationId: "org1",
      chatId: "chat1",
      message: "Olá!",
    });
  });

  it("falha de rede NÃO repete: a mensagem pode ter chegado, e repetir mandaria duas ao cliente", async () => {
    const { c, chamadas } = cliente([new Error("ECONNRESET")]);
    await expect(c.enviar("chat1", "Olá!")).rejects.toThrow("ECONNRESET");
    expect(chamadas).toHaveLength(1);
  });

  it("503 NÃO repete em escrita", async () => {
    const { c, chamadas } = cliente([resp(503, "indisponível")]);
    await expect(c.enviar("chat1", "Olá!")).rejects.toThrow(/erro 503/);
    expect(chamadas).toHaveLength(1);
  });

  it("429 espera o Retry-After e repete (o servidor recusou antes de processar)", async () => {
    const { c, chamadas } = cliente([
      resp(429, "", { "Retry-After": "0" }),
      resp(200, "{}"),
    ]);
    await c.enviar("chat1", "Olá!");
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].init.body).toBe(chamadas[0].init.body);
  });

  it("depois de esgotar os 429, explica o erro sem reproduzir o corpo", async () => {
    const corpo = JSON.stringify({
      message: "Muitos pedidos para 11999998888",
    });
    const { c } = cliente(
      Array.from({ length: 5 }, () => resp(429, corpo, { "Retry-After": "0" })),
    );
    const erro = await c.enviar("chat1", "Olá!").catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain("429");
    expect((erro as Error).message).not.toContain("11999998888");
  });
});

describe("erros da API", () => {
  it("o corpo cru da resposta nunca vai para a mensagem", async () => {
    const html =
      "<html>" +
      "Cliente João Silva, telefone 11999998888, joao@gmail.com ".repeat(20) +
      "</html>";
    const { c } = cliente([resp(500, html)]);
    const erro = await c.enviar("chat1", "Olá!").catch((e: Error) => e);
    const msg = (erro as Error).message;
    expect(msg).toContain("uTalk POST /v1/messages/");
    expect(msg).toContain("500");
    expect(msg).not.toMatch(/João|11999998888|joao@gmail/);
    expect(msg.length).toBeLessThan(200);
  });

  it("a mensagem curta e segura do JSON aparece", async () => {
    const { c } = cliente([
      resp(404, JSON.stringify({ message: "Chat não encontrado" })),
    ]);
    await expect(c.chat("x")).rejects.toThrow(/404.*Chat não encontrado/);
  });
});

describe("leituras", () => {
  it("repetem em 503 e devolvem os dados", async () => {
    const { c, chamadas } = cliente([
      resp(503),
      resp(200, JSON.stringify({ items: [{ id: "t1", name: "Quente" }] })),
    ]);
    const etiquetas = await c.etiquetas();
    expect(etiquetas).toEqual([{ id: "t1", name: "Quente" }]);
    expect(chamadas).toHaveLength(2);
  });
});

describe("foto (multipart)", () => {
  it("falha de rede também não repete o envio da foto", async () => {
    const { c, chamadas } = cliente([new Error("ECONNRESET")]);
    await expect(
      c.enviarArquivo("chat1", "frente.jpg", new Uint8Array([1, 2, 3])),
    ).rejects.toThrow("ECONNRESET");
    expect(chamadas).toHaveLength(1);
  });

  it("erro da API na foto não reproduz o corpo", async () => {
    const { c } = cliente([
      resp(413, "arquivo grande demais para o cliente 11999998888"),
    ]);
    const erro = await c
      .enviarArquivo("chat1", "frente.jpg", new Uint8Array([1]))
      .catch((e: Error) => e);
    expect((erro as Error).message).toContain("413");
    expect((erro as Error).message).not.toContain("11999998888");
  });
});
