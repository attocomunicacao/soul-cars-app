'use strict';

const creative = document.querySelector('#creative');
const form = document.querySelector('#editor-form');
const statusLine = document.querySelector('#status');
const exportButton = document.querySelector('#export-button');
const fields = ['titulo', 'subtitulo', 'terceiro-titulo', 'valor', 'ano'];
const slots = [{ key: 'main', title: 'Foto do veículo', hint: 'Foto 1 · PNG sem fundo' }];
/* Cada layout declara seu próprio tamanho de arte; sem declaração, vale 1080 × 1920. */
const TAMANHO_PADRAO = [1080, 1920];
const tamanhoDoLayout = (numero) => {
  const layout = window[numero === 1 ? 'Layouts' : `Layout${numero}`];
  return layout?.largura && layout?.altura ? [layout.largura, layout.altura] : TAMANHO_PADRAO;
};
window.tamanhoDoLayout = tamanhoDoLayout;

let activeSlot = 'main';
let exporting = false;
const pending = new Map();
const versions = new Map();

function message(text, error = false) {
  statusLine.textContent = text;
  statusLine.classList.toggle('error', error);
}

for (const [index, slot] of slots.entries()) {
  const card = document.createElement('div');
  card.className = 'upload-card';
  card.tabIndex = 0;
  card.dataset.slot = slot.key;
  card.setAttribute('aria-label', `Enviar ou colar imagem: ${slot.title}`);
  card.innerHTML = `<span class="upload-number">0${index + 1}</span><span class="upload-copy"><strong>${slot.title}</strong><span class="file-name">${slot.hint}</span></span><span class="upload-plus" aria-hidden="true">+</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="${slot.title}">`;
  const input = card.querySelector('input');
  function activate() {
    activeSlot = slot.key;
    document
      .querySelectorAll('.upload-card')
      .forEach((el) => el.classList.toggle('active', el === card));
  }
  card.addEventListener('focusin', activate);
  card.addEventListener('click', (event) => {
    activate();
    if (event.target !== input) input.click();
  });
  card.addEventListener('keydown', (event) => {
    if (event.target === card && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    if (input.files[0]) queueImage(slot.key, input.files[0]);
    input.value = '';
  });
  card.addEventListener('dragover', (event) => {
    event.preventDefault();
    card.classList.add('dragging');
  });
  card.addEventListener('dragleave', () => card.classList.remove('dragging'));
  card.addEventListener('drop', (event) => {
    event.preventDefault();
    card.classList.remove('dragging');
    activate();
    if (event.dataTransfer.files[0]) queueImage(slot.key, event.dataTransfer.files[0]);
  });
  document.querySelector('#upload-controls').append(card);
  if (slot.key !== 'main') {
    const details = document.createElement('details');
    details.innerHTML = '<summary>Ajustar enquadramento</summary>';
    for (const axis of ['x', 'y']) {
      const label = document.createElement('label');
      label.textContent = axis === 'x' ? 'Horizontal' : 'Vertical';
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.value = '50';
      range.setAttribute('aria-label', `${slot.title}: ${label.textContent}`);
      range.addEventListener('input', () =>
        creative.style.setProperty(`--${slot.key}-pos-${axis}`, `${range.value}%`)
      );
      label.append(range);
      details.append(label);
    }
    document.querySelector('#upload-controls').append(details);
  }
}

document.addEventListener('paste', (event) => {
  const item = Array.from(event.clipboardData?.items || []).find((item) =>
    item.type.startsWith('image/')
  );
  if (item && !exporting) {
    event.preventDefault();
    queueImage(activeSlot, item.getAsFile());
  }
});

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error('Não foi possível ler a foto. Selecione o arquivo novamente.'));
    reader.readAsDataURL(file);
  });
}

function hasTransparency(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  // Verifica o canal alfa original em faixas para limitar o uso de memória.
  for (let y = 0; y < canvas.height; y += 128) {
    const pixels = context.getImageData(0, y, canvas.width, Math.min(128, canvas.height - y)).data;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return true;
  }
  return false;
}

function queueImage(key, file) {
  if (exporting || !file) return;
  const version = (versions.get(key) || 0) + 1;
  versions.set(key, version);
  const job = loadImage(key, file, version)
    .catch((error) => {
      if (versions.get(key) === version) message(error.message, true);
    })
    .finally(() => {
      if (versions.get(key) === version) pending.delete(key);
    });
  pending.set(key, job);
}

async function loadImage(key, file, version) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Use uma foto PNG, JPG ou WebP.');
  if (file.size > 30 * 1024 * 1024)
    throw new Error('A foto excede 30 MB. Escolha um arquivo menor.');
  message('Carregando foto…');
  const source = await readFile(file);
  const candidate = new Image();
  candidate.src = source;
  try {
    await candidate.decode();
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Tente outro arquivo.');
  }
  if (candidate.naturalWidth * candidate.naturalHeight > 50000000)
    throw new Error('A imagem excede 50 megapixels. Reduza sua resolução.');
  const transparent = key === 'main' && hasTransparency(candidate);
  if (versions.get(key) !== version) return;
  const image = document.querySelector(`#image-${key}`);
  image.src = source;
  image.hidden = false;
  image.classList.toggle('transparent', transparent);
  await image.decode();
  if (key === 'main') window.CarGrounding.setImage(image, transparent);
  if (key === 'main') window.OriginalFloor.refresh();
  const card = document.querySelector(`[data-slot="${key}"]`);
  card.querySelector('.file-name').textContent = file.name || 'Imagem colada';
  card.querySelector('.upload-plus').textContent = '✓';
  const thumb = new Image();
  thumb.src = source;
  thumb.alt = '';
  card.querySelector('.upload-number').replaceChildren(thumb);
  card.title = file.name + ' · ' + candidate.naturalWidth + ' × ' + candidate.naturalHeight + ' px';
  const missing = slots.filter((slot) => !document.querySelector(`#image-${slot.key}`).src).length;
  message(
    missing
      ? `Foto adicionada. Faltam ${missing} foto${missing > 1 ? 's' : ''}.`
      : 'Foto pronta. Você já pode baixar o criativo.'
  );
}

function updateTexts() { window.Layouts?.sync(); message('Prévia atualizada.'); }
form.addEventListener('submit', (event) => event.preventDefault());
for (const key of fields) form.elements.namedItem(key).addEventListener('input', updateTexts);

function resizePreview() {
  const [largura, altura] = tamanhoDoLayout(window.Layouts?.current ?? 1);
  const available = document.querySelector('#preview-stage').clientWidth - 38;
  const maxHeight = window.innerWidth <= 660 ? 560 : Math.max(540, window.innerHeight - 220);
  // Painel muito estreito não pode virar escala zero ou negativa.
  const scale = Math.max(0.05, Math.min(available / largura, maxHeight / altura, 1));
  const palco = document.querySelector('#preview-scale');
  palco.style.width = `${largura}px`;
  palco.style.height = `${altura}px`;
  palco.style.transform = `scale(${scale})`;
  document.querySelector('#preview-size').style.width = `${largura * scale}px`;
  document.querySelector('#preview-size').style.height = `${altura * scale}px`;
  const selo = document.querySelector('#preview-formato');
  if (selo) selo.textContent = `${altura > largura * 1.5 ? '9:16' : '4:5'} · ${largura} × ${altura}`;
}
// A troca de layout pode mudar a proporção da arte (ex.: 1080 × 1350).
window.ajustarPrevia = resizePreview;
new ResizeObserver(resizePreview).observe(document.querySelector('#preview-stage'));
window.addEventListener('resize', resizePreview);
resizePreview();

async function ensureFonts() {
  if (!window.SOUL_FONT_CSS)
    throw new Error(
      'A fonte Montserrat não foi encontrada. Mantenha a pasta assets junto do HTML.'
    );
  await Promise.all(
    [300, 400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 52px Montserrat`))
  );
  await document.fonts.ready;
  if (
    ![300, 400, 500, 600, 700].every((weight) => document.fonts.check(`${weight} 52px Montserrat`))
  )
    throw new Error('A fonte Montserrat ainda não carregou. Tente novamente.');
}

function fileName() {
  const normalize = (value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const title = normalize(form.elements.namedItem('titulo').value);
  const year = normalize(form.elements.namedItem('ano').value.replace(/^ANO\s*/i, ''));
  return `${title.endsWith(`-${year}`) || title === year ? title : `${title}-${year}`}.png`;
}

async function exportLayouts(numbers) {
  if (exporting) return;
  exporting = true;
  const vitrineSlide = window.Layout6?.currentSlide ?? 0;
  exportButton.disabled = true;
  document.dispatchEvent(new CustomEvent('soul:exporting', { detail: true }));
  document.querySelector('#export-both').disabled = true;
  const controls = [
    ...form.querySelectorAll('input,select,button'),
    document.querySelector('#export-resolution')
  ];
  const disabledStates = controls.map((control) => control.disabled);
  controls.forEach((control) => {
    control.disabled = true;
  });
  const resolution = Number(document.querySelector('#export-resolution')?.value) || 1;
  window.renderScale = resolution;
  const medida = (numero) => {
    const [w, h] = tamanhoDoLayout(numero);
    return `${w * resolution} × ${h * resolution}`;
  };
  const dimensions = medida(numbers[0]);
  const variados = numbers.some((n) => medida(n) !== dimensions);
  message(`Preparando PNG em ${variados ? 'cada formato' : dimensions}…`);
  try {
    await Promise.all([...pending.values()]);
    if (fields.some((key) => !form.elements.namedItem(key).value.trim()))
      throw new Error('Preencha os cinco campos de texto.');
    const images = numbers.includes(4) ? [document.querySelector('#image-main')] : [];
    if (images.some(image => !image.getAttribute('src'))) throw new Error('Carregue a foto principal antes de baixar.');
    await Promise.all(images.map((image) => image.decode()));
    await window.CarGrounding.ready();
    await window.OriginalFloor.ready();
    await ensureFonts();
    if (numbers.includes(4)) {
      await window.Layout4.ready();
      if (window.Layout4.errors())
        throw new Error('Tráfego Pago: encurte os textos que excedem o espaço.');
    }
    if (numbers.includes(6)) {
      await window.Layout6.ready();
      window.Layout6.validateCarousel();
      if (window.Layout6.errors())
        throw new Error('Carrossel: encurte os textos que excedem o espaço disponível.');
    }
    if (!window.htmlToImage)
      throw new Error('A biblioteca de exportação não foi encontrada na pasta assets.');
    const files = [];
    const variants = numbers.flatMap((number) => number === 6
      ? [0, 1, 2].map((slide) => ({ number, slide }))
      : [{ number, slide: null }]);
    for (const { number, slide } of variants) {
      if (number === 6) {
        window.Layout6.selectSlide(slide, true);
        await window.Layout6.ready();
      }
      const target = document.querySelector(number === 1 ? '#creative' : `#creative${number}`);
      const [largura, altura] = tamanhoDoLayout(number);
      const wasHidden = target.hidden;
      const inactive = target.classList.contains('preview-inactive');
      target.hidden = false;
      target.classList.remove('preview-inactive');
      let canvas;
      try {
        canvas = await htmlToImage.toCanvas(target, {
          width: largura,
          height: altura,
          canvasWidth: largura * resolution,
          canvasHeight: altura * resolution,
          pixelRatio: 1,
          // Todos os layouts compartilham a tipografia da Vitrine.
          fontEmbedCSS:
            window.SOUL_FONT_CSS +
            (window.SOUL_CONDENSED_CSS || '') +
            (window.SOUL_BARLOW_CSS || ''),
          filter: (node) => !(node.tagName === 'IMG' && node.hidden),
          style: { transform: 'none', margin: '0' }
        });
      } finally {
        target.hidden = wasHidden;
        target.classList.toggle('preview-inactive', inactive);
      }
      if (canvas.width !== largura * resolution || canvas.height !== altura * resolution)
        throw new Error('A resolução exportada é inválida. Tente novamente.');
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Não foi possível gerar o PNG.');
      files.push({ blob, name: fileName().replace('.png', number === 6
        ? `-carrossel-${slide + 1}.png`
        : `-trafego-pago.png`) });
    }
    // No app desktop cada layout vai como PNG para a pasta CRIATIVO do veículo;
    // no navegador, vários layouts ainda saem juntos em um ZIP.
    const avulsos = files.length === 1 || window.SOUL_APP;
    const baixar = (blob, nome) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = nome;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    };
    if (avulsos) for (const file of files) baixar(file.blob, file.name);
    else baixar(await window.Layouts.zip(files), fileName().replace('.png', `-${files.length}-layouts.zip`));
    const tamanhoFinal = variados ? 'no seu formato' : `em ${dimensions} pixels`;
    message(
      files.length === 1
        ? `PNG pronto: ${dimensions} pixels. Download iniciado.`
        : avulsos
          ? numbers.every((number) => number === 6)
            ? `As três peças do carrossel foram salvas em PNG, cada uma ${tamanhoFinal}.`
            : `Os ${files.length} layouts foram salvos em PNG, cada um ${tamanhoFinal}.`
          : `Os ${files.length} layouts estão prontos no ZIP, cada um ${tamanhoFinal}.`
    );
    return true;
  } catch (error) {
    message(error.message || 'Não foi possível exportar. Tente novamente.', true);
    return false;
  } finally {
    window.Layout6?.selectSlide(vitrineSlide, true);
    exporting = false;
    exportButton.disabled = false;
    document.querySelector('#export-both').disabled = false;
    controls.forEach((control, index) => {
      control.disabled = disabledStates[index];
    });
    window.renderScale = 1;
    document.dispatchEvent(new CustomEvent('soul:exporting', { detail: false }));
  }
}
exportButton.addEventListener('click', () => exportLayouts([window.Layouts.current]));
document.querySelector('#export-both').addEventListener('click', () => exportLayouts([4, 6]));

ensureFonts().catch(error => message(error.message, true));
