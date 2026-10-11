export type MidiaInstagram = {
  caminho: string;
  nome: string;
  tipo: "carrossel" | "capa" | "video";
  posicao?: number;
  miniatura?: string;
};
export type PlanoInstagram = {
  veiculoId: number;
  nome: string;
  pasta: string;
  arquivos: MidiaInstagram[];
  carrossel: string;
  reels: string;
  pendencias: string[];
};
export type EtapaInstagram =
  "pendente" | "preparando" | "publicando" | "publicado" | "conferir";
export type RegistroInstagram = {
  veiculoId: number;
  conta: string;
  carrossel: EtapaInstagram;
  reels: EtapaInstagram;
  atualizado: string;
  detalhe: string;
  assinatura: string;
};
export type EstadoInstagram = {
  aberto: boolean;
  ocupado: boolean;
  conta: string;
  registro: RegistroInstagram | null;
};
export const contaInstagram = (valor: string) =>
  valor.trim().replace(/^@/, "").toLowerCase();
export function slugInstagram(nome: string, ano: string | null) {
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const titulo = normalizar(nome),
    a = normalizar(ano || "");
  return !a || titulo.endsWith(`-${a}`) || titulo === a
    ? titulo
    : `${titulo}-${a}`;
}
