'use strict';
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.grounding-controls').forEach((details) => (details.open = false));
  document.querySelector('.intro').innerHTML =
    '<p class="eyebrow">ÁREA DE CRIAÇÃO</p><h1>Criar anúncio</h1><p>Revise os dados, escolha o formato e baixe.</p>';
  document.querySelector('.preview-caption').textContent =
    'As alterações aparecem aqui. O tema do editor não altera a arte.';
  for (const [index, fieldset] of [...document.querySelectorAll('#editor-form > fieldset')].entries()) {
    const fold = document.createElement('details');
    fold.className = 'editor-section';
    fold.open = true;
    const summary = document.createElement('summary');
    summary.textContent = fieldset.querySelector('legend').textContent;
    fieldset.before(fold);
    fold.append(summary, fieldset);
    fieldset.querySelector('legend').classList.add('sr-only');
  }
  const quality = document.createElement('label');
  quality.className = 'export-quality';
  quality.innerHTML =
    'Resolução do PNG<select id="export-resolution"><option value="1">Padrão · 1080 × 1920</option><option value="2" selected>Alta · 2160 × 3840</option></select>';
  document.querySelector('.export-area').prepend(quality);
  document.querySelector('.export-note').textContent =
    'PNG sem compressão destrutiva · Processamento local';
  const guide = document.createElement('p');
  guide.className = 'quality-guide';
  guide.textContent =
    'Para maior nitidez, use as fotos originais. Ampliar uma foto pequena não recupera detalhes.';
  // Informação disponível junto da resolução, sem ocupar o painel.
  quality.title = guide.textContent;
  // O botão Baixar substitui o antigo "Exportar ↓" no cabeçalho da prévia.
  const baixar = document.querySelector('#export-button');
  baixar.classList.add('quick-export');
  document.querySelector('.preview-heading').append(baixar);
});
