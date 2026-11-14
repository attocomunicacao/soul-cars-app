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
import {
  CONFIG_PADRAO,
  LOJA_PADRAO,
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
  variaveis,
  type ConfigIa,
  type ExemploIa,
  type LojaIa,
  type MensagemIa,
  type ParReal,
  type RespostaRapida,
  type VeiculoIa,
} from "../../shared/pre-service";
import { gerar, listarModelos } from "./llm";
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
    loja: { ...LOJA_PADRAO, ...lido.loja },
    persona: lido.persona ?? PERSONA_PADRAO,
    respostas: lido.respostas ?? structuredClone(RESPOSTAS_PADRAO),
    exemplos: lido.exemplos ?? [],
    chats: lido.chats ?? {},
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
/** Veículos disponíveis: status "DISPONÍVEL ESTOQUE" e ativos no último download do BNDV. */
export function veiculosDisponiveis(): VeiculoIa[] {
  let linhas: Record<string, string>[];
  try {
    linhas = lerCsv(caminhos.CSV_VEICULOS());
  } catch {
    return [];
  }
  return linhas
    .filter(
      (v) =>
        ehAtivo(v) &&
        normalizar(v.status).trim().startsWith("disponivel estoque"),
    )
    .map((v) => {
      const n = Number(String(v.price ?? "").replace(",", "."));
      return {
        id: String(v.idVehicle ?? ""),
        marca: String(v.brand ?? "").trim(),
        modelo: String(v.model ?? "").trim(),
        placa: String(v.plate ?? "").toUpperCase(),
        preco:
          Number.isFinite(n) && n > 0
            ? Math.round(n).toLocaleString("pt-BR")
            : "",
      };
    })
    .filter((v) => v.id);
}

function pastaDoVeiculo(id: string): string | null {
  const raiz = caminhos.ESTOQUE();
  if (!fs.existsSync(raiz)) return null;
  const nome = fs.readdirSync(raiz).find((d) => d.split("_")[0] === id);
  return nome ? path.join(raiz, nome) : null;
}
/** Fotos numeradas de `ESTOQUE/<id>_…/FOTOS`, em ordem (caminhos completos). */
export function fotosDo(id: string): string[] {
  const p = pastaDoVeiculo(id);
  const dir = p && path.join(p, "FOTOS");
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
    };
  const veiculos = veiculosDisponiveis();
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
  });
  const bruto = await gerar(buscar, mensagens, cfg, chaveGroq(), (t) =>
    registrar("reserva", t),
  );
  return { ...interpretarResposta(bruto, conversa), plano, usados };
}

/** Simulador "Ensinar": responde à conversa digitada na tela, sem enviar nada. Fotos vêm como miniaturas. */
export async function simular(a: {
  conversa: MensagemIa[];
  nome?: string;
  etiquetas?: string[];
  enviadas?: Record<string, number>;
}) {
  const r = await responder(a.conversa, {
    nome: a.nome || "Cliente",
    etiquetas: a.etiquetas ?? [],
    fotosEnviadas: a.enviadas ?? {},
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

/** Envia o texto, depois as fotos em ordem, e aplica transferência/encerramento nas etiquetas do contato. */
async function entregar(r: Rascunho) {
  const e = carregar();
  const c = await cliente();
  const st = e.chats[r.chatId];
  if (!st) throw new Error("Lead não encontrado.");
  // Nunca transfere na primeira mensagem da IA: o lead precisa ter conversado antes.
  const transferir =
    r.transferir && st.historico.some((m) => m.role === "assistant");
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
    await tirarEtiqueta(c, st, e.config.etiquetaGatilhoId).catch(falha);
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
      for (const m of novas)
        st.historico.push({ role: "user", content: textoDa(m), em: horaDa(m) });

      const etiquetas = (chat.contact?.tags ?? [])
        .map((t) => t.name ?? t.tag?.name ?? "")
        .filter(Boolean);
      const r = await responder(conversa, {
        nome: st.nome,
        etiquetas,
        fotosEnviadas: st.fotosEnviadas,
      });
      if (r.plano?.semFotos && r.plano.veiculo)
        registrar(
          "foto",
          `${st.nome} pediu fotos do ${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}, mas ele não tem fotos na pasta FOTOS`,
        );
      if (!r.texto) continue;
      const rascunho: Rascunho = {
        id: novoId(),
        chatId: chat.id,
        nome: st.nome,
        pergunta: novas.map(textoDa).join("\n"),
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
      if (cfg.enviarSemAprovacao) await entregar(rascunho);
      else {
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
  await entregar({ ...r, texto: final });
  e.rascunhos = e.rascunhos.filter((x) => x.id !== id);
  gravar();
  return painel();
}
/** Descarta um rascunho sem enviar. */
export function descartar(id: string) {
  const e = carregar();
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
