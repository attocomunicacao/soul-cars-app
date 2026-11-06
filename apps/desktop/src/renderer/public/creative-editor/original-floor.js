'use strict';

// Composição local da fotografia original: o piso mantém suas cores e sombra reais.
window.OriginalFloor = (() => {
  const W = 1080,
    H = 1920;
  let source = null,
    panel,
    preview,
    output,
    frame = 0,
    loading = Promise.resolve(),
    generation = 0;
  const defaults = {
    x: 0,
    y: 0,
    scale: 100,
    cx: 540,
    cy: 1390,
    rx: 440,
    ry: 125,
    feather: 65,
    brush: 45
  };
  const state = { ...defaults, enabled: true, alignment: false, tool: 'erase' };
  let strokes = [],
    currentStroke = null;
  const canvas = () =>
    Object.assign(document.createElement('canvas'), {
      width: W * (window.renderScale || 1),
      height: H * (window.renderScale || 1)
    });
  const busy = () => typeof exporting !== 'undefined' && exporting;
  function mount() {
    if (panel) return;
    output = document.querySelector('#original-floor');
    panel = document.createElement('details');
    panel.open = true;
    panel.className = 'grounding-controls original-controls';
    panel.innerHTML = `<summary>Preservar piso e sombra da foto original</summary>
      <p class="grounding-help">Envie a mesma foto usada para criar o PNG. Se o recorte manteve o tamanho e a posição originais, o alinhamento será direto.</p>
      <label>Foto original com fundo<input id="original-upload" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p id="original-status" role="status">Aguardando a foto original e o PNG principal.</p>
      <fieldset id="original-controls" disabled>
      <label class="grounding-toggle"><input id="original-enabled" type="checkbox" checked> Usar piso real (substitui sombra e reflexo artificiais)</label>
      <label class="grounding-toggle"><input id="original-alignment" type="checkbox"> Mostrar foto inteira para alinhar nesta miniatura</label>
      <canvas id="original-preview" width="1080" height="800" aria-label="Piso preservado. Use os controles para selecionar a área ou arraste para apagar e restaurar." tabindex="0"></canvas>
      <p class="grounding-help">Na miniatura, alinhe as rodas da foto com as do PNG. Depois desligue a foto inteira e selecione apenas o piso ao redor dos pneus.</p>
      <details><summary>Alinhar foto original</summary><div id="original-align-ranges"></div></details>
      <div id="original-region-ranges"></div>
      <p class="grounding-help">Arraste na miniatura para corrigir a área preservada. Os pincéis também funcionam por toque.</p>
      <div class="grounding-picks"><button type="button" data-floor-tool="erase" aria-pressed="true">Apagar piso</button><button type="button" data-floor-tool="restore" aria-pressed="false">Restaurar piso</button></div>
      <div id="original-brush-ranges"></div>
      <div class="grounding-picks"><button type="button" id="floor-undo">Desfazer pincel</button><button type="button" id="floor-reset">Reiniciar ajustes</button></div>
      </fieldset>`;
    document.querySelector('[data-slot="main"]').after(panel);
    preview = panel.querySelector('canvas');
    const specs = [
      ['x', 'Deslocamento horizontal', -500, 500, 'align'],
      ['y', 'Deslocamento vertical', -500, 500, 'align'],
      ['scale', 'Tamanho da foto (%)', 30, 250, 'align'],
      ['cx', 'Centro horizontal', 0, 1080, 'region'],
      ['cy', 'Altura do piso', 880, 1530, 'region'],
      ['rx', 'Largura da área', 50, 700, 'region'],
      ['ry', 'Profundidade da área', 15, 350, 'region'],
      ['feather', 'Suavizar bordas (%)', 0, 100, 'region'],
      ['brush', 'Tamanho do pincel', 10, 150, 'brush']
    ];
    for (const [key, label, min, max, group] of specs) {
      const row = document.createElement('label');
      row.className = 'floor-range';
      row.innerHTML = `<span>${label}</span><input type="range" data-floor="${key}" aria-label="${label}" min="${min}" max="${max}" value="${state[key]}"><output>${state[key]}</output>`;
      row.querySelector('input').addEventListener('input', (e) => {
        if (busy()) return;
        state[key] = Number(e.target.value);
        row.querySelector('output').value = state[key];
        schedule();
      });
      panel.querySelector(`#original-${group}-ranges`).append(row);
    }
    panel.querySelector('#original-upload').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && !busy()) load(file);
      e.target.value = '';
    });
    for (const [id, key] of [
      ['original-enabled', 'enabled'],
      ['original-alignment', 'alignment']
    ])
      panel.querySelector('#' + id).addEventListener('change', (e) => {
        if (!busy()) {
          state[key] = e.target.checked;
          schedule();
        }
      });
    panel.querySelectorAll('[data-floor-tool]').forEach((button) =>
      button.addEventListener('click', () => {
        if (busy()) return;
        state.tool = button.dataset.floorTool;
        panel
          .querySelectorAll('[data-floor-tool]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      })
    );
    panel.querySelector('#floor-undo').addEventListener('click', () => {
      if (!busy()) {
        strokes.pop();
        schedule();
      }
    });
    panel.querySelector('#floor-reset').addEventListener('click', () => {
      if (busy()) return;
      Object.assign(state, defaults);
      strokes = [];
      panel.querySelectorAll('[data-floor]').forEach((input) => {
        input.value = state[input.dataset.floor];
        input.nextElementSibling.value = input.value;
      });
      schedule();
    });
    function point(e) {
      const r = preview.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * W,
        y: 800 + ((e.clientY - r.top) / r.height) * 800
      };
    }
    preview.addEventListener('pointerdown', (e) => {
      if (busy() || !isActive() || state.alignment) return;
      e.preventDefault();
      preview.setPointerCapture(e.pointerId);
      currentStroke = { tool: state.tool, size: state.brush, points: [point(e)] };
      strokes.push(currentStroke);
      schedule();
    });
    preview.addEventListener('pointermove', (e) => {
      if (currentStroke && !busy()) {
        currentStroke.points.push(point(e));
        schedule();
      }
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      preview.addEventListener(event, () => {
        currentStroke = null;
      });
    refresh();
  }
  function load(file) {
    const version = ++generation;
    loading = (async () => {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 30 * 1024 * 1024
      )
        throw Error('Use JPG, PNG ou WebP de até 30 MB.');
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(Error('Não foi possível ler a foto.'));
        r.readAsDataURL(file);
      });
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 50000000)
        throw Error('Use uma foto com até 50 megapixels.');
      if (version !== generation) return;
      source = image;
      Object.assign(state, defaults);
      strokes = [];
      panel.querySelectorAll('[data-floor]').forEach((input) => {
        input.value = state[input.dataset.floor];
        input.nextElementSibling.value = input.value;
      });
      refresh();
    })().catch((error) => {
      if (version === generation)
        panel.querySelector('#original-status').textContent =
          error.message || 'Não foi possível abrir esta foto.';
    });
    return loading;
  }
  function isActive() {
    const main = document.querySelector('#image-main');
    return Boolean(
      source && main.naturalWidth && main.classList.contains('transparent') && state.enabled
    );
  }
  function refresh() {
    if (!panel) return;
    const main = document.querySelector('#image-main');
    const available = Boolean(
      source && main.naturalWidth && main.classList.contains('transparent')
    );
    panel.querySelector('#original-controls').disabled = !available;
    panel.querySelector('#original-status').textContent = available
      ? 'Piso real disponível. Confira o alinhamento e a área preservada.'
      : source
        ? 'Adicione um PNG principal com fundo transparente.'
        : 'Aguardando a foto original com fundo.';
    render();
    window.Layout4?.sync();
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  }
  function drawOriginal(ctx) {
    const scale =
      (Math.min(870 / source.naturalWidth, 650 / source.naturalHeight) * state.scale) / 100;
    const w = source.naturalWidth * scale,
      h = source.naturalHeight * scale;
    ctx.drawImage(source, 540 - w / 2 + state.x, 1530 - h + state.y, w, h);
  }
  function render() {
    if (!panel) return;
    const active = isActive();
    window.CarGrounding.useOriginalFloor(active);
    output.hidden = !active;
    const pc = preview.getContext('2d');
    pc.clearRect(0, 0, 1080, 800);
    pc.fillStyle = '#dfdcda';
    pc.fillRect(0, 0, 1080, 800);
    if (!source) return;
    const layer = canvas(),
      ctx = layer.getContext('2d');
    ctx.scale(window.renderScale || 1, window.renderScale || 1);
    ctx.imageSmoothingQuality = 'high';
    drawOriginal(ctx);
    const mask = canvas(),
      m = mask.getContext('2d');
    m.scale(window.renderScale || 1, window.renderScale || 1);
    m.save();
    m.translate(state.cx, state.cy);
    m.scale(state.rx, state.ry);
    const g = m.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, '#fff');
    g.addColorStop(Math.min(0.99, 1 - state.feather / 100), '#fff');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = g;
    m.fillRect(-1, -1, 2, 2);
    m.restore();
    for (const stroke of strokes) {
      m.globalCompositeOperation = stroke.tool === 'erase' ? 'destination-out' : 'source-over';
      function stamp(p) {
        const g = m.createRadialGradient(p.x, p.y, stroke.size * 0.45, p.x, p.y, stroke.size);
        g.addColorStop(0, '#fff');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        m.fillStyle = g;
        m.fillRect(p.x - stroke.size, p.y - stroke.size, stroke.size * 2, stroke.size * 2);
      }
      stroke.points.forEach((p, i) => {
        if (!i) {
          stamp(p);
          return;
        }
        const a = stroke.points[i - 1],
          n = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / (stroke.size * 0.2)));
        for (let j = 1; j <= n; j++)
          stamp({ x: a.x + ((p.x - a.x) * j) / n, y: a.y + ((p.y - a.y) * j) / n });
      });
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, W, H);
    const fade = ctx.createLinearGradient(0, 1470, 0, 1508);
    fade.addColorStop(0, '#000');
    fade.addColorStop(1, 'transparent');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    if (active) output.src = layer.toDataURL('image/png');
    pc.save();
    pc.translate(0, -800);
    if (state.alignment) {
      pc.globalAlpha = 0.65;
      drawOriginal(pc);
      pc.globalAlpha = 1;
    } else pc.drawImage(layer, 0, 0, W, H);
    const main = document.querySelector('#image-main');
    if (main.naturalWidth) {
      const s = Math.min(870 / main.naturalWidth, 650 / main.naturalHeight),
        w = main.naturalWidth * s,
        h = main.naturalHeight * s;
      pc.globalAlpha = state.alignment ? 0.55 : 1;
      pc.drawImage(main, 540 - w / 2, 1530 - h, w, h);
      pc.globalAlpha = 1;
    }
    pc.strokeStyle = '#6b872d';
    pc.setLineDash([8, 7]);
    pc.lineWidth = 2;
    pc.beginPath();
    pc.ellipse(state.cx, state.cy, state.rx, state.ry, 0, 0, Math.PI * 2);
    pc.stroke();
    pc.restore();
  }
  async function ready() {
    await loading;
    cancelAnimationFrame(frame);
    render();
    if (output && !output.hidden) await output.decode();
  }
  // SOUL Cars Studio: salvar/restaurar ajustes (inclui os traços do pincel) por veículo.
  function snapshot() {
    const keys = Object.keys(defaults);
    return {
      ...Object.fromEntries(keys.map((k) => [k, state[k]])),
      enabled: state.enabled,
      strokes: strokes.map((s) => ({
        tool: s.tool,
        size: s.size,
        points: s.points.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }))
      }))
    };
  }
  function restore(saved) {
    if (!saved || !panel) return;
    for (const key of Object.keys(defaults)) if (typeof saved[key] === 'number') state[key] = saved[key];
    if (typeof saved.enabled === 'boolean') {
      state.enabled = saved.enabled;
      panel.querySelector('#original-enabled').checked = saved.enabled;
    }
    if (Array.isArray(saved.strokes)) strokes = saved.strokes;
    panel.querySelectorAll('[data-floor]').forEach((input) => {
      input.value = state[input.dataset.floor];
      input.nextElementSibling.value = input.value;
    });
    refresh();
  }

  document.addEventListener('DOMContentLoaded', mount);
  return {
    refresh,
    ready,
    load,
    snapshot,
    restore,
    get source() {
      return source;
    }
  };
})();
