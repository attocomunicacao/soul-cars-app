/**
 * Executor do Laboratório de testes da IA (sem Electron): roda um cenário de várias mensagens do
 * cliente pelo MESMO caminho do atendimento real (ficha → prompt → modelo → pós-processamento →
 * guarda anti-duplicação → auditoria), mantendo o estado entre os turnos. O modelo entra por uma
 * função injetada (`gerar`), então os testes usam respostas roteirizadas e o app usa Groq/Ollama.
 * Nunca escreve no uTalk nem envia nada: só devolve o resultado para a tela/relatório.
 */
import {
  montarMensagens,
  planoDeFotos,
  veiculoMencionado,
  PERSONA_PADRAO,
  LOJA_PADRAO,
  RESPOSTAS_PADRAO,
  normalizar,
  type ExemploIa,
  type LojaIa,
  type ParReal,
  type MensagemIa,
  type RespostaRapida,
  type VeiculoIa,
} from "../../shared/pre-service";
import {
  FICHA_VAZIA,
  coletaAtiva,
  fichaDaConversa,
  informados,
  mascararConversa,
  pendentes,
  podeTransferir,
  pediuHumano,
  type FichaLead,
} from "../../shared/lead-profile";
import {
  avaliarTurno,
  type SinalAuditoria,
} from "../../shared/pre-service-audit";
import type { Cenario, Esperado } from "../../shared/lab";
import { deveOmitir, posProcessar } from "../../shared/pre-service-pipeline";
import type { UsoModelo } from "../pre-service/llm";

export type { Cenario, Esperado } from "../../shared/lab";

export type TurnoLab = {
  cliente: string;
  bruto: string;
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  /** O guarda omitiria esta resposta no app (repete as últimas). */
  omitido: boolean;
  fotos: number;
  sinais: SinalAuditoria[];
  latenciaMs: number;
  /** Quem respondeu de fato (provedor, modelo, reserva) e quantos tokens a chamada gastou. */
  uso?: UsoModelo;
  /** Quantos exemplos reais da equipe (histórico do CRM) entraram no prompt deste turno. */
  reais?: number;
};

export type ResultadoCenario = {
  id: string;
  categoria: string;
  titulo: string;
  repeticao: number;
  turnos: TurnoLab[];
  /** Falhas contra `esperado` e sinais graves, em texto para a tela. */
  falhas: string[];
  erro?: string;
};

/** Dependências injetadas: modelo, estoque e textos da loja. */
export type DepsLab = {
  /** Devolve o texto bruto do modelo para as mensagens montadas; preenche `uso` quando recebe. */
  gerar: (
    mensagens: { role: string; content: string }[],
    uso?: UsoModelo,
  ) => Promise<string>;
  /** Exemplos reais da equipe (como no atendimento com "usar histórico do CRM" ligado). */
  reais?: ParReal[];
  /** Exemplos ensinados na tela "Ensinar". */
  exemplos?: ExemploIa[];
  veiculos?: VeiculoIa[];
  persona?: string;
  loja?: LojaIa;
  respostas?: RespostaRapida[];
  nomeAgente?: string;
  /** Relógio injetável (datas da ficha). */
  agora?: () => Date;
};

/** Estoque fictício do laboratório (nunca dados reais da loja). */
export const ESTOQUE_LAB: VeiculoIa[] = [
  {
    id: "l1",
    marca: "Honda",
    modelo: "Civic EXL 2.0 2019",
    placa: "ABC1D23",
    preco: "109.900",
    km: "84.000",
  },
  {
    id: "l2",
    marca: "Toyota",
    modelo: "Corolla XEi 2.0 2020",
    placa: "EFG4H56",
    preco: "124.900",
    km: "61.000",
  },
  {
    id: "l3",
    marca: "Volkswagen",
    modelo: "T-Cross Comfortline 1.0 TSI 2021",
    placa: "IJK7L89",
    preco: "112.500",
    km: "42.000",
  },
  {
    id: "l4",
    marca: "Chevrolet",
    modelo: "Onix LT 1.0 Turbo 2022",
    placa: "MNO0P12",
    preco: "79.900",
    km: "28.000",
  },
  {
    id: "l5",
    marca: "Jeep",
    modelo: "Renegade Longitude 1.8 2018",
    placa: "QRS3T45",
    preco: "89.900",
    km: "73.000",
  },
  {
    id: "l6",
    marca: "Hyundai",
    modelo: "HB20 Comfort 1.0 2021",
    placa: "UVW6X78",
    preco: "64.900",
    km: "39.000",
  },
];

const ARQUIVO_FOTOS_FICTICIAS = (id: string) => [
  `${id}-1.jpg`,
  `${id}-2.jpg`,
  `${id}-3.jpg`,
];

/**
 * Roda um cenário do começo ao fim. Em cada turno: acrescenta a mensagem do cliente, atualiza a
 * ficha, pede a resposta ao modelo, pós-processa, audita e guarda a resposta no histórico.
 */
export async function rodarCenario(
  c: Cenario,
  deps: DepsLab,
  repeticao = 1,
): Promise<ResultadoCenario> {
  const veiculos = deps.veiculos ?? ESTOQUE_LAB;
  const agora = deps.agora ?? (() => new Date());
  const loja = deps.loja ?? LOJA_PADRAO;
  const conversa: MensagemIa[] = [];
  const enviadas: Record<string, number> = {};
  let ficha: FichaLead = FICHA_VAZIA;
  const turnos: TurnoLab[] = [];
  try {
    for (const fala of c.turnos) {
      conversa.push({ role: "user", content: fala });
      ficha = fichaDaConversa(conversa, ficha, agora());
      const anteriorIa = [...conversa]
        .slice(0, -1)
        .reverse()
        .find((m) => m.role === "assistant");
      const carro = veiculoMencionado(
        veiculos,
        fala,
        anteriorIa?.content ?? "",
        ficha.veiculo ?? "",
      );
      if (carro)
        ficha = { ...ficha, veiculo: `${carro.marca} ${carro.modelo}` };
      // O modelo e a auditoria só veem a conversa mascarada (CPF e datas), como no app.
      const mascarada = mascararConversa(conversa);
      const plano = planoDeFotos({
        conversa: mascarada,
        veiculos,
        fotosDe: ARQUIVO_FOTOS_FICTICIAS,
        enviadas,
        maxFotos: 6,
      });
      const { mensagens, usados } = montarMensagens({
        persona: deps.persona ?? PERSONA_PADRAO,
        loja,
        config: { nomeAgente: deps.nomeAgente ?? "Sofia" },
        veiculos,
        respostas: deps.respostas ?? RESPOSTAS_PADRAO,
        exemplos: deps.exemplos ?? [],
        reais: deps.reais ?? [],
        conversa: mascarada,
        nomeLead: "Cliente",
        notaFotos: plano?.nota,
        ficha,
      });
      const inicio = Date.now();
      const uso: UsoModelo = { provedor: "", modelo: "", reserva: false };
      const bruto = await deps.gerar(mensagens, uso);
      const latenciaMs = Date.now() - inicio;
      const anteriores = mascarada
        .filter((m) => m.role === "assistant")
        .map((m) => m.content);
      const fotos = plano?.fotos.length ?? 0;
      const r = posProcessar({
        bruto,
        conversa: mascarada,
        ficha,
        veiculos,
        fotos,
        anteriores,
      });
      // Sem texto novo depois do guarda (tudo já dito) ou quase igual às últimas: o app não enviaria.
      const omitido =
        (!r.texto.trim() && !r.transferir && fotos === 0) ||
        deveOmitir(r.texto, anteriores, { transferir: r.transferir, fotos });
      const humano = pediuHumano(fala);
      const sinais = avaliarTurno({
        texto: r.texto,
        transferir: r.transferir,
        encerrar: r.encerrar,
        recebidas: [fala],
        veiculos,
        anteriores: anteriores.slice(-2),
        fotosPlanejadas: fotos,
        coleta: {
          financiado: ficha.pagamento.includes("financiado"),
          pendentes: coletaAtiva(ficha) ? pendentes(ficha) : [],
          podeTransferir: podeTransferir(ficha, { pediuHumano: humano }),
          informados: informados(ficha),
        },
      });
      turnos.push({
        cliente: fala,
        bruto,
        texto: r.texto,
        transferir: r.transferir,
        encerrar: r.encerrar,
        omitido,
        fotos,
        sinais,
        latenciaMs,
        ...(uso.provedor ? { uso } : {}),
        reais: usados.reais,
      });
      // Como no app: resposta omitida não entra no histórico; o resto vira a fala da IA.
      if (r.texto && !omitido) {
        conversa.push({ role: "assistant", content: r.texto });
        if (plano?.veiculo && fotos)
          enviadas[plano.veiculo.id] =
            (enviadas[plano.veiculo.id] ?? 0) + fotos;
      }
      if (r.transferir || r.encerrar) break;
    }
  } catch (e) {
    return {
      id: c.id,
      categoria: c.categoria,
      titulo: c.titulo,
      repeticao,
      turnos,
      falhas: [`Erro ao rodar: ${(e as Error).message}`],
      erro: (e as Error).message,
    };
  }
  return {
    id: c.id,
    categoria: c.categoria,
    titulo: c.titulo,
    repeticao,
    turnos,
    falhas: conferir(c.esperado ?? {}, turnos, ficha),
  };
}

/** Sinais que sempre contam como falha, mesmo sem `esperado`: repetição e texto sujo. */
const SINAIS_GRAVES: SinalAuditoria[] = [
  "resposta-repetida",
  "quase-repetida",
  "frase-duplicada",
  "palavra-repetida",
  "cpf-em-claro",
  "preco-fora-do-estoque",
  "perguntou-dado-ja-informado",
  "prometeu-consultor-sem-transferir",
];

/** Compara o resultado com o esperado e lista o que falhou (texto curto, em português). */
export function conferir(
  esperado: Esperado,
  turnos: TurnoLab[],
  ficha: FichaLead,
): string[] {
  const falhas: string[] = [];
  const textos = turnos.map((t) => normalizar(t.texto));
  turnos.forEach((t, i) => {
    if (!t.texto.trim() && !t.omitido)
      falhas.push(`Turno ${i + 1}: resposta vazia.`);
    if (/\[(TRANSFERIR|ENCERRAR)\]|<think>/i.test(t.texto))
      falhas.push(`Turno ${i + 1}: tag interna vazou no texto.`);
    for (const s of t.sinais) {
      const proibido = esperado.semSinais?.includes(s);
      if (SINAIS_GRAVES.includes(s) || proibido)
        falhas.push(`Turno ${i + 1}: ${s}.`);
    }
    if (t.omitido)
      falhas.push(`Turno ${i + 1}: resposta repetida (seria omitida).`);
  });
  if (esperado.transfere !== undefined) {
    const transferiu = turnos.some((t) => t.transferir);
    if (transferiu !== esperado.transfere)
      falhas.push(
        esperado.transfere
          ? "Esperava transferir e não transferiu."
          : "Transferiu quando não devia.",
      );
  }
  for (const trecho of esperado.contem ?? [])
    if (!textos.some((t) => t.includes(normalizar(trecho))))
      falhas.push(`Nenhuma resposta contém "${trecho}".`);
  for (const trecho of esperado.proibido ?? [])
    if (textos.some((t) => t.includes(normalizar(trecho))))
      falhas.push(`Alguma resposta contém o trecho proibido "${trecho}".`);
  const sabidos = new Set<string>(informados(ficha));
  for (const campo of esperado.coleta ?? [])
    if (!sabidos.has(campo)) falhas.push(`A ficha não registrou "${campo}".`);
  return falhas;
}

/**
 * Roda vários cenários em sequência (com N repetições cada), avisando o progresso. `cancelado`
 * é consultado entre cenários para o botão "Parar" da tela.
 */
export async function rodarLote(
  cenarios: Cenario[],
  deps: DepsLab,
  opcoes: {
    repeticoes?: number;
    progresso?: (feito: number, total: number, r: ResultadoCenario) => void;
    cancelado?: () => boolean;
    /** Interrompe o lote depois deste resultado (ex.: limite diário do Groq). */
    pararSe?: (r: ResultadoCenario) => boolean;
  } = {},
): Promise<ResultadoCenario[]> {
  const reps = Math.max(1, opcoes.repeticoes ?? 1);
  const total = cenarios.length * reps;
  const saida: ResultadoCenario[] = [];
  for (const c of cenarios)
    for (let i = 1; i <= reps; i++) {
      if (opcoes.cancelado?.()) return saida;
      const r = await rodarCenario(c, deps, i);
      saida.push(r);
      opcoes.progresso?.(saida.length, total, r);
      if (opcoes.pararSe?.(r)) return saida;
    }
  return saida;
}

/** Respostas genéricas e diferentes entre si, para o modo sem modelo (testa só o pós-processamento). */
const RESPOSTAS_ROTEIRIZADAS = [
  "Claro, posso te ajudar com isso.",
  "Certo, entendi o que você precisa.",
  "Perfeito, vou considerar isso no seu atendimento.",
  "Combinado, obrigada pelas informações.",
  "Entendi, vamos seguir com o seu atendimento.",
  "Ótimo, anotei o que você me disse.",
  "Tudo certo, estou acompanhando a sua conversa.",
  "Obrigada pela paciência, seguimos por aqui.",
];

/**
 * Modelo falso para o modo offline: devolve frases genéricas em rodízio (sem repetir em seguida).
 * Não mede a inteligência do modelo; mede se o pipeline mantém o texto final limpo e coerente.
 */
export function modeloRoteirizado(): DepsLab["gerar"] {
  let i = 0;
  return async () =>
    RESPOSTAS_ROTEIRIZADAS[i++ % RESPOSTAS_ROTEIRIZADAS.length];
}
