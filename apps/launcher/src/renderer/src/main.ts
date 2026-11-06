/**
 * Interface do Launcher (TypeScript puro, sem framework).
 *
 * Desenha a biblioteca de apps a partir do `EstadoLauncher` vindo do main e reage
 * aos eventos de progresso de download/instalação. Toda ação passa pela ponte
 * `window.launcher` (preload); erros aparecem na faixa vermelha do topo.
 */
import "./styles.css";
import type {
  EstadoApp,
  EstadoLauncher,
  LauncherApi,
  Progresso,
} from "../../shared/api";

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}

const URL_PROJETO = "https://github.com/attocomunicacao/soul-cars-app";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

let estado: EstadoLauncher | null = null;
/** Progresso atual por app (download/extração), para redesenhar sem perder a barra. */
const progresso = new Map<string, Progresso>();

/** Mostra um erro na faixa do topo (vazio esconde). */
function mostrarErro(mensagem: string) {
  const faixa = $("error");
  faixa.hidden = !mensagem;
  faixa.textContent = mensagem;
}

/** Texto do erro de uma promessa rejeitada pelo IPC (sem o prefixo técnico do Electron). */
const textoErro = (e: unknown) =>
  String(e instanceof Error ? e.message : e).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );

/** Executa uma ação do main e redesenha com o estado devolvido. */
async function acao(fn: () => Promise<EstadoLauncher | void>) {
  mostrarErro("");
  try {
    const novo = await fn();
    if (novo) desenhar(novo);
  } catch (e) {
    mostrarErro(textoErro(e));
    desenhar(await window.launcher.estado());
  }
}

/** Data ISO → "05/11/2026". */
const data = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

/** Cria um elemento com classe e texto. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe = "",
  texto = "",
) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto) e.textContent = texto;
  return e;
}

/** Cartão de um app: situação, botões e notas da versão. */
function cartao(item: EstadoApp): HTMLElement {
  const { release, instalada, situacao } = item;
  const card = el("article", "app-card");
  const andamento = progresso.get(release.id);
  const ocupado =
    !!andamento && !["concluido", "erro"].includes(andamento.etapa);

  const capa = el("div", "app-cover");
  const logo = el("img");
  logo.src = "./soul-logo.jpg";
  logo.alt = release.name;
  capa.append(logo);

  const corpo = el("div", "app-body");
  corpo.append(el("p", "eyebrow mono", "APP DESKTOP · WINDOWS"));
  corpo.append(el("h2", "", release.name));
  corpo.append(el("p", "muted", release.tagline));

  const chips = el("div", "chips");
  if (instalada)
    chips.append(el("span", "chip ok mono", `INSTALADO · v${instalada}`));
  if (situacao === "atualizacao-disponivel" || situacao === "nao-instalado")
    chips.append(
      el("span", "chip gold mono", `DISPONÍVEL · v${release.version}`),
    );
  if (situacao === "indisponivel")
    chips.append(el("span", "chip mono", "AGUARDANDO PRIMEIRA VERSÃO"));
  if (release.releasedAt)
    chips.append(el("span", "chip mono", data(release.releasedAt)));
  corpo.append(chips);

  const botoes = el("div", "actions");
  const principal = el("button", "primary mono");
  if (ocupado) {
    principal.textContent =
      andamento.etapa === "baixando"
        ? `BAIXANDO ${Math.round((andamento.fracao ?? 0) * 100)}%`
        : andamento.etapa === "verificando"
          ? "VERIFICANDO…"
          : "INSTALANDO…";
    principal.disabled = true;
  } else if (situacao === "nao-instalado") {
    principal.textContent = "INSTALAR";
    principal.onclick = () =>
      void acao(() => window.launcher.instalar(release.id));
  } else if (situacao === "atualizacao-disponivel") {
    principal.textContent = `ATUALIZAR PARA v${release.version}`;
    principal.onclick = () =>
      void acao(() => window.launcher.instalar(release.id));
  } else if (situacao === "atualizado") {
    principal.textContent = "ABRIR";
    principal.onclick = () =>
      void acao(() => window.launcher.abrir(release.id));
  } else {
    principal.textContent = "INDISPONÍVEL";
    principal.disabled = true;
  }
  botoes.append(principal);
  if (situacao === "atualizacao-disponivel" && !ocupado) {
    const abrir = el("button", "ghost mono", `ABRIR v${instalada}`);
    abrir.onclick = () => void acao(() => window.launcher.abrir(release.id));
    botoes.append(abrir);
  }
  if (instalada) {
    const pasta = el("button", "ghost mono", "ABRIR PASTA");
    pasta.onclick = () =>
      void acao(() => window.launcher.abrirPasta(release.id));
    botoes.append(pasta);
  }
  corpo.append(botoes);

  if (ocupado) {
    const barra = el("div", "progress");
    const preenchido = el("span");
    preenchido.style.width = `${Math.round((andamento.fracao ?? (andamento.etapa === "baixando" ? 0 : 1)) * 100)}%`;
    barra.append(preenchido);
    corpo.append(barra);
  }
  if (andamento?.etapa === "erro" && andamento.mensagem)
    corpo.append(el("p", "error-text", andamento.mensagem));

  if (release.notes.trim()) {
    const notas = el("details", "notes");
    notas.append(el("summary", "mono", `NOTAS DA VERSÃO v${release.version}`));
    const lista = el("ul");
    for (const linha of release.notes
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim()))
      if (linha) lista.append(el("li", "", linha));
    notas.append(lista);
    corpo.append(notas);
  }

  card.append(capa, corpo);
  return card;
}

/** Redesenha a tela inteira a partir do estado. */
function desenhar(novo: EstadoLauncher) {
  estado = novo;
  const apps = $("apps");
  apps.replaceChildren(...novo.apps.map(cartao));

  const faixa = $("launcher-update");
  faixa.hidden = !novo.novoLauncher;
  if (novo.novoLauncher) {
    faixa.replaceChildren(
      el("span", "", `Nova versão do Launcher: v${novo.novoLauncher.version}.`),
    );
    const botao = el("button", "primary mono", "ATUALIZAR LAUNCHER");
    botao.onclick = () => {
      botao.disabled = true;
      botao.textContent = "BAIXANDO…";
      void acao(() => window.launcher.atualizarLauncher());
    };
    faixa.append(botao);
  }

  ($("pref-close") as HTMLInputElement).checked =
    novo.preferencias.fecharAoAbrir;
  ($("pref-check") as HTMLInputElement).checked =
    novo.preferencias.verificarAoIniciar;
  $("install-dir").textContent = novo.pastaInstalacao;
  $("about-version").textContent =
    `Launcher v${novo.versaoLauncher} · ${novo.plataforma}`;
  $("platform").textContent = `v${novo.versaoLauncher} · ${novo.plataforma}`;
  $("status").textContent = novo.erroCatalogo
    ? `Sem conexão com o servidor de versões: ${novo.erroCatalogo}`
    : novo.verificadoEm
      ? `Catálogo verificado em ${new Date(novo.verificadoEm).toLocaleString("pt-BR")}`
      : "Catálogo ainda não verificado";
}

/** Troca de aba (Biblioteca, Configurações, Sobre). */
function ligarAbas() {
  for (const botao of document.querySelectorAll<HTMLButtonElement>(
    "[data-tab]",
  )) {
    botao.onclick = () => {
      for (const b of document.querySelectorAll("[data-tab]"))
        b.classList.toggle("active", b === botao);
      for (const secao of document.querySelectorAll<HTMLElement>(".tab"))
        secao.hidden = secao.id !== `tab-${botao.dataset.tab}`;
    };
  }
}

function iniciar() {
  ligarAbas();
  $("check").onclick = () => {
    $("status").textContent = "Verificando atualizações…";
    void acao(() => window.launcher.verificar());
  };
  $("pref-close").onchange = (e) =>
    void acao(() =>
      window.launcher.salvarPreferencias({
        fecharAoAbrir: (e.target as HTMLInputElement).checked,
      }),
    );
  $("pref-check").onchange = (e) =>
    void acao(() =>
      window.launcher.salvarPreferencias({
        verificarAoIniciar: (e.target as HTMLInputElement).checked,
      }),
    );
  $("open-repo").onclick = () => void window.launcher.abrirLink(URL_PROJETO);

  window.launcher.aoProgresso((p) => {
    progresso.set(p.appId, p);
    if (p.etapa === "concluido") progresso.delete(p.appId);
    if (estado) desenhar(estado);
  });

  void acao(async () => {
    const inicial = await window.launcher.estado();
    desenhar(inicial);
    if (inicial.preferencias.verificarAoIniciar) {
      $("status").textContent = "Verificando atualizações…";
      return window.launcher.verificar();
    }
  });
}

iniciar();
