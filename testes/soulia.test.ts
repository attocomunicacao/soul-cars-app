import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  analisar,
  anonimizar,
  extrairExemplos,
  gerarExemplosJsonl,
  gerarPadraoMd,
  gerarPromptRefino,
  situacaoDaMensagem,
} from "../src/main/soulia/analise";
import {
  lerConversas,
  lerEventos,
  migrarMemoria,
  resumoDaMemoria,
  esquecerTudo,
} from "../src/main/soulia/memoria";
import { montarAbas, paraCsv } from "../src/main/soulia/planilha";
import { sincronizar } from "../src/main/soulia/sincronizar";
import type { Buscar } from "../src/main/utalk-api";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status });

const AGORA = new Date("2026-10-16T15:00:00Z");

/** uTalk falso: duas conversas; a segunda tem mais mensagens do que cabe em uma página. */
function falso() {
  const chamadas: string[] = [];
  const mensagensC2 = Array.from({ length: 130 }, (_, i) => ({
    id: `M2-${i}`,
    _t: "Message",
    eventAtUTC: new Date(Date.UTC(2026, 9, 10, 12, 0, i)).toISOString(),
    messageType: "Text",
    source: i % 2 === 0 ? "Contact" : "Member",
    content: i % 2 === 0 ? "Qual o preço?" : "R$ 50 mil, aceita proposta.",
  }));
  let eventoC1 = "2026-10-10T12:10:00Z";
  const buscar: Buscar = async (url) => {
    chamadas.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/members/me/"))
      return resposta({ organizations: [{ id: "ORG1", name: "Soul" }] });
    if (u.pathname.endsWith("/chats/") && !u.pathname.includes("relative"))
      return resposta({
        page: { totalItems: 2 },
        items: [
          {
            id: "C1",
            createdAtUTC: "2026-10-10T12:00:00Z",
            eventAtUTC: eventoC1,
            open: true,
            contact: {
              id: "K1",
              name: "Ana Souza",
              phoneNumber: "+5511987654321",
            },
            tags: [{ name: "FIESTA 2016" }, { name: "VISITA" }],
            sector: { name: "Vendas" },
            organizationMember: { name: "Gustavo" },
          },
          {
            id: "C2",
            createdAtUTC: "2026-10-10T11:59:00Z",
            eventAtUTC: "2026-10-10T12:03:00Z",
            contact: { id: "K2", name: "Bruno" },
            tags: [],
          },
        ],
      });
    if (u.pathname.endsWith("/C1/relative-messages/"))
      return resposta({
        messages: [
          {
            id: "M3",
            _t: "Message",
            eventAtUTC: "2026-10-10T12:10:00Z",
            messageType: "Text",
            source: "Contact",
            content: "Quero financiar, qual a entrada?",
          },
          {
            id: "M2",
            _t: "SentMessage",
            eventAtUTC: "2026-10-10T12:04:00Z",
            messageType: "Text",
            source: "Member",
            content: "Oi Ana! Ele está disponível sim. 🚗",
            sentByOrganizationMember: { id: "U1", name: "Gustavo" },
          },
          {
            id: "N1",
            _t: "PrivateNote",
            eventAtUTC: "2026-10-10T12:03:30Z",
            messageType: "Text",
            source: "Member",
            isPrivate: true,
            content: "lead quente",
          },
          {
            id: "M1",
            _t: "Message",
            eventAtUTC: "2026-10-10T12:00:00Z",
            messageType: "Text",
            source: "Contact",
            content: "Oi, vi o anúncio do Fiesta. Ainda está disponível?",
            ad: { title: "Fiesta 2016" },
          },
          {
            id: "E1",
            _t: "TagsChangedMetadata",
            eventAtUTC: "2026-10-10T12:05:00Z",
            tags: ["VISITA"],
          },
        ],
      });
    if (u.pathname.endsWith("/C2/relative-messages/")) {
      const de = u.searchParams.get("FromEventUTC")!;
      const lote = mensagensC2
        .filter((m) => m.eventAtUTC <= de)
        .sort((a, b) => b.eventAtUTC.localeCompare(a.eventAtUTC))
        .slice(0, 100);
      return resposta({ messages: lote });
    }
    return resposta({}, 404);
  };
  return {
    buscar,
    chamadas,
    mudarC1: () => {
      eventoC1 = "2026-10-11T09:00:00Z";
    },
  };
}

let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  migrarMemoria(db);
});

describe("sincronização da memória", () => {
  it("baixa leads, mensagens e eventos e pagina conversas longas", async () => {
    const { buscar } = falso();
    const progresso: string[] = [];
    const r = await sincronizar(db, buscar, "tok", {
      agora: () => AGORA,
      aoProgresso: (p) => progresso.push(p.fase),
    });
    expect(r).toMatchObject({
      conversasVistas: 2,
      conversasBaixadas: 2,
      mensagensNovas: 4 + 130,
      falhas: 0,
    });
    expect(progresso).toContain("pronto");
    const m = resumoDaMemoria(db);
    expect(m).toMatchObject({ leads: 2, conversas: 2 });
    const conversas = lerConversas(db);
    const c1 = conversas.find((c) => c.id === "C1")!;
    expect(c1).toMatchObject({
      nome: "Ana Souza",
      telefone: "+5511987654321",
      etiquetas: ["FIESTA 2016", "VISITA"],
      setor: "Vendas",
      atendente: "Gustavo",
    });
    expect(c1.anuncio).toEqual({ title: "Fiesta 2016" });
    expect(c1.mensagens.map((x) => x.id)).toEqual(["M1", "N1", "M2", "M3"]);
    expect(c1.mensagens[1].privada).toBe(true);
    expect(c1.mensagens.map((x) => x.origem)).toEqual([
      "lead",
      "vendedor",
      "vendedor",
      "lead",
    ]);
    expect(lerEventos(db)).toEqual([
      expect.objectContaining({
        conversaId: "C1",
        tipo: "TagsChangedMetadata",
      }),
    ]);
    expect(m.mensagens).toBe(133); // notas privadas ficam fora da contagem
  });

  it("na segunda vez pula conversas que não mudaram", async () => {
    const f = falso();
    await sincronizar(db, f.buscar, "tok", { agora: () => AGORA });
    f.chamadas.length = 0;
    const r = await sincronizar(db, f.buscar, "tok", { agora: () => AGORA });
    expect(r.conversasBaixadas).toBe(0);
    expect(f.chamadas.some((u) => u.includes("relative-messages"))).toBe(false);

    f.mudarC1();
    const r2 = await sincronizar(db, f.buscar, "tok", { agora: () => AGORA });
    expect(r2.conversasBaixadas).toBe(1);
    expect(r2.mensagensNovas).toBe(0);
  });

  it("só lê do uTalk: nenhuma chamada que não seja GET", async () => {
    const metodos: string[] = [];
    const { buscar } = falso();
    await sincronizar(
      db,
      async (url, init) => {
        metodos.push(init.method ?? "GET");
        return buscar(url, init);
      },
      "tok",
      { agora: () => AGORA },
    );
    expect(new Set(metodos)).toEqual(new Set(["GET"]));
  });

  it("para quando cancelado e não marca a sincronização como completa", async () => {
    const { buscar } = falso();
    const r = await sincronizar(db, buscar, "tok", {
      agora: () => AGORA,
      cancelado: () => true,
    });
    expect(r.cancelado).toBe(true);
    expect(resumoDaMemoria(db).ultimaSincronizacao).toBeNull();
  });

  it("explica o erro quando o token é recusado", async () => {
    await expect(
      sincronizar(db, async () => resposta({}, 401), "ruim", {
        agora: () => AGORA,
      }),
    ).rejects.toThrow(/recusou o token/);
  });

  it("esquecerTudo apaga a memória", async () => {
    await sincronizar(db, falso().buscar, "tok", { agora: () => AGORA });
    esquecerTudo(db);
    expect(resumoDaMemoria(db)).toMatchObject({ conversas: 0, mensagens: 0 });
  });
});

describe("anonimização e situações", () => {
  it("troca telefone, CPF, e-mail, placa e nome do lead", () => {
    const t = anonimizar(
      "Oi Ana, ligue (11) 98765-4321, CPF 123.456.789-09, ana@x.com, placa ABC1D23",
      "Ana Souza",
    );
    expect(t).toBe(
      "Oi [NOME], ligue [TELEFONE], CPF [CPF], [EMAIL], placa [PLACA]",
    );
  });

  it("reconhece o assunto da mensagem do lead", () => {
    expect(situacaoDaMensagem("Qual o valor dele?")).toBe("preco");
    expect(situacaoDaMensagem("aceita meu carro na troca?")).toBe("troca");
    expect(situacaoDaMensagem("dá pra financiar com 10 de entrada?")).toBe(
      "financiamento",
    );
    expect(situacaoDaMensagem("Que horas vocês abrem?")).toBe("visita");
    expect(situacaoDaMensagem("manda mais fotos")).toBe("fotos_videos");
    expect(situacaoDaMensagem("ok")).toBeNull();
  });
});

describe("análise do atendimento", () => {
  async function preparar() {
    await sincronizar(db, falso().buscar, "tok", { agora: () => AGORA });
    return lerConversas(db);
  }

  it("mede espera, resposta e avanço por conversa", async () => {
    const a = analisar(await preparar(), AGORA);
    const c1 = a.metricas.find((m) => m.id === "C1")!;
    expect(c1).toMatchObject({
      msgsLead: 2,
      msgsNossas: 1,
      inicioPor: "lead",
      semResposta: false,
      leadRespondeuDepois: true,
      positiva: true,
    });
    expect(c1.esperaMin).toBeCloseTo(4);
    expect(c1.anuncio).toBe("Fiesta 2016");
    expect(c1.situacoes).toEqual(
      expect.arrayContaining(["disponibilidade", "financiamento"]),
    );
    expect(a.conversasComLead).toBe(2);
    expect(a.espera.medianaMin).not.toBeNull();
    expect(a.estilo.comEmojiPct).toBeGreaterThan(0);
  });

  it("gera exemplos anonimizados e documentos sem dados pessoais", async () => {
    const conversas = await preparar();
    const a = analisar(conversas, AGORA);
    const ex = extrairExemplos(conversas);
    expect(ex.length).toBeGreaterThan(0);
    const jsonl = gerarExemplosJsonl(ex);
    const md = gerarPadraoMd(a);
    const prompt = gerarPromptRefino(conversas, a);
    for (const saida of [jsonl, md, prompt]) {
      expect(saida).not.toContain("Ana");
      expect(saida).not.toContain("987654321");
    }
    expect(md).toContain("# Padrão de atendimento da Soul Cars");
    expect(prompt).toContain("Conversas de amostra");
    expect(
      jsonl
        .trim()
        .split("\n")
        .every((l) => JSON.parse(l).situacao),
    ).toBe(true);
  });

  it("monta as abas e o CSV protege contra fórmulas", async () => {
    const conversas = await preparar();
    const a = analisar(conversas, AGORA);
    const abas = montarAbas(conversas, lerEventos(db), a);
    expect(abas.map((x) => x.nome)).toEqual([
      "Resumo",
      "Leads",
      "Mensagens",
      "Eventos",
      "Situações",
      "Exemplos",
    ]);
    const leads = abas.find((x) => x.nome === "Leads")!;
    expect(leads.linhas).toHaveLength(2);
    expect(leads.linhas[0]).toHaveLength(leads.colunas.length);
    const csv = paraCsv({
      nome: "T",
      colunas: ["a", "b"],
      linhas: [["=1+1", 'diz "oi"; tchau']],
    });
    expect(csv.startsWith("﻿a;b")).toBe(true);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain('"diz ""oi""; tchau"');
  });
});
