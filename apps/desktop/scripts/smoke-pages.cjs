// Smoke das páginas, no Electron real: abre CRM · Leads (Painel, Kanban, lista, gaveta, Atividade)
// e o Pré-atendimento IA (8 abas) com dados FICTÍCIOS, confere que cada uma renderiza e que o
// console não tem erros, e roda o axe-core (acessibilidade) em cada tela.
// Perfil e banco TEMPORÁRIOS: nunca toca em %APPDATA%\soul-cars-app. Rode com `npm run smoke:pages`
// (precisa do build). O axe só informa por padrão; com SOUL_AXE_ESTRITO=1 as violações reprovam.
// O relatório do axe fica em apps/desktop/.tmp/axe-report.json (pasta ignorada pelo git).
process.env.SOUL_SEM_SPLASH = "1";
const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

const REPO = path.resolve(__dirname, "..");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-smoke-paginas-"));
app.setPath("userData", raiz);
fs.writeFileSync(
  path.join(raiz, "config.json"),
  JSON.stringify({ raizDados: raiz }),
);
const { DatabaseSync } = require("node:sqlite");
new DatabaseSync(path.join(raiz, "soul.db")).close();
fs.mkdirSync(path.join(raiz, "ESTOQUE"), { recursive: true });
fs.mkdirSync(path.join(raiz, "dados"), { recursive: true });

// ---- CRM fictício (cache da última leitura do uTalk)
const tags = [
  { id: "s1", name: "Novo lead", groupIds: [] },
  { id: "s2", name: "Quente", groupIds: [] },
  { id: "s3", name: "Agendado", groupIds: [] },
  { id: "s4", name: "Perdido", groupIds: [] },
  { id: "c1", name: "Ford Fiesta 2016", groupIds: [] },
  { id: "c2", name: "VW Gol 2018", groupIds: [] },
];
const agora = Date.now();
const iso = (dias) => new Date(agora - dias * 86400000).toISOString();
const lead = (n, tagIds, memberId, dias) => ({
  id: "L" + n,
  name: "Cliente Teste " + n,
  phone: "1199990000" + n,
  email: "",
  createdAt: iso(dias),
  lastActive: iso(dias / 2),
  tagIds,
  memberId,
  chatId: "chat" + n,
  chatOpen: true,
  waiting: n % 2 === 0,
  sector: "Vendas",
  totalChats: 1,
  actions: memberId
    ? [{ memberId, title: "Respondeu", trigger: "msg", at: iso(dias / 2) }]
    : [],
});
fs.mkdirSync(path.join(raiz, "crm-leads"), { recursive: true });
fs.writeFileSync(
  path.join(raiz, "crm-leads", "cache.json"),
  JSON.stringify({
    snapshot: {
      organization: { id: "org1", name: "Soul Cars Teste" },
      tags,
      groups: [],
      members: [
        { id: "m1", name: "Ana SDR" },
        { id: "m2", name: "Bruno SDR" },
      ],
      leads: [
        lead(1, ["s1", "c1"], "m1", 1),
        lead(2, ["s2", "c1"], "m1", 2),
        lead(3, ["s3", "c2"], "m2", 3),
        lead(4, ["s4", "c2"], "m2", 5),
        lead(5, ["s1"], null, 1),
        lead(6, ["s2", "c2"], "m1", 6),
      ],
      fetchedAt: new Date().toISOString(),
    },
    events: [
      {
        at: iso(0.1),
        type: "novo",
        leadId: "L1",
        text: "Cliente Teste 1 entrou",
      },
      {
        at: iso(0.2),
        type: "tag+",
        leadId: "L2",
        text: "Cliente Teste 2 ganhou Quente",
        tags: ["Quente"],
      },
    ],
  }),
);
fs.writeFileSync(
  path.join(raiz, "crm-leads", "config.json"),
  JSON.stringify({
    windowDays: 0,
    intervalSec: 3600,
    notifyNewLeads: false,
    tagCategories: {
      s1: "status",
      s2: "status",
      s3: "status",
      s4: "status",
      c1: "car",
      c2: "car",
    },
    statusOrder: ["s1", "s2", "s3", "s4"],
  }),
);

const erros = [];
const checks = [];
const axe = {};
const registra = (nome, ok, detalhe = "") =>
  checks.push({ nome, ok: !!ok, detalhe: String(detalhe).slice(0, 160) });
const timeout = setTimeout(() => {
  console.error("SMOKE PÁGINAS: tempo excedido");
  app.exit(1);
}, 180000);
app.on("window-all-closed", () => {});

app.on("browser-window-created", (_e, w) => {
  w.webContents.setBackgroundThrottling(false);
  w.on("show", () => w.hide());
  w.webContents.on("console-message", (_ev, nivel, msg) => {
    if (nivel >= 3) erros.push(msg);
  });
  w.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((r) => setTimeout(r, 2500));
      if (w.isDestroyed()) return;
      const js = (c) => w.webContents.executeJavaScript(c);
      let principal = false;
      try {
        principal = await js("!!window.soul");
      } catch {
        return;
      }
      if (!principal) return; // tela de carregamento
      await js(`window.__t = {
        dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
        esperar: async (f, m) => { for (let i = 0; i < 80; i++) { if (f()) return; await window.__t.dormir(100); } throw Error(m); },
        menu: (t) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim().includes(t)); if (!b) throw Error('menu sem ' + t); b.click(); },
        seg: async (t) => { const b = [...document.querySelectorAll('.segmented button')].find((x) => x.textContent.trim() === t); if (!b) throw Error('sem ' + t); b.click(); await window.__t.dormir(500); }
      }; null`);
      await js(AXE + "; null");
      // SOUL_TEMA=dark mede o tema escuro (os tokens dele só valem com data-theme="dark").
      if (process.env.SOUL_TEMA === "dark")
        await js(
          `document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; null`,
        );
      const auditar = async (nome) => {
        axe[nome] =
          await js(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
          .then((r) => r.violations.map((v) => ({ id: v.id, impacto: v.impact, ocorrencias: v.nodes.length, exemplos: v.nodes.slice(0, 40).map((n) => { const d = (n.any[0] && n.any[0].data) || {}; return { alvo: n.target.join(' '), fg: d.fgColor, bg: d.bgColor, razao: d.contrastRatio, tamanho: d.fontSize }; }) })))`);
      };

      // ---------------- Configurações sobre uma página embutida (a vista nativa cobre a tela)
      await js(`window.__t.menu('Atendimento'); window.__t.dormir(800)`);
      await js(`window.__t.menu('Configurações'); window.__t.dormir(500)`);
      registra(
        "configurações: a folha fica visível sobre a página embutida",
        await js(
          `(() => { const f = document.querySelector('.sheet-backdrop'); return !!f && getComputedStyle(f).display !== 'none' && f.getBoundingClientRect().width > 0; })()`,
        ),
      );
      await auditar("configuracoes");
      await js(
        `[...document.querySelectorAll('.sheet .segmented button')].find((b) => b.textContent.trim() === 'Escuro')?.click(); window.__t.dormir(300)`,
      );
      registra(
        "tema: Escuro aplica data-theme=dark e fica guardado",
        await js(
          `document.documentElement.dataset.theme === 'dark' && localStorage.getItem('soul-theme') === 'dark'`,
        ),
      );
      await js(
        `[...document.querySelectorAll('.sheet .segmented button')].find((b) => b.textContent.trim() === 'Claro')?.click(); window.__t.dormir(300)`,
      );
      registra(
        "tema: Claro volta ao tema claro",
        await js(`document.documentElement.dataset.theme === 'light'`),
      );
      await js(`window.__t.menu('Configurações'); window.__t.dormir(300)`);

      // ---------------- Estoque
      await js(
        `window.__t.menu('Estoque'); window.__t.esperar(() => !!document.querySelector('.metric-link'), 'Estoque não abriu')`,
      );
      // Espera a transição de cores do tema (trocado logo antes) acabar, para o axe medir a cor final.
      await js(`window.__t.dormir(700)`);
      await auditar("estoque");

      // ---------------- CRM · Leads
      await js(
        `window.__t.menu('Leads'); window.__t.esperar(() => document.querySelector('.page-head h1')?.textContent === 'Leads', 'Leads não abriu')`,
      );
      await js(
        `window.__t.esperar(() => !!document.querySelector('.kpis'), 'Painel sem KPIs')`,
      );
      registra(
        "leads: painel com KPIs e carro",
        await js(
          `!!document.querySelector('.kpis') && document.body.textContent.includes('Ford Fiesta 2016')`,
        ),
      );
      await auditar("leads-painel");
      await js(`window.__t.seg('Kanban')`);
      registra(
        "leads: kanban com colunas e cartões",
        await js(
          `document.body.textContent.includes('Novo lead') && document.body.textContent.includes('Cliente Teste 1')`,
        ),
      );
      await auditar("leads-kanban");
      await js(`window.__t.seg('Leads')`);
      registra(
        "leads: lista com 6 linhas",
        (await js(`document.querySelectorAll('tbody tr').length`)) === 6,
      );
      await auditar("leads-lista");
      await js(
        `[...document.querySelectorAll('tbody tr')].find((t) => t.textContent.includes('Cliente Teste 1'))?.click(); window.__t.dormir(400)`,
      );
      registra(
        "leads: gaveta de detalhe abre",
        await js(`!!document.querySelector('[role=dialog]')`),
      );
      await js(
        `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.__t.dormir(400)`,
      );
      registra(
        "leads: gaveta fecha com Esc",
        !(await js(`!!document.querySelector('[role=dialog]')`)),
      );
      await js(`window.__t.seg('Atividade')`);
      registra(
        "leads: atividade mostra eventos",
        await js(
          `document.body.textContent.includes('entrou') || document.body.textContent.includes('Quente')`,
        ),
      );
      await auditar("leads-atividade");

      // ---------------- Pré-atendimento IA
      await js(
        `window.__t.menu('Pré-atendimento IA'); window.__t.esperar(() => document.querySelector('.page-head h1')?.textContent === 'Pré-atendimento IA', 'Pré-atendimento não abriu')`,
      );
      for (const aba of [
        "Visão geral",
        "Aprovação",
        "Auditoria",
        "Ensinar",
        "Laboratório",
        "Respostas-rápidas",
        "Loja",
        "Configurações",
      ]) {
        await js(`window.__t.seg(${JSON.stringify(aba)})`);
        const tamanho = await js(
          `document.querySelector('section.pre-atendimento')?.textContent.length || 0`,
        );
        registra(
          `pré-atendimento: aba ${aba} renderiza`,
          tamanho > 150,
          `texto=${tamanho}`,
        );
        await auditar("pre-" + aba.toLowerCase().replace(/[^a-z]+/g, "-"));
      }

      registra("console sem erros", erros.length === 0, erros.join(" | "));
      fs.mkdirSync(path.join(REPO, ".tmp"), { recursive: true });
      fs.writeFileSync(
        path.join(
          REPO,
          ".tmp",
          process.env.SOUL_TEMA === "dark"
            ? "axe-report-dark.json"
            : "axe-report.json",
        ),
        JSON.stringify(axe, null, 2),
      );
      const violacoes = Object.values(axe).reduce(
        (n, lista) => n + lista.length,
        0,
      );
      const falhas = checks.filter((c) => !c.ok);
      console.log(
        `SMOKE PÁGINAS ${falhas.length ? "FALHOU" : "OK"} | ${checks.length - falhas.length}/${checks.length} verificações | axe: ${violacoes} tipos de violação em ${Object.keys(axe).length} telas`,
      );
      for (const f of falhas)
        console.log("FALHA: " + f.nome + " :: " + f.detalhe);
      clearTimeout(timeout);
      const estrito = process.env.SOUL_AXE_ESTRITO === "1" && violacoes > 0;
      app.exit(falhas.length || estrito ? 2 : 0);
    } catch (e) {
      console.error("SMOKE PÁGINAS FALHOU:", e && e.message ? e.message : e);
      clearTimeout(timeout);
      app.exit(1);
    }
  });
});
import(pathToFileURL(path.join(REPO, "out/main/index.js")).href);
