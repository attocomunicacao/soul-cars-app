import type { WebContents } from "electron";

// Seletores por significado, em português/inglês. Uma mudança de tela gera
// uma interrupção visível; nunca tentamos clicar em coordenadas arbitrárias.
const DOM_HELPERS = `
const norm = s => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
const visivel = e => !!e && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
const dialogos = [...document.querySelectorAll('[role="dialog"]')].filter(visivel);
const area = dialogos.at(-1) || document;
const nome = e => [e.getAttribute('aria-label'),e.innerText,e.querySelector('svg[aria-label]')?.getAttribute('aria-label')].map(norm).filter(Boolean);
const candidatos = raiz => [...raiz.querySelectorAll('button,a,[role="button"],[role="link"],[role="menuitem"],[role="tab"],div[tabindex="0"],span[tabindex="0"]')];
const nomeBotao = e => [...nome(e), norm(e.textContent)].filter(Boolean);
const achar = (labels, raiz) => {
  const alvos = labels.map(norm);
  const direto = candidatos(raiz).find(e => visivel(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && nomeBotao(e).some(n => alvos.includes(n)));
  if (direto) return direto;
  // Menu recolhido: só há o ícone, e o nome está no aria-label do SVG ou da imagem.
  for (const icone of raiz.querySelectorAll('svg[aria-label],[aria-label]')) {
    if (!alvos.includes(norm(icone.getAttribute('aria-label')))) continue;
    const alvo = icone.closest('a,button,[role="button"],[role="link"],[tabindex="0"]') || icone;
    if (visivel(alvo) && alvo.getAttribute('aria-disabled') !== 'true') return alvo;
  }
  return undefined;
};
const botao = (labels, raiz = area) => achar(labels, raiz) || (raiz === area && area !== document ? achar(labels, document) : undefined);
const legenda = () => [...area.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"][aria-label]')].find(e => visivel(e) && /caption|legenda/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' '))) || [...area.querySelectorAll('textarea,[contenteditable="true"][role="textbox"]')].find(visivel);
`;

export class InstagramBrowser {
  private chooser: number | null = null;
  constructor(
    private wc: WebContents,
    private signal: AbortSignal,
    private log: (texto: string) => void,
    private validarOrigem: () => void,
  ) {}
  private checar() {
    if (this.signal.aborted) throw new Error("Automação interrompida.");
    if (this.wc.isDestroyed())
      throw new Error("A janela do Instagram foi fechada.");
    this.validarOrigem();
  }
  private async avaliar<T>(codigo: string): Promise<T> {
    this.checar();
    return this.wc.executeJavaScript(
      `(() => { ${DOM_HELPERS} ${codigo} })()`,
      true,
    ) as Promise<T>;
  }
  private async esperar<T>(
    fn: () => Promise<T>,
    mensagem: string,
    timeout = 25_000,
  ): Promise<T> {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) {
      this.checar();
      const r = await fn();
      if (r) return r;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(mensagem);
  }
  async conta() {
    return this.avaliar<string>(`
      const reservados = ['accounts','direct','explore','reels','stories','p','reel','about','legal'];
      const handle = href => {
        try {
          const m = new URL(href || '/', location.href).pathname.match(/^\\/([a-zA-Z0-9._]+)\\/?$/);
          return m && !reservados.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : '';
        } catch { return ''; }
      };
      const textoNome = e => [nome(e), [norm(e.textContent)]].flat();
      const links = [...document.querySelectorAll('a[href]')];
      // 1) O link "Perfil" do menu lateral (texto, rótulo ou ícone).
      const perfil = links.find(e => visivel(e) && textoNome(e).some(n => ['perfil','profile'].includes(n)));
      let achado = handle(perfil?.getAttribute('href'));
      // 2) A foto do próprio perfil dentro de um link do menu: "Foto do perfil de fulano".
      if (!achado) {
        for (const img of document.querySelectorAll('img[alt]')) {
          const m = norm(img.alt).match(/(?:foto do perfil de|profile picture of)\\s+([a-z0-9._]+)|^([a-z0-9._]+)'s profile picture/);
          const dono = m && (m[1] || m[2]);
          if (dono && img.closest('a[href]') && handle(img.closest('a[href]').getAttribute('href')) === dono) { achado = dono; break; }
        }
      }
      return achado;
    `);
  }
  private async clicar(labels: string[], timeout = 25_000) {
    try {
      return await this.esperar(
        () =>
          this.avaliar<boolean>(`
      const e = botao(${JSON.stringify(labels)});
      if (!e) return false; e.click(); return true;
    `),
        `Não encontrei “${labels[0]}” no Instagram. Confira a janela e tente novamente.`,
        timeout,
      );
    } catch (erro) {
      // Mostra os rótulos que a página tem, para ajustar a busca quando a tela do Instagram mudar.
      const vistos = await this.avaliar<string[]>(
        `
        return [...new Set([...document.querySelectorAll('[aria-label]')].filter(visivel).map(e => e.getAttribute('aria-label')))].slice(0, 40);
      `,
      ).catch(() => [] as string[]);
      if (vistos.length)
        this.log(`Rótulos visíveis na página: ${vistos.join(" | ")}`);
      throw erro;
    }
  }
  private onDebugger = (
    _e: unknown,
    metodo: string,
    params: { backendNodeId?: number },
  ) => {
    if (metodo === "Page.fileChooserOpened")
      this.chooser = params.backendNodeId ?? null;
  };
  private async anexar(files: string[], tipo: "midia" | "capa") {
    this.checar();
    const expressao = `(() => { const inputs = [...document.querySelectorAll('input[type="file"]')];
      const elegiveis = inputs.filter(e => ${tipo === "capa" ? "!e.multiple && /image/i.test(e.accept) && !/video/i.test(e.accept)" : files.length > 1 ? "e.multiple && /image/i.test(e.accept)" : "/video/i.test(e.accept)"});
      const dialogo = [...document.querySelectorAll('[role="dialog"]')].at(-1);
      return elegiveis.filter(e => dialogo?.contains(e)).at(-1) || elegiveis.at(-1) || null;
    })()`;
    const r = await this.wc.debugger.sendCommand("Runtime.evaluate", {
      expression: expressao,
    });
    let backendNodeId: number | null = null;
    if (r.result?.objectId) {
      const d = await this.wc.debugger.sendCommand("DOM.describeNode", {
        objectId: r.result.objectId,
      });
      backendNodeId = d.node.backendNodeId;
    }
    if (!backendNodeId) {
      this.chooser = null;
      await this.clicar(
        tipo === "capa"
          ? [
              "Selecionar do computador",
              "Select from computer",
              "Carregar capa",
              "Upload cover photo",
            ]
          : ["Selecionar do computador", "Select from computer"],
      );
      backendNodeId = await this.esperar(
        async () => this.chooser,
        "O Instagram não abriu a seleção de arquivo.",
      );
    }
    this.checar();
    await this.wc.debugger.sendCommand("DOM.setFileInputFiles", {
      backendNodeId,
      files,
    });
    this.log(
      tipo === "capa"
        ? "Capa de Tráfego Pago anexada."
        : `${files.length} arquivo(s) anexado(s) na ordem definida.`,
    );
    // Dá tempo para o evento de upload atualizar o editor antes de avançar.
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  async publicar(
    files: string[],
    caption: string,
    capa: string | null,
    antesDeCompartilhar: () => void | Promise<void>,
  ) {
    this.checar();
    const anexouDebugger = !this.wc.debugger.isAttached();
    if (anexouDebugger) this.wc.debugger.attach("1.3");
    this.wc.debugger.on("message", this.onDebugger);
    await this.wc.debugger.sendCommand("Page.enable");
    await this.wc.debugger.sendCommand("Page.setInterceptFileChooserDialog", {
      enabled: true,
    });
    try {
      const dialogoAberto = await this.avaliar<boolean>(
        "return dialogos.length > 0;",
      );
      if (dialogoAberto)
        throw new Error(
          "Feche o editor de publicação ou aviso aberto no Instagram antes de iniciar.",
        );
      await this.clicar([
        "Criar",
        "Create",
        "Nova publicação",
        "New post",
        "Novo post",
        "Nova postagem",
      ]);
      // O "Criar" abre um menu (Postar / Vídeo ao vivo / Anúncio, ou Publicação / Reel).
      const menuAberto = await this.esperar(
        () =>
          this.avaliar<boolean>(
            "const e = botao(['Postar','Publicação','Post']); if (e) {e.click(); return true;} return !!document.querySelector('input[type=file]') || !!botao(['Selecionar do computador','Select from computer']);",
          ),
        "O menu de criação do Instagram não abriu.",
        8_000,
      );
      if (menuAberto) await new Promise((resolve) => setTimeout(resolve, 500));
      await this.esperar(
        () =>
          this.avaliar<boolean>(
            "return !!document.querySelector('input[type=file]') || !!botao(['Selecionar do computador','Select from computer']);",
          ),
        "O editor de nova publicação não abriu.",
      );
      await this.anexar(files, "midia");
      let capaAnexada = !capa;
      let legendaEncontrada = false;
      for (let etapa = 0; etapa < 4; etapa++) {
        await this.esperar(
          () =>
            this.avaliar<boolean>(
              "return !!legenda() || !!botao(['Avançar','Next','Seguinte']);",
            ),
          "O Instagram ainda não terminou de carregar a mídia.",
          120_000,
        );
        if (capa && !capaAnexada) {
          const painelCapa = await this.avaliar<boolean>(
            "return /foto de capa|cover photo|capa do video|cover image/i.test(area.innerText);",
          );
          if (painelCapa) {
            await this.anexar([capa], "capa");
            capaAnexada = true;
          }
        }
        legendaEncontrada = await this.avaliar<boolean>("return !!legenda();");
        if (legendaEncontrada) break;
        const recorte = await this.avaliar<boolean>(
          "const e = botao(['Selecionar corte','Select crop','Selecionar proporção','Select aspect ratio']); if(e){e.click();return true;} return false;",
        );
        if (recorte) await this.clicar(["Original"]);
        await this.clicar(["Avançar", "Next", "Seguinte"]);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      if (!capaAnexada)
        throw new Error(
          "O Instagram não ofereceu o envio da capa do Reels. O vídeo não foi publicado. Confira a janela para selecionar a capa de Tráfego Pago.",
        );
      if (!legendaEncontrada)
        throw new Error(
          "Não encontrei o campo de legenda. A publicação foi interrompida.",
        );
      await this.avaliar(
        "const e = legenda(); e.focus(); if(e.isContentEditable){ const r=document.createRange();r.selectNodeContents(e);const s=window.getSelection();s.removeAllRanges();s.addRange(r); } else { e.select(); } return true;",
      );
      await this.wc.debugger.sendCommand("Input.insertText", { text: caption });
      const texto = await this.avaliar<string>(
        "const e=legenda(); return e?.value ?? e?.innerText ?? '';",
      );
      const limpar = (s: string) =>
        s
          .replace(/\r\n/g, "\n")
          .replace(/\u00a0/g, " ")
          .trim();
      if (limpar(texto) !== limpar(caption))
        throw new Error(
          "A legenda preenchida não corresponde ao TEXTO PRINCIPAL. Não publiquei.",
        );
      this.log("Legenda conferida. Compartilhando no Instagram…");
      await this.esperar(
        () =>
          this.avaliar<boolean>(
            "return !!botao(['Compartilhar','Share','Publicar','Publish']);",
          ),
        "O Instagram não mostrou o botão de compartilhar.",
      );
      await antesDeCompartilhar();
      await this.clicar(["Compartilhar", "Share", "Publicar", "Publish"]);
      await this.esperar(
        () =>
          this.avaliar<boolean>(`
        const t = norm(area.innerText);
        return !legenda() && /sua publicacao foi compartilhada|your post has been shared|your reel has been shared|publicacao compartilhada|reel compartilhado|sua publicacao foi partilhada/.test(t);
      `),
        "O envio foi iniciado, mas o Instagram não confirmou a publicação. Confira o perfil antes de tentar novamente.",
        300_000,
      );
      this.log("Instagram confirmou a publicação.");
      // Fecha somente a confirmação final, nunca um rascunho em andamento.
      await this.avaliar(
        "const e=botao(['Fechar','Close']);if(e)e.click();return true;",
      );
    } finally {
      this.wc.debugger.removeListener("message", this.onDebugger);
      if (!this.wc.isDestroyed() && this.wc.debugger.isAttached()) {
        await this.wc.debugger
          .sendCommand("Page.setInterceptFileChooserDialog", { enabled: false })
          .catch(() => {});
        if (anexouDebugger) this.wc.debugger.detach();
      }
    }
  }
}
