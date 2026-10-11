(() => {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('integrated') !== '1')
    return;
  const targetOrigin = location.protocol === 'file:' ? '*' : location.origin;
  document.documentElement.classList.add('integrated');
  const allowed = ['titulo', 'subtitulo', 'terceiro-titulo', 'valor', 'ano', 'km', 'fuel'];
  window.addEventListener('message', async (event) => {
    if (
      event.source !== window.parent ||
      (location.protocol !== 'file:' && event.origin !== location.origin)
    )
      return;
    if (event.data?.type === 'soul:theme') {
      SoulTheme.apply(event.data.theme);
      return;
    }
    if (event.data?.type === 'soul:instagram-export') {
      const fim = Date.now() + 20000;
      while ((!window.SOUL_PHOTOS_READY || !window.SOUL_VITRINE_READY) && Date.now() < fim)
        await new Promise(resolve => setTimeout(resolve, 100));
      if (!window.SOUL_PHOTOS_READY || !window.SOUL_VITRINE_READY) {
        window.parent.postMessage({ type: 'soul:instagram-export-error', message: 'As fotos ainda não carregaram. Confira a pasta FOTOS e tente novamente.' }, targetOrigin);
        return;
      }
      // eslint-disable-next-line no-undef -- função do editor local
      const pronto = await exportLayouts([6, 4]);
      if (!pronto) window.parent.postMessage({ type: 'soul:instagram-export-error', message: document.querySelector('#status').textContent }, targetOrigin);
      return;
    }
    if (event.data?.type !== 'soul:vehicle' || !event.data.fields) return;
    window.vehiclePaint = typeof event.data.fields.cor === 'string' ? event.data.fields.cor : '';
    for (const key of allowed) {
      if (typeof event.data.fields[key] !== 'string') continue;
      const input = document.querySelector('#editor-form').elements.namedItem(key);
      if (!input) continue;
      input.value = event.data.fields[key];
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    window.dispatchEvent(new Event('resize'));
    window.parent.postMessage(
      { type: 'soul:applied', revision: event.data.revision },
      targetOrigin
    );
  });
  document.addEventListener('soul:exporting', (event) =>
    window.parent.postMessage({ type: 'soul:exporting', value: event.detail }, targetOrigin)
  );
  document.addEventListener('DOMContentLoaded', () => {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'quick-export';
    back.textContent = '← Voltar aos dados';
    back.onclick = () => window.parent.postMessage({ type: 'soul:back' }, targetOrigin);
    document.querySelector('.app-header .brand').replaceWith(back);
    document.querySelector('.intro p:last-child').textContent =
      'Tráfego Pago ou Carrossel. Fotos carregadas do estoque.';
    window.parent.postMessage({ type: 'soul:ready' }, targetOrigin);
  });
})();
