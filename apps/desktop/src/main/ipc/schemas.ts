/**
 * Esquema de cada comando do IPC (`COMANDOS` em `ipc.ts`).
 *
 * Todo comando novo precisa de uma entrada aqui: o app não abre se faltar, e
 * um teste confere. Caminhos de pasta só são aceitos dentro das raízes
 * autorizadas (pasta de dados da loja e dados internos do app).
 */
import { EDITAVEIS, STATUS_VEICULO } from "../../shared/vehicle";
import { PERIODOS_FUNIL } from "../../shared/funnel";
import { PERIODOS_META } from "../../shared/meta-ads";
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
} from "./validation";

/** Métodos que a interface pode chamar por `engine_call`. */
export const METODOS_DO_MOTOR_PELA_INTERFACE = [
  "ping",
  "ler_crlv",
  "ocr_equipamentos",
  "remover_fundo",
  "aquecer_recorte",
  "gerar_doc_md",
  "cnw_buscar",
  "cnw_ficha",
  "cnw_texto",
  "ficha_web_buscar",
  "ficha_web_ficha",
  "fotos_organizar",
] as const;

/** Métodos que só o processo principal chama (planilha da Soul IA); a interface não os alcança. */
export const METODOS_INTERNOS_DO_MOTOR = ["soulia_planilha"] as const;

/** Todos os métodos de `apps/engine/main.py` (um teste confere a lista com o Python). */
export const METODOS_DO_MOTOR = [
  ...METODOS_DO_MOTOR_PELA_INTERFACE,
  ...METODOS_INTERNOS_DO_MOTOR,
] as const;

/** Nome de modelo de recorte: só letras, números, hífen e sublinhado (vira nome de pasta e de arquivo). */
const modeloDeRecorte: Regra<string> = (v, campo) => {
  const t = texto({ max: 60 })(v, campo);
  if (!/^[A-Za-z0-9_-]+$/.test(t))
    throw new Error(
      `Argumento inválido: "${campo}" deve ser um nome de modelo simples.`,
    );
  return t;
};

/** Ano vindo da ficha: texto curto ou número; nulo vira ausente. */
const anoDoModelo: Regra<string | number | undefined> = (v, campo) => {
  if (v === undefined || v === null) return undefined;
  return typeof v === "number"
    ? inteiro(v, campo)
    : texto({ max: 10, vazio: true })(v, campo);
};

/** Parâmetros aceitos por cada método do motor chamado pela interface. Fora daqui, o campo é descartado. */
function parametrosDoMotor(
  pasta: Regra<string>,
): Record<
  (typeof METODOS_DO_MOTOR_PELA_INTERFACE)[number],
  Record<string, Regra>
> {
  // Um arquivo vem em base64 (anexo) ou do disco (dentro das raízes), nunca de qualquer lugar.
  const arquivo = {
    arquivo: opcional(texto({ max: 60_000_000 })),
    origem: opcional(pasta),
  };
  const nomeDaBusca = {
    nome: texto({ max: 200, vazio: true }),
    ano: anoDoModelo,
  };
  return {
    ping: {},
    aquecer_recorte: {},
    ler_crlv: { ...arquivo, senha: opcional(texto({ max: 200, vazio: true })) },
    gerar_doc_md: {
      ...arquivo,
      senha: opcional(texto({ max: 200, vazio: true })),
      texto_integral: opcional(booleano),
    },
    ocr_equipamentos: {
      ...arquivo,
      modo: opcional(umDe("auto", "seguranca", "conforto", "infotenimento")),
    },
    remover_fundo: {
      ...arquivo,
      destino: opcional(pasta),
      modelo: opcional(modeloDeRecorte),
    },
    fotos_organizar: { pasta },
    cnw_buscar: nomeDaBusca,
    ficha_web_buscar: nomeDaBusca,
    cnw_ficha: {
      codigo: texto({ max: 100 }),
      referer: opcional(texto({ max: 500, vazio: true })),
    },
    ficha_web_ficha: { codigo: texto({ max: 100 }) },
    cnw_texto: { texto: texto({ max: 200_000, vazio: true }) },
  };
}

const PRESETS_META = PERIODOS_META.map(([v]) => v);
const PRESETS_FUNIL = PERIODOS_FUNIL.map(([v]) => v);

/** Extensões que o Windows executaria ao "abrir" o arquivo. */
export const EXTENSOES_EXECUTAVEIS =
  /\.(exe|com|bat|cmd|msi|msp|ps1|ps1xml|psm1|psd1|vbs|vbe|vb|js|jse|wsf|wsh|wsc|lnk|url|scr|pif|reg|hta|cpl|dll|jar|jnlp|application|appref-ms|gadget|msc|msu|scf|inf|settingcontent-ms|library-ms|search-ms)$/i;

/**
 * Diz se o host é deste computador ou da rede local: localhost, loopback, faixas privadas
 * (10.x, 172.16-31.x, 192.168.x), link-local, IPv6 local, nomes sem ponto e `.local`/`.lan`.
 */
export function hostEhLocal(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "::1") return true;
  if (/^(fc|fd)[0-9a-f]{0,2}:/.test(h) || /^fe80:/.test(h)) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (h.includes(":")) return false;
  return !h.includes(".") || /\.(local|lan|home\.arpa)$/.test(h);
}

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

/** Endereço do Ollama: só http(s) neste computador ou na rede local. */
const urlLocal: Regra<string> = (v, campo) => {
  const t = texto({ max: 200 })(v, campo);
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new Error(`${campo}: endereço inválido.`);
  }
  if (!["http:", "https:"].includes(u.protocol))
    throw new Error(`${campo}: use http:// ou https://.`);
  if (!hostEhLocal(u.hostname))
    throw new Error(
      `${campo}: use o endereço deste computador ou da rede local (ex.: http://localhost:11434).`,
    );
  return t;
};

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
  const PARAMETROS_DO_MOTOR = parametrosDoMotor(pasta);
  const nome = texto({ max: 255 });
  const veiculo = idVeiculo;
  const vazio: Esquema = {};

  return {
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
    embutida_mostrar: {
      args: {
        id: umDe("crm", "meta"),
        x: numero,
        y: numero,
        largura: numero,
        altura: numero,
      },
    },
    embutida_esconder: vazio,
    utalk_token_salvar: { args: { token: texto({ max: 4000 }) } },
    utalk_token_remover: vazio,
    // ---- CRM · Leads, Meta Ads e Funil (vindos do Soul APP) ----
    crm_leads_dados: vazio,
    crm_leads_atualizar: vazio,
    crm_leads_config_salvar: {
      args: {
        patch: objeto({
          windowDays: opcional(inteiro),
          intervalSec: opcional(inteiro),
          notifyNewLeads: opcional(booleano),
          tagCategories: opcional(objetoLivre),
          statusOrder: opcional(lista(texto({ max: 200 }), 2000)),
        }),
      },
    },
    meta_estado: vazio,
    meta_salvar: {
      args: {
        token: opcional(texto({ max: 4000, vazio: true })),
        conta: opcional(texto({ max: 60, vazio: true })),
        versao: opcional(texto({ max: 20, vazio: true })),
      },
    },
    meta_token_remover: vazio,
    meta_testar: {
      args: {
        token: opcional(texto({ max: 4000, vazio: true })),
        conta: opcional(texto({ max: 60, vazio: true })),
      },
    },
    meta_token_validade: vazio,
    meta_config_ler: vazio,
    meta_painel: { args: { preset: opcional(umDe(...PRESETS_META)) } },
    meta_config_salvar: {
      args: {
        patch: objeto({
          datePreset: opcional(umDe(...PRESETS_META)),
          alertCpr: opcional(numero),
          alertSpend: opcional(numero),
          roasTarget: opcional(numero),
          chartDays: opcional(inteiro),
        }),
      },
    },
    funil_dados: { args: { forcar: opcional(booleano) } },
    funil_config_salvar: {
      args: {
        patch: objeto({
          period: opcional(
            objeto({
              preset: umDe(...PRESETS_FUNIL),
              since: texto({ max: 10, vazio: true }),
              until: texto({ max: 10, vazio: true }),
            }),
          ),
          clickMetric: opcional(umDe("linkClicks", "clicks")),
          cumulative: opcional(booleano),
          tagRoles: opcional(objetoLivre),
          campaignProducts: opcional(objetoLivre),
        }),
      },
    },
    soulapp_estado: vazio,
    soulapp_importar: vazio,
    soulia_estado: vazio,
    soulia_sincronizar: { args: { limite: opcional(inteiro) } },
    soulia_cancelar: vazio,
    soulia_exportar: vazio,
    soulia_abrir_pasta: vazio,
    soulia_esquecer: vazio,
    // ---- Pré-atendimento IA ----
    pre_painel: vazio,
    pre_config_salvar: {
      args: {
        patch: objeto({
          ligado: opcional(booleano),
          provedor: opcional(umDe("groq", "ollama")),
          modeloGroq: opcional(texto({ max: 200 })),
          reservaOllama: opcional(booleano),
          urlOllama: opcional(urlLocal),
          modeloOllama: opcional(texto({ max: 200 })),
          temperatura: opcional(numero),
          etiquetaGatilhoId: opcional(texto({ max: 100, vazio: true })),
          etiquetaTransferenciaId: opcional(texto({ max: 100, vazio: true })),
          intervaloSeg: opcional(inteiro),
          enviarSemAprovacao: opcional(booleano),
          enviarAbertura: opcional(booleano),
          nomeAgente: opcional(texto({ max: 60 })),
          maxFotos: opcional(inteiro),
          usarHistoricoCrm: opcional(booleano),
        }),
      },
    },
    pre_chave_groq_salvar: {
      args: { chave: texto({ max: 400, vazio: true }) },
    },
    pre_loja_salvar: {
      args: {
        patch: objeto(
          Object.fromEntries(
            [
              "nome",
              "endereco",
              "horario",
              "telefone",
              "site",
              "financiamento",
              "troca",
              "extra",
            ].map((k) => [k, opcional(texto({ max: 4000, vazio: true }))]),
          ),
        ),
      },
    },
    pre_persona_salvar: { args: { persona: texto({ max: 20_000 }) } },
    pre_resposta_salvar: {
      args: {
        item: objeto({
          id: texto({ max: 100, vazio: true }),
          titulo: texto({ max: 200 }),
          palavras: texto({ max: 1000, vazio: true }),
          texto: texto({ max: 4000 }),
        }),
      },
    },
    pre_resposta_remover: { args: { id: texto({ max: 100 }) } },
    pre_respostas_importar: vazio,
    pre_exemplo_salvar: {
      args: {
        item: objeto({
          id: opcional(texto({ max: 100, vazio: true })),
          pergunta: texto({ max: 4000 }),
          resposta: texto({ max: 4000 }),
          origem: umDe("correcao", "manual"),
        }),
      },
    },
    pre_exemplo_remover: { args: { id: texto({ max: 100 }) } },
    pre_exemplos_recalcular: vazio,
    pre_simular: {
      args: {
        conversa: lista(
          objeto({
            role: umDe("user", "assistant"),
            content: texto({ max: 4000 }),
          }),
          200,
        ),
        nome: opcional(texto({ max: 200, vazio: true })),
        etiquetas: opcional(lista(texto({ max: 200 }), 100)),
        enviadas: opcional(objetoLivre),
      },
    },
    pre_rodar: vazio,
    pre_aprovar: {
      args: { id: texto({ max: 100 }), texto: opcional(texto({ max: 4000 })) },
    },
    pre_descartar: { args: { id: texto({ max: 100 }) } },
    pre_reativar: { args: { chatId: texto({ max: 100 }) } },
    pre_esquecer: { args: { chatId: texto({ max: 100 }) } },
    pre_etiquetas: vazio,
    pre_modelos: vazio,
    pre_auditoria: { args: { limite: opcional(inteiro) } },
    // ---- Laboratório de testes da IA ----
    lab_cenarios: vazio,
    lab_rodar: {
      args: {
        ids: opcional(lista(texto({ max: 200 }), 5000)),
        categoria: opcional(texto({ max: 200 })),
        repeticoes: opcional(inteiro),
      },
    },
    lab_cancelar: vazio,
    lab_execucoes: vazio,
    lab_execucao: { args: { id: texto({ max: 100 }) } },
    lab_avaliar: {
      args: {
        execucaoId: texto({ max: 100 }),
        cenarioId: texto({ max: 200 }),
        repeticao: inteiro,
        turno: inteiro,
        nota: inteiro,
        etiquetas: lista(texto({ max: 50 }), 20),
        comentario: texto({ max: 1000, vazio: true }),
      },
    },
    lab_avaliacoes: { args: { execucaoId: opcional(texto({ max: 100 })) } },
    lab_relatorio: { args: { execucaoId: texto({ max: 100 }) } },
    lab_analisar_historico: vazio,
    lab_cenarios_auditoria: vazio,
    lab_abrir_pasta: vazio,
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
        method: umDe(...METODOS_DO_MOTOR_PELA_INTERFACE),
        params: opcional(objetoLivre),
      },
      // Os `params` só valem na forma do método escolhido: caminho dentro das raízes, campos conhecidos.
      depois: (args) => {
        const metodo =
          args.method as (typeof METODOS_DO_MOTOR_PELA_INTERFACE)[number];
        const params = objeto(PARAMETROS_DO_MOTOR[metodo])(
          args.params ?? {},
          "params",
        );
        return { ...args, params };
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
      },
    },
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
