import { lerXlsx, type Celula } from "./xlsx";

export type Conta = {
  /** Linha da planilha (1 = primeira). */
  linha: number;
  /** Identifica a conta para o "pago": aba, vencimento, destinatário e ocorrência. */
  id: string;
  vencimento: string | null;
  destinatario: string;
  valor: number | null;
  chave: string;
  via: string;
  acesso: string;
  local: string;
};

export type Bloco = {
  /** Linha do TOTAL: é onde entram as contas novas. */
  linhaTotal: number;
  rotulo: string;
  contas: Conta[];
  total: number;
  /** Total que a própria planilha mostra (pode diferir da soma real). */
  totalPlanilha: number | null;
};

/**
 * Contas de valor variável, por bloco (0 = vencimento dia 05, 1 = dia 20). Vale o início do nome,
 * sem acento nem maiúsculas. As demais têm valor fixo: o app não altera nem o valor, nem o resto.
 */
export const CONTAS_VARIAVEIS: string[][] = [
  ["PORTO", "CARTORIO", "BNDV", "ENEL", "ALUGUEL", "VIVO"],
  ["GESSE", "SABESP", "COMGAS", "ENEL"],
];

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();

export function valorVariavel(bloco: number, destinatario: string): boolean {
  const nome = semAcento(destinatario);
  return (CONTAS_VARIAVEIS[bloco] ?? []).some((n) => nome.startsWith(n));
}

export type Mes = { nome: string; blocos: Bloco[] };

/** Valor digitado ("1.234,56", "R$ 90", "90.5") → número; vazio → null; inválido → undefined. */
export function lerValorDigitado(entrada: string): number | null | undefined {
  const t = entrada.replace(/R\$|\s/g, "");
  if (!t) return null;
  const n = Number(
    t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t,
  );
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

const texto = (c: Celula | undefined) =>
  c === null || c === undefined ? "" : String(c).trim();

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** "AAAA-MM-DD" ou "DD/MM/AAAA" → "AAAA-MM-DD"; outra coisa → null. */
export function dataIso(c: Celula | undefined): string | null {
  const t = texto(c);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

const numero = (c: Celula | undefined) =>
  typeof c === "number" && Number.isFinite(c) ? c : null;

/**
 * Lê as abas mensais: cada tabela começa numa linha com "VENCIMENTO" na coluna B e
 * termina na linha com "TOTAL" na coluna C (colunas B a H: vencimento, destinatário,
 * valor, chave, via, acesso, local).
 */
export function lerMeses(abas: { nome: string; linhas: Celula[][] }[]): Mes[] {
  const meses: Mes[] = [];
  for (const aba of abas) {
    const blocos: Bloco[] = [];
    let atual: Conta[] | null = null;
    const vistos = new Map<string, number>();
    for (const [i, l] of aba.linhas.entries()) {
      if (texto(l[1]).toUpperCase() === "VENCIMENTO") {
        atual = [];
        continue;
      }
      if (!atual) continue;
      if (texto(l[2]).toUpperCase() === "TOTAL") {
        const dia = dataIso(l[1]);
        blocos.push({
          linhaTotal: i + 1,
          rotulo: dia
            ? `Vencimento dia ${dia.slice(8)}`
            : `Bloco ${blocos.length + 1}`,
          contas: atual,
          total: arredondar(atual.reduce((s, c) => s + (c.valor ?? 0), 0)),
          totalPlanilha: numero(l[3]),
        });
        atual = null;
        continue;
      }
      const destinatario = texto(l[2]);
      if (!destinatario) continue;
      const vencimento = dataIso(l[1]);
      const base = `${aba.nome}|${vencimento ?? ""}|${destinatario}`;
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);
      atual.push({
        linha: i + 1,
        id: `${base}|${n}`,
        vencimento,
        destinatario,
        valor: numero(l[3]),
        chave: texto(l[4]),
        via: texto(l[5]),
        acesso: texto(l[6]),
        local: texto(l[7]),
      });
    }
    if (blocos.length) meses.push({ nome: aba.nome, blocos });
  }
  return meses;
}

export type ResumoMes = {
  total: number;
  pago: number;
  aPagar: number;
  atrasadas: number;
  proxima: Conta | null;
};

/** Totais do mês; `hoje` em "AAAA-MM-DD". Conta sem valor ainda não entra na soma. */
export function resumirMes(
  mes: Mes,
  pagos: Record<string, boolean>,
  hoje: string,
): ResumoMes {
  let total = 0;
  let pago = 0;
  let atrasadas = 0;
  let proxima: Conta | null = null;
  for (const c of mes.blocos.flatMap((b) => b.contas)) {
    const v = c.valor ?? 0;
    total += v;
    if (pagos[c.id]) {
      pago += v;
      continue;
    }
    if (c.vencimento && c.vencimento < hoje) atrasadas++;
    else if (
      c.vencimento &&
      (!proxima || c.vencimento < (proxima.vencimento ?? ""))
    )
      proxima = c;
  }
  return {
    total: arredondar(total),
    pago: arredondar(pago),
    aPagar: arredondar(total - pago),
    atrasadas,
    proxima,
  };
}

export async function lerPlanilhaFinancas(base64: string): Promise<Mes[]> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const meses = lerMeses(await lerXlsx(bytes.buffer));
  if (!meses.length)
    throw new Error(
      "Não encontrei tabelas com VENCIMENTO e TOTAL nas abas da planilha.",
    );
  return meses;
}
