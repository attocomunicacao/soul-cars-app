 'use strict';
window.Layouts = (() => {
  const first = document.querySelector('#creative');
  const value = key => document.querySelector(`[name="${key}"]`)?.value.trim() ?? '';
  let selected = 4, frame = 0;
  function model() {
    const title = value('titulo')
      .toUpperCase()
      .replace(/\b(?:19|20)\d{2}(?:\/(?:\d{2}|\d{4}))?\b/g, '')
      .trim();
    return (
      title
        .replace(
          /^(?:MERCEDES[- ]BENZ|LAND ROVER|ALFA ROMEO|FORD|RENAULT|CHEVROLET|VOLKSWAGEN|VW|FIAT|TOYOTA|HONDA|HYUNDAI|NISSAN|PEUGEOT|CITRO[EË]N|SUZUKI|JEEP|KIA|BMW|AUDI|VOLVO|BYD|CHERY|CAOA CHERY|MITSUBISHI)\s+/,
          ''
        )
        .trim() || title
    );
  }

  function sync() { window.Layout4.sync(); window.Layout6.sync(); }
  function choose(number) {
    if (typeof exporting !== 'undefined' && exporting) return;
    selected = number === 6 ? 6 : 4;
    document.querySelector('#creative4').hidden = selected !== 4;
    document.querySelector('#creative6').hidden = selected !== 6;
    document.querySelector('#export-button').innerHTML = selected === 6 ? 'Baixar carrossel (3 PNGs) <span>↓</span>' : 'Baixar Tráfego Pago <span>↓</span>';
    document.querySelectorAll('[data-layout]').forEach(button => {
      const active = Number(button.dataset.layout) === selected;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    document.querySelector('.g-controls').closest('.editor-section')?.toggleAttribute('hidden', selected !== 4);
    document.querySelector('.v-inputs').closest('.editor-section')?.toggleAttribute('hidden', selected !== 6);
    window.ajustarPrevia?.(); sync();
    const resolution = document.querySelector('#export-resolution');
    if (resolution) for (const option of resolution.options) option.textContent = `${option.value === '1' ? 'Padrão' : 'Alta'} · ${1080 * Number(option.value)} × ${(selected === 6 ? 1350 : 1920) * Number(option.value)}`;
  }
  document.querySelectorAll('[data-layout]').forEach(button => {
    button.addEventListener('click', () => choose(Number(button.dataset.layout)));
    button.addEventListener('keydown', event => {
      if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault(); choose(event.key === 'Home' ? 4 : event.key === 'End' ? 6 : selected === 4 ? 6 : 4);
        document.querySelector(`[data-layout="${selected}"]`).focus();
      }
    });
  });
  new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); }).observe(first, {subtree:true, attributes:true});
  document.querySelector('#editor-form').addEventListener('input', sync);
  document.fonts.ready.then(sync);
  document.addEventListener('DOMContentLoaded', () => choose(4));
  async function zip(files) {
    const enc = new TextEncoder(),
      parts = [],
      central = [];
    let offset = 0;
    function crc(bytes) {
      let c = 0xffffffff;
      for (const b of bytes) {
        c ^= b;
        for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
      return (c ^ 0xffffffff) >>> 0;
    }
    for (const file of files) {
      const bytes = new Uint8Array(await file.blob.arrayBuffer()),
        name = enc.encode(file.name),
        sum = crc(bytes);
      const local = new Uint8Array(30 + name.length),
        v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x800, true);
      v.setUint32(14, sum, true);
      v.setUint32(18, bytes.length, true);
      v.setUint32(22, bytes.length, true);
      v.setUint16(26, name.length, true);
      local.set(name, 30);
      parts.push(local, bytes);
      const record = new Uint8Array(46 + name.length),
        r = new DataView(record.buffer);
      r.setUint32(0, 0x02014b50, true);
      r.setUint16(4, 20, true);
      r.setUint16(6, 20, true);
      r.setUint16(8, 0x800, true);
      r.setUint32(16, sum, true);
      r.setUint32(20, bytes.length, true);
      r.setUint32(24, bytes.length, true);
      r.setUint16(28, name.length, true);
      r.setUint32(42, offset, true);
      record.set(name, 46);
      central.push(record);
      offset += local.length + bytes.length;
    }
    const end = new Uint8Array(22),
      e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(
      12,
      central.reduce((sum, p) => sum + p.length, 0),
      true
    );
    e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
  return { get current() { return selected; }, sync, choose, zip, model };
})();
