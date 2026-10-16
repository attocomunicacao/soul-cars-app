/**
 * Classificação das etiquetas do CRM (uTalk) da loja. O main e a interface usam o mesmo formato.
 *
 * - Veículo: "🚘 FIESTA 2016", "🏍 NMAX 2023" (emoji de carro/moto ou "MODELO ANO").
 * - Etapa do atendimento: FOLLOW, CALL, hora marcada, agendado, confirmado, simulação, vendido.
 * - Encerrado: FINALIZADO e DESQUALIFICADO.
 * - Temperatura: QUENTE e FRIO.
 */

export type EtiquetaClassificada =
  | { tipo: "veiculo"; modelo: string; ano: number | null }
  | { tipo: "etapa"; chave: Etapa }
  | { tipo: "encerrado"; chave: "finalizado" | "desqualificado" }
  | { tipo: "temperatura"; chave: "quente" | "frio" }
  | { tipo: "outra" };

export type Etapa =
  | "follow1"
  | "follow2"
  | "call1"
  | "call2"
  | "call3"
  | "horaMarcada"
  | "agendado"
  | "reagendado"
  | "confirmado"
  | "simulacao"
  | "vendido";

/** Etapas na ordem do funil, com o rótulo mostrado na tela. */
export const ETAPAS: { chave: Etapa; rotulo: string; texto: string }[] = [
  { chave: "follow1", rotulo: "1º follow-up", texto: "1 FOLLOW" },
  { chave: "follow2", rotulo: "2º follow-up", texto: "2 FOLLOW" },
  { chave: "call1", rotulo: "1ª ligação", texto: "1 CALL" },
  { chave: "call2", rotulo: "2ª ligação", texto: "2 CALL" },
  { chave: "call3", rotulo: "3ª ligação", texto: "3 CALL" },
  {
    chave: "horaMarcada",
    rotulo: "Ligação com hora marcada",
    texto: "LIGACAO COM HORA MARCADA",
  },
  { chave: "simulacao", rotulo: "Simulação", texto: "SIMULACAO" },
  { chave: "agendado", rotulo: "Agendado", texto: "AGENDADO" },
  { chave: "reagendado", rotulo: "Reagendado", texto: "REAGENDADO" },
  { chave: "confirmado", rotulo: "Confirmado", texto: "CONFIRMADO" },
  { chave: "vendido", rotulo: "Vendido", texto: "VENDIDO" },
];

/** Texto sem emojis, sem acentos, em maiúsculas e com espaços simples. */
export function textoLimpo(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Só letras e números: "T-CROSS", "T CROSS" e "TCROSS" ficam iguais. */
export const compacto = (s: string) => textoLimpo(s).replace(/\s/g, "");

const EMOJI_VEICULO = /[\u{1F697}\u{1F698}\u{1F699}\u{1F3CD}\u{1F6FB}]/u;

export function classificarEtiqueta(
  nome: string,
  emoji?: string | null,
): EtiquetaClassificada {
  const limpo = textoLimpo(nome);
  const etapa = ETAPAS.find((e) => e.texto === limpo);
  if (etapa) return { tipo: "etapa", chave: etapa.chave };
  if (limpo === "FINALIZADO") return { tipo: "encerrado", chave: "finalizado" };
  if (limpo === "DESQUALIFICADO")
    return { tipo: "encerrado", chave: "desqualificado" };
  if (limpo === "QUENTE") return { tipo: "temperatura", chave: "quente" };
  if (limpo === "FRIO") return { tipo: "temperatura", chave: "frio" };

  const comAno = /^(.+?)\s+((?:19|20)\d{2})$/.exec(limpo);
  const temEmoji = EMOJI_VEICULO.test(`${emoji ?? ""}${nome}`);
  if (comAno) return { tipo: "veiculo", modelo: comAno[1], ano: +comAno[2] };
  if (temEmoji && limpo) return { tipo: "veiculo", modelo: limpo, ano: null };
  return { tipo: "outra" };
}

/** Demanda de um modelo (todas as etiquetas dele somadas) com o detalhe por ano. */
export type DemandaModelo = {
  modelo: string;
  leads: number;
  anos: { ano: number | null; leads: number }[];
};

type Contada = { nome: string; emoji?: string | null; leads: number };

/** Soma as etiquetas de veículo por modelo; "Prisma 2011" e "PRISMA 2011" viram uma só. */
export function demandaPorModelo(etiquetas: Contada[]): DemandaModelo[] {
  const modelos = new Map<string, Map<number | null, number>>();
  for (const e of etiquetas) {
    const c = classificarEtiqueta(e.nome, e.emoji);
    if (c.tipo !== "veiculo") continue;
    const anos = modelos.get(c.modelo) ?? new Map<number | null, number>();
    anos.set(c.ano, (anos.get(c.ano) ?? 0) + e.leads);
    modelos.set(c.modelo, anos);
  }
  return [...modelos]
    .map(([modelo, anos]) => ({
      modelo,
      leads: [...anos.values()].reduce((a, b) => a + b, 0),
      anos: [...anos]
        .map(([ano, leads]) => ({ ano, leads }))
        .sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0)),
    }))
    .sort((a, b) => b.leads - a.leads || a.modelo.localeCompare(b.modelo));
}

/** Resumo mínimo de um veículo em estoque para cruzar com a demanda. */
export type VeiculoEstoque = {
  marca: string;
  modelo: string;
  ano: string | null;
};

/** Quantos veículos em estoque correspondem ao modelo (e ao ano, quando a etiqueta o traz). */
export function emEstoque(
  modelo: string,
  ano: number | null,
  estoque: VeiculoEstoque[],
): number {
  const alvo = compacto(modelo);
  if (!alvo) return 0;
  return estoque.filter((v) => {
    if (!compacto(`${v.marca} ${v.modelo}`).includes(alvo)) return false;
    return ano === null || (v.ano ?? "").includes(String(ano));
  }).length;
}
