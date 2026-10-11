const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pt-BR");

export const moeda = (v: number | null) => (v == null ? "—" : brl.format(v));
export const km = (v: number | null) =>
  v == null ? "—" : `${num.format(v)} km`;

/** "R$ 89.900" ou "89900" → 89900 */
export const inteiro = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};
