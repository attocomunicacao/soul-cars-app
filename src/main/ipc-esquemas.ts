/**
 * Esquema de cada comando do IPC (`COMANDOS` em `ipc.ts`).
 *
 * Todo comando novo precisa de uma entrada aqui: o app não abre se faltar, e
 * um teste confere. Caminhos de pasta só são aceitos dentro das raízes
 * autorizadas (pasta de dados da loja e dados internos do app).
 */
import { EDITAVEIS, STATUS_VEICULO } from "../compartilhado/veiculo";
import {
  booleano,
  caminhoEmRaizes,
  caminhoQualquer,
  anulavel,
  idVeiculo,
  inteiro,
  lista,
  numero,
  objeto,
  objetoLivre,
  opcional,
  texto,
  umDe,
  type Esquema,
  type Regra,
} from "./validacao";

export const METODOS_DO_MOTOR = [
  "ping",
  "ler_crlv",
  "ocr_equipamentos",
  "remover_fundo",
  "gerar_doc_md",
  "cnw_buscar",
  "cnw_ficha",
  "fotos_organizar",
] as const;

/** Extensões que o Windows executaria ao "abrir" o arquivo. */
export const EXTENSOES_EXECUTAVEIS =
  /\.(exe|com|bat|cmd|msi|msp|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|lnk|scr|pif|reg|hta|cpl|dll|jar)$/i;

export type Contexto = {
  /** Raízes onde o app pode ler/gravar: dados da loja e dados internos. */
  raizes: () => string[];
  /** Raízes onde abrir um arquivo pelo sistema é aceitável (inclui Imagens\SOUL Cars). */
  raizesAbrir: () => string[];
};

const contas: Regra = (v, campo) => {
  const externo = objetoLivre(v, campo);
  for (const [grupo, interno] of Object.entries(externo)) {
    const valores = objetoLivre(interno, `${campo}.${grupo}`);
    for (const [nome, valor] of Object.entries(valores))
      numero(valor, `${campo}.${grupo}.${nome}`);
  }
  return externo;
};

const escalar: Regra<string | number> = (v, campo) =>
  typeof v === "number"
    ? numero(v, campo)
    : texto({ vazio: true, max: 50_000 })(v, campo);

/** Chaves da tabela config: letras minúsculas, números e "_", com sufixo ":<texto>" opcional. Nunca senhas ou chaves. */
const chaveConfig: Regra<string> = (v, campo) => {
  const chave = texto({ max: 1100 })(v, campo);
  if (
    !/^[a-z][a-z0-9_]*(:.+)?$/s.test(chave) ||
    /api_key|senha|token|segredo/i.test(chave.split(":")[0])
  )
    throw new Error(
      `Argumento inválido: "${campo}" não é uma chave de configuração permitida.`,
    );
  return chave;
};

/** Alterações do veículo: só as colunas de EDITAVEIS; chave presente com valor vazio vira NULL. */
const patchVeiculo: Regra = (v, campo) => {
  const origem = objetoLivre(v, campo);
  const saida: Record<string, string | number | null> = {};
  for (const coluna of EDITAVEIS) {
    if (!(coluna in origem)) continue;
    const valor = origem[coluna];
    saida[coluna] =
      valor === undefined || valor === null
        ? null
        : coluna === "status"
          ? umDe(...STATUS_VEICULO)(valor, `${campo}.status`)
          : escalar(valor, `${campo}.${coluna}`);
  }
  return saida;
};

function esquemasDoBanco(): Record<string, Esquema> {
  const id = inteiro;
  const cheio = texto({ max: 2000, vazio: true });
  return {
    db_veiculos_listar: {
      args: { busca: opcional(texto({ max: 200, vazio: true })) },
    },
    db_veiculo_obter: { args: { id } },
    db_veiculo_criar: {
      args: {
        veiculo: objeto({
          nome: texto({ max: 200 }),
          ano: anulavel(escalar),
          versao: anulavel(escalar),
          cambio: anulavel(escalar),
          preco: anulavel(escalar),
          km: anulavel(escalar),
          placa: anulavel(escalar),
        }),
      },
    },
    db_veiculo_atualizar: { args: { id, patch: patchVeiculo } },
    db_anuncios_listar: { args: { veiculoId: opcional(id) } },
    db_anuncio_registrar: {
      args: {
        anuncio: objeto({
          veiculo_id: id,
          estoque_id: anulavel(id),
          modelo: texto({ max: 300 }),
          campanha: texto({ max: 300 }),
          criado_dia: texto({ max: 10 }),
        }),
      },
    },
    db_anuncio_pausar: { args: { id, dia: texto({ max: 10 }) } },
    db_anuncio_remover: { args: { id } },
    db_config_obter: { args: { chave: chaveConfig } },
    db_config_salvar: {
      args: {
        chave: chaveConfig,
        valor: opcional(texto({ max: 1_000_000, vazio: true })),
      },
    },
    db_loja_obter: {},
    db_loja_salvar: {
      args: {
        loja: objeto({
          contato: cheio,
          horario: cheio,
          loja: cheio,
          endereco: cheio,
        }),
      },
    },
    db_relatorio_salvar: {
      args: {
        relatorio: objeto({
          tipo: texto({ max: 50 }),
          arquivo: texto({ max: 500 }),
          inicio: texto({ max: 30 }),
          fim: texto({ max: 30 }),
          dados: texto({ max: 50_000_000, vazio: true }),
        }),
      },
    },
    db_relatorios_listar: { args: { limite: opcional(id) } },
    db_relatorio_excluir: { args: { id } },
    db_manutencao: {},
  };
}

export function criarEsquemas(ctx: Contexto): Record<string, Esquema> {
  const pasta = caminhoEmRaizes(ctx.raizes);
  const nome = texto({ max: 255 });
  const veiculo = idVeiculo;
  const vazio: Esquema = {};

  return {
    // ---- Instagram ----
    instagram_plano: { args: { id: veiculo } },
    instagram_estado: { args: { id: veiculo } },
    instagram_conta: { args: { conta: texto({ max: 100, vazio: true }) } },
    instagram_abrir: vazio,
    instagram_publicar: { args: { id: veiculo } },
    instagram_cancelar: vazio,
    instagram_confirmar: {
      args: {
        id: veiculo,
        etapa: texto({ max: 40 }),
        publicado: booleano,
      },
    },

    // ---- banco, caminhos e configuração ----
    ...esquemasDoBanco(),
    app_data: vazio,
    config_ler: vazio,
    config_gravar: {
      args: {
        patch: objeto({
          raizDados: opcional(caminhoQualquer),
          pastaMotor: opcional(caminhoQualquer),
        }),
      },
    },
    caminhos_app: vazio,

    // ---- Estoque ----
    estoque_atualizar: { args: { todos: opcional(booleano) } },
    bndv_abrir: vazio,
    estoque_vitrine: vazio,
    relatorio_pdf: vazio,
    estoque_resumo: vazio,
    anuncios_vendas: vazio,
    balanco_carregar: vazio,
    balanco_montar: { args: { contas: opcional(contas) } },
    balanco_salvar: { args: { contas } },
    relatorio_gerar: vazio,
    relatorio_abrir: vazio,
    estoque_listar: { args: { raiz: opcional(pasta) } },
    estoque_ler: { args: { raiz: pasta, caminho: texto({ max: 1024 }) } },
    estoque_proximo_numero: { args: { raiz: opcional(pasta) } },
    pasta_criar: {
      args: {
        raiz: opcional(pasta),
        numero: inteiro,
        nome,
        placa: texto({ max: 20 }),
      },
    },

    // ---- entrada por pasta sincronizada ----
    entrada_estado: vazio,
    entrada_verificar: vazio,
    entrada_pausar: { args: { pausar: opcional(booleano) } },
    entrada_liberar: { args: { subpastas: lista(texto({ max: 512 }), 5000) } },

    // ---- motor Python ----
    engine_call: {
      args: {
        method: umDe(...METODOS_DO_MOTOR),
        params: opcional(objetoLivre),
      },
    },
    engine_reiniciar: vazio,
    motor_estado: vazio,
    motor_instalar: vazio,
    video_gerar: {
      args: {
        pasta,
        veiculo: texto({ max: 200 }),
        motor: texto({ max: 200, vazio: true }),
        preco: texto({ max: 50, vazio: true }),
        python: opcional(caminhoQualquer),
      },
    },
    video_leve: { args: { pasta, python: opcional(caminhoQualquer) } },
    video_cancelar: vazio,

    // ---- sistema ----
    copiar_texto: { args: { texto: texto({ max: 2_000_000, vazio: true }) } },
    dialog: {
      args: {
        directory: opcional(booleano),
        title: opcional(texto({ max: 200, vazio: true })),
        defaultPath: opcional(texto({ max: 1024, vazio: true })),
        filters: opcional(
          lista(
            objeto({
              name: texto({ max: 100 }),
              extensions: lista(texto({ max: 20 }), 50),
            }),
            20,
          ),
        ),
        multiple: opcional(booleano),
        mode: opcional(umDe("open", "save")),
      },
    },
    open_url: { args: { url: texto({ max: 2048 }) } },
    open_path: { args: { path: caminhoEmRaizes(ctx.raizesAbrir) } },
    reveal: { args: { path: caminhoQualquer } },

    // ---- fotos do editor de criativos ----
    foto_salvar: {
      cabecalhos: {
        "x-veiculo": veiculo,
        "x-slot": texto({ max: 40 }),
        "x-nome": texto({ max: 255, vazio: true }),
        "x-mime": texto({ max: 60 }),
      },
      corpo: "obrigatorio",
    },
    fotos_listar: { args: { veiculo } },
    foto_ler: { args: { veiculo, slot: texto({ max: 40 }) } },
    veiculo_apagar_arquivos: { args: { veiculo } },
    fotos_importar_padrao: { args: { veiculo, pasta } },
    criativo_salvar: {
      cabecalhos: {
        "x-pasta": nome,
        "x-nome": nome,
        "x-destino": opcional((v, campo) =>
          v === "" ? undefined : pasta(v, campo),
        ),
      },
      corpo: "obrigatorio",
    },

    // ---- produção ----
    producao_status: { args: { pasta } },
    producao_fotos: { args: { pasta } },
    producao_documento: { args: { pasta } },
    producao_doc_copiar: {
      args: {
        pasta,
        origem: (v, campo) => {
          const caminho = caminhoQualquer(v, campo);
          if (!/\.pdf$/i.test(caminho))
            throw new Error("O documento precisa ser um arquivo PDF.");
          return caminho;
        },
      },
    },
    producao_gravar: {
      cabecalhos: { "x-pasta": pasta, "x-nome": nome },
      corpo: "obrigatorio",
    },
    fotos_renomear: { args: { pasta, ordem: lista(texto({ max: 255 }), 500) } },
  };
}
