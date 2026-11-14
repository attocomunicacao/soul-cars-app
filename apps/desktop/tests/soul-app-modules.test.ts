/**
 * Testes (Vitest) dos módulos vindos do Soul APP: CRM · Leads (shared/crm-leads.ts e
 * main/crm/leads-sync.ts + umbler-client.ts), Funil (shared/funnel.ts), Meta Ads
 * (shared/meta-ads.ts e main/meta/graph-api.ts) e a decifragem da importação.
 * Todos os dados são fictícios; a rede é um `fetch` falso.
 */
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CONFIG_LEADS_PADRAO,
  NENHUM,
  classificarEtiquetas,
  compararLeituras,
  filtrarLeads,
  seriePorDia,
  statusDoLead,
  type LeadCrm,
  type SnapshotCrm,
} from "../src/shared/crm-leads";
import {
  CONFIG_FUNIL_PADRAO,
  SEM_PRODUTO,
  calcularFunil,
  completarPapeis,
  diagnosticar,
  produtoPeloNome,
  resolverPeriodo,
  sugerirPapel,
  type MetaFunil,
} from "../src/shared/funnel";
import {
  alertas,
  escolherResultado,
  faixaDeSaude,
  metricas,
  notaDeSaude,
  periodos,
  situacaoDaCampanha,
} from "../src/shared/meta-ads";
import { montarLeads, resumirChat } from "../src/main/crm/leads-sync";
import { ClienteUmbler } from "../src/main/crm/umbler-client";
import {
  buscarMetaDoFunil,
  mensagemDoMeta,
  graphGet,
  normalizarConta,
} from "../src/main/meta/graph-api";
import { decifrarV10 } from "../src/main/crm/soul-app-import";

const lead = (extra: Partial<LeadCrm>): LeadCrm => ({
  id: "l1",
  name: "Cliente Teste",
  phone: "+55 11 90000-0000",
  email: "",
  createdAt: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  tagIds: [],
  memberId: null,
  chatId: null,
  chatOpen: false,
  waiting: false,
  sector: "",
  totalChats: 0,
  actions: [],
  ...extra,
});

const snap = (
  leads: LeadCrm[],
  extra: Partial<SnapshotCrm> = {},
): SnapshotCrm => ({
  organization: { id: "org", name: "Loja Demo" },
  tags: [
    { id: "t-novo", name: "NOVO", groupIds: [] },
    { id: "t-quente", name: "QUENTE", groupIds: [] },
    { id: "t-agend", name: "AGENDADO", groupIds: [] },
    { id: "t-onix", name: "ONIX 2022", groupIds: [] },
    { id: "t-1call", name: "1 CALL", groupIds: [] },
  ],
  groups: [],
  members: [{ id: "m1", name: "Ana SDR" }],
  leads,
  fetchedAt: new Date().toISOString(),
  ...extra,
});

describe("CRM · Leads", () => {
  it("classifica carro × status pelo nome e ordena as colunas pelo funil", () => {
    const { cfg, mudou } = classificarEtiquetas(snap([]), CONFIG_LEADS_PADRAO);
    expect(mudou).toBe(true);
    expect(cfg.tagCategories["t-onix"]).toBe("car");
    expect(cfg.tagCategories["t-quente"]).toBe("status");
    expect(cfg.statusOrder).toEqual([
      "t-novo",
      "t-1call",
      "t-quente",
      "t-agend",
    ]);
    // Segunda passada não muda nada.
    expect(classificarEtiquetas(snap([]), cfg).mudou).toBe(false);
  });

  it("põe o lead na coluna do status mais avançado", () => {
    const ordem = ["t-novo", "t-1call", "t-quente", "t-agend"];
    expect(statusDoLead(lead({ tagIds: ["t-novo", "t-quente"] }), ordem)).toBe(
      "t-quente",
    );
    expect(statusDoLead(lead({ tagIds: ["t-onix"] }), ordem)).toBe(NENHUM);
  });

  it("filtra por carro, SDR e busca por telefone", () => {
    const { cfg } = classificarEtiquetas(snap([]), CONFIG_LEADS_PADRAO);
    const ls = [
      lead({ id: "a", tagIds: ["t-onix"], memberId: "m1" }),
      lead({ id: "b", phone: "11 98888-7777" }),
    ];
    const base = { period: "all" as const, car: "", member: "", search: "" };
    expect(
      filtrarLeads(ls, { ...base, car: "t-onix" }, cfg).map((l) => l.id),
    ).toEqual(["a"]);
    expect(
      filtrarLeads(ls, { ...base, car: NENHUM }, cfg).map((l) => l.id),
    ).toEqual(["b"]);
    expect(
      filtrarLeads(ls, { ...base, member: NENHUM }, cfg).map((l) => l.id),
    ).toEqual(["b"]);
    expect(
      filtrarLeads(ls, { ...base, search: "8888" }, cfg).map((l) => l.id),
    ).toEqual(["b"]);
  });

  it("série por dia tem um ponto por dia, mais antigo primeiro", () => {
    const s = seriePorDia([lead({})], 7);
    expect(s).toHaveLength(7);
    expect(s[6].valor).toBe(1);
  });

  it("gera eventos de lead novo, etiqueta e troca de SDR", () => {
    const antes = snap([lead({ id: "x", tagIds: ["t-novo"] })], {
      fetchedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const depois = snap([
      lead({ id: "x", tagIds: ["t-quente"], memberId: "m1" }),
      lead({ id: "y", name: "Novo Cliente" }),
    ]);
    const tipos = compararLeituras(antes, depois)
      .map((e) => e.type)
      .sort();
    expect(tipos).toEqual(["novo", "sdr", "tag+", "tag-"]);
    expect(compararLeituras(null, depois)).toEqual([]);
  });

  it("monta leads: SDR pela última ação do bot e etiqueta apagada da organização", () => {
    const chat = resumirChat({
      id: "c1",
      contact: { id: "l1" },
      createdAtUTC: "2026-11-01T10:00:00Z",
      eventAtUTC: "2026-11-02T10:00:00Z",
      bots: [
        {
          memberId: "m1",
          botTitle: "LIGAÇÃO ATENDIDA",
          createdAt: "2026-11-02T09:00:00Z",
        },
      ],
      waiting: true,
    });
    const s = montarLeads(
      {
        id: "org",
        name: "Loja",
        organizationMembers: [{ id: "m1", displayName: "Ana" }],
      },
      [{ id: "t1", name: "QUENTE" }],
      [
        {
          id: "l1",
          name: "Cliente",
          createdAtUTC: "2026-11-01T10:00:00Z",
          tags: [{ id: "t1" }, { id: "t-velha", name: "APAGADA" }],
        },
        {
          id: "grupo",
          contactType: "Group",
          createdAtUTC: "2026-11-01T10:00:00Z",
        },
      ],
      [chat],
    );
    expect(s.leads).toHaveLength(1);
    expect(s.leads[0].memberId).toBe("m1");
    expect(s.leads[0].waiting).toBe(true);
    expect(s.leads[0].actions[0].title).toBe("LIGAÇÃO ATENDIDA");
    expect(s.tags.map((t) => t.id)).toEqual(["t1", "t-velha"]);
  });

  it("cliente do uTalk percorre páginas e repete em 429", async () => {
    let chamadas = 0;
    const buscar = async (url: string) => {
      chamadas++;
      if (chamadas === 1) return new Response("", { status: 429 });
      const skip = Number(new URL(url).searchParams.get("Skip"));
      const items =
        skip === 0
          ? Array.from({ length: 50 }, (_, i) => ({ id: i }))
          : [{ id: 99 }];
      return new Response(JSON.stringify({ items }), { status: 200 });
    };
    const cli = new ClienteUmbler(buscar, "token", async () => {});
    const itens = await cli.todasAsPaginas<{ id: number }>("/v1/tags/");
    expect(itens).toHaveLength(51);
    expect(chamadas).toBe(3);
  });

  it("token recusado vira mensagem clara", async () => {
    const cli = new ClienteUmbler(
      async () => new Response("", { status: 401 }),
      "x",
      async () => {},
    );
    await expect(cli.get("/v1/members/me/")).rejects.toThrow(
      /Token do uTalk inválido/,
    );
  });
});

describe("Funil Meta → CRM", () => {
  it("resolve períodos prontos e personalizados", () => {
    const hoje = new Date(2026, 10, 14, 9);
    expect(
      resolverPeriodo({ preset: "last_7d", since: "", until: "" }, hoje),
    ).toEqual({ since: "2026-11-08", until: "2026-11-14" });
    expect(
      resolverPeriodo({ preset: "last_month", since: "", until: "" }, hoje),
    ).toEqual({ since: "2026-10-01", until: "2026-10-31" });
    expect(
      resolverPeriodo(
        { preset: "custom", since: "2026-11-01", until: "2026-11-05" },
        hoje,
      ),
    ).toEqual({ since: "2026-11-01", until: "2026-11-05" });
  });

  it("sugere papéis pelo nome e marca carros do CRM como produto", () => {
    expect(sugerirPapel("2ª CALL", [])).toBe("call2");
    expect(sugerirPapel("Desqualificado", [])).toBe("desqualificado");
    expect(sugerirPapel("Visita marcada", [])).toBe("agendado");
    const r = completarPapeis(snap([]), {}, new Set(["t-onix"]));
    expect(r.papeis["t-onix"]).toBe("product");
    expect(r.papeis["t-1call"]).toBe("call1");
  });

  it("acha o produto da campanha pelo nome (com ou sem ano)", () => {
    const p = [
      { id: "onix", name: "ONIX 2022" },
      { id: "hb20", name: "HB20" },
    ];
    expect(produtoPeloNome("[LEADS] Onix 2022 - SP", p)).toBe("onix");
    expect(produtoPeloNome("Campanha HB20 novembro", p)).toBe("hb20");
    expect(produtoPeloNome("Institucional", p)).toBe(null);
  });

  it("conta as etapas acumuladas e o custo vem do Meta", () => {
    const dia = new Date().toISOString().slice(0, 10);
    const cfg = {
      ...CONFIG_FUNIL_PADRAO,
      tagRoles: {
        "t-onix": "product" as const,
        "t-quente": "quente" as const,
        "t-agend": "agendado" as const,
        "t-1call": "call1" as const,
      },
    };
    const crm = snap([
      lead({ id: "a", tagIds: ["t-onix", "t-quente", "t-agend"] }),
      lead({ id: "b", tagIds: ["t-1call"] }),
      lead({ id: "c", tagIds: [] }),
    ]);
    const meta: MetaFunil = {
      accountId: "act_1",
      range: { since: dia, until: dia },
      campaigns: [{ id: "c1", name: "Onix 2022" }],
      daily: [
        {
          date: dia,
          campaignId: "c1",
          spend: 300,
          impressions: 10000,
          clicks: 200,
          linkClicks: 150,
          conversations: 4,
        },
      ],
      fetchedAt: "",
    };
    const { m, c } = calcularFunil(
      meta,
      crm,
      cfg,
      { since: dia, until: dia },
      "",
    );
    expect(m.spend).toBe(300);
    expect(m.clicks).toBe(150);
    expect(c).toMatchObject({
      leads: 3,
      call1: 2,
      quente: 1,
      agendado: 1,
      noCall: 1,
    });
    const soOnix = calcularFunil(
      meta,
      crm,
      cfg,
      { since: dia, until: dia },
      "t-onix",
    );
    expect(soOnix.c.leads).toBe(1);
    expect(
      calcularFunil(meta, crm, cfg, { since: dia, until: dia }, SEM_PRODUTO).m
        .spend,
    ).toBe(0);
    const d = diagnosticar(m, c);
    expect(d.some((x) => x.texto.includes("sem nenhuma call"))).toBe(true);
    expect(d.some((x) => x.texto.includes("Cada agendamento custou"))).toBe(
      true,
    );
  });
});

describe("Meta Ads", () => {
  it("compara com o período anterior de mesmo tamanho", () => {
    const p = periodos("last_7d", new Date(2026, 10, 14, 9));
    expect(p.atual).toEqual({ since: "2026-11-07", until: "2026-11-13" });
    expect(p.anterior).toEqual({ since: "2026-10-31", until: "2026-11-06" });
  });

  it("escolhe o resultado conforme o objetivo da campanha", () => {
    const r = escolherResultado(
      "OUTCOME_ENGAGEMENT",
      [
        { action_type: "link_click", value: "90" },
        {
          action_type: "onsite_conversion.messaging_conversation_started_7d",
          value: "12",
        },
      ],
      [
        {
          action_type: "onsite_conversion.messaging_conversation_started_7d",
          value: "7.5",
        },
      ],
    );
    expect(r).toEqual({
      type: "onsite_conversion.messaging_conversation_started_7d",
      results: 12,
      costPerResult: 7.5,
    });
  });

  it("situação pelo custo médio e alertas pelos limites", () => {
    expect(
      situacaoDaCampanha(
        { spend: 100, roas: null, results: 10, costPerResult: 5 },
        10,
        3,
        false,
      ).rotulo,
    ).toBe("Eficiente");
    expect(
      situacaoDaCampanha(
        { spend: 100, roas: null, results: 2, costPerResult: 50 },
        10,
        3,
        false,
      ).rotulo,
    ).toBe("Caro");
    expect(
      situacaoDaCampanha(
        { spend: 100, roas: null, results: 0, costPerResult: null },
        10,
        3,
        false,
      ).tom,
    ).toBe("ruim");
    const a = alertas(
      [{ id: "1", name: "X", costPerResult: 40, spend: 900 } as never],
      {
        datePreset: "last_7d",
        alertCpr: 30,
        alertSpend: 500,
        roasTarget: 3,
        chartDays: 14,
      },
    );
    expect(a["1"]).toHaveLength(2);
  });

  it("nota de saúde fica entre 0 e 100", () => {
    const t = {
      spend: 1000,
      impressions: 100000,
      reach: 30000,
      clicks: 1500,
      results: 100,
      revenue: 0,
    };
    const n = notaDeSaude(
      metricas(t),
      metricas({ ...t, results: 80 }),
      3,
      false,
    );
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(100);
    expect(faixaDeSaude(80)[0]).toBe("Excelente");
  });

  it("Graph API: segue a paginação e traduz token vencido", async () => {
    const paginas: Record<string, unknown> = {
      "https://x/1": { data: [{ a: 1 }], paging: { next: "https://x/2" } },
      "https://x/2": { data: [{ a: 2 }] },
    };
    const ok = await graphGet(
      async (u) => new Response(JSON.stringify(paginas[u])),
      "https://x/1",
      "t",
    );
    expect(ok).toEqual([{ a: 1 }, { a: 2 }]);
    await expect(
      graphGet(
        async () =>
          new Response(
            JSON.stringify({ error: { code: 190, message: "expired" } }),
          ),
        "https://x/1",
        "t",
      ),
    ).rejects.toThrow(/Token do Meta inválido ou expirado/);
  });

  it("Graph API: dados do funil por campanha e por dia", async () => {
    const corpo = {
      data: [
        {
          campaign_id: "c1",
          campaign_name: "Onix",
          date_start: "2026-11-01",
          spend: "10.5",
          impressions: "1000",
          clicks: "30",
          inline_link_clicks: "20",
          actions: [
            {
              action_type:
                "onsite_conversion.messaging_conversation_started_7d",
              value: "3",
            },
          ],
        },
      ],
    };
    let url = "";
    const m = await buscarMetaDoFunil(
      async (u) => {
        url = u;
        return new Response(JSON.stringify(corpo));
      },
      { token: "t", conta: "123", versao: "v25.0" },
      { since: "2026-11-01", until: "2026-11-01" },
    );
    expect(url).toContain("/act_123/insights");
    expect(m.daily[0]).toMatchObject({
      spend: 10.5,
      linkClicks: 20,
      conversations: 3,
    });
    expect(m.campaigns).toEqual([
      { id: "c1", name: "Onix", objective: undefined },
    ]);
    expect(normalizarConta("act_9")).toBe("act_9");
  });
});

describe("erros do Meta", () => {
  it("explica o bloqueio de API da Meta (200/5258005) e o limite de consultas", () => {
    expect(
      mensagemDoMeta({
        code: 200,
        error_subcode: 5258005,
        message: "API access blocked.",
      }),
    ).toMatch(/A Meta bloqueou o acesso/);
    expect(mensagemDoMeta({ code: 17 })).toMatch(/limitou as consultas/);
    expect(mensagemDoMeta({ code: 100, message: "Campo inválido" })).toBe(
      "Meta: Campo inválido",
    );
  });
});

describe("importação do Soul APP", () => {
  it("decifra o formato v10 do safeStorage com a chave do Local State", () => {
    const chave = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", chave, nonce);
    const corpo = Buffer.concat([
      c.update("token-ficticio-123", "utf8"),
      c.final(),
    ]);
    const valor = Buffer.concat([
      Buffer.from("v10"),
      nonce,
      corpo,
      c.getAuthTag(),
    ]).toString("base64");
    expect(decifrarV10(chave, valor)).toBe("token-ficticio-123");
    expect(decifrarV10(crypto.randomBytes(32), valor)).toBe("");
    expect(decifrarV10(chave, "lixo")).toBe("");
  });
});
