/**
 * Todos os comandos que a interface pode pedir ao processo principal.
 *
 * A interface nunca toca em disco nem em banco: ela chama
 * `invocar("nome_do_comando", args)` e cai aqui. Para acrescentar um
 * recurso, escreva o comando nesta tabela e chame pelo nome na interface —
 * não existe outro caminho, e é isso que mantém a parte HTML sem acesso ao
 * computador.
 *
 * Os nomes são os mesmos do serviço anterior do Studio, então o código da
 * interface que foi portado continua chamando o que sempre chamou.
 */
import {
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  shell,
} from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as caminhos from "../core/paths";
import * as balanco from "../inventory/balance";
import { extrair } from "../inventory/bndv-extraction";
import {
  esconderEmbutidas,
  mostrarEmbutida,
  type IdEmbutida,
  type Retangulo,
} from "../window/embedded-sites";
import * as utalk from "../crm/utalk";
import * as leadsCrm from "../crm/leads";
import * as soulApp from "../crm/soul-app-import";
import * as metaAds from "../meta/meta";
import * as funil from "../funnel/funnel";
import * as souliaIa from "../soul-ai/soul-ai";
import * as preAtendimento from "../pre-service/pre-service";
import * as lab from "../lab/lab";
import { vitrine } from "../inventory/showcase";
import { exportarRelatorioPdf } from "../inventory/report-pdf";
import { gerarHtml } from "../inventory/report";
import { lerCsv, sincronizar } from "../inventory/folder-sync";
import { ultimasVendas } from "../inventory/sales";
import * as arquivos from "../studio/files";
import * as bancoStudio from "../studio/database";
import * as repo from "../studio/repository";
import * as motor from "../studio/engine-bridge";
import { criarEsquemas, EXTENSOES_EXECUTAVEIS } from "./schemas";
import { criarCaminhosEscolhidos, validarChamada } from "./validation";
import { registrar } from "../core/diagnostics";
import { criarEntrada } from "../studio/intake";

type Args = Record<string, any>;
type Cabecalhos = Record<string, string>;
type Comando = (
  args: Args,
  corpo: Uint8Array | null,
  cabecalhos: Cabecalhos,
) => unknown;

const banco = bancoStudio.banco;

let janela: BrowserWindow | null = null;
export const definirJanela = (w: BrowserWindow) => {
  janela = w;
};

/** Manda um evento para a interface (progresso, log do vídeo, etc.). */
export const emitir = (nome: string, carga: unknown) => {
  if (janela && !janela.isDestroyed())
    janela.webContents.send("soul:evento", { nome, carga });
};

/** Entrada por pasta sincronizada: vigia em segundo plano, controlado pelos comandos entrada_*. */
const entrada = criarEntrada({
  selecionar: bancoStudio.selecionar,
  executar: bancoStudio.executar,
  emitir,
  estoque: caminhos.ESTOQUE,
  // Um trabalho pesado por vez: a entrada espera o vídeo terminar.
  videoOcupado: motor.videoEmExecucao,
});

/** Vídeo e cópia da entrada não rodam juntos (16 GB de RAM, sem GPU). */
const semCopiaEmAndamento = () => {
  if (entrada.copiandoAgora())
    throw new Error(
      "A entrada está copiando arquivos. Aguarde terminar e tente de novo.",
    );
};
export const iniciarEntrada = () => entrada.iniciar();
/** Pré-atendimento IA: o laço só roda se estiver ligado nas configurações dele. */
export const iniciarPreAtendimento = () =>
  preAtendimento.iniciarPreAtendimento(emitir);
export const pararPreAtendimento = () => preAtendimento.pararLaco();
export const pararEntrada = () => entrada.parar();

const naoVazio = (v: unknown, mensagem: string) => {
  if (v === undefined || v === null || v === "") throw new Error(mensagem);
  return v;
};

// ------------------------------------------------------------- ESTOQUE
/** Quantos veículos o índice tem e quando foi gerado. */
function resumoEstoque() {
  try {
    const arquivo = caminhos.INDICE_CSV();
    const n = lerCsv(arquivo).length;
    const quando = fs.statSync(arquivo).mtime.toISOString();
    return { veiculos: n, quando };
  } catch {
    return { veiculos: 0, quando: null };
  }
}

/**
 * O botão Atualizar do Estoque: abre o BNDV, baixa tudo e organiza as pastas.
 *
 * Vai mandando `estoque:log` e `estoque:etapa` para a tela acompanhar; o
 * retorno é o resumo do que foi criado.
 */
let atualizandoEstoque = false;
async function atualizarEstoque(args: Args) {
  if (atualizandoEstoque)
    throw new Error("Uma atualização já está em andamento.");
  atualizandoEstoque = true;
  try {
    const log = (texto: string, tom?: string) =>
      emitir("estoque:log", { texto, tom: tom ?? "normal" });
    const etapa = (indice: number, texto: string) =>
      emitir("estoque:etapa", { indice, texto });

    etapa(0, "Abrindo o BNDV…");
    const r = await extrair(log, () =>
      etapa(2, "Baixando da API — leva cerca de 1 minuto"),
    );
    etapa(1, "Aguardando o BNDV responder…");
    if (r.incompleto) {
      log(
        "Alguns registros não vieram. Continuando mesmo assim — nada será apagado.",
        "aviso",
      );
    }

    etapa(3, "Criando pastas e fichas…");
    log("");
    const resumo = sincronizar(log, !!args.todos);
    log("");
    log("Pronto.", "ok");
    return { ...resumo, ...resumoEstoque() };
  } finally {
    atualizandoEstoque = false;
  }
}

// ------------------------------------------------------------- diálogos
type OpcoesDialogo = {
  directory?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  multiple?: boolean;
  mode?: "open" | "save";
};

/** Caminhos escolhidos pelo usuário nos diálogos nativos desta sessão (base da regra de `config_gravar`). */
const escolhidosNoDialogo = criarCaminhosEscolhidos();

async function dialogo(opcoes: OpcoesDialogo) {
  const caminho = await abrirDialogo(opcoes);
  for (const p of [caminho ?? []].flat()) escolhidosNoDialogo.lembrar(p);
  return caminho;
}

async function abrirDialogo(opcoes: OpcoesDialogo) {
  const pai = janela ?? undefined;
  if (opcoes.mode === "save") {
    const r = await dialog.showSaveDialog(pai!, {
      title: opcoes.title,
      defaultPath: opcoes.defaultPath,
      filters: opcoes.filters,
    });
    return r.canceled ? null : r.filePath;
  }
  const properties: ("openFile" | "openDirectory" | "multiSelections")[] =
    opcoes.directory
      ? ["openDirectory"]
      : opcoes.multiple
        ? ["openFile", "multiSelections"]
        : ["openFile"];
  const r = await dialog.showOpenDialog(pai!, {
    title: opcoes.title,
    defaultPath: opcoes.defaultPath,
    filters: opcoes.directory ? undefined : opcoes.filters,
    properties,
  });
  if (r.canceled || !r.filePaths.length) return null;
  return opcoes.multiple ? r.filePaths : r.filePaths[0];
}

// --------------------------------------------------------- tabela de comandos
const COMANDOS: Record<string, Comando> = {
  // ---- banco do Studio ----
  // Cada operação do banco é um comando nomeado: a interface não escreve SQL.
  db_veiculos_listar: (a) => repo.listarVeiculos(banco(), a.busca),
  db_veiculo_obter: (a) => repo.obterVeiculo(banco(), a.id),
  db_veiculo_criar: (a) => repo.criarVeiculo(banco(), a.veiculo as never),
  db_veiculo_atualizar: (a) => repo.atualizarVeiculo(banco(), a.id, a.patch),
  db_anuncios_listar: (a) => repo.listarAnuncios(banco(), a.veiculoId),
  db_anuncio_registrar: (a) =>
    repo.registrarAnuncio(banco(), a.anuncio as never),
  db_anuncio_pausar: (a) => repo.marcarAnuncioPausado(banco(), a.id, a.dia),
  db_anuncio_remover: (a) => repo.removerAnuncio(banco(), a.id),
  db_config_obter: (a) => repo.obterConfig(banco(), a.chave),
  db_config_salvar: (a) => repo.salvarConfig(banco(), a.chave, a.valor ?? null),
  db_loja_obter: () => repo.obterLoja(banco()),
  db_loja_salvar: (a) => repo.salvarLoja(banco(), a.loja as never),
  db_relatorio_salvar: (a) =>
    repo.salvarRelatorio(banco(), a.relatorio as never),
  db_relatorios_listar: (a) => repo.listarRelatorios(banco(), a.limite),
  db_relatorio_excluir: (a) => repo.excluirRelatorio(banco(), a.id),
  db_manutencao: () => bancoStudio.manutencao(),

  // ---- caminhos e configuração ----
  app_data: () => caminhos.userData(),
  config_ler: () => {
    // Os tokens cifrados (uTalk, Meta e Groq) nunca vão para a interface.
    const {
      utalkTokenCifrado: _token,
      metaTokenCifrado: _meta,
      groqChaveCifrada: _groq,
      ...resto
    } = caminhos.lerConfig();
    return { ...resto, raizDados: caminhos.raizDados() };
  },
  config_gravar: (a) => {
    const patch = a.patch ?? {};
    // A raiz dos dados e a pasta do motor definem o que o app lê e executa: só valem se vieram do seletor de pastas.
    for (const campo of ["raizDados", "pastaMotor"])
      if (typeof patch[campo] === "string")
        escolhidosNoDialogo.exigir(patch[campo], campo);
    return caminhos.gravarConfig(patch);
  },
  caminhos_app: () => ({
    raizDados: caminhos.raizDados(),
    estoque: caminhos.ESTOQUE(),
    dados: caminhos.DADOS(),
    userData: caminhos.userData(),
    relatorio: caminhos.RELATORIO_HTML(),
  }),

  // ---- Estoque (BNDV) ----
  estoque_atualizar: (a) => atualizarEstoque(a),
  embutida_mostrar: (a) => {
    if (janela) mostrarEmbutida(a.id as IdEmbutida, janela, a as Retangulo);
    return true;
  },
  embutida_esconder: () => {
    esconderEmbutidas();
    return true;
  },
  utalk_token_salvar: (a) => utalk.salvarTokenUtalk(String(a.token)),
  utalk_token_remover: () => utalk.removerTokenUtalk(),
  // ---- CRM · Leads, Meta Ads e Funil (vindos do Soul APP) ----
  crm_leads_dados: () => leadsCrm.dadosLeads(),
  crm_leads_atualizar: () => leadsCrm.atualizarLeads(),
  crm_leads_config_salvar: (a) => leadsCrm.salvarConfigLeads(a.patch),
  meta_estado: () => metaAds.estadoMeta(),
  meta_salvar: (a) =>
    metaAds.salvarMeta({ token: a.token, conta: a.conta, versao: a.versao }),
  meta_token_remover: () => metaAds.removerTokenMeta(),
  meta_testar: (a) => metaAds.testarMeta({ token: a.token, conta: a.conta }),
  meta_token_validade: () => metaAds.validadeTokenMeta(),
  meta_config_ler: () => metaAds.configMeta(),
  meta_painel: (a) => metaAds.painelMeta(a.preset),
  meta_config_salvar: (a) => metaAds.salvarConfigMeta(a.patch),
  funil_dados: (a) => funil.dadosFunil(!!a.forcar),
  funil_config_salvar: (a) => funil.salvarConfigFunil(a.patch),
  soulapp_estado: () => ({ encontrado: soulApp.soulAppEncontrado() }),
  soulapp_importar: () => soulApp.importarSoulApp(),
  // ---- Soul IA (memória das conversas do uTalk) ----
  soulia_estado: () => souliaIa.estadoSouliaIa(),
  soulia_sincronizar: (a) =>
    souliaIa.sincronizarSouliaIa({ limite: a.limite }, emitir),
  soulia_cancelar: () => souliaIa.cancelarSouliaIa(),
  soulia_exportar: () => souliaIa.exportarSouliaIa(emitir),
  soulia_abrir_pasta: () => souliaIa.abrirPastaSouliaIa(),
  soulia_esquecer: () => souliaIa.esquecerSouliaIa(),
  // ---- Pré-atendimento IA (atende pelo uTalk os leads com a etiqueta de gatilho) ----
  pre_painel: () => preAtendimento.painel(),
  pre_config_salvar: (a) => preAtendimento.salvarConfig(a.patch),
  pre_chave_groq_salvar: (a) => preAtendimento.salvarChaveGroq(String(a.chave)),
  pre_loja_salvar: (a) => preAtendimento.salvarLoja(a.patch),
  pre_persona_salvar: (a) => preAtendimento.salvarPersona(String(a.persona)),
  pre_resposta_salvar: (a) => preAtendimento.salvarResposta(a.item),
  pre_resposta_remover: (a) => preAtendimento.removerResposta(String(a.id)),
  pre_respostas_importar: () => preAtendimento.importarRespostas(),
  pre_exemplo_salvar: (a) => preAtendimento.salvarExemplo(a.item),
  pre_exemplo_remover: (a) => preAtendimento.removerExemplo(String(a.id)),
  pre_exemplos_recalcular: () => preAtendimento.recalcularExemplos(),
  pre_simular: (a) => preAtendimento.simular(a as never),
  pre_rodar: () => preAtendimento.rodar(),
  pre_aprovar: (a) => preAtendimento.aprovar(String(a.id), a.texto),
  pre_descartar: (a) => preAtendimento.descartar(String(a.id)),
  pre_reativar: (a) => preAtendimento.reativar(String(a.chatId)),
  pre_esquecer: (a) => preAtendimento.esquecerChat(String(a.chatId)),
  pre_etiquetas: () => preAtendimento.etiquetasUtalk(),
  pre_modelos: () => preAtendimento.modelos(),
  pre_auditoria: (a) =>
    preAtendimento.auditoria(a.limite === undefined ? 200 : Number(a.limite)),
  // ---- Laboratório de testes da IA ----
  lab_cenarios: () => lab.listarCenarios(),
  lab_rodar: (a) =>
    lab.rodarLab(
      {
        ids: a.ids as string[] | undefined,
        categoria: a.categoria as string | undefined,
        repeticoes: a.repeticoes as number | undefined,
      },
      emitir,
    ),
  lab_cancelar: () => lab.cancelarLab(),
  lab_execucoes: () => lab.listarExecucoes(),
  lab_execucao: (a) => lab.lerExecucao(String(a.id)),
  lab_avaliar: (a) => lab.salvarAvaliacao(a as never),
  lab_avaliacoes: (a) =>
    lab.listarAvaliacoes(a.execucaoId as string | undefined),
  lab_relatorio: (a) => lab.relatorioDaExecucao(String(a.execucaoId)),
  lab_analisar_historico: () => lab.analisarHistoricoLab(),
  lab_cenarios_auditoria: () => lab.gerarCenariosDaAuditoria(),
  lab_abrir_pasta: () => lab.abrirPastaLab(),
  estoque_vitrine: () => vitrine(),
  // ---- Finanças (planilha mensal vinculada) ----
  relatorio_pdf: () => exportarRelatorioPdf(janela),
  estoque_resumo: () => resumoEstoque(),
  anuncios_vendas: () => ultimasVendas(),
  balanco_carregar: () => ({
    modelo: balanco.MODELO,
    auto: balanco.AUTO,
    contas: balanco.carregar(),
  }),
  balanco_montar: (a) => balanco.montar(a.contas),
  balanco_salvar: (a) => {
    balanco.salvar(a.contas);
    return balanco.montar(a.contas);
  },
  relatorio_gerar: () => gerarHtml(),
  relatorio_abrir: () => {
    const caminho = gerarHtml();
    return fs.readFileSync(caminho, "utf8");
  },

  // ---- pastas do estoque (lidas pelo Studio) ----
  estoque_listar: (a) => arquivos.listarEstoque(a.raiz ?? caminhos.ESTOQUE()),
  estoque_ler: (a) => arquivos.lerArquivo(a.raiz, a.caminho),
  estoque_proximo_numero: (a) =>
    arquivos.proximoNumero(a.raiz ?? caminhos.ESTOQUE()),
  pasta_criar: (a) =>
    arquivos.criarPasta(
      a.raiz ?? caminhos.ESTOQUE(),
      a.numero,
      a.nome,
      a.placa,
    ),

  // ---- entrada por pasta sincronizada ----
  entrada_estado: () => entrada.obterEstado(),
  entrada_verificar: () => {
    void entrada.verificar();
    return entrada.obterEstado();
  },
  entrada_pausar: (a) => {
    entrada.pausar(a.pausar === true);
    return entrada.obterEstado();
  },
  entrada_liberar: (a) =>
    entrada.liberar(
      Array.isArray(a.subpastas) ? a.subpastas.map(String) : [],
      (caminho) => shell.trashItem(caminho),
    ),

  // ---- motor Python (opcional) ----
  engine_call: (a) => motor.chamarMotor(a.method, a.params, emitir),
  engine_reiniciar: () => motor.reiniciarMotor(),
  motor_estado: () => motor.estadoMotor(),
  motor_instalar: () => motor.instalarMotor(emitir),
  video_gerar: (a) => {
    semCopiaEmAndamento();
    return motor.gerarVideo(
      a as Parameters<typeof motor.gerarVideo>[0],
      emitir,
    );
  },
  video_cancelar: () => ({ cancelado: motor.cancelarVideo() }),

  // ---- sistema ----
  copiar_texto: (a) => clipboard.writeText(String(a.texto ?? "")),
  dialog: (a) => dialogo(a),
  open_url: (a) => {
    const url = new URL(String(a.url));
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("URL inválida.");
    return shell.openExternal(url.href);
  },
  open_path: async (a) => {
    if (EXTENSOES_EXECUTAVEIS.test(String(a.path)))
      throw new Error("Este tipo de arquivo não pode ser aberto pelo app.");
    const erro = await shell.openPath(
      path.resolve(String(naoVazio(a.path, "Caminho vazio."))),
    );
    if (erro) throw new Error(erro);
    return null;
  },
  reveal: (a) => {
    const alvo = path.resolve(String(naoVazio(a.path, "Caminho vazio.")));
    if (!fs.existsSync(alvo)) throw new Error("Arquivo não encontrado.");
    shell.showItemInFolder(alvo);
    return null;
  },

  // ---- fotos do editor de criativos ----
  foto_salvar: (_a, corpo, h) => {
    arquivos.salvarFoto(
      h["x-veiculo"],
      h["x-slot"],
      h["x-nome"],
      h["x-mime"],
      corpo!,
    );
    return null;
  },
  fotos_listar: (a) => arquivos.listarFotos(a.veiculo),
  foto_ler: (a) => arquivos.lerFoto(a.veiculo, a.slot),
  veiculo_apagar_arquivos: (a) => {
    arquivos.apagarArquivosVeiculo(a.veiculo);
    return null;
  },
  fotos_importar_padrao: (a) =>
    arquivos.importarFotosPadrao(a.veiculo, a.pasta),
  criativo_salvar: (_a, corpo, h) =>
    arquivos.salvarCriativo(
      h["x-pasta"],
      h["x-nome"],
      h["x-destino"] || null,
      corpo!,
    ),

  // ---- produção ----
  producao_status: (a) => arquivos.statusProducao(a.pasta),
  producao_fotos: (a) =>
    arquivos.previaFotos(a.pasta).map((foto) => {
      const imagem = nativeImage.createFromDataURL(foto.miniatura);
      return {
        ...foto,
        miniatura: imagem.isEmpty()
          ? ""
          : imagem.resize({ width: 320 }).toDataURL(),
      };
    }),
  producao_documento: (a) => arquivos.documentoNaPasta(a.pasta),
  producao_doc_copiar: (a) => arquivos.copiarComoDoc(a.pasta, a.origem),
  producao_gravar: (_a, corpo, h) =>
    arquivos.gravarNaPasta(h["x-pasta"], h["x-nome"], corpo!),
  fotos_renomear: (a) => arquivos.renomearFotos(a.pasta, a.ordem),
};

const ESQUEMAS = criarEsquemas({
  raizes: () => [caminhos.raizDados(), caminhos.userData()],
  raizesAbrir: () => [
    caminhos.raizDados(),
    caminhos.userData(),
    path.join(os.homedir(), "Pictures", "SOUL Cars"),
  ],
});

/** Comando sem esquema é erro de programação: o app não abre. */
function conferirEsquemas() {
  const sem = Object.keys(COMANDOS).filter((c) => !ESQUEMAS[c]);
  const sobra = Object.keys(ESQUEMAS).filter((c) => !COMANDOS[c]);
  if (sem.length || sobra.length)
    throw new Error(
      `IPC sem esquema: [${sem.join(", ")}]; esquema sem comando: [${sobra.join(", ")}]`,
    );
}

const CABECALHOS_CODIFICADOS = ["x-pasta", "x-nome", "x-destino"];

export function registrarIpc() {
  conferirEsquemas();
  ipcMain.handle(
    "soul:invoke",
    async (
      evento,
      comando: string,
      args: Args = {},
      cabecalhos: Cabecalhos = {},
      corpo: Uint8Array | null = null,
    ) => {
      if (
        !janela ||
        evento.sender !== janela.webContents ||
        evento.senderFrame !== janela.webContents.mainFrame
      ) {
        throw new Error("Origem do comando não autorizada.");
      }
      const executar = Object.hasOwn(COMANDOS, comando)
        ? COMANDOS[comando]
        : undefined;
      const esquema = Object.hasOwn(ESQUEMAS, comando)
        ? ESQUEMAS[comando]
        : undefined;
      if (!executar || !esquema)
        throw new Error(`Comando não disponível: ${String(comando)}`);
      // Erros voltam como mensagem, não como stack: a interface mostra ao usuário.
      try {
        const decodificados =
          cabecalhos && typeof cabecalhos === "object"
            ? Object.fromEntries(
                Object.entries(cabecalhos).map(([nome, valor]) => [
                  nome,
                  CABECALHOS_CODIFICADOS.includes(nome) &&
                  typeof valor === "string"
                    ? decodeURIComponent(valor)
                    : valor,
                ]),
              )
            : cabecalhos;
        const v = validarChamada(comando, esquema, args, decodificados, corpo);
        return await executar(v.args, v.corpo, v.cabecalhos);
      } catch (erro) {
        registrar(
          `ipc ${comando}: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
        throw new Error(erro instanceof Error ? erro.message : String(erro), {
          cause: erro,
        });
      }
    },
  );
}

export const nomesDeComandos = () => Object.keys(COMANDOS).sort();
