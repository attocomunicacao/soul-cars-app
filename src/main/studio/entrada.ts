/**
 * Entrada de arquivos por pasta sincronizada (Google Drive para Desktop, OneDrive…).
 *
 * A equipe envia fotos, vídeo e documento numa subpasta com a placa no nome. A cada ciclo
 * este módulo acha o veículo do ESTOQUE pela placa e COPIA os arquivos para a pasta dele.
 *
 * Garantias: nunca move nem apaga a origem, nunca sobrescreve um arquivo do destino,
 * só copia arquivo de tamanho estável, copia em fluxo (vídeos de 400 MB não vão para a
 * memória) e é idempotente (a tabela `entrada_arquivos` lembra o que já foi copiado).
 * Quem não casa vira pendência para a pessoa resolver; nada é adivinhado.
 *
 * Sem Electron e sem acesso direto ao banco: tudo entra por `DepsEntrada`, o que permite
 * testar com pastas temporárias.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import {
  AVISO_HEIC,
  classificar,
  ehTemporario,
  extrairPlacas,
  nomeComSufixo,
  placaDaPasta,
} from "../../compartilhado/entrada";
import { arquivos as listarArquivosDir, dentro, pastaFotos } from "./arquivos";

type Linha = Record<string, any>;

export type DepsEntrada = {
  selecionar: (sql: string, valores?: unknown[]) => Linha[];
  executar: (sql: string, valores?: unknown[]) => unknown;
  emitir: (nome: string, carga: unknown) => void;
  /** Pasta ESTOQUE (uma subpasta por veículo). */
  estoque: () => string;
  agora?: () => number;
};

export type EstadoEntrada = {
  pasta: string | null;
  pausado: boolean;
  verificando: boolean;
  copiando: { arquivo: string; bytes: number; total: number } | null;
  ultimaVerificacao: string | null;
  erro: string | null;
  copiadosNoCiclo: number;
};

export type Liberavel = {
  pasta: string;
  arquivos: number;
  bytes: number;
  veiculo: string | null;
};

export type ResultadoLiberar = {
  liberados: number;
  bytes: number;
  ignorados: { arquivo: string; motivo: string }[];
};

/** Tempo mínimo em que tamanho e data precisam ficar iguais para o arquivo valer. */
export const ESTAVEL_MS = 5000;
export const INTERVALO_MS = 30_000;
const ATRASO_INICIAL_MS = 10_000;
const PROFUNDIDADE = 3;

export async function hashArquivo(caminho: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const leitura = fs.createReadStream(caminho, { highWaterMark: 4 << 20 });
  for await (const pedaco of leitura) hash.update(pedaco as Buffer);
  return hash.digest("hex");
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ehPasta = (p: string) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** Placa → pastas do ESTOQUE que a têm no nome. */
export function mapaPlacas(estoque: string): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  let nomes: string[] = [];
  try {
    nomes = fs
      .readdirSync(estoque, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return mapa;
  }
  for (const nome of nomes) {
    const placa = placaDaPasta(nome);
    if (!placa) continue;
    mapa.set(placa, [...(mapa.get(placa) ?? []), path.join(estoque, nome)]);
  }
  return mapa;
}

type Item = { caminho: string; nome: string; tamanho: number; mtime: number };

function listarItens(dir: string, nivel = 0): Item[] {
  let entradas: fs.Dirent[] = [];
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const itens: Item[] = [];
  for (const e of entradas) {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (nivel + 1 < PROFUNDIDADE && !e.name.startsWith("."))
        itens.push(...listarItens(caminho, nivel + 1));
    } else if (e.isFile() && !ehTemporario(e.name)) {
      try {
        const st = fs.statSync(caminho);
        itens.push({
          caminho,
          nome: e.name,
          tamanho: st.size,
          mtime: Math.trunc(st.mtimeMs),
        });
      } catch {
        /* sumiu no meio da varredura */
      }
    }
  }
  return itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const VIDEOS_BRUTOS = (pasta: string) =>
  ["VIDEO", "PROJETO", ""].flatMap((sub) =>
    listarArquivosDir(sub ? path.join(pasta, sub) : pasta),
  );

/** O Editor Mágico exige um único vídeo bruto; os VIDEO_* já editados não contam. */
function videoBrutoExistente(pasta: string): string | null {
  return (
    VIDEOS_BRUTOS(pasta).find(
      (p) =>
        classificar(path.basename(p)) === "video" &&
        !path.basename(p).toUpperCase().startsWith("VIDEO_"),
    ) ?? null
  );
}

function pdfExistente(pasta: string): string | null {
  return (
    listarArquivosDir(pasta).find((p) => p.toLowerCase().endsWith(".pdf")) ??
    null
  );
}

export function criarEntrada(deps: DepsEntrada) {
  const agora = deps.agora ?? Date.now;
  const vistos = new Map<
    string,
    { tamanho: number; mtime: number; visto: number }
  >();
  let timer: NodeJS.Timeout | null = null;
  let inicial: NodeJS.Timeout | null = null;
  let rodando = false;
  const estado: EstadoEntrada = {
    pasta: null,
    pausado: false,
    verificando: false,
    copiando: null,
    ultimaVerificacao: null,
    erro: null,
    copiadosNoCiclo: 0,
  };

  const pastaEntrada = (): string | null => {
    const linhas = deps.selecionar("SELECT valor FROM config WHERE chave = ?", [
      "entrada_pasta",
    ]);
    const valor = String(linhas[0]?.valor ?? "").trim();
    return valor || null;
  };

  const registrar = (r: {
    origem: string;
    tamanho: number;
    mtime: number;
    situacao: "copiado" | "pendente" | "erro";
    detalhe?: string | null;
    aviso?: boolean;
    destino?: string | null;
    hash?: string | null;
    veiculoPasta?: string | null;
  }) => {
    deps.executar(
      `INSERT INTO entrada_arquivos
         (origem, tamanho, mtime_ms, situacao, detalhe, aviso, destino, hash, veiculo_pasta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (origem, tamanho, mtime_ms) DO UPDATE SET
         situacao = excluded.situacao, detalhe = excluded.detalhe, aviso = excluded.aviso,
         destino = excluded.destino, hash = excluded.hash, veiculo_pasta = excluded.veiculo_pasta,
         atualizado = datetime('now', 'localtime')`,
      [
        r.origem,
        r.tamanho,
        r.mtime,
        r.situacao,
        r.detalhe ?? null,
        r.aviso ? 1 : 0,
        r.destino ?? null,
        r.hash ?? null,
        r.veiculoPasta ?? null,
      ],
    );
    // Versão antiga do mesmo arquivo que ainda estava pendente ou com erro não vale mais.
    deps.executar(
      `DELETE FROM entrada_arquivos
        WHERE origem = ? AND situacao != 'copiado' AND NOT (tamanho = ? AND mtime_ms = ?)`,
      [r.origem, r.tamanho, r.mtime],
    );
  };

  const jaCopiado = (i: Item) =>
    deps.selecionar(
      `SELECT 1 FROM entrada_arquivos
        WHERE origem = ? AND tamanho = ? AND mtime_ms = ? AND situacao = 'copiado'`,
      [i.caminho, i.tamanho, i.mtime],
    ).length > 0;

  const pendencia = (i: Item, motivo: string) =>
    registrar({
      origem: i.caminho,
      tamanho: i.tamanho,
      mtime: i.mtime,
      situacao: "pendente",
      detalhe: motivo,
    });

  let ultimoProgresso = 0;
  const progresso = (arquivo: string, bytes: number, total: number) => {
    estado.copiando = { arquivo, bytes, total };
    if (agora() - ultimoProgresso > 250 || bytes >= total) {
      ultimoProgresso = agora();
      deps.emitir("entrada:progresso", estado.copiando);
    }
  };

  /** Copia em fluxo para `<alvo>.parcial` e só então publica no nome final, sem sobrescrever. */
  async function copiarSemSobrescrever(
    item: Item,
    alvo: string,
  ): Promise<string> {
    const parcial = alvo + ".parcial";
    fs.rmSync(parcial, { force: true });
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    const leitura = fs.createReadStream(item.caminho, {
      highWaterMark: 4 << 20,
    });
    leitura.on("data", (pedaco) => {
      hash.update(pedaco as Buffer);
      bytes += (pedaco as Buffer).length;
      progresso(item.nome, bytes, item.tamanho);
    });
    try {
      await pipeline(leitura, fs.createWriteStream(parcial, { flags: "wx" }));
      const depois = fs.statSync(item.caminho);
      if (
        depois.size !== item.tamanho ||
        Math.trunc(depois.mtimeMs) !== item.mtime ||
        fs.statSync(parcial).size !== item.tamanho
      )
        throw new Error(
          "O arquivo mudou durante a cópia; vou tentar de novo no próximo ciclo.",
        );
      if (fs.existsSync(alvo)) throw new Error("O destino passou a existir.");
      try {
        fs.linkSync(parcial, alvo); // falha se o nome já existir: nunca sobrescreve
        fs.unlinkSync(parcial);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") throw e;
        if (fs.existsSync(alvo)) throw e;
        fs.renameSync(parcial, alvo); // sistema de arquivos sem hard link
      }
    } catch (e) {
      fs.rmSync(parcial, { force: true });
      throw e;
    }
    return hash.digest("hex");
  }

  async function copiarPara(
    item: Item,
    destDir: string,
    nomeDestino: string,
    veiculoPasta: string,
    aviso: string | null,
  ) {
    fs.mkdirSync(destDir, { recursive: true });
    let nome = nomeDestino;
    for (let n = 1; ;) {
      const alvo = path.join(destDir, nome);
      if (!fs.existsSync(alvo)) break;
      if (fs.statSync(alvo).size === item.tamanho) {
        const [a, b] = [
          await hashArquivo(item.caminho),
          await hashArquivo(alvo),
        ];
        if (a === b) {
          registrar({
            origem: item.caminho,
            tamanho: item.tamanho,
            mtime: item.mtime,
            situacao: "copiado",
            detalhe: "Já existia um arquivo igual no destino.",
            destino: alvo,
            hash: a,
            veiculoPasta,
          });
          return;
        }
      }
      n++;
      nome = nomeComSufixo(nomeDestino, n);
    }
    const alvo = path.join(destDir, nome);
    const hash = await copiarSemSobrescrever(item, alvo);
    registrar({
      origem: item.caminho,
      tamanho: item.tamanho,
      mtime: item.mtime,
      situacao: "copiado",
      detalhe:
        aviso ??
        (nome !== nomeDestino ? `Nome já existia; salvo como ${nome}.` : null),
      aviso: !!aviso,
      destino: alvo,
      hash,
      veiculoPasta,
    });
    estado.copiadosNoCiclo++;
  }

  async function processarItem(
    item: Item,
    veiculoPasta: string,
    pdfsDaOrigem: number,
  ) {
    const tipo = classificar(item.nome);
    if (tipo === "foto" || tipo === "foto-heic")
      return copiarPara(
        item,
        pastaFotos(veiculoPasta),
        item.nome,
        veiculoPasta,
        tipo === "foto-heic" ? AVISO_HEIC : null,
      );
    if (tipo === "video") {
      const existente = videoBrutoExistente(veiculoPasta);
      if (existente)
        return pendencia(
          item,
          `Já existe um vídeo bruto na pasta do veículo (${path.basename(existente)}). O Editor Mágico exige só um.`,
        );
      return copiarPara(
        item,
        path.join(veiculoPasta, "VIDEO"),
        item.nome,
        veiculoPasta,
        null,
      );
    }
    if (tipo === "documento") {
      if (pdfsDaOrigem > 1)
        return pendencia(
          item,
          `Há ${pdfsDaOrigem} PDFs na pasta de entrada deste veículo. Deixe só o documento (CRLV).`,
        );
      const existente = pdfExistente(veiculoPasta);
      if (existente)
        return pendencia(
          item,
          `Já existe um PDF na pasta do veículo (${path.basename(existente)}); não sobrescrevo.`,
        );
      return copiarPara(item, veiculoPasta, "DOC.pdf", veiculoPasta, null);
    }
    return pendencia(
      item,
      `Tipo de arquivo não reconhecido (${path.extname(item.nome) || "sem extensão"}).`,
    );
  }

  async function processarPasta(
    subNome: string,
    subCaminho: string,
    placas: Map<string, string[]>,
  ) {
    const itens = listarItens(subCaminho);
    const candidatas = extrairPlacas(subNome);
    const casadas = candidatas.filter((p) => placas.has(p));
    let motivo: string | null = null;
    let veiculoPasta = "";
    if (casadas.length === 0)
      motivo = candidatas.length
        ? `Nenhum veículo do estoque com a placa ${candidatas.join(" ou ")}.`
        : "Não encontrei uma placa no nome da pasta.";
    else if (casadas.length > 1)
      motivo = `O nome da pasta tem mais de uma placa do estoque (${casadas.join(", ")}).`;
    else {
      const pastas = placas.get(casadas[0])!;
      if (pastas.length > 1)
        motivo = `Mais de um veículo com a placa ${casadas[0]}: ${pastas.map((p) => path.basename(p)).join(", ")}.`;
      else veiculoPasta = pastas[0];
    }
    const pdfs = itens.filter(
      (i) => classificar(i.nome) === "documento",
    ).length;

    for (const item of itens) {
      if (estado.pausado) return;
      const anterior = vistos.get(item.caminho);
      const mudou =
        !anterior ||
        anterior.tamanho !== item.tamanho ||
        anterior.mtime !== item.mtime;
      if (mudou)
        vistos.set(item.caminho, {
          tamanho: item.tamanho,
          mtime: item.mtime,
          visto: agora(),
        });
      const estavel =
        !mudou &&
        agora() - anterior!.visto >= ESTAVEL_MS &&
        agora() - item.mtime >= ESTAVEL_MS;
      if (jaCopiado(item) || !estavel) continue;
      try {
        if (motivo) pendencia(item, motivo);
        else await processarItem(item, veiculoPasta, pdfs);
      } catch (e) {
        registrar({
          origem: item.caminho,
          tamanho: item.tamanho,
          mtime: item.mtime,
          situacao: "erro",
          detalhe: mensagem(e),
          veiculoPasta: veiculoPasta || null,
        });
      } finally {
        estado.copiando = null;
      }
    }
  }

  /** Uma passada pela pasta de entrada. Só uma roda por vez. */
  async function verificar(): Promise<void> {
    if (rodando || estado.pausado) return;
    rodando = true;
    estado.verificando = true;
    estado.erro = null;
    estado.copiadosNoCiclo = 0;
    deps.emitir("entrada:estado", obterEstado());
    try {
      const pasta = pastaEntrada();
      estado.pasta = pasta;
      if (!pasta) throw new Error("Escolha a pasta sincronizada em Entrada.");
      if (!ehPasta(pasta))
        throw new Error(`A pasta de entrada não foi encontrada: ${pasta}`);
      const placas = mapaPlacas(deps.estoque());
      const subs = fs
        .readdirSync(pasta, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      for (const sub of subs) {
        if (estado.pausado) break;
        await processarPasta(sub, path.join(pasta, sub), placas);
      }
      estado.ultimaVerificacao = new Date(agora()).toISOString();
    } catch (e) {
      estado.erro = mensagem(e);
    } finally {
      rodando = false;
      estado.verificando = false;
      estado.copiando = null;
      deps.emitir("entrada:fim", obterEstado());
    }
  }

  function obterEstado() {
    const pasta = pastaEntrada();
    estado.pasta = pasta;
    const existe = (r: Linha) => fs.existsSync(String(r.origem));
    const pendencias = deps
      .selecionar(
        `SELECT id, origem, tamanho, situacao, detalhe FROM entrada_arquivos
          WHERE situacao IN ('pendente', 'erro') ORDER BY origem`,
      )
      .filter(existe);
    const avisos = deps.selecionar(
      `SELECT id, origem, destino, detalhe FROM entrada_arquivos
          WHERE situacao = 'copiado' AND aviso = 1 ORDER BY origem`,
    );
    const liberaveis: Liberavel[] = [];
    if (pasta) {
      const grupos = new Map<string, Liberavel>();
      for (const r of deps.selecionar(
        `SELECT origem, tamanho, veiculo_pasta FROM entrada_arquivos
          WHERE situacao = 'copiado' AND liberado = 0`,
      )) {
        const rel = path.relative(pasta, String(r.origem));
        if (
          rel.startsWith("..") ||
          path.isAbsolute(rel) ||
          !fs.existsSync(String(r.origem))
        )
          continue;
        const sub = rel.split(path.sep)[0];
        const g = grupos.get(sub) ?? {
          pasta: sub,
          arquivos: 0,
          bytes: 0,
          veiculo: r.veiculo_pasta
            ? path.basename(String(r.veiculo_pasta))
            : null,
        };
        g.arquivos++;
        g.bytes += Number(r.tamanho);
        grupos.set(sub, g);
      }
      liberaveis.push(...grupos.values());
    }
    return { estado: { ...estado }, pendencias, avisos, liberaveis };
  }

  /**
   * "Liberar espaço": manda para a Lixeira os arquivos da pasta de entrada que já foram copiados.
   * Cada arquivo só sai se a origem não mudou e o destino tem o mesmo tamanho e o mesmo hash.
   */
  async function liberar(
    subpastas: string[],
    paraLixeira: (caminho: string) => Promise<void>,
  ): Promise<ResultadoLiberar> {
    const pasta = pastaEntrada();
    if (!pasta) throw new Error("Pasta de entrada não configurada.");
    if (rodando) throw new Error("Aguarde a verificação terminar.");
    const resultado: ResultadoLiberar = {
      liberados: 0,
      bytes: 0,
      ignorados: [],
    };
    for (const sub of subpastas) {
      if (path.basename(sub) !== sub || !sub)
        throw new Error("Pasta inválida.");
      const base = dentro(pasta, path.join(pasta, sub));
      const linhas = deps.selecionar(
        `SELECT id, origem, tamanho, mtime_ms, destino, hash FROM entrada_arquivos
          WHERE situacao = 'copiado' AND liberado = 0`,
      );
      for (const r of linhas) {
        const origem = String(r.origem);
        if (!origem.startsWith(base + path.sep)) continue;
        const recusar = (motivo: string) =>
          resultado.ignorados.push({ arquivo: origem, motivo });
        try {
          const so = fs.statSync(origem);
          if (so.size !== r.tamanho || Math.trunc(so.mtimeMs) !== r.mtime_ms) {
            recusar("A origem mudou depois da cópia.");
            continue;
          }
          const destino = String(r.destino ?? "");
          if (
            !destino ||
            !fs.existsSync(destino) ||
            fs.statSync(destino).size !== r.tamanho
          ) {
            recusar("O destino não existe ou tem tamanho diferente.");
            continue;
          }
          if ((await hashArquivo(destino)) !== r.hash) {
            recusar("O conteúdo do destino não confere com o da cópia.");
            continue;
          }
          await paraLixeira(origem);
          deps.executar(
            "UPDATE entrada_arquivos SET liberado = 1 WHERE id = ?",
            [r.id],
          );
          resultado.liberados++;
          resultado.bytes += so.size;
        } catch (e) {
          recusar(mensagem(e));
        }
      }
    }
    return resultado;
  }

  const notificar = () => deps.emitir("entrada:estado", obterEstado());

  return {
    verificar,
    obterEstado,
    liberar,
    pausar(pausar: boolean) {
      estado.pausado = pausar;
      notificar();
    },
    iniciar(intervalo = INTERVALO_MS, atraso = ATRASO_INICIAL_MS) {
      this.parar();
      inicial = setTimeout(() => void verificar(), atraso);
      timer = setInterval(() => void verificar(), intervalo);
      inicial.unref?.();
      timer.unref?.();
    },
    parar() {
      if (inicial) clearTimeout(inicial);
      if (timer) clearInterval(timer);
      inicial = timer = null;
    },
  };
}
