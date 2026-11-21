/**
 * Cliente do uTalk (Umbler) que o Pré-atendimento IA usa para conversar: lê os chats com a etiqueta
 * de gatilho e as mensagens, envia texto e fotos (multipart) e mexe nas etiquetas do fluxo, que ficam
 * no CONTATO (`POST /v1/contacts/{id}/tags/` e `DELETE ...?tagId=`), não no chat. É o único ponto do app
 * que escreve no CRM, e só é chamado pelo laço de atendimento ou por ação explícita na tela.
 * Sem Electron: o `fetch` é injetado para os testes.
 */
import { buscarComRetentativa, mensagemDeErroHttp } from "../core/http-retry";
import { BASE_UTALK, type Buscar } from "../crm/utalk-api";

type Consulta = Record<string, string | number | string[] | undefined>;

export type ChatUtalk = {
  id: string;
  contact?: {
    id?: string;
    name?: string | null;
    phoneNumber?: string | null;
    tags?: { name?: string; tag?: { name?: string } }[];
  };
};
export type MensagemUtalk = {
  id: string;
  content?: string | null;
  message?: string | null;
  source?: string | null;
  eventAtUTC?: string | null;
  createdAtUTC?: string | null;
  isPrivate?: boolean;
  sentByOrganizationMember?: unknown;
  botInstance?: unknown;
};

const itens = <T>(r: unknown): T[] =>
  Array.isArray(r)
    ? (r as T[])
    : ((r as { items?: T[] })?.items ??
      (r as { messages?: T[] })?.messages ??
      []);

export const textoDa = (m: MensagemUtalk) => m.content || m.message || "";
export const horaDa = (m: MensagemUtalk) =>
  new Date(m.eventAtUTC || m.createdAtUTC || 0).getTime();

/** Cria o cliente para a organização `orgId`. */
export function clienteEscrita(buscar: Buscar, token: string, orgId: string) {
  async function chamar(
    metodo: string,
    caminho: string,
    { consulta, corpo }: { consulta?: Consulta; corpo?: object } = {},
  ) {
    const url = new URL(BASE_UTALK + caminho);
    for (const [k, v] of Object.entries({
      organizationId: orgId,
      ...consulta,
    })) {
      if (v === undefined || v === "") continue;
      for (const x of Array.isArray(v) ? v : [v])
        url.searchParams.append(k, String(x));
    }
    // Leitura repete também em falha de rede e 502/503/504. Escrita só repete em 429: se o pedido
    // tivesse chegado, repetir mandaria a mesma mensagem ao cliente duas vezes.
    const r = await buscarComRetentativa(
      buscar,
      url.toString(),
      {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: corpo
          ? JSON.stringify({ organizationId: orgId, ...corpo })
          : undefined,
      },
      {
        timeoutMs: 30_000,
        tentativasTransitorias: metodo === "GET" ? 2 : 0,
      },
    );
    if (!r.ok)
      throw new Error(
        await mensagemDeErroHttp(r, `uTalk ${metodo} ${caminho}`),
      );
    const texto = await r.text();
    return texto ? (JSON.parse(texto) as unknown) : null;
  }

  return {
    etiquetas: async () =>
      itens<{ id: string; name?: string }>(
        await chamar("GET", "/v1/tags/", { consulta: { Take: 200 } }),
      ),
    respostasRapidas: async () =>
      itens<Record<string, string | undefined>>(
        await chamar("GET", "/v1/quick-answers/", { consulta: { Take: 200 } }),
      ),
    chatsComEtiqueta: async (etiquetaId: string) =>
      itens<ChatUtalk>(
        await chamar("GET", "/v1/chats/", {
          consulta: {
            "Tags.Rule": "ContainsAny",
            "Tags.Values": [etiquetaId],
            ChatState: "Open",
            Take: 50,
          },
        }),
      ),
    mensagens: async (chatId: string, quantas = 20) =>
      itens<MensagemUtalk>(
        await chamar("GET", `/v1/chats/${chatId}/relative-messages/`, {
          consulta: {
            FromEventUTC: new Date(Date.now() + 60_000).toISOString(),
            Take: quantas,
            Direction: "TakeBefore",
          },
        }),
      ),
    chat: (chatId: string) =>
      chamar("GET", `/v1/chats/${chatId}/`) as Promise<ChatUtalk | null>,
    enviar: (chatId: string, mensagem: string) =>
      chamar("POST", "/v1/messages/", {
        corpo: {
          chatId,
          message: mensagem,
          automated: true,
          skipReassign: true,
        },
      }),
    /** Nota interna no chat (`isPrivate`): só a equipe vê, o cliente não recebe nada. */
    notaPrivada: (chatId: string, texto: string) =>
      chamar("POST", "/v1/messages/", {
        corpo: {
          chatId,
          message: texto,
          isPrivate: true,
          automated: true,
          skipReassign: true,
        },
      }),
    /** Envia uma foto no chat (multipart no mesmo endpoint das mensagens). */
    enviarArquivo: async (chatId: string, nome: string, bytes: Uint8Array) => {
      const ext = nome.split(".").pop()?.toLowerCase();
      const tipo =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
      const form = new FormData();
      form.append("ChatId", chatId);
      form.append("OrganizationId", orgId);
      form.append("Automated", "true");
      form.append("SkipReassign", "true");
      form.append("File", new Blob([Buffer.from(bytes)], { type: tipo }), nome);
      const r = await buscarComRetentativa(
        buscar,
        BASE_UTALK + "/v1/messages/",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
        { timeoutMs: 60_000 },
      );
      if (!r.ok)
        throw new Error(await mensagemDeErroHttp(r, "uTalk envio de foto"));
    },
    porEtiqueta: (contatoId: string, etiquetaId: string) =>
      chamar("POST", `/v1/contacts/${contatoId}/tags/`, {
        corpo: { tagId: etiquetaId },
      }),
    tirarEtiqueta: (contatoId: string, etiquetaId: string) =>
      chamar("DELETE", `/v1/contacts/${contatoId}/tags/`, {
        consulta: { tagId: etiquetaId },
      }),
    tirarEtiquetaDoChat: (chatId: string, etiquetaId: string) =>
      chamar("DELETE", `/v1/chats/${chatId}/tags/${etiquetaId}/`),
  };
}

export type ClienteEscrita = ReturnType<typeof clienteEscrita>;
