// Smoke de segurança, cofre, motor, Pré-atendimento e gaveta, no Electron real.
// Roda com perfil e banco TEMPORÁRIOS e dados fictícios (nunca toca em %APPDATA%\soul-cars-app):
// valida que a pasta do motor e a raiz só entram pelo seletor de pastas, a URL do Ollama, extensões bloqueadas, o cofre de tokens
// (inclusive um token no formato antigo), o protocolo do motor, as ações do Pré-atendimento e o
// foco da gaveta com Tab e Esc de verdade. Rode com `npm run smoke:security` (precisa do build).
const { app, safeStorage, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const REPO = path.resolve(__dirname, "..");
const MOTOR = path.resolve(REPO, "../engine");

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-smoke-seguranca-"));
app.setPath("userData", raiz);
const { DatabaseSync } = require("node:sqlite");
new DatabaseSync(path.join(raiz, "soul.db")).close();
fs.mkdirSync(path.join(raiz, "ESTOQUE"), { recursive: true });
fs.mkdirSync(path.join(raiz, "dados"), { recursive: true });

// diálogo nativo simulado: devolve a pasta do motor, como se o usuário a tivesse escolhido
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [MOTOR] });

// ---- CRM fictício (para a gaveta)
const agora = Date.now();
const iso = (d) => new Date(agora - d * 86400000).toISOString();
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
  waiting: false,
  sector: "Vendas",
  totalChats: 1,
  actions: [],
});
fs.mkdirSync(path.join(raiz, "crm-leads"), { recursive: true });
fs.writeFileSync(
  path.join(raiz, "crm-leads", "cache.json"),
  JSON.stringify({
    snapshot: {
      organization: { id: "o", name: "Teste" },
      tags: [{ id: "s1", name: "Novo lead", groupIds: [] }],
      groups: [],
      members: [{ id: "m1", name: "Ana" }],
      leads: [lead(1, ["s1"], "m1", 1), lead(2, ["s1"], "m1", 2)],
      fetchedAt: new Date().toISOString(),
    },
    events: [],
  }),
);
fs.writeFileSync(
  path.join(raiz, "crm-leads", "config.json"),
  JSON.stringify({
    windowDays: 0,
    intervalSec: 3600,
    notifyNewLeads: false,
    tagCategories: { s1: "status" },
    statusOrder: ["s1"],
  }),
);

// ---- Pré-atendimento com um rascunho plantado
fs.writeFileSync(
  path.join(raiz, "pre-atendimento.json"),
  JSON.stringify({
    chats: {
      c1: {
        chatId: "c1",
        contatoId: null,
        nome: "Cliente Teste",
        telefone: null,
        historico: [{ role: "user", content: "oi", em: 1 }],
        status: "ativo",
        vistoAte: 0,
        ultimaIaEm: null,
        fotosEnviadas: {},
      },
    },
    rascunhos: [
      {
        id: "r1",
        chatId: "c1",
        nome: "Cliente Teste",
        pergunta: "oi",
        texto: "Olá! Em que posso ajudar?",
        transferir: false,
        encerrar: false,
        fotos: [],
        veiculoFotos: null,
        veiculoFotosId: null,
        inicioFotos: 0,
        em: agora,
      },
    ],
    registros: [],
  }),
);

const resultados = [];
const erros = [];
const timeout = setTimeout(() => {
  console.error("TESTES: tempo excedido");
  app.exit(1);
}, 240000);
const registra = (nome, ok, detalhe = "") =>
  resultados.push({ nome, ok: !!ok, detalhe: String(detalhe).slice(0, 160) });

app.whenReady().then(async () => {
  // Token do uTalk no formato ANTIGO (o que a versão anterior gravava), antes de o app abrir.
  // Sem cifragem no sistema (alguns ambientes de CI) o bloco do cofre é ignorado, não reprovado.
  const cifra = safeStorage.isEncryptionAvailable();
  const TOKEN_LEGADO = "token-legado-1234567890";
  fs.writeFileSync(
    path.join(raiz, "config.json"),
    JSON.stringify({
      raizDados: raiz,
      pastaMotor: MOTOR,
      ...(cifra
        ? {
            utalkTokenCifrado: safeStorage
              .encryptString(TOKEN_LEGADO)
              .toString("base64"),
          }
        : {}),
    }),
  );
  app.on("browser-window-created", (_e, w) => {
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
        if (!principal) return;
        const inv = (c, a = {}) =>
          js(
            `window.soul.invocar(${JSON.stringify(c)}, ${JSON.stringify(a)}).then(v=>({ok:true,v}),e=>({ok:false,e:String((e&&e.message)||e)}))`,
          );
        const cfgDisco = () =>
          fs.readFileSync(path.join(raiz, "config.json"), "utf8");

        let r;
        if (!cifra)
          registra(
            "cofre: ignorado (o sistema não oferece cifragem neste ambiente)",
            true,
            "ignorado",
          );
        else {
          // ---------- cofre: token no formato antigo continua valendo
          r = await inv("crm_leads_dados");
          registra(
            "cofre: token do uTalk gravado pela versão anterior continua lido",
            r.ok && r.v.conectado === true,
            JSON.stringify(r),
          );

          // ---------- cofre: salvar novo token (cifrado em disco) e remover
          r = await inv("utalk_token_salvar", {
            token: "Bearer token-novo-9876543210",
          });
          registra(
            "cofre: salvar token do uTalk (sem o prefixo Bearer)",
            r.ok && r.v.configurado === true,
            JSON.stringify(r),
          );
          registra(
            "cofre: token do uTalk não fica em texto puro no config.json",
            !cfgDisco().includes("token-novo-9876543210"),
          );
          r = await inv("utalk_token_salvar", { token: "curto" });
          registra(
            "cofre: token do uTalk curto demais é recusado",
            !r.ok && /completo/.test(r.e),
            r.e,
          );
          r = await inv("utalk_token_remover");
          registra(
            "cofre: remover token do uTalk",
            r.ok && r.v.configurado === false,
            JSON.stringify(r),
          );

          r = await inv("meta_salvar", {
            token: "meta-token-fake-1234567890",
            conta: "act_123456",
            versao: "v21.0",
          });
          registra(
            "cofre: salvar token do Meta junto com conta e versão",
            r.ok && r.v.configurado === true && r.v.conta === "act_123456",
            JSON.stringify(r),
          );
          registra(
            "cofre: token do Meta não fica em texto puro no config.json",
            !cfgDisco().includes("meta-token-fake-1234567890"),
          );
          r = await inv("meta_token_remover");
          registra(
            "cofre: remover token do Meta",
            r.ok && r.v.configurado === false,
            JSON.stringify(r),
          );

          r = await inv("pre_chave_groq_salvar", {
            chave: "gsk_" + "a".repeat(30),
          });
          registra(
            "cofre: salvar chave do Groq",
            r.ok && r.v.conexoes.groq === true,
            JSON.stringify(r).slice(0, 120),
          );
          registra(
            "cofre: chave do Groq não fica em texto puro no config.json",
            !cfgDisco().includes("a".repeat(30)),
          );
          r = await inv("pre_chave_groq_salvar", { chave: "gsk_curta" });
          registra(
            "cofre: chave do Groq curta demais é recusada",
            !r.ok && /completa/.test(r.e),
            r.e,
          );
          r = await inv("pre_chave_groq_salvar", { chave: "" });
          registra(
            "cofre: remover chave do Groq",
            r.ok && r.v.conexoes.groq === false,
            "",
          );
        }

        // ---------- segurança do main
        r = await inv("config_gravar", {
          patch: { pastaMotor: "C:\\Windows\\System32" },
        });
        registra(
          "segurança: pasta do motor digitada (fora do seletor) é recusada",
          !r.ok && /seletor/.test(r.e),
          r.e,
        );
        r = await inv("config_gravar", {
          patch: { raizDados: path.join(os.tmpdir(), "outra-raiz") },
        });
        registra(
          "segurança: raiz dos dados digitada (fora do seletor) é recusada",
          !r.ok && /seletor/.test(r.e),
          r.e,
        );
        r = await inv("dialog", { directory: true });
        registra(
          "segurança: diálogo devolve a pasta escolhida",
          r.ok && r.v === MOTOR,
          JSON.stringify(r),
        );
        r = await inv("config_gravar", { patch: { pastaMotor: MOTOR } });
        registra(
          "segurança: pasta do motor escolhida pelo seletor é aceita",
          r.ok,
          r.e || "",
        );
        r = await inv("pre_config_salvar", {
          patch: { urlOllama: "http://example.com" },
        });
        registra(
          "segurança: URL do Ollama fora da rede local é recusada",
          !r.ok && /rede local|deste computador/.test(r.e),
          r.e,
        );
        r = await inv("pre_config_salvar", {
          patch: { urlOllama: "http://192.168.0.20:11434" },
        });
        registra(
          "segurança: URL do Ollama na rede local é aceita",
          r.ok,
          r.e || "",
        );
        fs.writeFileSync(
          path.join(raiz, "atalho.url"),
          "[InternetShortcut]\nURL=http://example.com\n",
        );
        r = await inv("open_path", { path: path.join(raiz, "atalho.url") });
        registra(
          "segurança: abrir arquivo .url é recusado",
          !r.ok && /não pode ser aberto/.test(r.e),
          r.e,
        );

        // ---------- motor
        r = await inv("engine_call", { method: "ping", params: {} });
        registra(
          "motor: motor responde ao ping",
          r.ok && r.v && typeof r.v === "object",
          JSON.stringify(r).slice(0, 100),
        );
        // `ler_crlv` sem arquivo passa pelo esquema (os dois campos são opcionais) e chega ao Python.
        r = await inv("engine_call", { method: "ler_crlv", params: {} });
        registra(
          "motor: parâmetro faltando vira mensagem clara (não derruba o motor)",
          !r.ok &&
            /Arquivo não recebido|Campo ausente|No module named/.test(r.e),
          /No module named/.test(r.e)
            ? "ignorado: dependência opcional ausente"
            : r.e,
        );
        r = await inv("engine_call", {
          method: "ler_crlv",
          params: {
            origem: path.join(os.tmpdir(), "fora-das-raizes", "x.pdf"),
          },
        });
        registra(
          "motor: caminho de origem fora das pastas do app é recusado antes de chegar ao Python",
          !r.ok && /fora da pasta de dados/.test(r.e),
          r.e,
        );
        r = await inv("engine_call", { method: "soulia_planilha", params: {} });
        registra(
          "motor: método interno (planilha da Soul IA) não é chamável pela interface",
          !r.ok && /method/.test(r.e),
          r.e,
        );
        r = await inv("video_gerar", {
          pasta: raiz,
          veiculo: "TESTE",
          motor: "",
          preco: "",
          python: "C:/Windows/System32/cmd.exe",
        });
        registra(
          "motor: o executável do vídeo informado pela interface é ignorado (sem motor, falha por falta dele)",
          !r.ok && !/cmd\.exe/.test(r.e),
          r.e,
        );
        r = await inv("engine_call", { method: "ping", params: {} });
        registra(
          "motor: motor continua respondendo depois do erro",
          r.ok,
          r.e || "",
        );

        // ---------- Pré-atendimento: ações
        r = await inv("pre_aprovar", { id: "r1" });
        registra(
          "pré-atendimento: aprovar rascunho sem token do uTalk falha com mensagem clara",
          !r.ok && /token do uTalk/.test(r.e),
          r.e,
        );
        r = await inv("pre_painel");
        registra(
          "pré-atendimento: rascunho não se perde quando o envio falha",
          r.ok && r.v.rascunhos.some((x) => x.id === "r1"),
          "",
        );
        r = await inv("pre_loja_salvar", { patch: { nome: "Loja Teste" } });
        registra(
          "pré-atendimento: salvar dados da loja",
          r.ok && r.v.loja.nome === "Loja Teste",
          r.e || "",
        );
        registra(
          "pré-atendimento: loja gravada em disco (pre-atendimento.json)",
          JSON.parse(
            fs.readFileSync(path.join(raiz, "pre-atendimento.json"), "utf8"),
          ).loja.nome === "Loja Teste",
        );
        r = await inv("pre_persona_salvar", { persona: "Persona de teste" });
        registra(
          "pré-atendimento: salvar persona",
          r.ok && r.v.persona === "Persona de teste",
          r.e || "",
        );
        r = await inv("pre_resposta_salvar", {
          item: { id: "", titulo: "Saudação", palavras: "oi", texto: "Olá!" },
        });
        const idResp =
          r.ok && r.v.respostas.find((x) => x.titulo === "Saudação")?.id;
        registra("pré-atendimento: criar resposta-rápida", !!idResp, r.e || "");
        r = await inv("pre_resposta_remover", { id: idResp });
        registra(
          "pré-atendimento: remover resposta-rápida",
          r.ok && !r.v.respostas.some((x) => x.id === idResp),
          r.e || "",
        );
        r = await inv("pre_descartar", { id: "r1" });
        registra(
          "pré-atendimento: descartar rascunho",
          r.ok && !r.v.rascunhos.some((x) => x.id === "r1"),
          r.e || "",
        );
        r = await inv("pre_exemplos_recalcular");
        registra("pré-atendimento: recalcular exemplos reais", r.ok, r.e || "");
        r = await inv("pre_auditoria", { limite: 10 });
        registra(
          "pré-atendimento: auditoria do Pré-atendimento lê sem erro",
          r.ok,
          r.e || "",
        );

        // ---------- gaveta com Tab e Esc de verdade
        await js(`window.__t={dormir:(ms)=>new Promise(r=>setTimeout(r,ms)),
          esperar:async(f,m)=>{for(let i=0;i<80;i++){if(f())return;await window.__t.dormir(100)}throw Error(m)}};null`);
        await js(
          `(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim().includes('Leads'));b.click();return null})()`,
        );
        await js(
          `window.__t.esperar(()=>document.querySelector('.page-head h1')?.textContent==='Leads','Leads não abriu')`,
        );
        await js(
          `(()=>{const b=[...document.querySelectorAll('.segmented button')].find(x=>x.textContent.trim()==='Leads');b.click();return null})()`,
        );
        await js(
          `window.__t.esperar(()=>document.querySelectorAll('tbody tr').length>0,'lista vazia')`,
        );
        // foca um botão conhecido e abre a gaveta por clique programático (o foco fica no botão)
        await js(
          `(()=>{window.__gatilho=[...document.querySelectorAll('.segmented button')].find(x=>x.textContent.trim()==='Leads');window.__gatilho.focus();[...document.querySelectorAll('tbody tr')].find(t=>t.textContent.includes('Cliente Teste 1')).click();return null})()`,
        );
        await js(
          `window.__t.esperar(()=>!!document.querySelector('[role=dialog]'),'gaveta não abriu')`,
        );
        const dentro = () =>
          js(
            `!!document.activeElement&&!!document.activeElement.closest('[role=dialog]')`,
          );
        registra("gaveta: gaveta abre com o foco dentro dela", await dentro());
        const total = await js(
          `document.querySelector('[role=dialog]').querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])').length`,
        );
        const tecla = async (modifiers) => {
          w.webContents.sendInputEvent({
            type: "keyDown",
            keyCode: "Tab",
            modifiers,
          });
          w.webContents.sendInputEvent({
            type: "keyUp",
            keyCode: "Tab",
            modifiers,
          });
          await new Promise((r) => setTimeout(r, 120));
        };
        let sempreDentro = true;
        for (let i = 0; i < total + 3; i++) {
          await tecla([]);
          if (!(await dentro())) sempreDentro = false;
        }
        registra(
          `gaveta: Tab circula só dentro da gaveta (${total} itens focáveis, ${total + 3} Tabs)`,
          sempreDentro,
          `total=${total}`,
        );
        let sempreDentroVolta = true;
        for (let i = 0; i < total + 3; i++) {
          await tecla(["shift"]);
          if (!(await dentro())) sempreDentroVolta = false;
        }
        registra(
          "gaveta: Shift+Tab circula só dentro da gaveta",
          sempreDentroVolta,
        );
        w.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
        w.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
        await new Promise((r) => setTimeout(r, 500));
        registra(
          "gaveta: Esc fecha a gaveta",
          !(await js(`!!document.querySelector('[role=dialog]')`)),
        );
        registra(
          "gaveta: o foco volta ao elemento que abriu a gaveta",
          await js(`document.activeElement===window.__gatilho`),
        );

        registra(
          "console sem erros durante todos os testes",
          erros.length === 0,
          erros.join(" | "),
        );
        const falhas = resultados.filter((x) => !x.ok);
        console.log("RESULTADOS " + JSON.stringify(resultados));
        console.log(
          `TOTAL ${resultados.length} | OK ${resultados.length - falhas.length} | FALHAS ${falhas.length}`,
        );
        for (const f of falhas)
          console.log("FALHA: " + f.nome + " :: " + f.detalhe);
        clearTimeout(timeout);
        app.exit(falhas.length ? 2 : 0);
      } catch (e) {
        console.error("TESTES FALHOU:", e && e.message ? e.message : e);
        console.log("RESULTADOS " + JSON.stringify(resultados));
        clearTimeout(timeout);
        app.exit(1);
      }
    });
  });
  import(pathToFileURL(path.join(REPO, "out/main/index.js")).href);
});
