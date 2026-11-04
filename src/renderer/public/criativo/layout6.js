'use strict';
/* Layout 06 · Carrossel — 1080 × 1350.
   Reprodução da peça de referência da Soul Cars: friso preto com quatro filetes
   dourados, modelo em cobre metálico com o ano em preto ao lado, três trapézios
   técnicos (preço · combustível · câmbio), foto frontal em estúdio e rodapé
   geométrico com contatos e logotipo. */
window.Layout6 = (() => {
  const LARGURA = 1080;
  const ALTURA = 1350;
  const ALTURA_FOTO = 619;

  const icone = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const WHATSAPP = icone(
    '<path d="M12 2.9a9.1 9.1 0 0 0-7.8 13.8L3 21l4.4-1.2A9.1 9.1 0 1 0 12 2.9Z"/>' +
      '<path d="M8.9 7.6c.3 0 .5.1.7.5l.7 1.6c.1.3.1.5-.1.8l-.5.6c-.2.2-.2.4-.1.6.5 1 1.6 2 2.6 2.5.2.1.4.1.6-.1l.6-.6c.2-.2.5-.3.8-.2l1.6.7c.3.2.5.4.5.7 0 1-.8 1.8-1.8 1.8-3.2 0-6.9-3.7-6.9-6.9 0-1 .8-1.8 1.3-2Z"/>'
  );
  const INSTAGRAM = icone(
    '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/>' +
      '<circle cx="12" cy="12" r="4.1"/><circle cx="17.1" cy="6.9" r="1.05" fill="#96704d" stroke="none"/>'
  );
  const SITE = icone(
    '<circle cx="12" cy="12" r="9"/><path d="M3.2 12h17.6"/>' +
      '<path d="M12 3c2.4 2.5 3.6 5.6 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.6-3.6-9S9.6 5.5 12 3Z"/>'
  );

  const root = document.createElement('article');
  root.id = 'creative6';
  root.hidden = true;
  root.setAttribute('role', 'tabpanel');
  root.setAttribute('aria-labelledby', 'tab-layout6');
  root.innerHTML = `
    <div class="v-head">
      <h2 class="v-model v-fit" data-max="215" data-min="88"><span class="v-it"></span></h2>
      <p class="v-year v-fit" data-max="215" data-min="88"><span class="v-it"></span></p>
      <p class="v-version v-fit" data-max="62" data-min="26"><span class="v-it"></span></p>
      <div class="v-extra"><i class="v-dot"></i><b><span class="v-it"></span></b></div>
    </div>
    <div class="v-top">
      <i class="v-stripe" style="left:600px"></i><i class="v-stripe" style="left:624px"></i>
      <i class="v-stripe" style="left:648px"></i><i class="v-stripe" style="left:672px"></i>
    </div>
    <div class="v-cards">
      <div class="v-card v-card-price"></div>
      <div class="v-card v-card-fuel"></div>
      <div class="v-card v-card-gear"></div>
      <p class="v-label v-price-label">VALOR À VISTA</p>
      <i class="v-price-rule"></i>
      <p class="v-value v-price v-fit" data-max="76" data-min="36"><span class="v-it"></span></p>
      <p class="v-label v-fuel-label">COMBUSTÍVEL</p>
      <p class="v-value v-fuel v-fit" data-max="98" data-min="34"><span class="v-it"></span></p>
      <p class="v-label v-gear-label">CÂMBIO</p>
      <i class="v-gear-rule"></i>
      <p class="v-value v-gear v-fit" data-max="76" data-min="28"><span class="v-it"></span></p>
    </div>
    <div class="v-photo">
      <img class="v-original-floor v-layer" alt="" hidden><img class="v-shadow v-layer" alt="" hidden>
      <div class="v-car"><img data-mirror="image-main" alt="" hidden></div>
    </div>
    <div class="v-foot">
      <div class="v-copper"></div><div class="v-copper-edge"></div><div class="v-black"></div>
      <p class="v-contact v-c1">${WHATSAPP}<span></span></p>
      <p class="v-contact v-c2">${INSTAGRAM}<span></span></p>
      <p class="v-contact v-c3">${SITE}<span></span></p>
      <div class="v-logo">
        <div class="v-mark"><img src="assets/logo-soul.png" alt="Soul Cars"></div>
        <div class="v-word"><img src="assets/logo-soul.png" alt=""></div>
      </div>
    </div>`;
  document.querySelector('#preview-scale').append(root);

  // Campos que não existem na ficha do veículo: diferencial verificado e contatos da loja.
  // data-ajuste faz o app guardar estes valores junto dos demais ajustes do veículo.
  const extras = document.createElement('fieldset');
  extras.className = 'v-inputs';
  extras.innerHTML =
    '<legend><span>02</span> Carrossel</legend>' +
    '<p class="field-hint">Três peças em 1080 × 1350, com as fotos 1, 2 e 4 em PNG sem fundo. A sombra e o piso acompanham cada carro.</p>' +
    '<label>Diferencial <span class="muted">(opcional, só o que for verdadeiro)</span>' +
    '<input name="v-diferencial" data-ajuste placeholder="COM TETO SOLAR" autocomplete="off"></label>' +
    '<label>WhatsApp<input name="v-telefone" data-ajuste value="11 96595-2083" autocomplete="off"></label>' +
    '<div class="field-row">' +
    '<label>Instagram<input name="v-instagram" data-ajuste value="@soulcarsveiculos" autocomplete="off"></label>' +
    '<label>Site<input name="v-site" data-ajuste value="soulcars.com.br" autocomplete="off"></label>' +
    '</div>' +
    '<details class="v-studio-controls"><summary>Sombra e piso</summary>' +
    '<p class="field-hint">Cada peça usa o piso real da foto original de mesma numeração (1, 2 e 4). Sem a foto original, aplica só a sombra de chão.</p>' +
    '<label>Sombra no piso<input name="v-sombra" data-ajuste type="range" min="0" max="100" value="68" aria-label="Sombra no piso da Carrossel"></label>' +
    '<label>Suavidade da sombra<input name="v-suavidade" data-ajuste type="range" min="0" max="100" value="55" aria-label="Suavidade da sombra da Carrossel"></label>' +
    '</details>';
  document.querySelector('#editor-form').append(extras);
  extras.addEventListener('input', sync);
  extras.addEventListener('change', sync);

  const slides = [1, 2, 4].map((numero) => ({ numero, image: null, version: 0 }));
  const slideJobs = new Map();
  let slideIndex = 0;
  const carousel = document.createElement('div');
  carousel.className = 'v-carousel-controls';
  carousel.innerHTML = '<p class="field-hint">Carrossel com 3 peças · fotos 1, 2 e 4. Cada peça mantém os dados e o estúdio, trocando a foto do veículo.</p>' +
    '<div class="v-carousel-grid">' + slides.map((slide, index) =>
      `<div class="v-carousel-card"><button type="button" data-v-slide="${index}" aria-pressed="${index === 0}"><img alt="Foto ${slide.numero} do carrossel" hidden><span>Peça ${index + 1} · foto ${slide.numero}</span></button><label>Escolher PNG<input type="file" accept="image/png" data-v-upload="${index}" aria-label="PNG da foto ${slide.numero} da Carrossel"></label><label>Foto original para piso<input type="file" accept="image/jpeg,image/png,image/webp" data-v-original="${index}" aria-label="Foto original ${slide.numero} da Carrossel"></label></div>`
    ).join('') + '</div>' +
    '<label>Peça em edição<select name="v-slide" data-ajuste>' + slides.map((slide, index) => `<option value="${index}">Peça ${index + 1} · foto ${slide.numero}</option>`).join('') + '</select></label>' +
    '<button type="button" class="v-crop-carousel">Recortar fotos 1, 2 e 4 da pasta</button>' +
    '<p class="field-hint v-carousel-status" aria-live="polite">Carregue os três PNGs para exportar o carrossel.</p>';
  extras.insertBefore(carousel, extras.querySelector('.v-studio-controls'));
  carousel.querySelectorAll('.v-carousel-card').forEach((card, index) => {
    const label = document.createElement('label');
    label.hidden = true;
    label.innerHTML = `<input type="hidden" name="v-apoios-${index}" data-ajuste value="">`;
    card.append(label);
  });
  const slideSelect = carousel.querySelector('[name="v-slide"]');
  const previewNav = document.createElement('nav');
  previewNav.className = 'v-preview-nav';
  previewNav.hidden = true;
  previewNav.setAttribute('aria-label', 'Visualizar peças da Carrossel');
  previewNav.innerHTML = '<span>Carrossel</span>' + slides.map((slide, index) =>
    `<button type="button" data-v-preview="${index}" aria-pressed="${index === 0}">Peça ${index + 1}<small>Foto ${slide.numero}</small></button>`
  ).join('');
  document.querySelector('#preview-stage').before(previewNav);
  previewNav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    selectSlide(button.dataset.vPreview);
    slideSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  function selectSlide(index, forExport = false) {
    if (!forExport && typeof exporting !== 'undefined' && exporting) return;
    slideIndex = Math.max(0, Math.min(2, Number(index) || 0));
    slideSelect.value = String(slideIndex);
    carousel.querySelectorAll('[data-v-slide]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.vSlide) === slideIndex)));
    root.dataset.slide = String(slideIndex + 1);
    previewNav.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.vPreview) === slideIndex)));
    sync();
  }
  carousel.querySelectorAll('[data-v-slide]').forEach((button) => button.addEventListener('click', () => selectSlide(button.dataset.vSlide)));
  slideSelect.addEventListener('change', () => selectSlide(slideSelect.value));
  function loadSlide(index, file, restoring = false) {
    const slide = slides[index];
    if (!slide || !file || (typeof exporting !== 'undefined' && exporting)) return Promise.resolve();
    const version = ++slide.version;
    const job = (async () => {
      if (file.type !== 'image/png' || file.size > 30 * 1024 * 1024) throw Error('Use um PNG sem fundo de até 30 MB.');
      const image = new Image();
      image.src = await readFile(file);
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 50000000) throw Error('A foto excede 50 megapixels.');
      if (!hasTransparency(image) || !caixaOpaca(image)) throw Error('A foto do carrossel precisa ter o carro recortado e fundo transparente.');
      if (version !== slide.version) return;
      slide.image = image;
      if (!restoring) {
        slide.original = null;
        extras.querySelector(`[name="v-apoios-${index}"]`).value = '';
      }
      const thumb = carousel.querySelector(`[data-v-slide="${index}"] img`);
      thumb.src = image.src;
      thumb.hidden = false;
      carousel.querySelector('.v-carousel-status').textContent = `${slides.filter((s) => s.image).length} de 3 fotos prontas. Exportar Carrossel gera as três peças.`;
      if (!restoring && window.SOUL_APP) window.parent.postMessage({ type: 'soul:vitrine-photo', numero: slide.numero, file }, location.origin);
      sync();
    })().catch((error) => {
      carousel.querySelector('.v-carousel-status').textContent = error.message;
      throw error;
    }).finally(() => { if (version === slide.version) slideJobs.delete(index); });
    slideJobs.set(index, job);
    return job;
  }
  carousel.querySelectorAll('[data-v-upload]').forEach((input) => input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    loadSlide(Number(input.dataset.vUpload), file).catch(() => {});
  }));
  const cropButton = carousel.querySelector('.v-crop-carousel');
  cropButton.hidden = !new URLSearchParams(location.search).has('app');
  cropButton.addEventListener('click', () => {
    cropButton.disabled = true;
    window.parent.postMessage({ type: 'soul:vitrine-crop' }, location.origin);
  });
  async function loadOriginal(index, file) {
    if (!file || !slides[index]) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 30 * 1024 * 1024) throw Error('Use uma foto original JPG, PNG ou WebP de até 30 MB.');
    const image = new Image();
    image.src = await readFile(file);
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 50000000) throw Error('A foto excede 50 megapixels.');
    slides[index].original = image;
    studioKey = '';
    sync();
  }
  carousel.querySelectorAll('[data-v-original]').forEach((input) => input.addEventListener('change', () => {
    const job = loadOriginal(Number(input.dataset.vOriginal), input.files?.[0]).catch((error) => { carousel.querySelector('.v-carousel-status').textContent = error.message; });
    slideJobs.set(`original-${input.dataset.vOriginal}`, job);
    input.value = '';
  }));
  async function loadPhotos(photos) {
    await Promise.allSettled(photos.map(async ({ numero, file, original }) => {
      const index = slides.findIndex((s) => s.numero === numero);
      await loadSlide(index, file, true);
      await loadOriginal(index, original);
    }));
    sync();
  }
  function validateCarousel() {
    if (slides.some((s) => !s.image)) throw Error('Carrossel: carregue os recortes das fotos 1, 2 e 4 para exportar as três peças.');
  }

  // A caixa opaca só pode ser medida com a foto decodificada.
  root.querySelector('.v-car img').addEventListener('load', () => sync());

  const value = (key) => document.querySelector(`[name="${key}"]`)?.value.trim() ?? '';

  /** Largura útil da caixa. O itálico real já entra na largura de layout; sobra só o
   *  avanço dos 3° de skew, daí a folga pequena.
   *  (scrollWidth não serve aqui: ele já inclui o avanço da transformação.) */
  const limiteDe = (el) =>
    (el.dataset.limite ? +el.dataset.limite : el.clientWidth) - Math.round(el.clientHeight * 0.03);

  const cabe = (el) => (el.querySelector('.v-it') ?? el).offsetWidth <= limiteDe(el);

  /** Reduz a fonte até o texto caber na caixa. */
  function fit(el) {
    for (let size = +el.dataset.max; size >= +el.dataset.min; size--) {
      el.style.fontSize = size + 'px';
      if (cabe(el)) break;
    }
  }

  /** Caixa opaca do recorte, em pixels da foto. O PNG sem fundo costuma ter margem
   *  transparente em volta; sem isso o carro sairia pequeno e solto no meio da faixa. */
  const caixas = new Map();
  function caixaOpaca(img) {
    const chave = img.currentSrc || img.src;
    if (caixas.has(chave)) return caixas.get(chave);
    let caixa = null;
    try {
      const escala = Math.min(1, 320 / img.naturalWidth);
      const l = Math.max(1, Math.round(img.naturalWidth * escala));
      const a = Math.max(1, Math.round(img.naturalHeight * escala));
      const tela = document.createElement('canvas');
      tela.width = l;
      tela.height = a;
      const ctx = tela.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, l, a);
      const alfa = ctx.getImageData(0, 0, l, a).data;
      const bottom = new Array(l).fill(-1);
      let x0 = l, y0 = a, x1 = -1, y1 = -1;
      for (let y = 0; y < a; y++)
        for (let x = 0; x < l; x++)
          // Só o corpo sólido define a caixa: a sombra residual semitransparente do
          // PNG não pode encolher o carro em relação às outras peças.
          if (alfa[(y * l + x) * 4 + 3] > 160) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            bottom[x] = y;
          }
      if (x1 >= x0 && y1 >= y0)
        caixa = { x: x0 / escala, y: y0 / escala, largura: (x1 - x0 + 1) / escala, altura: (y1 - y0 + 1) / escala };
      if (caixa) {
        // Pneus formam mínimos locais no contorno, inclusive quando a roda
        // traseira está mais alta pela perspectiva. Uma divisão ao meio erra
        // este caso e confunde o para-choque com o segundo pneu.
        const smooth = bottom.map((_, x) => {
          const values = bottom.slice(Math.max(0, x - 2), x + 3).sort((a, b) => a - b);
          return values[Math.floor(values.length / 2)];
        });
        const radius = Math.max(4, Math.round((x1 - x0) * 0.09));
        const candidates = [];
        for (let x = x0; x <= x1; x++) {
          const base = smooth[x];
          if (base < y0 + (y1 - y0) * 0.52 || base < Math.max(...smooth.slice(Math.max(x0, x - 4), x + 5))) continue;
          const left = Math.min(...smooth.slice(Math.max(x0, x - radius), x + 1));
          const right = Math.min(...smooth.slice(x, Math.min(x1 + 1, x + radius + 1)));
          const prominence = base - Math.max(left, right);
          if (prominence >= 2) candidates.push({ x, y: base, prominence });
        }
        candidates.sort((a, b) => b.prominence - a.prominence || b.y - a.y);
        const picked = [];
        for (const candidate of candidates) {
          if (picked.every((p) => Math.abs(p.x - candidate.x) > (x1 - x0) * 0.23)) {
            // Centro da região de contato em vez da primeira coluna do pneu.
            const near = candidates.filter((p) => Math.abs(p.x - candidate.x) < radius && Math.abs(p.y - candidate.y) <= 2);
            picked.push({ x: near.reduce((sum, p) => sum + p.x, 0) / near.length, y: candidate.y });
          }
          if (picked.length === 2) break;
        }
        if (picked.length === 2) caixa.contacts = picked.sort((a, b) => a.x - b.x).map((p) => ({ x: p.x / escala, y: p.y / escala }));
        else {
          // Na vista frontal o para-choque une os mínimos dos pneus. Procura
          // o contato nas faixas externas, usando alfa sólido: a sombra residual
          // semitransparente do PNG não pode definir a altura do chão.
          const contatoFrontal = (inicio, fim) => {
            const colunas = [];
            for (let x = Math.ceil(x0 + (x1 - x0) * inicio); x <= x0 + (x1 - x0) * fim; x++)
              if (bottom[x] >= y0 + (y1 - y0) * 0.6) colunas.push({ x, y: bottom[x] });
            if (!colunas.length) return null;
            const base = Math.max(...colunas.map((p) => p.y));
            const apoio = colunas.filter((p) => p.y >= base - 2);
            return { x: apoio.reduce((s, p) => s + p.x, 0) / apoio.length / escala, y: base / escala };
          };
          const frontais = [contatoFrontal(0.02, 0.10), contatoFrontal(0.90, 0.98)];
          if (frontais.every(Boolean)) caixa.contacts = frontais;
        }
      }
    } catch {
      caixa = null; // foto de outra origem: segue o enquadramento simples
    }
    caixas.set(chave, caixa);
    return caixa;
  }

  /** Encaixa o recorte na faixa: largura de ~65%, apoiado no piso, com a sombra
   *  de contato exatamente sob os pneus. */
  function enquadrar(hero) {
    const alvo = hero.parentElement; // .v-car
    const caixa = hero.naturalWidth ? caixaOpaca(hero) : null;
    if (!caixa) {
      hero.style.cssText = '';
      return null;
    }
    const LARGURA_ALVO = 860;
    const ALTURA_ALVO = 579;
    const k = Math.min(LARGURA_ALVO / caixa.largura, ALTURA_ALVO / caixa.altura);
    Object.assign(hero.style, {
      width: `${hero.naturalWidth * k}px`,
      height: `${hero.naturalHeight * k}px`,
      objectFit: 'fill',
      left: `${(alvo.offsetWidth - caixa.largura * k) / 2 - caixa.x * k}px`,
      top: `${alvo.offsetHeight - (caixa.y + caixa.altura) * k}px`
    });
    return {
      x: (LARGURA - alvo.offsetWidth) / 2 + parseFloat(hero.style.left),
      y: alvo.offsetTop + parseFloat(hero.style.top),
      width: hero.naturalWidth * k,
      height: hero.naturalHeight * k,
      scale: k,
      bounds: caixa
    };
  }

  // Mesma lógica do Tráfego pago: o recorte (PNG) fica sobre o piso real da foto
  // original da mesma numeração, recortado por uma máscara elíptica suave. Sem a
  // foto original, só a sombra de chão do CarGrounding. Nada de brilho ou contorno.
  let studioKey = '';
  function studioLayers(hero, geometry) {
    const shadowImg = root.querySelector('.v-shadow');
    const originalFloor = root.querySelector('.v-original-floor');
    if (!geometry) {
      originalFloor.hidden = true;
      shadowImg.hidden = true;
      studioKey = '';
      return;
    }
    const scale = Math.max(1, Math.min(3, window.renderScale || 1));
    const [strength, softness] = ['v-sombra', 'v-suavidade'].map((name) => Number(value(name)) / 100);
    const usesMain = hero.src === document.querySelector('#image-main').src;
    const grounding = usesMain ? window.CarGrounding?.snapshot?.() : null;
    const original = slides[slideIndex].original ?? (usesMain ? window.OriginalFloor?.source : null);
    const key = JSON.stringify([hero.src, original?.src, geometry, scale, strength, softness, grounding?.points]);
    if (studioKey === key) return;
    const { x, y, width, height, bounds, scale: k } = geometry;
    const carWidth = bounds.largura * k;
    const base = y + (bounds.y + bounds.altura) * k;
    const center = x + (bounds.x + bounds.largura / 2) * k;
    // O painel de pneus usa uma imagem contain de 870 × 650. Converte os seus
    // pontos de volta ao recorte e então ao enquadramento exclusivo da Carrossel.
    const sourceScale = Math.min(870 / hero.naturalWidth, 650 / hero.naturalHeight);
    const sourceX = (870 - hero.naturalWidth * sourceScale) / 2;
    const sourceY = 650 - hero.naturalHeight * sourceScale;
    const automatic = bounds.contacts;
    const points = automatic && (!usesMain || !window.CarGrounding?.contactsAdjusted?.())
      ? automatic.map((p) => ({ x: x + p.x * k, y: y + p.y * k }))
      : grounding?.points?.length === 2
      ? grounding.points.map((p) => ({
          x: x + (p.x - sourceX) / sourceScale * k,
          y: y + (p.y - sourceY) / sourceScale * k
        }))
      : [{ x: center - carWidth * 0.34, y: base }, { x: center + carWidth * 0.34, y: base }];
    const [a, b] = points;
    const cy = (a.y + b.y) / 2;
    const canvas = () => {
      const c = document.createElement('canvas');
      c.width = LARGURA * scale;
      c.height = ALTURA_FOTO * scale;
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      return { c, ctx };
    };
    originalFloor.hidden = !original;
    shadowImg.hidden = Boolean(original) || strength <= 0;
    if (original) {
      // Foto e PNG conservam as coordenadas originais, por isso os pneus coincidem.
      const { c: realCanvas, ctx: real } = canvas();
      real.drawImage(original, x, y, width, height);
      const { c: maskCanvas, ctx: mask } = canvas();
      mask.translate(center, base - carWidth * 0.08);
      mask.scale(carWidth * 0.63, carWidth * 0.20);
      const fade = mask.createRadialGradient(0, 0, 0, 0, 0, 1);
      fade.addColorStop(0, '#fff');
      fade.addColorStop(0.35, '#fff');
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      mask.fillStyle = fade;
      mask.fillRect(-1, -1, 2, 2);
      real.globalCompositeOperation = 'destination-in';
      real.drawImage(maskCanvas, 0, 0, LARGURA, ALTURA_FOTO);
      // Suaviza também as bordas do arquivo, quando o piso chega até a moldura.
      const edges = real.createLinearGradient(x, 0, x + width, 0);
      edges.addColorStop(0, 'rgba(0,0,0,0)');
      edges.addColorStop(0.08, '#000');
      edges.addColorStop(0.92, '#000');
      edges.addColorStop(1, 'rgba(0,0,0,0)');
      real.fillStyle = edges;
      real.fillRect(0, 0, LARGURA, ALTURA_FOTO);
      // O mesmo vale para o alto e o pé da foto: sem isso o piso real termina numa linha
      // reta e deixa uma faixa branca entre a foto e o rodapé.
      const margem = Math.min(80, height * 0.2);
      const bordas = real.createLinearGradient(0, y, 0, y + height);
      // Só suaviza as bordas que ficam dentro da faixa; as que passam da moldura já são cortadas por ela.
      bordas.addColorStop(0, y > 0 ? 'rgba(0,0,0,0)' : '#000');
      bordas.addColorStop(y > 0 ? margem / height : 0, '#000');
      bordas.addColorStop(y + height < ALTURA_FOTO ? 1 - margem / height : 1, '#000');
      bordas.addColorStop(1, y + height < ALTURA_FOTO ? 'rgba(0,0,0,0)' : '#000');
      real.fillStyle = bordas;
      real.fillRect(0, 0, LARGURA, ALTURA_FOTO);
      originalFloor.src = realCanvas.toDataURL('image/png');
    } else if (strength > 0) {
      const { c: shadowCanvas, ctx: shadow } = canvas();
      window.CarGrounding.paintFloorShadow(shadow, {
        points,
        width: carWidth,
        strength,
        soft: softness,
        depth: carWidth * 0.075,
        bodyCenter: { x: center, y: (cy + base) / 2 }
      });
      shadowImg.src = shadowCanvas.toDataURL('image/png');
    }
    studioKey = key;
  }

  // Os controles compartilhados de pneus também reposicionam estas camadas.
  let studioFrame = 0;
  for (const event of ['input', 'change', 'click']) document.addEventListener(event, (e) => {
    if (!e.target.closest?.('.grounding-controls')) return;
    cancelAnimationFrame(studioFrame);
    studioFrame = requestAnimationFrame(sync);
  });

  const texto = (seletor, valor) => {
    const el = root.querySelector(seletor);
    (el.querySelector('.v-it') ?? el).textContent = valor;
  };

  function sync() {
    previewNav.hidden = window.Layouts?.current !== 6;
    const escondido = root.hidden;
    if (escondido) {
      root.style.visibility = 'hidden';
      root.hidden = false;
    }

    // Foto: o recorte transparente ganha estúdio e sombra sintéticos; a foto com
    // fundo próprio preenche a faixa, sem cenário inventado por cima.
    const principal = slides[slideIndex].image ?? (slideIndex === 0 ? document.querySelector('#image-main') : null);
    const comFundo = !slides[slideIndex].image && slideIndex === 0 ? window.OriginalFloor?.source : null;
    const recortada = principal && (slides[slideIndex].image || principal.classList.contains('transparent')) && principal.getAttribute('src');
    const foto = root.querySelector('.v-photo');
    const hero = root.querySelector('.v-car img');
    foto.classList.toggle('v-real', !recortada && Boolean(comFundo));
    if (!recortada && comFundo) {
      hero.removeAttribute('data-mirror');
      hero.hidden = false;
      if (hero.src !== comFundo.src) hero.src = comFundo.src;
    } else {
      hero.removeAttribute('data-mirror');
      hero.hidden = !principal || principal.hidden || !principal.getAttribute('src');
      if (!hero.hidden && hero.src !== principal.src) hero.src = principal.src;
    }
    foto.classList.toggle('v-studio', Boolean(recortada && !hero.hidden));
    if (recortada && !hero.hidden && hero.complete && hero.naturalWidth) studioLayers(hero, enquadrar(hero));
    else {
      hero.style.cssText = '';
      studioLayers(hero, null);
    }

    // Cabeçalho: modelo sem a marca e sem o ano, com o ano em preto à direita.
    const titulo = value('titulo')
      .toUpperCase()
      .replace(/\b(?:19|20)\d{2}(?:\/(?:\d{2}|\d{4}))?\b/g, '')
      .trim();
    const ano = value('ano').replace(/^ANO\s*/i, '');
    texto('.v-model', window.Layouts?.model?.() || titulo);
    texto('.v-year', ano);
    texto('.v-version', `${value('subtitulo')} ${value('terceiro-titulo')}`.trim().toUpperCase());

    const diferencial = value('v-diferencial').toUpperCase();
    const extra = root.querySelector('.v-extra');
    extra.hidden = !diferencial;
    if (diferencial) texto('.v-extra b', diferencial);

    // Cartões técnicos.
    const bruto = value('valor').replace(/^R\$\s*/i, '');
    const [inteiro, centavos = '00'] = bruto.split(',');
    texto('.v-price', `R$ ${inteiro || '0'},${centavos.padEnd(2, '0').slice(0, 2)}`);
    texto('.v-fuel', value('fuel').toUpperCase());
    texto('.v-gear', value('terceiro-titulo').toUpperCase());

    // Rodapé. O painel claro termina no chevron, que avança sobre as linhas do meio:
    // cada linha tem o seu limite e o texto encolhe até caber.
    const LIMITES = [278, 241, 246];
    ['.v-c1', '.v-c2', '.v-c3'].forEach((seletor, i) => {
      const linha = root.querySelector(seletor);
      const alvo = linha.querySelector('span');
      alvo.textContent = value(['v-telefone', 'v-instagram', 'v-site'][i]);
      for (let corpo = 29; corpo >= 19; corpo--) {
        linha.style.fontSize = `${corpo}px`;
        if (alvo.offsetWidth <= LIMITES[i]) break;
      }
    });

    // O ano é ancorado à direita; o modelo ocupa o que sobra, com folga para a
    // inclinação. offsetWidth é medida de layout: não sofre o scale da prévia.
    // Modelo e ano ocupam o mesmo patamar visual: os dois terminam no menor corpo
    // que couber nos respectivos espaços, como na peça de referência.
    const campoAno = root.querySelector('.v-year');
    const campoModelo = root.querySelector('.v-model');
    campoAno.dataset.limite = '430'; // a caixa encolhe com o texto; o teto é fixo
    const largura = () => Math.max(240, LARGURA - 97 - campoAno.offsetWidth - 45 - 34);
    // Maior corpo em que os dois cabem: o ano no seu teto e o modelo no que sobra.
    // Um corpo menor estreita o ano e devolve espaço ao modelo, então a busca é direta.
    for (let corpo = +campoModelo.dataset.max; corpo >= +campoModelo.dataset.min; corpo--) {
      campoAno.style.fontSize = campoModelo.style.fontSize = `${corpo}px`;
      if (!cabe(campoAno)) continue;
      campoModelo.style.width = `${largura()}px`;
      if (cabe(campoModelo)) break;
    }

    // A versão vai até o marcador do diferencial; sem ele, usa a linha inteira.
    const versao = root.querySelector('.v-version');
    versao.style.width = `${extra.hidden ? 990 : 690}px`;

    root.querySelectorAll('.v-fit').forEach((el) => {
      if (el !== campoAno && el !== campoModelo) fit(el);
    });
    if (escondido) {
      root.hidden = true;
      root.style.visibility = '';
    }
  }

  async function ready() {
    await Promise.all([...slideJobs.values()]);
    await Promise.all([
      document.fonts.load('italic 900 215px "Barlow Condensed"'),
      document.fonts.load('600 31px "Barlow Condensed"')
    ]);
    await document.fonts.ready;
    if (!window.SOUL_BARLOW_CSS || !document.fonts.check('italic 900 215px "Barlow Condensed"'))
      throw Error('A fonte do layout Carrossel não carregou. Verifique a pasta assets.');
    sync();
    await Promise.all([...root.querySelectorAll('img:not([hidden])')].map((i) => i.decode()));
    // Após decodificar a foto nova, mede seu alfa e gera as camadas na resolução
    // de exportação. Aguarda os PNGs antes de html-to-image capturar o layout.
    sync();
    await Promise.all([...root.querySelectorAll('.v-layer:not([hidden])')].map((i) => i.decode()));
  }

  function errors() {
    const escondido = root.hidden;
    if (escondido) {
      root.style.visibility = 'hidden';
      root.hidden = false;
    }
    const estourou = [...root.querySelectorAll('.v-fit')].some((el) => !cabe(el));
    if (escondido) {
      root.hidden = true;
      root.style.visibility = '';
    }
    return estourou;
  }

  return { sync, ready, errors, loadPhotos, selectSlide, validateCarousel,
    get currentSlide() { return slideIndex; },
    setCropping(active) { cropButton.disabled = active; cropButton.textContent = active ? 'Recortando fotos…' : 'Recortar fotos 1, 2 e 4 da pasta'; },
    largura: LARGURA, altura: ALTURA };
})();
