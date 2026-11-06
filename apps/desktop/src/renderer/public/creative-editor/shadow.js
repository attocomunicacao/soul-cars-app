'use strict';

// Sombra de chão independente da fotografia: nenhuma alteração nos pixels do carro.
window.CarGrounding = (() => {
  const state = {
    enabled: true,
    strength: 65,
    softness: 55,
    depth: 55,
    reflection: 28,
    points: [],
    bounds: null,
    transparent: false,
    selected: 0
  };
  let output,
    section,
    mini,
    note,
    controls,
    currentSource = '';
  let frame = 0;
  let suppressed = false;
  let estimatedPoints = [];
  const busy = () => typeof exporting !== 'undefined' && exporting;

  function mount() {
    if (section) return;
    output = document.querySelector('#ground-shadow');
    section = document.createElement('details');
    section.className = 'grounding-controls';
    section.open = true;
    section.innerHTML = `<summary>Sombra e reflexo no piso</summary>
      <p class="grounding-note">Envie a foto principal com fundo transparente para criar a sombra.</p>
      <fieldset class="grounding-fields" disabled>
        <label class="grounding-toggle"><input id="ground-enabled" type="checkbox" checked> Ativar sombra de chão</label>
        <p class="grounding-help">Ajuste os pontos na base dos pneus. Selecione um pneu abaixo e clique onde ele toca o chão na foto.</p>
        <div class="grounding-picks"><button type="button" data-point="0" aria-pressed="true">Marcar pneu 1</button><button type="button" data-point="1" aria-pressed="false">Marcar pneu 2</button></div>
        <div class="grounding-mini"><img alt="Foto principal para posicionar os contatos dos pneus"><span class="grounding-dot" data-dot="0">1</span><span class="grounding-dot" data-dot="1">2</span></div>
        <div class="grounding-ranges"></div>
        <details><summary>Posição precisa dos pneus</summary><div class="grounding-coordinates"></div></details>
        <button type="button" class="grounding-reset">Restaurar estimativa automática</button>
      </fieldset>`;
    const mainCard = document.querySelector('[data-slot="main"]');
    mainCard.after(section);
    mini = section.querySelector('.grounding-mini');
    note = section.querySelector('.grounding-note');
    controls = section.querySelector('fieldset');
    for (const [key, label] of [
      ['strength', 'Intensidade'],
      ['softness', 'Suavidade'],
      ['depth', 'Profundidade'],
      ['reflection', 'Reflexo']
    ]) {
      const row = document.createElement('label');
      row.innerHTML = `<span>${label}</span><input type="range" min="0" max="100" value="${state[key]}" data-setting="${key}" aria-label="${key === 'reflection' ? 'Intensidade do reflexo' : label + ' da sombra'}"><output>${state[key]}%</output>`;
      row.querySelector('input').addEventListener('input', (event) => {
        if (busy()) return;
        state[key] = Number(event.target.value);
        row.querySelector('output').value = `${state[key]}%`;
        schedule();
      });
      section.querySelector('.grounding-ranges').append(row);
    }
    for (let point = 0; point < 2; point++)
      for (const [axis, label, max] of [
        ['x', 'Horizontal', 870],
        ['y', 'Vertical', 650]
      ]) {
        const row = document.createElement('label');
        row.innerHTML = `<span>Pneu ${point + 1} · ${label}</span><input type="range" min="0" max="${max}" data-coordinate="${point}-${axis}" aria-label="Pneu ${point + 1}: ${label}">`;
        row.querySelector('input').addEventListener('input', (event) => {
          if (busy() || !state.points[point]) return;
          state.points[point][axis] = Number(event.target.value);
          sync();
          schedule();
        });
        section.querySelector('.grounding-coordinates').append(row);
      }
    section.querySelector('#ground-enabled').addEventListener('change', (event) => {
      if (!busy()) {
        state.enabled = event.target.checked;
        schedule();
      }
    });
    section.querySelectorAll('[data-point]').forEach((button) =>
      button.addEventListener('click', () => {
        if (busy()) return;
        state.selected = Number(button.dataset.point);
        section
          .querySelectorAll('[data-point]')
          .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      })
    );
    mini.addEventListener('click', (event) => {
      if (busy() || !state.transparent) return;
      const rect = mini.getBoundingClientRect();
      state.points[state.selected] = {
        x: Math.max(0, Math.min(870, ((event.clientX - rect.left) / rect.width) * 870)),
        y: Math.max(0, Math.min(650, ((event.clientY - rect.top) / rect.height) * 650))
      };
      sync();
      schedule();
    });
    section.querySelector('.grounding-reset').addEventListener('click', () => {
      if (!busy() && currentSource)
        setImage(document.querySelector('#image-main'), state.transparent);
    });
  }

  function analyze(image) {
    const canvas = document.createElement('canvas');
    canvas.width = 870;
    canvas.height = 650;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scale = Math.min(870 / image.naturalWidth, 650 / image.naturalHeight);
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    ctx.drawImage(image, (870 - width) / 2, 650 - height, width, height);
    const rgba = ctx.getImageData(0, 0, 870, 650).data;
    const bottom = new Array(870).fill(-1);
    let left = 870,
      right = 0,
      top = 650,
      base = 0;
    for (let y = 0; y < 650; y++)
      for (let x = 0; x < 870; x++) {
        // Ignora halos quase transparentes ao estimar a borda do recorte.
        if (rgba[(y * 870 + x) * 4 + 3] < 160) continue;
        bottom[x] = y;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        base = Math.max(base, y);
      }
    if (left > right) return null;
    const mid = (left + right) / 2;
    function contact(from, to) {
      let deepest = -1;
      for (let x = Math.ceil(from); x <= Math.floor(to); x++)
        deepest = Math.max(deepest, bottom[x]);
      const near = [];
      for (let x = Math.ceil(from); x <= Math.floor(to); x++)
        if (bottom[x] >= deepest - 5 && bottom[x] >= 0) near.push(x);
      return {
        x: near.length ? near.reduce((a, b) => a + b, 0) / near.length : (from + to) / 2,
        y: Math.max(0, deepest)
      };
    }
    return {
      bounds: { left, right, top, base },
      points: [contact(left, mid), contact(mid + 1, right)]
    };
  }

  function setImage(image, transparent) {
    mount();
    state.transparent = transparent;
    currentSource = image.src;
    mini.querySelector('img').src = image.src;
    const geometry = transparent ? analyze(image) : null;
    estimatedPoints = (geometry?.points || []).map((p) => ({ ...p }));
    controls.disabled = !geometry;
    state.bounds = geometry?.bounds || null;
    state.points = geometry?.points || [];
    mini.hidden = !geometry;
    note.textContent = geometry
      ? 'Pontos estimados pelo recorte. Confira se estão na base dos pneus e ajuste quando necessário.'
      : 'Use PNG ou WebP com o carro recortado e fundo transparente. Fotos com fundo mantêm a sombra original.';
    sync();
    render();
  }

  function sync() {
    state.points.forEach((point, index) => {
      const marker = section.querySelector(`[data-dot="${index}"]`);
      marker.style.left = `${(point.x / 870) * 100}%`;
      marker.style.top = `${(point.y / 650) * 100}%`;
      for (const axis of ['x', 'y'])
        section.querySelector(`[data-coordinate="${index}-${axis}"]`).value = point[axis];
    });
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  }

  function paintFloorShadow(ctx, { points, width, strength, soft, depth, bodyCenter }) {
    const [a, b] = points;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    function ellipse(x, y, rx, ry, opacity, rotation = angle, core = 0.12) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(Math.max(1, rx), Math.max(1, ry));
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, `rgba(18,20,23,${opacity})`);
      gradient.addColorStop(core, `rgba(18,20,23,${opacity * 0.85})`);
      gradient.addColorStop(0.62, `rgba(18,20,23,${opacity * 0.28})`);
      gradient.addColorStop(1, 'rgba(18,20,23,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    const cx = bodyCenter?.x ?? (a.x + b.x) / 2,
      cy = bodyCenter?.y ?? (a.y + b.y) / 2;
    // Penumbra ampla, sombra sob a carroceria e contatos curtos e densos.
    ellipse(
      cx,
      cy - depth * 0.25,
      Math.max(length * 0.65, width * 0.49),
      depth * (1.25 + soft),
      strength * 0.25
    );
    ellipse(
      cx,
      cy - depth * 0.2,
      Math.max(length * 0.58, width * 0.38),
      depth * (0.55 + soft * 0.25),
      strength * 0.57,
      angle,
      0.22
    );
    for (const point of points) {
      ellipse(
        point.x,
        point.y + 2,
        Math.max(28, width * 0.065) * (1 + soft * 0.35),
        12 + soft * 12,
        strength * 0.65,
        0
      );
      ellipse(
        point.x,
        point.y,
        Math.max(18, width * 0.033),
        5 + soft * 3,
        strength * 0.83,
        0,
        0.28
      );
    }
  }

  function render() {
    if (!output) return;
    if (suppressed) {
      output.hidden = true;
      document.querySelector('#ground-reflection').hidden = true;
      return;
    }
    renderReflection();
    if (!state.transparent || !state.bounds || !state.enabled || !state.strength) {
      output.hidden = true;
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1080 * (window.renderScale || 1);
    canvas.height = 1920 * (window.renderScale || 1);
    const ctx = canvas.getContext('2d');
    ctx.scale(window.renderScale || 1, window.renderScale || 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const points = state.points.map((p) => ({ x: p.x + 105, y: p.y + 880 }));
    paintFloorShadow(ctx, {
      points,
      width: state.bounds.right - state.bounds.left,
      strength: state.strength / 100,
      soft: state.softness / 100,
      depth: 16 + state.depth * 0.62
    });
    // Suaviza o limite para preservar a área de texto abaixo do recorte.
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, 1470, 0, 1506);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 1080, 1920);
    output.src = canvas.toDataURL('image/png');
    output.hidden = false;
  }

  function renderReflection() {
    const reflection = document.querySelector('#ground-reflection');
    if (!reflection) return;
    if (!state.transparent || !state.bounds || !state.reflection) {
      reflection.hidden = true;
      return;
    }
    const image = document.querySelector('#image-main');
    const canvas = document.createElement('canvas');
    canvas.width = 1080 * (window.renderScale || 1);
    canvas.height = 1920 * (window.renderScale || 1);
    const ctx = canvas.getContext('2d');
    ctx.scale(window.renderScale || 1, window.renderScale || 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const [a, b] = state.points.map((p) => ({ x: p.x + 105, y: p.y + 880 }));
    // Aproximação de piso em perspectiva a partir dos dois contatos indicados.
    const dx = b.x - a.x;
    const slope = Math.abs(dx) < 30 ? 0 : Math.max(-0.65, Math.min(0.65, (b.y - a.y) / dx));
    const intercept = (a.y + b.y) / 2 - (slope * (a.x + b.x)) / 2;
    const compression = 0.32;
    const scale = Math.min(870 / image.naturalWidth, 650 / image.naturalHeight);
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, intercept);
    ctx.lineTo(1080, intercept + slope * 1080);
    ctx.lineTo(1080, 1920);
    ctx.lineTo(0, 1920);
    ctx.closePath();
    ctx.clip();
    ctx.filter = `blur(${2.5 * (window.renderScale || 1)}px)`;
    ctx.transform(1, (1 + compression) * slope, 0, -compression, 0, (1 + compression) * intercept);
    ctx.drawImage(image, 105 + (870 - width) / 2, 1530 - height, width, height);
    ctx.restore();
    // Reflexo forte junto ao contato, que se dissolve ao se afastar do carro.
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const m = mask.getContext('2d');
    m.scale(window.renderScale || 1, window.renderScale || 1);
    m.transform(1, slope, 0, 1, 0, intercept);
    const fade = m.createLinearGradient(0, 0, 0, 160);
    fade.addColorStop(0, `rgba(0,0,0,${state.reflection / 100})`);
    fade.addColorStop(0.35, `rgba(0,0,0,${state.reflection / 220})`);
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = fade;
    m.fillRect(0, 0, 1080, 160);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, 1080, 1920);
    const textFade = ctx.createLinearGradient(0, 1470, 0, 1510);
    textFade.addColorStop(0, '#000');
    textFade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = textFade;
    ctx.fillRect(0, 0, 1080, 1920);
    reflection.src = canvas.toDataURL('image/png');
    reflection.hidden = false;
  }

  async function ready() {
    cancelAnimationFrame(frame);
    render();
    await Promise.all(
      [output, document.querySelector('#ground-reflection')]
        .filter((image) => image && !image.hidden)
        .map((image) => image.decode())
    );
  }
  document.addEventListener('DOMContentLoaded', mount);
  // SOUL Cars Studio: salvar/restaurar ajustes por veículo.
  function snapshot() {
    const { enabled, strength, softness, depth, reflection, points } = state;
    return { enabled, strength, softness, depth, reflection, points: points.map((p) => ({ ...p })) };
  }
  function restore(saved) {
    if (!saved || !section) return;
    for (const key of ['strength', 'softness', 'depth', 'reflection'])
      if (typeof saved[key] === 'number') {
        state[key] = saved[key];
        const input = section.querySelector(`[data-setting="${key}"]`);
        input.value = saved[key];
        input.nextElementSibling.value = `${saved[key]}%`;
      }
    if (typeof saved.enabled === 'boolean') {
      state.enabled = saved.enabled;
      section.querySelector('#ground-enabled').checked = saved.enabled;
    }
    // Pontos só valem para o mesmo recorte (a estimativa automática já existe).
    if (state.transparent && Array.isArray(saved.points) && saved.points.length === 2)
      state.points = saved.points.map((p) => ({ x: Number(p.x), y: Number(p.y) }));
    sync();
    render();
  }

  return {
    paintFloorShadow,
    setImage,
    ready,
    snapshot,
    restore,
    contactsAdjusted() {
      return state.points.some((p, i) => !estimatedPoints[i] ||
        Math.abs(p.x - estimatedPoints[i].x) > 0.5 || Math.abs(p.y - estimatedPoints[i].y) > 0.5);
    },
    useOriginalFloor(value) {
      suppressed = value;
      render();
    }
  };
})();
