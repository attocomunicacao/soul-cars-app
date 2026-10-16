import { describe, expect, it } from "vitest";
import { visaoGeral, type Buscar } from "../src/main/utalk-api";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status });

const TAGS = [
  { id: "FIN", name: "FINALIZADO", emoji: "❌" },
  { id: "DES", name: "DESQUALIFICADO", emoji: "❌" },
  { id: "Q", name: "QUENTE", emoji: "🔥" },
  { id: "F16", name: "FIESTA 2016", emoji: "🚘" },
  { id: "ON", name: "ONIX 2020", emoji: "🚘" },
];
const CONTAGENS: Record<string, number> = {
  FIN: 1265,
  DES: 1103,
  Q: 9,
  F16: 176,
  ON: 162,
};

function servidor(tags = TAGS): Buscar {
  return async (url) => {
    const u = new URL(url);
    const p = u.pathname;
    const q = u.searchParams;
    if (p.endsWith("/members/me/"))
      return resposta({ organizations: [{ id: "ORG1", name: "Soul Cars" }] });
    if (p.endsWith("/tags/")) return resposta({ items: tags });
    if (p.endsWith("/chats/")) {
      if (q.get("Behavior") === "CountOnly") {
        if (q.get("LastMessage") === "Contact")
          return resposta({ page: { totalItems: 2 } });
        if (q.get("DateStartCreatedAtUTC"))
          return resposta({ page: { totalItems: 9 } });
        return resposta({ page: { totalItems: 5 } });
      }
      return resposta({
        items: [
          {
            id: "C1",
            waitingSinceUTC: "2026-10-16T10:00:00Z",
            contact: { id: "K1", name: " Ana " },
            tags: [{ name: "FIESTA 2016" }],
          },
        ],
      });
    }
    if (p.endsWith("/contacts/")) {
      if (q.get("Behavior") === "CountOnly") {
        if (q.get("Tags.Rule") === "None")
          return resposta({ page: { totalItems: 800 } });
        const e = q.get("Tags.Values");
        return resposta({ page: { totalItems: CONTAGENS[e ?? ""] ?? 3000 } });
      }
      return resposta({
        items: [
          {
            id: "K2",
            name: "Bruno",
            lastActiveUTC: "2026-10-16T11:00:00Z",
            tags: [{ name: "QUENTE" }],
          },
        ],
      });
    }
    return resposta({}, 404);
  };
}

describe("visão geral do uTalk", () => {
  it("junta totais, etiquetas contadas e listas", async () => {
    const v = await visaoGeral(
      servidor(),
      "t",
      new Date("2026-10-16T12:00:00Z"),
    );
    expect(v).toMatchObject({
      organizacao: "Soul Cars",
      totalLeads: 3000,
      emAtendimento: 800,
      conversasNovas7d: 9,
      conversasAbertas: 5,
      aguardando: 2,
    });
    expect(v.etiquetas.slice(0, 2).map((e) => [e.nome, e.leads])).toEqual([
      ["FINALIZADO", 1265],
      ["DESQUALIFICADO", 1103],
    ]);
    expect(v.listaAguardando[0]).toMatchObject({
      nome: "Ana",
      desde: "2026-10-16T10:00:00Z",
      etiquetas: ["FIESTA 2016"],
    });
    expect(v.listaQuentes.map((l) => l.nome)).toEqual(["Bruno"]);
  });

  it("não calcula 'em atendimento' nem leads quentes sem as etiquetas", async () => {
    const v = await visaoGeral(servidor([TAGS[3]]), "t");
    expect(v.emAtendimento).toBeNull();
    expect(v.listaQuentes).toEqual([]);
  });

  it("explica quando o token é recusado", async () => {
    const buscar: Buscar = async () => resposta({}, 401);
    await expect(visaoGeral(buscar, "ruim")).rejects.toThrow(/recusou o token/);
  });
});
