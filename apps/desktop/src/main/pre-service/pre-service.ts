/**
 * Pré-atendimento IA no processo principal (portado do Soul IA): o laço que atende pelo WhatsApp
 * (uTalk) os leads com a etiqueta de gatilho, o envio de fotos das pastas do ESTOQUE, os rascunhos
 * para aprovação, o simulador "Ensinar" e as configurações.
 *
 * Reaproveita o que o app já tem: o token do uTalk (crm/utalk), o estoque baixado do BNDV
 * (`dados/bndv_veiculos.csv`, só "DISPONÍVEL ESTOQUE" e ativos), as pastas `ESTOQUE/<id>_…/FOTOS` e a
 * memória das conversas da Soul IA (exemplos reais). O estado fica em `pre-atendimento.json` na pasta
 * interna do app; a chave do Groq fica cifrada (safeStorage) no config.json e nunca volta à interface.
 * O laço só roda com "ligado" marcado nas Configurações (desligado por padrão).
 */
import fs from "node:fs";
import path from "node:path";
import { nativeImage, safeStorage } from "electron";
import * as caminhos from "../core/paths";
import { tokenUtalk } from "../crm/utalk";
import { descobrirOrganizacao, type Buscar } from "../crm/utalk-api";
import { ehAtivo, lerCsv } from "../inventory/folder-sync";
import { conversasDaMemoria } from "../soul-ai/soul-ai";
import { arquivoNaRaiz, pastaFotos } from "../studio/files";
import {
  CONFIG_PADRAO,
  LOJA_PADRAO,
  PERSONAS_ANTERIORES,
  PERSONA_PADRAO,
  RESPOSTAS_PADRAO,
  doContato,
  extrairPares,
  fotosNumeradas,
  interpretarResposta,
  montarMensagens,
  normalizar,
  planoDeFotos,
  preencher,
  respostaDeAbertura,
  veiculoMencionado,
  FINANCIAMENTO_ANTERIOR,
  voltouParaIa,
  variaveis,
  type ConfigIa,
  type ExemploIa,
  type LojaIa,
  type MensagemIa,
  type ParReal,
  type RespostaRapida,
  type VeiculoIa,
} from "../../shared/pre-service";
import { lerKmEValor } from "../../shared/des-md";
import {
  FICHA_VAZIA,
  anexarPergunta,
  coletaAtiva,
  coletaCompleta,
  fecharTransferencia,
  informados,
  proximaPergunta,
  fichaCompativel,
  fichaDaConversa,
  mascarar,
  mascararConversa,
  motivoDaTransferencia,
  pediuHumano,
  pendentes,
  podeTransferir,
  resumoParaSdr,
  rotulos,
  type FichaLead,
} from "../../shared/lead-profile";
import {
  avaliarTurno,
  mascararTelefone,
  type Desfecho,
} from "../../shared/pre-service-audit";
import { gravarDesfecho, gravarTurno, lerTurnos } from "./audit";
import { gerar, listarModelos, type UsoModelo } from "./llm";
import {
  clienteEscrita,
  horaDa,
  textoDa,
  type ClienteEscrita,
} from "./utalk-writer";

type Emitir = (nome: string, carga: unknown) => void;
const buscar = fetch as Buscar;

// ------------------------------------------------------------------ estado
type EstadoChat = {
  chatId: string;
  contatoId: string | null;
  nome: string;
  telefone: string | null;
  historico: (MensagemIa & { em: number })[];
  status: "ativo" | "humano" | "encerrado";
  vistoAte: number;
  ultimaIaEm: number | null;
  fotosEnviadas: Record<string, number>;
  /** A IA conseguiu tirar a etiqueta de gatilho ao transferir? (`false` = ela ainda está no lead) */
  gatilhoRetirado?: boolean;
  /** O que a IA já sabe do lead (CPF cifrado). */
  ficha?: FichaLead;
  /** Só as mensagens depois deste instante contam para a ficha (começa um novo ciclo ao devolver o lead à IA). */
  fichaDesde?: number;
};
export type Rascunho = {
  id: string;
  chatId: string;
  nome: string;
  pergunta: string;
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  fotos: string[];
  veiculoFotos: string | null;
  veiculoFotosId: string | null;
  inicioFotos: number;
  em: number;
};
type Registro = { em: string; tipo: string; texto: string };
type Estado = {
  config: ConfigIa;
  loja: LojaIa;
  persona: string;
  respostas: RespostaRapida[];
  exemplos: ExemploIa[];
  chats: Record<string, EstadoChat>;
  rascunhos: Rascunho[];
  registros: Registro[];
};

const ARQUIVO = () => path.join(caminhos.userData(), "pre-atendimento.json");
const CHAVE_GROQ = "groqChaveCifrada";
let estado: Estado | null = null;
let emitirEvento: Emitir = () => {};

function carregar(): Estado {
  if (estado) return estado;
  let lido: Partial<Estado> = {};
  try {
    lido = JSON.parse(fs.readFileSync(ARQUIVO(), "utf8")) as Partial<Estado>;
  } catch {
    /* primeira vez */
  }
  estado = {
    config: { ...CONFIG_PADRAO, ...lido.config },
    loja: {
      ...LOJA_PADRAO,
      ...lido.loja,
      ...(lido.loja?.financiamento === FINANCIAMENTO_ANTERIOR
        ? { financiamento: LOJA_PADRAO.financiamento }
        : {}),
    },
    persona:
      !lido.persona || PERSONAS_ANTERIORES.includes(lido.persona)
        ? PERSONA_PADRAO
        : lido.persona,
    respostas: lido.respostas ?? structuredClone(RESPOSTAS_PADRAO),
    exemplos: lido.exemplos ?? [],
    chats: Object.fromEntries(
      Object.entries(lido.chats ?? {}).map(([id, c]) => [
        id,
        c.ficha ? { ...c, ficha: fichaCompativel(c.ficha) } : c,
      ]),
    ),
    rascunhos: lido.rascunhos ?? [],
    registros: lido.registros ?? [],
  };
  return estado;
}
function gravar() {
  fs.mkdirSync(caminhos.userData(), { recursive: true });
  fs.writeFileSync(ARQUIVO(), JSON.stringify(carregar(), null, 1), "utf8");
  emitirEvento("preatendimento:mudou", null);
}
function registrar(tipo: string, texto: string) {
  const e = carregar();
  e.registros.unshift({ em: new Date().toISOString(), tipo, texto });
  e.registros = e.registros.slice(0, 300);
  gravar();
}
const novoId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ------------------------------------------------------------ ficha do lead
/** Guarda CPF e nascimento cifrados (safeStorage); sem criptografia no sistema, só marca como informado. */
function cifrar(valor: string): string {
  return safeStorage.isEncryptionAvailable()
    ? "enc:" + safeStorage.encryptString(valor).toString("base64")
    : "informado";
}
/** Valor em claro a partir do que está guardado ("" se não der para decifrar). */
function lerSegredo(guardado: string): string {
  if (!guardado.startsWith("enc:")) return "";
  try {
    return safeStorage.decryptString(Buffer.from(guardado.slice(4), "base64"));
  } catch {
    return "";
  }
}
/** Atualiza a ficha com a conversa e cifra o CPF e o nascimento recém-lidos (nunca são gravados em claro). */
function atualizarFicha(base: FichaLead | undefined, conversa: MensagemIa[]) {
  const f = fichaDaConversa(conversa, base ?? FICHA_VAZIA);
  if (/^[0-9]{11}$/.test(f.cpf)) f.cpf = cifrar(f.cpf);
  if (/^[0-9]{2}[/][0-9]{2}[/][0-9]{4}$/.test(f.nascimento))
    f.nascimento = cifrar(f.nascimento);
  return f;
}

// ------------------------------------------------------------ auditoria
const ARQUIVO_AUDITORIA = () =>
  path.join(caminhos.userData(), "pre-atendimento-auditoria.jsonl");
type RespostaIa = Awaited<ReturnType<typeof responder>>;

/** Grava um turno na auditoria (nunca lança: a auditoria não pode atrapalhar o atendimento). */
function auditarTurno(a: {
  id: string;
  origem: "laco" | "simulador";
  chatId: string | null;
  nome: string;
  telefone: string | null;
  recebidas: string[];
  anteriores: string[];
  desfecho: Desfecho;
  r?: RespostaIa;
  erro?: string;
  ficha?: FichaLead;
}) {
  try {
    const { r } = a;
    const abertura = r?.auditoria.uso.provedor === "resposta-de-abertura";
    const sinais =
      r && !abertura
        ? avaliarTurno({
            texto: r.texto,
            transferir: r.transferir,
            encerrar: r.encerrar,
            recebidas: a.recebidas,
            veiculos: r.auditoria.veiculos,
            anteriores: a.anteriores,
            fotosPlanejadas: r.plano?.fotos.length ?? 0,
            coleta: a.ficha && {
              financiado: a.ficha.pagamento.includes("financiado"),
              pendentes: pendentes(a.ficha),
              informados: informados(a.ficha),
              podeTransferir: podeTransferir(a.ficha),
            },
          })
        : [];
    if (a.erro) sinais.push("erro");
    gravarTurno(ARQUIVO_AUDITORIA(), {
      id: a.id,
      em: new Date().toISOString(),
      origem: a.origem,
      chatId: a.chatId,
      nome: a.nome,
      telefone: mascararTelefone(a.telefone),
      recebidas: a.recebidas,
      provedor: r?.auditoria.uso.provedor ?? "",
      modelo: r?.auditoria.uso.modelo ?? "",
      reserva: r?.auditoria.uso.reserva ?? false,
      latenciaMs: r?.auditoria.latenciaMs ?? 0,
      bruto: r?.auditoria.bruto ?? "",
      texto: r?.texto ?? "",
      transferir: r?.transferir ?? false,
      encerrar: r?.encerrar ?? false,
      usados: r?.usados ?? {
        respostas: [],
        veiculos: 0,
        exemplos: 0,
        reais: 0,
      },
      fotos: {
        veiculo: r?.plano?.veiculo
          ? `${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}`
          : null,
        qtd: r?.plano?.fotos.length ?? 0,
        semFotos: !!r?.plano?.semFotos,
      },
      estoque: r?.auditoria.veiculos.length ?? 0,
      desfecho: a.desfecho,
      ...(a.ficha ? { faltando: rotulos(pendentes(a.ficha)) } : {}),
      ...(a.erro ? { erro: a.erro } : {}),
      sinais,
    });
  } catch {
    /* sem auditoria neste turno */
  }
}

/** Turnos auditados, do mais recente ao mais antigo, para a aba Auditoria. */
export const auditoria = (limite = 200) =>
  lerTurnos(ARQUIVO_AUDITORIA(), Math.min(Math.max(limite, 1), 1000));

// ------------------------------------------------------------ chave do Groq
function chaveGroq(): string | null {
  const g = caminhos.lerConfig()[CHAVE_GROQ];
  if (typeof g !== "string" || !g) return null;
  try {
    return safeStorage.decryptString(Buffer.from(g, "base64"));
  } catch {
    return null;
  }
}
/** Guarda a chave do Groq cifrada pelo sistema; "" remove. */
export function salvarChaveGroq(chave: string) {
  const limpa = chave.trim().replace(/^Bearer\s+/i, "");
  if (!limpa) caminhos.gravarConfig({ [CHAVE_GROQ]: "" });
  else {
    if (limpa.length < 20)
      throw new Error("Cole a chave completa do Groq (começa com gsk_).");
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        "O Windows não liberou a cifragem para guardar a chave com segurança.",
      );
    caminhos.gravarConfig({
      [CHAVE_GROQ]: safeStorage.encryptString(limpa).toString("base64"),
    });
  }
  return painel();
}

// ------------------------------------------------------------ estoque e fotos
/** Veículos disponíveis: status "DISPONÍVEL ESTOQUE", ativos no último download do BNDV e com fotos na pasta. */
export function veiculosDisponiveis(): VeiculoIa[] {
  let linhas: Record<string, string>[];
  try {
    linhas = lerCsv(caminhos.CSV_VEICULOS());
  } catch {
    return [];
  }
  return (
    linhas
      .filter(
        (v) =>
          ehAtivo(v) &&
          normalizar(v.status).trim().startsWith("disponivel estoque"),
      )
      .map((v) => {
        const n = Number(
          String(v.salePrice ?? v.price ?? "").replace(",", "."),
        );
        const id = String(v.idVehicle ?? "");
        const des = desMdDo(id);
        return {
          id,
          marca: String(v.brand ?? "").trim(),
          modelo: String(v.model ?? "").trim(),
          placa: String(v.plate ?? "").toUpperCase(),
          // O valor do DES.md (o anunciado) vale mais que o do BNDV, que muitas vezes vem zerado.
          preco:
            des.valor ||
            (Number.isFinite(n) && n > 0
              ? Math.round(n).toLocaleString("pt-BR")
              : ""),
          km: des.km || String(v.km ?? "").trim(),
        };
      })
      // Regra da loja: só fica disponível (catálogo e IA) quem está em estoque no BNDV E tem fotos na pasta.
      .filter((v) => v.id && fotosDo(v.id).length > 0)
  );
}

/** Quilometragem e valor do DES.md da pasta do veículo ("" quando não há DES.md ou o campo). */
function desMdDo(id: string): { km: string; valor: string } {
  try {
    const pasta = pastaDoVeiculo(id);
    const arq = pasta && arquivoNaRaiz(pasta, "DES.md");
    return arq
      ? lerKmEValor(fs.readFileSync(arq, "utf8"))
      : { km: "", valor: "" };
  } catch {
    return { km: "", valor: "" };
  }
}

function pastaDoVeiculo(id: string): string | null {
  const raiz = caminhos.ESTOQUE();
  if (!fs.existsSync(raiz)) return null;
  const nome = fs.readdirSync(raiz).find((d) => d.split("_")[0] === id);
  return nome ? path.join(raiz, nome) : null;
}
/** Fotos numeradas de `ESTOQUE/<id>_…/FOTOS` (ou FOTO, Imagens…), em ordem (caminhos completos). */
export function fotosDo(id: string): string[] {
  const p = pastaDoVeiculo(id);
  const dir = p && pastaFotos(p);
  if (!dir || !fs.existsSync(dir)) return [];
  return fotosNumeradas(fs.readdirSync(dir)).map((f) => path.join(dir, f));
}
const miniatura = (arquivo: string) => {
  const img = nativeImage.createFromPath(arquivo);
  return img.isEmpty() ? "" : img.resize({ width: 240 }).toDataURL();
};

// ------------------------------------------------------------ exemplos reais
let pares: ParReal[] | null = null;
function paresReais(): ParReal[] {
  if (pares) return pares;
  const e = carregar();
  // O que a IA mandou sai com o usuário do token: não pode virar "exemplo da equipe".
  const daIa = new Set(
    Object.values(e.chats).flatMap((c) =>
      c.historico
        .filter((m) => m.role === "assistant")
        .map((m) => m.content.trim()),
    ),
  );
  try {
    pares = extrairPares(
      conversasDaMemoria().map((c) => ({
        id: c.id,
        direta: true, // a memória só guarda chats diretos (DirectMessage)
        etiquetas: c.etiquetas,
        mensagens: c.mensagens.map((m) => ({
          em: new Date(m.em).getTime(),
          // "externo" = enviada pelo celular da loja (equipe).
          de:
            m.origem === "lead"
              ? "lead"
              : m.origem === "robo"
                ? "robo"
                : "equipe",
          texto: m.texto ?? "",
          tipo: m.tipo,
          privada: m.privada,
        })),
      })),
      daIa,
    );
  } catch {
    pares = [];
  }
  return pares;
}

// ------------------------------------------------------------ resposta
type Lead = {
  nome: string;
  etiquetas: string[];
  fotosEnviadas: Record<string, number>;
  ficha?: FichaLead;
  /** Estoque já carregado pelo chamador (evita ler o CSV e as pastas duas vezes por rodada). */
  veiculos?: VeiculoIa[];
};

async function responder(conversa: MensagemIa[], lead: Lead) {
  const e = carregar();
  const cfg = e.config;
  const abertura = !conversa.length && respostaDeAbertura(e.respostas);
  if (abertura)
    return {
      texto: preencher(
        abertura.texto,
        variaveis(e.loja, cfg.nomeAgente, lead.nome),
      ),
      transferir: false,
      encerrar: false,
      plano: null,
      usados: {
        respostas: [abertura.titulo],
        veiculos: 0,
        exemplos: 0,
        reais: 0,
      },
      auditoria: {
        bruto: "",
        uso: { provedor: "resposta-de-abertura", modelo: "", reserva: false },
        latenciaMs: 0,
        veiculos: [] as VeiculoIa[],
      },
    };
  const veiculos = lead.veiculos ?? veiculosDisponiveis();
  const plano = planoDeFotos({
    conversa,
    veiculos,
    fotosDe: fotosDo,
    etiquetas: lead.etiquetas,
    enviadas: lead.fotosEnviadas,
    maxFotos: cfg.maxFotos,
  });
  const { mensagens, usados } = montarMensagens({
    persona: e.persona,
    loja: e.loja,
    config: cfg,
    veiculos,
    respostas: e.respostas,
    exemplos: e.exemplos,
    reais: cfg.usarHistoricoCrm ? paresReais() : [],
    conversa,
    nomeLead: lead.nome,
    notaFotos: plano?.nota,
    ficha: lead.ficha,
  });
  const inicio = Date.now();
  const uso: UsoModelo = {
    provedor: cfg.provedor,
    modelo: cfg.provedor === "groq" ? cfg.modeloGroq : cfg.modeloOllama,
    reserva: false,
  };
  const bruto = await gerar(
    buscar,
    mensagens,
    cfg,
    chaveGroq(),
    (t) => registrar("reserva", t),
    uso,
  );
  const f = lead.ficha;
  const humano = pediuHumano(
    conversa.filter((m) => m.role === "user").at(-1)?.content ?? "",
  );
  const lido = interpretarResposta(bruto, conversa, {
    bloquearTransferencia: !!f && !podeTransferir(f, { pediuHumano: humano }),
  });
  // Qualificação completa, cliente que recusa ou que pede alguém: a transferência não depende de o modelo lembrar da tag.
  const proxima =
    f && !f.entregue && coletaAtiva(f) ? proximaPergunta(f) : null;
  // O modelo prometeu "um consultor vai ligar" e não há mais nada a perguntar: transfere de verdade.
  const prometeu =
    /consultor (vai|ira|entrara|continua)/.test(normalizar(lido.texto)) &&
    !proxima;
  const forcar =
    !!f &&
    !f.entregue &&
    (coletaCompleta(f) || f.recusou || humano || prometeu);
  const transferir = lido.transferir || (forcar && !lido.encerrar);
  // Quem pergunta é o sistema (sempre o item certo, na ordem): o texto do modelo fica só com a resposta.
  let texto = lido.texto;
  if (f && transferir) texto = fecharTransferencia(texto, f);
  else if (proxima && !lido.encerrar && (plano?.fotos.length ?? 0) === 0)
    texto = anexarPergunta(texto, proxima.frase, proxima.campos);
  return {
    ...lido,
    texto,
    transferir,
    plano,
    usados,
    auditoria: { bruto, uso, latenciaMs: Date.now() - inicio, veiculos },
  };
}

/** Simulador "Ensinar": responde à conversa digitada na tela, sem enviar nada. Fotos vêm como miniaturas. */
export async function simular(a: {
  conversa: MensagemIa[];
  nome?: string;
  etiquetas?: string[];
  enviadas?: Record<string, number>;
}) {
  const r = await responder(mascararConversa(a.conversa), {
    nome: a.nome || "Cliente",
    etiquetas: a.etiquetas ?? [],
    fotosEnviadas: a.enviadas ?? {},
    ficha: fichaDaConversa(a.conversa),
  });
  auditarTurno({
    id: novoId(),
    origem: "simulador",
    chatId: null,
    nome: a.nome || "Cliente",
    telefone: null,
    recebidas: a.conversa
      .filter((m) => m.role === "user")
      .slice(-1)
      .map((m) => mascarar(m.content, true)),
    anteriores: a.conversa
      .filter((m) => m.role === "assistant")
      .slice(-2)
      .map((m) => m.content),
    desfecho: "simulado",
    r,
    ficha: fichaDaConversa(a.conversa),
  });
  return {
    texto: r.texto,
    transferir: r.transferir,
    encerrar: r.encerrar,
    usados: r.usados,
    fotos: (r.plano?.fotos ?? []).map(miniatura),
    veiculoFotos: r.plano?.veiculo
      ? `${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}`
      : null,
    veiculoFotosId: r.plano?.veiculo?.id ?? null,
    inicioFotos: r.plano?.inicio ?? 0,
    semFotos: !!r.plano?.semFotos,
  };
}

// ------------------------------------------------------------ uTalk
let org: { token: string; id: string } | null = null;
async function cliente(): Promise<ClienteEscrita> {
  const token = tokenUtalk();
  if (!token)
    throw new Error("Cadastre o token do uTalk em Configurações → Conexões.");
  if (!org || org.token !== token)
    org = { token, id: (await descobrirOrganizacao(buscar, token)).id };
  return clienteEscrita(buscar, token, org.id);
}

async function contatoDo(c: ClienteEscrita, st: EstadoChat) {
  if (!st.contatoId)
    st.contatoId = (await c.chat(st.chatId))?.contact?.id ?? null;
  if (!st.contatoId) throw new Error("contato do chat não encontrado");
  return st.contatoId;
}
/** Tira a etiqueta onde ela estiver (contato e/ou chat); só falha se não sair de nenhum. */
async function tirarEtiqueta(
  c: ClienteEscrita,
  st: EstadoChat,
  etiquetaId: string,
) {
  const erros: unknown[] = [];
  await c
    .tirarEtiqueta(await contatoDo(c, st), etiquetaId)
    .catch((e) => erros.push(e));
  await c
    .tirarEtiquetaDoChat(st.chatId, etiquetaId)
    .catch((e) => erros.push(e));
  if (erros.length === 2) throw erros[0];
}

/** Nota do cliente: sempre que a IA transfere, vai ao SDR em nota privada no chat (e fica no painel, sem CPF). */
async function entregarResumo(c: ClienteEscrita, st: EstadoChat) {
  const f = (st.ficha ??= FICHA_VAZIA);
  const ultimo = st.historico.filter((m) => m.role === "user").at(-1)?.content;
  const nota = resumoParaSdr(f, {
    nome: st.nome,
    motivo: motivoDaTransferencia(f, {
      pediuHumano: pediuHumano(ultimo ?? ""),
    }),
    cpfPlano: lerSegredo(f.cpf) || undefined,
    nascimentoPlano: lerSegredo(f.nascimento) || undefined,
  });
  try {
    await c.notaPrivada(st.chatId, nota);
    registrar(
      "crm",
      st.nome + ": nota do cliente enviada ao SDR (nota privada)",
    );
  } catch (erro) {
    registrar(
      "erro",
      st.nome +
        ": nota privada não criada — " +
        (erro as Error).message.slice(0, 120),
    );
  }
  f.entregue = true;
}

/** Envia o texto, depois as fotos em ordem, e aplica transferência/encerramento nas etiquetas do contato. */
async function entregar(r: Rascunho) {
  const e = carregar();
  const c = await cliente();
  const st = e.chats[r.chatId];
  if (!st) throw new Error("Lead não encontrado.");
  // Não transfere na primeira mensagem da IA (o lead precisa ter conversado antes), salvo se ele mesmo pediu para falar com alguém.
  const ultimoDoLead = st.historico.filter((m) => m.role === "user").at(-1);
  const transferir =
    r.transferir &&
    (st.historico.some((m) => m.role === "assistant") ||
      pediuHumano(ultimoDoLead?.content ?? ""));
  // Texto primeiro: as imagens demoram mais no uTalk e chegariam na frente.
  await c.enviar(r.chatId, r.texto);
  let enviadas = 0;
  for (const f of r.fotos) {
    try {
      await c.enviarArquivo(r.chatId, path.basename(f), fs.readFileSync(f));
      enviadas++;
    } catch (erro) {
      registrar(
        "erro",
        `${st.nome}: foto não enviada (${path.basename(f)}) — ${(erro as Error).message.slice(0, 120)}`,
      );
    }
  }
  if (enviadas && r.veiculoFotosId) {
    st.fotosEnviadas[r.veiculoFotosId] = r.inicioFotos + enviadas; // "mais fotos" continua daqui
    registrar(
      "foto",
      `${st.nome}: ${enviadas} fotos do ${r.veiculoFotos} enviadas`,
    );
  }
  st.historico.push({ role: "assistant", content: r.texto, em: Date.now() });
  st.ultimaIaEm = Date.now();
  if (transferir || r.encerrar) {
    const falha = (erro: unknown) =>
      registrar(
        "erro",
        `${st.nome}: etiqueta não atualizada — ${(erro as Error).message}`,
      );
    if (transferir && e.config.etiquetaTransferenciaId)
      await c
        .porEtiqueta(await contatoDo(c, st), e.config.etiquetaTransferenciaId)
        .catch(falha);
    st.gatilhoRetirado = await tirarEtiqueta(c, st, e.config.etiquetaGatilhoId)
      .then(() => true)
      .catch((erro) => {
        falha(erro);
        return false;
      });
    if (transferir) await entregarResumo(c, st);
    st.status = r.encerrar ? "encerrado" : "humano";
  }
  registrar("envio", `→ ${st.nome}: ${r.texto}`);
}

let ocupado = false;
let ultimaRodada: string | null = null;
let ultimoErro: string | null = null;

/** Uma rodada do atendimento: lê os chats com a etiqueta de gatilho e responde quem escreveu. */
export async function rodar() {
  if (ocupado) return { pulou: true, chats: 0, atendidos: 0 };
  ocupado = true;
  const e = carregar();
  const cfg = e.config;
  let atendidos = 0;
  try {
    if (!cfg.etiquetaGatilhoId)
      throw new Error("Escolha a etiqueta de gatilho nas Configurações.");
    const c = await cliente();
    const chats = await c.chatsComEtiqueta(cfg.etiquetaGatilhoId);
    for (const chat of chats) {
      const st = (e.chats[chat.id] ??= {
        chatId: chat.id,
        contatoId: chat.contact?.id ?? null,
        nome: chat.contact?.name || chat.contact?.phoneNumber || "Lead",
        telefone: chat.contact?.phoneNumber ?? null,
        historico: [],
        status: "ativo",
        vistoAte: 0,
        ultimaIaEm: null,
        fotosEnviadas: {},
      });
      if (chat.contact?.id) st.contatoId = chat.contact.id;
      // Etiqueta de gatilho de volta num lead entregue à equipe = a equipe devolveu à IA.
      if (voltouParaIa(st)) {
        st.status = "ativo";
        st.vistoAte = Date.now(); // só responde o que chegar daqui em diante
        st.ficha = undefined; // novo ciclo: a ficha do atendimento anterior não vale
        st.fichaDesde = Date.now();
        registrar(
          "crm",
          `${st.nome}: voltou para a IA (etiqueta de gatilho recolocada)`,
        );
      }
      if (
        st.status !== "ativo" ||
        e.rascunhos.some((d) => d.chatId === chat.id)
      )
        continue;
      const msgs = (await c.mensagens(chat.id))
        .filter((m) => !m.isPrivate && textoDa(m))
        .sort((a, b) => horaDa(a) - horaDa(b));
      const novas = msgs.filter((m) => doContato(m) && horaDa(m) > st.vistoAte);
      const nuncaFalou = !st.historico.length && !st.ultimaIaEm;
      if (!novas.length && !(nuncaFalou && cfg.enviarAbertura)) continue;

      // Conversa vista pelo modelo = histórico real do chat (equipe e celular "External" contam como nós).
      const conversa: MensagemIa[] = novas.length
        ? msgs.map((m) => ({
            role: doContato(m) ? "user" : "assistant",
            content: textoDa(m),
          }))
        : [];
      if (novas.length) st.vistoAte = horaDa(novas[novas.length - 1]);
      // O CPF e a data de nascimento ficam só na ficha (cifrada): o modelo, o histórico e a auditoria veem a versão mascarada.
      const doCiclo = msgs.filter((m) => horaDa(m) > (st.fichaDesde ?? 0));
      st.ficha = atualizarFicha(
        st.ficha,
        novas.length
          ? doCiclo.map((m) => ({
              role: doContato(m) ? ("user" as const) : ("assistant" as const),
              content: textoDa(m),
            }))
          : [],
      );
      const mascaradas = mascararConversa(
        msgs.map((m) => ({
          role: doContato(m) ? ("user" as const) : ("assistant" as const),
          content: textoDa(m),
        })),
      );
      const doCliente = novas.map((m) => mascaradas[msgs.indexOf(m)].content);
      for (const m of novas)
        st.historico.push({
          role: "user",
          content: mascaradas[msgs.indexOf(m)].content,
          em: horaDa(m),
        });

      const etiquetas = (chat.contact?.tags ?? [])
        .map((t) => t.name ?? t.tag?.name ?? "")
        .filter(Boolean);
      const base = {
        origem: "laco" as const,
        chatId: chat.id,
        nome: st.nome,
        telefone: st.telefone,
        recebidas: doCliente,
        ficha: st.ficha,
        anteriores: st.historico
          .filter((m) => m.role === "assistant")
          .slice(-2)
          .map((m) => m.content),
      };
      // O carro é detectado antes de responder: a mesma mensagem que cita o carro já avança a pergunta.
      const estoque = veiculosDisponiveis();
      for (const m of novas) {
        const i = msgs.indexOf(m);
        const anteriorIa = msgs
          .slice(0, i)
          .reverse()
          .find((x) => !doContato(x));
        const carro = veiculoMencionado(
          estoque,
          textoDa(m),
          anteriorIa ? textoDa(anteriorIa) : "",
          st.ficha?.veiculo ?? "",
        );
        if (carro && st.ficha)
          st.ficha.veiculo = carro.marca + " " + carro.modelo;
      }
      let r: RespostaIa;
      try {
        r = await responder(novas.length ? mascaradas : conversa, {
          veiculos: estoque,
          nome: st.nome,
          etiquetas,
          fotosEnviadas: st.fotosEnviadas,
          ficha: st.ficha,
        });
      } catch (erro) {
        auditarTurno({
          ...base,
          id: novoId(),
          desfecho: "erro",
          erro: (erro as Error).message.slice(0, 300),
        });
        throw erro;
      }
      if (r.plano?.semFotos && r.plano.veiculo)
        registrar(
          "foto",
          `${st.nome} pediu fotos do ${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}, mas ele não tem fotos na pasta FOTOS`,
        );
      if (!r.texto) {
        auditarTurno({ ...base, id: novoId(), desfecho: "descartado", r });
        continue;
      }
      const rascunho: Rascunho = {
        id: novoId(),
        chatId: chat.id,
        nome: st.nome,
        pergunta: doCliente.join("\n"),
        texto: r.texto,
        transferir: r.transferir,
        encerrar: r.encerrar,
        fotos: r.plano?.fotos ?? [],
        veiculoFotos: r.plano?.veiculo
          ? `${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}`
          : null,
        veiculoFotosId: r.plano?.veiculo?.id ?? null,
        inicioFotos: r.plano?.inicio ?? 0,
        em: Date.now(),
      };
      auditarTurno({
        ...base,
        id: rascunho.id,
        desfecho: cfg.enviarSemAprovacao ? "enviado" : "rascunho",
        r,
      });
      if (cfg.enviarSemAprovacao) {
        try {
          await entregar(rascunho);
        } catch (erro) {
          gravarDesfecho(ARQUIVO_AUDITORIA(), rascunho.id, "erro");
          throw erro;
        }
      } else {
        e.rascunhos.unshift(rascunho);
        registrar("rascunho", `${st.nome}: aguardando aprovação`);
      }
      atendidos++;
    }
    ultimaRodada = new Date().toISOString();
    ultimoErro = null;
    gravar();
    return { pulou: false, chats: chats.length, atendidos };
  } catch (erro) {
    const msg = (erro as Error).message;
    if (msg !== ultimoErro) registrar("erro", msg);
    ultimoErro = msg;
    throw erro;
  } finally {
    ocupado = false;
  }
}

let laco: ReturnType<typeof setInterval> | null = null;
/** Liga ou desliga o laço conforme as configurações. Chamado ao abrir o app e ao salvar. */
export function reiniciarLaco() {
  if (laco) clearInterval(laco);
  laco = null;
  const cfg = carregar().config;
  if (cfg.ligado && cfg.etiquetaGatilhoId)
    laco = setInterval(
      () => void rodar().catch(() => {}),
      Math.max(5, cfg.intervaloSeg) * 1000,
    );
}
/** Para o laço (ao fechar o app). */
export function pararLaco() {
  if (laco) clearInterval(laco);
  laco = null;
}
/** Liga os eventos para a tela e o laço, se estiver ligado nas configurações. */
export function iniciarPreAtendimento(emitir: Emitir) {
  emitirEvento = emitir;
  reiniciarLaco();
}

// ------------------------------------------------------------ comandos da tela
/** Tudo o que a tela mostra (sem chave nem token). */
export function painel() {
  const e = carregar();
  return {
    config: e.config,
    loja: e.loja,
    persona: e.persona,
    respostas: e.respostas,
    exemplos: e.exemplos,
    rascunhos: e.rascunhos.map((r) => ({
      ...r,
      fotos: r.fotos.map((f) => path.basename(f)),
    })),
    chats: Object.values(e.chats)
      .map((c) => ({
        chatId: c.chatId,
        nome: c.nome,
        status: c.status,
        mensagens: c.historico.length,
        ultima: c.historico.at(-1) ?? null,
        ultimaIaEm: c.ultimaIaEm,
        // Nota do cliente para o painel (CPF e nascimento nunca aparecem aqui).
        resumo: c.ficha
          ? resumoParaSdr(c.ficha, {
              nome: c.nome,
              motivo:
                c.status === "ativo"
                  ? undefined
                  : motivoDaTransferencia(c.ficha),
            })
          : null,
      }))
      .sort((a, b) => (b.ultima?.em ?? 0) - (a.ultima?.em ?? 0)),
    registros: e.registros.slice(0, 80),
    laco: { rodando: !!laco, ultimaRodada, ultimoErro },
    conexoes: { utalk: !!tokenUtalk(), groq: !!chaveGroq() },
    estoque: veiculosDisponiveis().length,
    exemplosReais: paresReais().length,
  };
}

/** Grava parte das configurações e religa o laço. */
export function salvarConfig(patch: Partial<ConfigIa>) {
  const e = carregar();
  e.config = { ...e.config, ...patch };
  gravar();
  reiniciarLaco();
  return painel();
}
/** Grava os dados da loja usados no contexto. */
export function salvarLoja(patch: Partial<LojaIa>) {
  const e = carregar();
  e.loja = { ...e.loja, ...patch };
  gravar();
  return painel();
}
/** Grava a persona (regras do atendimento). */
export function salvarPersona(persona: string) {
  carregar().persona = persona;
  gravar();
  return painel();
}
/** Cria ou atualiza uma resposta-rápida. */
export function salvarResposta(item: RespostaRapida) {
  const e = carregar();
  const novo = { ...item, id: item.id || novoId() };
  const i = e.respostas.findIndex((x) => x.id === novo.id);
  if (i >= 0) e.respostas[i] = novo;
  else e.respostas.unshift(novo);
  gravar();
  return painel();
}
/** Apaga uma resposta-rápida. */
export function removerResposta(id: string) {
  const e = carregar();
  e.respostas = e.respostas.filter((x) => x.id !== id);
  gravar();
  return painel();
}
/** Correção do simulador ou da aprovação: vira exemplo de ensino. */
export function salvarExemplo(item: Omit<ExemploIa, "id"> & { id?: string }) {
  const e = carregar();
  const novo: ExemploIa = { ...item, id: item.id || novoId() };
  const i = e.exemplos.findIndex((x) => x.id === novo.id);
  if (i >= 0) e.exemplos[i] = novo;
  else e.exemplos.unshift(novo);
  gravar();
  return painel();
}
/** Apaga um exemplo de ensino. */
export function removerExemplo(id: string) {
  const e = carregar();
  e.exemplos = e.exemplos.filter((x) => x.id !== id);
  gravar();
  return painel();
}

/** Aprova um rascunho (texto editado vira exemplo) e envia. */
export async function aprovar(id: string, texto?: string) {
  const e = carregar();
  const r = e.rascunhos.find((x) => x.id === id);
  if (!r) throw new Error("Rascunho não encontrado.");
  const final = (texto ?? r.texto).trim();
  if (!final) throw new Error("A resposta está vazia.");
  if (final !== r.texto && r.pergunta)
    e.exemplos.unshift({
      id: novoId(),
      pergunta: r.pergunta,
      resposta: final,
      origem: "correcao",
    });
  try {
    await entregar({ ...r, texto: final });
  } catch (erro) {
    gravarDesfecho(ARQUIVO_AUDITORIA(), id, "erro");
    throw erro;
  }
  gravarDesfecho(ARQUIVO_AUDITORIA(), id, "aprovado");
  e.rascunhos = e.rascunhos.filter((x) => x.id !== id);
  gravar();
  return painel();
}
/** Descarta um rascunho sem enviar. */
export function descartar(id: string) {
  const e = carregar();
  if (e.rascunhos.some((x) => x.id === id))
    gravarDesfecho(ARQUIVO_AUDITORIA(), id, "descartado");
  e.rascunhos = e.rascunhos.filter((x) => x.id !== id);
  gravar();
  return painel();
}
/** Tira o lead só do app (histórico e rascunhos); nada é apagado no uTalk. */
export function esquecerChat(chatId: string) {
  const e = carregar();
  delete e.chats[chatId];
  e.rascunhos = e.rascunhos.filter((d) => d.chatId !== chatId);
  gravar();
  return painel();
}
/** Devolve o lead à IA: põe a etiqueta de gatilho e tira a de transferência. */
export async function reativar(chatId: string) {
  const e = carregar();
  const st = e.chats[chatId];
  if (!st) throw new Error("Lead não encontrado.");
  if (!e.config.etiquetaGatilhoId)
    throw new Error("Escolha a etiqueta de gatilho.");
  const c = await cliente();
  await c
    .porEtiqueta(await contatoDo(c, st), e.config.etiquetaGatilhoId)
    .catch((erro: Error) => {
      if (!/cont[ée]m|already/i.test(erro.message)) throw erro;
    });
  if (e.config.etiquetaTransferenciaId)
    await tirarEtiqueta(c, st, e.config.etiquetaTransferenciaId).catch(
      () => {},
    );
  st.status = "ativo";
  st.ficha = undefined; // novo ciclo de atendimento
  st.fichaDesde = Date.now();
  registrar("crm", `${st.nome}: devolvido para a IA`);
  return painel();
}

/** Etiquetas do uTalk, para escolher a de gatilho e a de transferência. */
export async function etiquetasUtalk() {
  const c = await cliente();
  return (await c.etiquetas())
    .map((t) => ({ id: t.id, nome: (t.name ?? "").trim() || "(sem nome)" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
/** Traz as respostas-rápidas cadastradas no uTalk (sem repetir as já importadas). */
export async function importarRespostas() {
  const e = carregar();
  let n = 0;
  for (const q of await (await cliente()).respostasRapidas()) {
    const texto = q.text || q.content || q.message;
    const id = "ut_" + q.id;
    if (!texto || e.respostas.some((x) => x.id === id)) continue;
    e.respostas.push({
      id,
      titulo: q.shortcut || q.title || q.name || "uTalk",
      palavras: q.shortcut || "",
      texto,
    });
    n++;
  }
  gravar();
  return { importadas: n, painel: painel() };
}
/** Modelos disponíveis no provedor escolhido. */
export const modelos = () =>
  listarModelos(buscar, carregar().config, chaveGroq());
/** Recalcula os exemplos reais a partir da memória da Soul IA (depois de sincronizar). */
export function recalcularExemplos() {
  pares = null;
  return painel();
}
