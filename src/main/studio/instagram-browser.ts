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
const comentario = e => /coment|comment/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' '));
// A legenda só existe dentro do editor (diálogo). Sem diálogo, qualquer campo seria o de comentário do feed.
const legenda = () => area === document ? undefined : [...area.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"][aria-label]')].find(e => visivel(e) && !comentario(e) && /caption|legenda/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' '))) || (area === document ? undefined : [...area.querySelectorAll('textarea,[contenteditable="true"][role="textbox"]')].find(e => visivel(e) && !comentario(e)));
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
  /** Clique com mouse de verdade no centro do elemento: menus do Instagram ignoram element.click(). */
  private async cliqueReal(codigoElemento: string): Promise<boolean> {
    const p = await this.avaliar<{ x: number; y: number } | null>(`
      const e = (() => { ${codigoElemento} })();
      if (!e) return null;
      const alvo = e.closest('button,[role="button"],[role="menuitem"],[tabindex]') || e;
      alvo.scrollIntoView({block:'nearest'});
      const r = alvo.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    `);
    if (!p) return false;
    this.wc.sendInputEvent({ type: "mouseMove", x: p.x, y: p.y });
    this.wc.sendInputEvent({
      type: "mouseDown",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
    });
    this.wc.sendInputEvent({
      type: "mouseUp",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
    });
    return true;
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
      return elegiveis.filter(e => dialogo?.contains(e)).at(-1) || ${tipo === "capa" ? "null" : "elegiveis.at(-1)"} || null;
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
              "Selecionar da galeria",
              "Select from gallery",
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
        // Registra a tela atual para diagnosticar mudanças no fluxo do Instagram.
        const tela = await this.avaliar<string[]>(
          "return [...new Set([...area.querySelectorAll('*')].filter(e => visivel(e) && !e.children.length).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(t => t && t.length < 30))].slice(0, 14);",
        ).catch(() => [] as string[]);
        this.log(`Tela ${etapa + 1}: ${tela.join(" | ")}`);
        if (capa && !capaAnexada) {
          const painelCapa = await this.avaliar<boolean>(
            `const t = norm(area.innerText);
            return /foto d[ae] capa|cover photo|capa do video|cover image|\bcapa\b|\bcover\b/.test(t)
              || !!botao(['Selecionar da galeria','Select from gallery','Carregar capa','Upload cover photo']);`,
          );
          if (painelCapa) {
            await this.anexar([capa], "capa");
            capaAnexada = true;
          }
        }
        legendaEncontrada = await this.avaliar<boolean>("return !!legenda();");
        if (legendaEncontrada) break;
        const recorte = await this.cliqueReal(
          "return botao(['Selecionar corte','Select crop','Selecionar proporção','Select aspect ratio']);",
        );
        this.log(
          recorte
            ? "Botão de corte encontrado; escolhendo “Original”."
            : "Botão de corte não encontrado nesta tela.",
        );
        // O carrossel deve sair em tamanho real: sem "Original", não publica cortado em 1:1.
        if (recorte) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          const original = await this.esperar(
            () =>
              this.cliqueReal(
                "return botao(['Original']) || [...area.querySelectorAll('*')].find(x => visivel(x) && (norm(x.getAttribute('aria-label')) === 'original' || (!x.children.length && norm(x.textContent) === 'original')));",
              ),
            "",
            6_000,
          ).catch(() => false);
          if (!original) {
            const textos = await this.avaliar<string[]>(
              "return [...new Set([...area.querySelectorAll('*')].filter(e => visivel(e) && !e.children.length).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(t => t && t.length < 40))].slice(0, 50);",
            ).catch(() => [] as string[]);
            this.log(`Itens visíveis no corte: ${textos.join(" | ")}`);
            throw new Error(
              `Não consegui selecionar o corte “Original” (tamanho real). Não publiquei. Itens visíveis: ${textos.join(" | ")}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        await this.clicar(["Avançar", "Next", "Seguinte"]);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      if (!capaAnexada) {
        const textos = await this.avaliar<string[]>(
          "return [...new Set([...area.querySelectorAll('*')].filter(e => visivel(e) && !e.children.length).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(t => t && t.length < 40))].slice(0, 50);",
        ).catch(() => [] as string[]);
        throw new Error(
          `O Instagram não ofereceu o envio da capa do Reels. O vídeo não foi publicado. Itens visíveis: ${textos.join(" | ")}`,
        );
      }
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
            "return area !== document && !!botao(['Compartilhar','Share','Publicar','Publish']);",
          ),
        "O Instagram não mostrou o botão de compartilhar.",
      );
      await antesDeCompartilhar();
      await this.clicar(["Compartilhar", "Share", "Publicar", "Publish"]);
      await this.esperar(
        () =>
          this.avaliar<boolean>(`
        const t = norm(area.innerText);
        return !legenda() && /sua publicacao foi compartilhada|your post has been shared|your reel has been shared|publicacao compartilhada|seu post foi compartilhado|seu reel foi compartilhado|post compartilhado|reel compartilhado|reel compartilhado|sua publicacao foi partilhada/.test(t);
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
