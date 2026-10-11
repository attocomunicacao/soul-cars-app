/* Ponte com o SOUL Cars Studio (app desktop). Ativa só com ?app=1.
   - Avisa o app de cada foto enviada (para salvar no veículo).
   - Recebe fotos salvas e as carrega no editor.
   - Troca o download do navegador por gravação direta em disco feita pelo app. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (window.parent === window || params.get('app') !== '1') return;
  const origin = location.origin;
  const targetOrigin = location.protocol === 'file:' ? '*' : origin;
  // O editor usa isso para gravar cada layout direto na pasta CRIATIVO, sem ZIP.
  window.SOUL_APP = true;
  const post = (data) => window.parent.postMessage(data, targetOrigin);
  let restoring = false;
  window.SOUL_PHOTOS_READY = false;
  window.SOUL_VITRINE_READY = false;
  function informarLayout() {
    post({ type: 'soul:layout', layout: document.querySelector('[data-layout][aria-selected="true"]')?.dataset.layout ?? '4' });
  }
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-layout]')) queueMicrotask(informarLayout);
  });

  function slotOf(target) {
    const card = target.closest?.('[data-slot]');
    if (card) return card.dataset.slot;
    if (target.id === 'original-upload') return 'original';
    return null;
  }

  function report(slot, file) {
    if (restoring || !slot || !file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
    post({ type: 'soul:photo', slot, file });
  }

  // Fase de captura: roda antes dos handlers do editor limparem o <input>.
  document.addEventListener(
    'change',
    (event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.type === 'file' && input.files?.[0])
        report(slotOf(input), input.files[0]);
    },
    true
  );
  document.addEventListener(
    'drop',
    (event) => report(slotOf(event.target), event.dataTransfer?.files?.[0]),
    true
  );
  document.addEventListener(
    'paste',
    (event) => {
      const item = [...(event.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      // eslint-disable-next-line no-undef -- `activeSlot` é global (let) do script.js
      if (item) report(typeof activeSlot === 'string' ? activeSlot : 'main', item.getAsFile());
    },
    true
  );

  // Exportação: intercepta o <a download> gerado pelo editor.
  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('blob:')) {
      const name = this.download;
      fetch(this.href)
        .then((r) => r.blob())
        .then((blob) => post({ type: 'soul:export', name, blob }));
      return;
    }
    return nativeClick.call(this);
  };

  // ---- Ajustes do editor (salvos por veículo no app) ----
  // Controles simples: luz e cor, carrossel e resolução. Textos vêm da ficha e
  // não entram aqui. Sombra/pneus e piso/pincel têm snapshot próprio nos módulos.
  const CONTROLES = 'input[type="range"], input[type="checkbox"], select, input[data-ajuste]';
  const chave = (el) => el.id || el.name || el.getAttribute('aria-label');
  const simples = () =>
    [...document.querySelectorAll(CONTROLES)].filter((el) => chave(el) && !el.closest('.grounding-controls'));

  function capturar() {
    const controles = {};
    for (const el of simples()) controles[chave(el)] = el.type === 'checkbox' ? el.checked : el.value;
    return {
      versao: 1,
      layout: document.querySelector('[data-layout][aria-selected="true"]')?.dataset.layout ?? '4',
      controles,
      sombra: window.CarGrounding.snapshot?.(),
      piso: window.OriginalFloor.snapshot?.()
    };
  }

  function aplicar(ajustes) {
    if (!ajustes || ajustes.versao !== 1) return;
    for (const el of simples()) {
      const valor = ajustes.controles?.[chave(el)];
      if (valor === undefined) continue;
      if (el.type === 'checkbox') el.checked = Boolean(valor);
      else el.value = String(valor);
      el.dispatchEvent(new Event(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', { bubbles: true }));
      if (el.tagName !== 'SELECT' && el.type !== 'checkbox') el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    window.CarGrounding.restore?.(ajustes.sombra);
    window.OriginalFloor.restore?.(ajustes.piso);
    window.Layouts.choose(Number(ajustes.layout) === 6 ? 6 : 4);
    window.Layout6?.sync();
  }

  let salvarTimer = 0;
  function agendarSalvar() {
    if (restoring) return;
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(() => {
      if (!restoring) post({ type: 'soul:ajustes', ajustes: capturar() });
    }, 700);
  }
  for (const tipo of ['input', 'change', 'click', 'pointerup'])
    document.addEventListener(tipo, agendarSalvar, true);

  window.addEventListener('message', async (event) => {
    if (event.source !== window.parent || (location.protocol !== 'file:' && event.origin !== origin)) return;
    const data = event.data;
    if (data?.type === 'soul:photos') {
      window.SOUL_PHOTOS_READY = false;
      restoring = true;
      try {
        for (const { slot, file } of data.photos) {
          if (slot === 'original') {
            window.OriginalFloor.load(file);
            await window.OriginalFloor.ready().catch(() => {});
                            window.Layout6?.sync();
          } else {
            // eslint-disable-next-line no-undef -- função global do script.js
            if (slot === 'main') queueImage(slot, file);
          }
        }
        // eslint-disable-next-line no-undef
        await Promise.all([...pending.values()]);
        await window.OriginalFloor.ready().catch(() => {});
                window.Layout6?.sync();
        // Ajustes só depois das fotos: carregar foto recalcula pneus e zera o piso.
        if (data.ajustes) aplicar(data.ajustes);
      } finally {
        restoring = false;
        window.SOUL_PHOTOS_READY = true;
        informarLayout();
      }
      // Foto nova sem ajustes (ex.: recorte automático): salva a estimativa recalculada.
      if (!data.ajustes && data.photos.length) agendarSalvar();
    } else if (data?.type === 'soul:vitrine-photos') {
      window.SOUL_VITRINE_READY = false;
      try { await window.Layout6?.loadPhotos(data.photos || []); }
      finally { window.SOUL_VITRINE_READY = true; }
    } else if (data?.type === 'soul:vitrine-cropping') {
      window.Layout6?.setCropping(Boolean(data.active));
    } else if (data?.type === 'soul:aplicar-ajustes') {
      restoring = true;
      try {
        aplicar(data.ajustes);
      } finally {
        restoring = false;
        informarLayout();
      }
    } else if (data?.type === 'soul:export-result') {
      const status = document.querySelector('#status');
      status.textContent = data.message;
      status.classList.toggle('error', !data.ok);
    }
  });
})();
