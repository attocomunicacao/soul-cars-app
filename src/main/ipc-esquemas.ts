/**
 * Esquema de cada comando do IPC (`COMANDOS` em `ipc.ts`).
 *
 * Todo comando novo precisa de uma entrada aqui: o app não abre se faltar, e
 * um teste confere. Caminhos de pasta só são aceitos dentro das raízes
 * autorizadas (pasta de dados da loja e dados internos do app).
 */
import {
  booleano,
  caminhoEmRaizes,
  caminhoQualquer,
  consultaSql,
  idVeiculo,
  inteiro,
  lista,
  numero,
  objeto,
  objetoLivre,
  opcional,
  texto,
  umDe,
  valorSql,
  type Esquema,
  type Regra,
} from "./validacao";

export const METODOS_DO_MOTOR = [
  "gerar_textos",
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
  pastaBackups: () => string;
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

export function criarEsquemas(ctx: Contexto): Record<string, Esquema> {
  const pasta = caminhoEmRaizes(ctx.raizes);
  const sql = consultaSql(ctx.pastaBackups);
  const nome = texto({ max: 255 });
  const veiculo = idVeiculo;
  const consulta: Esquema = {
    args: { sql, values: opcional(lista(valorSql, 2000)) },
  };
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
    sql_select: consulta,
    sql_execute: consulta,
    banco_backup_preparar: { args: { nome: texto({ max: 100 }) } },
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
    segredo_definir: {
      args: {
        nome: texto({ max: 64 }),
        valor: opcional(texto({ max: 500, vazio: true })),
      },
    },
    segredo_existe: { args: { nome: texto({ max: 64 }) } },
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
