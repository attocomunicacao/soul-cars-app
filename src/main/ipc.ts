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
import path from "node:path";
import * as caminhos from "./caminhos";
import * as balanco from "./estoque/balanco";
import { extrair } from "./estoque/extracao";
import { gerarHtml } from "./estoque/relatorio";
import { lerCsv, sincronizar } from "./estoque/sync";
import { ultimasVendas } from "./estoque/vendas";
import * as arquivos from "./studio/arquivos";
import * as bancoStudio from "./studio/banco";
import * as motor from "./studio/motor";
import * as instagram from "./studio/instagram";
import { criarEntrada } from "./studio/entrada";

type Args = Record<string, any>;
type Cabecalhos = Record<string, string>;
type Comando = (
  args: Args,
  corpo: Uint8Array | null,
  cabecalhos: Cabecalhos,
) => unknown;

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

async function dialogo(opcoes: OpcoesDialogo) {
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
  instagram_plano: (a) => instagram.planoInstagram(a.id),
  instagram_estado: (a) => instagram.estadoInstagram(a.id),
  instagram_conta: (a) => instagram.salvarContaInstagram(a.conta),
  instagram_abrir: () => instagram.abrirInstagram(janela!, emitir),
  instagram_publicar: (a) => instagram.publicarInstagram(a.id, emitir),
  instagram_cancelar: () => instagram.cancelarInstagram(),
  instagram_confirmar: (a) =>
    instagram.confirmarInstagram(a.id, a.etapa, a.publicado === true),
  // ---- banco do Studio ----
  sql_select: (a) => bancoStudio.selecionar(a.sql, a.values ?? []),
  sql_execute: (a) => bancoStudio.executar(a.sql, a.values ?? []),
  banco_backup_preparar: (a) => bancoStudio.prepararBackup(a.nome),

  // ---- caminhos e configuração ----
  app_data: () => caminhos.userData(),
  config_ler: () => ({
    ...caminhos.lerConfig(),
    raizDados: caminhos.raizDados(),
  }),
  config_gravar: (a) => caminhos.gravarConfig(a.patch ?? {}),
  caminhos_app: () => ({
    raizDados: caminhos.raizDados(),
    estoque: caminhos.ESTOQUE(),
    dados: caminhos.DADOS(),
    userData: caminhos.userData(),
    relatorio: caminhos.RELATORIO_HTML(),
  }),

  // ---- Estoque (BNDV) ----
  estoque_atualizar: (a) => atualizarEstoque(a),
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
  video_leve: (a) => {
    semCopiaEmAndamento();
    return motor.gerarVideoLeve(
      a as Parameters<typeof motor.gerarVideoLeve>[0],
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
  salvar_texto: (a) => {
    fs.writeFileSync(a.caminho, String(a.conteudo), "utf8");
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

export function registrarIpc() {
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
      const executar = COMANDOS[comando];
      if (!executar) throw new Error(`Comando não disponível: ${comando}`);
      // Erros voltam como mensagem, não como stack: a interface mostra ao usuário.
      try {
        const decodificados = Object.fromEntries(
          Object.entries(cabecalhos).map(([nome, valor]) => [
            nome,
            ["x-pasta", "x-nome", "x-destino"].includes(nome)
              ? decodeURIComponent(valor)
              : valor,
          ]),
        );
        return await executar(args, corpo, decodificados);
      } catch (erro) {
        throw new Error(erro instanceof Error ? erro.message : String(erro));
      }
    },
  );
}

export const nomesDeComandos = () => Object.keys(COMANDOS).sort();
