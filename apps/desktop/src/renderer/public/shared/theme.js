/**
 * Tema compartilhado (claro/escuro) entre o app e o editor de criativos.
 */
/* Runs before paint. The shell owns the theme when the creative editor is embedded. */
(() => {
  'use strict';
  const storageKey = 'soul-theme';
  const embedded =
    window.parent !== window && new URLSearchParams(location.search).get('integrated') === '1';
  const preference = matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    /* Storage is optional for file://. */
  }

  function apply(theme, persist = false) {
    if (!['light', 'dark'].includes(theme)) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.textContent = theme === 'dark' ? '☀ Tema claro' : '◐ Tema escuro';
      button.setAttribute(
        'aria-label',
        `Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'} em todo o site`
      );
    });
    if (persist) {
      saved = theme;
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        /* Keep the session theme. */
      }
    }
    document.dispatchEvent(new CustomEvent('soul:theme-changed', { detail: theme }));
  }

  const initial = embedded ? new URLSearchParams(location.search).get('theme') : saved;
  apply(
    initial === 'light' || initial === 'dark' ? initial : preference.matches ? 'dark' : 'light'
  );
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.hidden = embedded;
      button.addEventListener('click', () =>
        apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true)
      );
    });
    apply(document.documentElement.dataset.theme);
  });
  preference.addEventListener('change', (event) => {
    if (!saved && !embedded) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey && !embedded) apply(event.newValue);
  });
  window.SoulTheme = Object.freeze({
    apply,
    get current() {
      return document.documentElement.dataset.theme;
    }
  });
})();
