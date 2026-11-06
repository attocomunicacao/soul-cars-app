/** Há quanto tempo foi `iso`, em texto curto ("12 min", "3 h", "2 d"). Vazio se a data for inválida. */
export function haQuanto(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.floor((agora - t) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
