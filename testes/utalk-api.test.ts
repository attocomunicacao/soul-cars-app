import { describe, expect, it } from "vitest";
import {
  metricas,
  temperaturaDaEtiqueta,
  visaoGeral,
  type Buscar,
} from "../src/main/utalk-api";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status });

function falso(): { buscar: Buscar; urls: string[] } {
  const urls: string[] = [];
  const buscar: Buscar = async (url) => {
    urls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/members/me/"))
      return resposta({ organizations: [{ id: "ORG1", name: "Soul Cars" }] });
    if (u.pathname.endsWith("/tags/"))
      return resposta({
        items: [
          { id: "T1", name: "FIESTA 2016" },
          { id: "T2", name: "ONIX 2020", emoji: "🚗" },
          { id: "T3", name: "HB20 2019" },
        ],
      });
    if (u.pathname.endsWith("/contacts/")) {
      const etiqueta = u.searchParams.get("Tags.Values");
      const total = { T1: 14, T2: 3, T3: 14 }[etiqueta ?? ""] ?? 200;
      return resposta({ page: { totalItems: total }, items: [] });
    }
    return resposta({}, 404);
  };
  return { buscar, urls };
}

describe("métricas do uTalk", () => {
  it("conta os leads por etiqueta, do maior para o menor", async () => {
    const { buscar, urls } = falso();
    const m = await metricas(buscar, "token-de-teste");
    expect(m.organizacao).toBe("Soul Cars");
    expect(m.totalLeads).toBe(200);
    expect(m.etiquetas.map((e) => [e.nome, e.leads])).toEqual([
      ["FIESTA 2016", 14],
      ["HB20 2019", 14],
      ["ONIX 2020", 3],
    ]);
    const contagem = urls.filter((u) => u.includes("/contacts/"))[1];
    expect(contagem).toContain("Behavior=CountOnly");
    expect(contagem).toContain("organizationId=ORG1");
  });

  it("explica quando o token é recusado", async () => {
    const buscar: Buscar = async () => resposta({}, 401);
    await expect(metricas(buscar, "ruim")).rejects.toThrow(/recusou o token/);
  });
});

describe("visão geral do uTalk", () => {
  function servidor(comEtiquetas = true): Buscar {
    return async (url) => {
      const u = new URL(url);
      const p = u.pathname;
      const q = u.searchParams;
      if (p.endsWith("/members/me/"))
        return resposta({ organizations: [{ id: "ORG1", name: "Soul Cars" }] });
      if (p.endsWith("/tags/"))
        return resposta({
          items: comEtiquetas
            ? [
                { id: "Q", name: "🔥 Quente" },
                { id: "M", name: "MORNO" },
                { id: "F2", name: "FIESTA 2016" },
              ]
            : [{ id: "F2", name: "FIESTA 2016" }],
        });
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
          const e = q.get("Tags.Values");
          return resposta({
            page: { totalItems: { Q: 4, M: 7 }[e ?? ""] ?? 120 },
          });
        }
        return resposta({
          items: [
            {
              id: "K2",
              name: "Bruno",
              lastActiveUTC: "2026-10-16T11:00:00Z",
              tags: [{ name: "Quente" }],
            },
          ],
        });
      }
      return resposta({}, 404);
    };
  }

  it("monta cartões, temperatura e listas", async () => {
    const v = await visaoGeral(
      servidor(),
      "t",
      new Date("2026-10-16T12:00:00Z"),
    );
    expect(v).toMatchObject({
      totalLeads: 120,
      conversasNovas7d: 9,
      conversasAbertas: 5,
      aguardando: 2,
      temperatura: { quente: 4, morno: 7, frio: null },
    });
    expect(v.listaAguardando[0]).toMatchObject({
      nome: "Ana",
      desde: "2026-10-16T10:00:00Z",
      etiquetas: ["FIESTA 2016"],
    });
    expect(v.listaQuentes.map((l) => l.nome)).toEqual(["Bruno"]);
  });

  it("deixa a temperatura nula quando as etiquetas não existem", async () => {
    const v = await visaoGeral(servidor(false), "t");
    expect(v.temperatura).toEqual({ quente: null, morno: null, frio: null });
    expect(v.listaQuentes).toEqual([]);
  });

  it("reconhece a temperatura pelo nome da etiqueta", () => {
    expect(temperaturaDaEtiqueta("Lead QUENTE")).toBe("quente");
    expect(temperaturaDaEtiqueta("Mórno")).toBe("morno");
    expect(temperaturaDaEtiqueta("Frio")).toBe("frio");
    expect(temperaturaDaEtiqueta("FIESTA 2016")).toBe(null);
  });
});
