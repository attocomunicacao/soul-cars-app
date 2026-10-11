'use strict';
window.Layout4 = (() => {
  const root = document.createElement('article');
  root.id = 'creative4';
  root.hidden = true;
  root.setAttribute('role', 'tabpanel');
  root.setAttribute('aria-labelledby', 'tab-layout4');
  const star =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 3.2 7 7.8 1-5.7 5.4 1.5 7.6-6.8-3.8L5.2 22l1.5-7.6L1 9l7.8-1Z"/></svg>';
  root.innerHTML = `<div class="g-lights"></div><div class="g-floor"></div>
    <div class="g-header"><i></i>${star}<span>CARROS COM ALMA</span>${star}<i></i></div>
    <h2 class="g-title g-fit" data-max="140" data-min="42"></h2>
    <p class="g-subtitle g-fit" data-max="44" data-min="28"></p><p class="g-price g-fit" data-max="180" data-min="115"></p>
    <div class="g-car"><img data-mirror="ground-reflection" class="g-layer" alt="" hidden><img data-mirror="ground-shadow" class="g-layer" alt="" hidden><img data-mirror="original-floor" class="g-layer" alt="" hidden><img data-mirror="image-main" class="g-main" alt="" hidden></div>
    <div class="g-cards"><div class="g-card"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="M25 23v34m15-34v34m15-34v17H25"/></svg><div><span>CÂMBIO</span><b class="g-gear g-cardfit"></b></div></div>
    <div class="g-card"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="M23 59V21h27v38M20 59h33M23 34h27m0-10 9 8v20c0 7 8 7 8 0V32l-9-9"/></svg><div><span>COMBUSTÍVEL</span><b class="g-fuel g-cardfit"></b></div></div></div>
    <p class="g-slogan">Qualidade, procedência e <strong>confiança</strong> em cada detalhe.</p>
    <div class="g-cta"><div class="g-phone"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="M12 68l4-16a29 29 0 1 1 12 12Zm18-47c-10 9 8 30 21 32l7-9-10-6-5 5c-5-2-8-6-10-10l4-4Z"/></svg></div><span>FALE AGORA COM UM <strong>ESPECIALISTA</strong></span></div>
    <div class="g-footer"><i></i><div><b>SOUL CARS</b><span>MULTIMARCAS</span></div><i></i></div>`;
  document.querySelector('#preview-scale').append(root);
  const controls = document.createElement('fieldset');
  controls.className = 'g-controls';
  controls.innerHTML =
    '<legend><span>01</span> Tráfego Pago</legend><label>Combustível<input name="fuel" value="FLEX"></label><p class="field-hint">Foto principal com fundo branco de estúdio.</p>';
  document.querySelector('#editor-form').append(controls);
  controls.addEventListener('input', sync);
  for (const [name, label, min, max, initial] of [
    ['brightness', 'Brilho', 85, 120, 104],
    ['contrast', 'Contraste', 85, 125, 106],
    ['saturation', 'Saturação', 70, 120, 94]
  ]) {
    const labelEl = document.createElement('label');
    labelEl.textContent = label + ' ';
    const output = document.createElement('output');
    const input = document.createElement('input');
    input.type = 'range';
    input.name = 'gold-' + name;
    input.min = min;
    input.max = max;
    input.value = initial;
    input.dataset.initial = initial;
    labelEl.append(output, input);
    controls.append(labelEl);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Restaurar luz e cor';
  reset.addEventListener('click', () => {
    controls
      .querySelectorAll('input[type=range]')
      .forEach((input) => (input.value = input.dataset.initial));
    sync();
  });
  controls.append(reset);
  let boundsKey = '',
    bounds = null;
  function carBounds(image) {
    if (!image.naturalWidth) return { x: 105, y: 880, w: 870, h: 650 };
    if (boundsKey === image.src && bounds) return bounds;
    const canvas = document.createElement('canvas');
    canvas.width = 870;
    canvas.height = 650;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const s = Math.min(870 / image.naturalWidth, 650 / image.naturalHeight),
      w = image.naturalWidth * s,
      h = image.naturalHeight * s;
    ctx.drawImage(image, (870 - w) / 2, 650 - h, w, h);
    let left = 870,
      top = 650,
      right = -1,
      bottom = -1;
    const pixels = ctx.getImageData(0, 0, 870, 650).data;
    for (let y = 0; y < 650; y++)
      for (let x = 0; x < 870; x++)
        if (pixels[(y * 870 + x) * 4 + 3] > 40) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    bounds =
      right < 0
        ? { x: 105, y: 880, w: 870, h: 650 }
        : { x: 105 + left, y: 880 + top, w: right - left + 1, h: bottom - top + 1 };
    boundsKey = image.src;
    return bounds;
  }
  const value = (key) => document.querySelector(`[name="${key}"]`).value.trim();
  function fit(el) {
    for (let size = Number(el.dataset.max); size >= Number(el.dataset.min); size--) {
      el.style.fontSize = size + 'px';
      if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) break;
    }
  }
  function sync() {
    const hidden = root.hidden;
    if (hidden) {
      root.style.visibility = 'hidden';
      root.hidden = false;
    }
    for (const target of root.querySelectorAll('[data-mirror]')) {
      const source = document.getElementById(target.dataset.mirror);
      target.hidden = source.hidden || !source.getAttribute('src');
      if (source.getAttribute('src') && target.getAttribute('src') !== source.getAttribute('src'))
        target.src = source.src;
    }
    root.querySelector('.g-title').textContent = value('titulo')
      .toUpperCase()
      .replace(/\b(?:19|20)\d{2}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    controls.querySelectorAll('input[type=range]').forEach((input) => {
      root.style.setProperty('--' + input.name, Number(input.value) / 100);
      input.previousElementSibling.textContent = input.value + '%';
    });
    root.querySelector('.g-subtitle').textContent =
      `${value('subtitulo')} ${value('terceiro-titulo')} ${value('ano').replace(/^ANO\s*/i, '')}`;
    const raw = value('valor').replace(/^R\$\s*/i, '');
    const pieces = raw.split(',');
    const price = root.querySelector('.g-price');
    price.replaceChildren();
    for (const [cls, text] of [
      ['g-currency', 'R$'],
      ['g-integer', pieces[0]],
      ['g-cents', ',' + (pieces.length > 1 ? pieces.slice(1).join(',') : '00')]
    ]) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      price.append(span);
    }
    root.querySelector('.g-gear').textContent = value('terceiro-titulo');
    root.querySelector('.g-fuel').textContent = value('fuel');
    const image = document.querySelector('#image-main');
    const b = carBounds(image),
      s = Math.min(1010 / b.w, 690 / b.h);
    root.querySelector('.g-car').style.transform =
      `translate(${540 - (b.x + b.w / 2) * s}px,${1325 - (b.y + b.h) * s}px) scale(${s})`;
    root.querySelectorAll('.g-fit').forEach(fit);
    root.querySelectorAll('.g-cardfit').forEach((el) => {
      el.dataset.max = '42';
      el.dataset.min = '24';
      fit(el);
    });
    if (hidden) {
      root.hidden = true;
      root.style.visibility = '';
    }
  }
  async function ready() {
    await Promise.all([300,400,600].map(weight => document.fonts.load(`${weight} 185px "Barlow Condensed"`)));
    await document.fonts.ready;
    sync();
    if (!value('fuel')) throw Error('Layout Gold: preencha o combustível.');
    await Promise.all(
      [...root.querySelectorAll('img:not([hidden])')].map((image) => image.decode())
    );
  }
  function errors() {
    const hidden = root.hidden;
    if (hidden) {
      root.style.visibility = 'hidden';
      root.hidden = false;
    }
    const bad = [...root.querySelectorAll('.g-fit,.g-cardfit')].some(
      (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
    );
    if (hidden) {
      root.hidden = true;
      root.style.visibility = '';
    }
    return bad;
  }
  return { sync, ready, errors };
})();
