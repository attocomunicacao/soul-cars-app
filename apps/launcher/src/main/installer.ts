/**
 * Instalação, atualização e abertura dos apps do catálogo.
 *
 * Fluxo de instalar/atualizar um app:
 *   0. se o manifesto traz um pacote só de código e há uma versão instalada com o mesmo
 *      Electron, copia essa versão e troca só `resources` (o executável é o já liberado
 *      pelo Windows); se algo falhar, segue para o pacote completo;
 *   1. baixa o pacote .zip da plataforma (download.ts, com SHA-256);
 *   2. extrai numa pasta temporária ao lado (`<versão>.extraindo`);
 *   3. confere se o executável existe e renomeia para `apps/<id>/<versão>`;
 *   4. marca a versão como ativa e apaga as antigas (mantém a anterior para voltar atrás).
 *
 * A versão em uso nunca é sobrescrita: uma atualização interrompida não estraga o app.
 * Todo acesso a disco usa `fsSemAsar` (disk.ts): o `fs` do Electron prenderia o app.asar
 * da versão nova e impediria renomear a pasta.
 * Os dados do usuário (banco, configurações, pastas do estoque) ficam fora daqui,
 * na pasta de dados do próprio app, e não são tocados pelo Launcher.
 */
import { spawn } from "node:child_process";
import { fsSemAsar as fs, renomearComPaciencia } from "./disk";
import path from "node:path";
import type { AppRelease } from "../shared/manifest";
import type { ResultadoAbertura } from "../shared/api";
import {
  compararVersoes,
  versoesAlternativas,
  versoesParaLimpar,
} from "../shared/manifest";
import { pastaDaVersao, pastaDoApp, pastaDownloads } from "./config";
import { baixarVerificado } from "./download";
import { abrirExecutavel, ErroAoAbrir } from "./launch";
import { registrar } from "./log";
import { idDoRuntime } from "./runtime";
import { gravarEstado, lerEstado } from "./state";

/** Etapas avisadas à interface durante a instalação. */
export type AvisoInstalacao = (
  etapa: "baixando" | "verificando" | "extraindo",
  fracao?: number,
) => void;

/** Apps com instalação em andamento (evita duas ao mesmo tempo). */
const emAndamento = new Set<string>();

/** Extrai um .zip com o `tar` do próprio Windows (10+), sem dependências extras. */
function extrairZip(zip: string, destino: string): Promise<void> {
  fs.mkdirSync(destino, { recursive: true });
  const [comando, args] =
    process.platform === "win32"
      ? [
          path.join(
            process.env.SystemRoot ?? "C:\\Windows",
            "System32",
            "tar.exe",
          ),
          ["-xf", zip, "-C", destino],
        ]
      : ["unzip", ["-q", "-o", zip, "-d", destino]];
  return new Promise((ok, falha) => {
    const filho = spawn(comando, args, { windowsHide: true });
    let erro = "";
    filho.stderr.on("data", (d: Buffer) => (erro += d.toString()));
    filho.on("error", falha);
    filho.on("close", (codigo) =>
      codigo === 0
        ? ok()
        : falha(
            new Error(`Falha ao extrair o pacote (${codigo}). ${erro.trim()}`),
          ),
    );
  });
}

/** Opções de apagar pasta: o Windows pode segurar arquivos recém-escritos por instantes. */
const APAGAR = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 300,
} as const;

/** Procura o executável na pasta extraída (na raiz ou uma pasta abaixo). */
export function acharExecutavel(pasta: string, nome: string): string | null {
  const direto = path.join(pasta, nome);
  if (fs.existsSync(direto)) return direto;
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const dentro = path.join(pasta, item.name, nome);
    if (fs.existsSync(dentro)) return dentro;
  }
  return null;
}

/** Nome do executável do app neste sistema. */
function nomeExecutavel(release: AppRelease): string {
  const nome = release.executable[process.platform];
  if (!nome)
    throw new Error(`${release.name} não tem versão para este sistema.`);
  return nome;
}

/**
 * Pasta (raiz do Electron) de uma versão instalada que serve de base para o pacote de código:
 * a que tem o mesmo runtime do manifesto. Prefere a última que abriu de fato (sabidamente
 * aceita pelo Windows), depois a ativa e as demais, da mais nova para a mais antiga.
 */
function acharBase(release: AppRelease, runtime: string): string | null {
  const instalacao = lerEstado().instalados[release.id];
  if (!instalacao) return null;
  const ordem = [
    instalacao.ultimaQueAbriu,
    instalacao.ativa,
    ...[...instalacao.versoes].sort((a, b) => compararVersoes(b, a)),
  ].filter((v): v is string => !!v && v !== release.version);
  const exe = nomeExecutavel(release);
  for (const versao of new Set(ordem)) {
    const pasta = pastaDaVersao(release.id, versao);
    if (!fs.existsSync(pasta)) continue;
    const achado = acharExecutavel(pasta, exe);
    if (!achado) continue;
    const raiz = path.dirname(achado);
    if (idDoRuntime(raiz) === runtime) return raiz;
  }
  return null;
}

/**
 * Monta `destino` copiando uma versão já instalada (sem a pasta `resources`) e extraindo por
 * cima o pacote de código. O executável copiado é o mesmo que o Windows já liberou, então a
 * versão nova abre na hora. Devolve false se não há pacote ou versão base compatível.
 */
async function instalarPorPacoteDeCodigo(
  release: AppRelease,
  plataforma: string,
  destino: string,
  avisar: AvisoInstalacao,
): Promise<boolean> {
  const patch = release.patch;
  const download = patch?.downloads[plataforma];
  if (!patch || !download) return false;
  const base = acharBase(release, patch.runtime);
  if (!base) return false;
  const zip = path.join(
    pastaDownloads(),
    `${release.id}-${release.version}-${plataforma}-codigo.zip`,
  );
  avisar("baixando", 0);
  await baixarVerificado(download, zip, (f) => avisar("baixando", f));
  avisar("verificando");
  avisar("extraindo");
  fs.cpSync(base, destino, {
    recursive: true,
    filter: (origem) =>
      path.relative(base, origem).split(path.sep)[0] !== "resources",
  });
  await extrairZip(zip, destino);
  fs.rmSync(zip, { force: true });
  if (!fs.existsSync(path.join(destino, "resources", "app.asar")))
    throw new Error("O pacote de código não contém resources/app.asar.");
  registrar(
    `${release.name} ${release.version} montado só com o código novo, sobre o executável de ${base}.`,
  );
  return true;
}

/** Baixa e instala a versão do manifesto; devolve a pasta instalada. */
export async function instalarApp(
  release: AppRelease,
  plataforma: string,
  avisar: AvisoInstalacao,
): Promise<string> {
  const download = release.downloads[plataforma];
  if (!download)
    throw new Error(
      `${release.name} ${release.version} não tem pacote para ${plataforma}.`,
    );
  if (emAndamento.has(release.id))
    throw new Error(`${release.name} já está sendo instalado.`);
  emAndamento.add(release.id);
  try {
    const executavel = nomeExecutavel(release);
    const final = pastaDaVersao(release.id, release.version);
    const temporaria = `${final}.extraindo`;
    fs.rmSync(temporaria, APAGAR);

    // Preferência: pacote só de código sobre um executável já liberado pelo Windows.
    let pronta = false;
    try {
      pronta = await instalarPorPacoteDeCodigo(
        release,
        plataforma,
        temporaria,
        avisar,
      );
    } catch (erro) {
      registrar(
        `Pacote de código de ${release.version} falhou (${String(erro)}); usando o pacote completo.`,
      );
      fs.rmSync(temporaria, APAGAR);
    }
    if (!pronta) {
      const zip = path.join(
        pastaDownloads(),
        `${release.id}-${release.version}-${plataforma}.zip`,
      );
      avisar("baixando", 0);
      await baixarVerificado(download, zip, (f) => avisar("baixando", f));
      avisar("verificando");
      avisar("extraindo");
      await extrairZip(zip, temporaria);
      fs.rmSync(zip, { force: true });
    }
    if (!acharExecutavel(temporaria, executavel))
      throw new Error(`O pacote baixado não contém ${executavel}.`);
    fs.rmSync(final, APAGAR);
    await renomearComPaciencia(temporaria, final);

    // Marca como ativa e limpa versões antigas (se alguma estiver aberta, fica para depois).
    const estado = gravarEstado((e) => {
      const atual = e.instalados[release.id] ?? {
        ativa: release.version,
        versoes: [],
      };
      const versoes = [...new Set([...atual.versoes, release.version])];
      // Mantém a "última que abriu": é a reserva se o Windows bloquear a versão nova.
      e.instalados[release.id] = { ...atual, ativa: release.version, versoes };
    });
    const sobras = versoesParaLimpar(
      estado.instalados[release.id].versoes,
      release.version,
      2,
      estado.instalados[release.id].ultimaQueAbriu,
    );
    const apagadas = sobras.filter((v) => {
      try {
        fs.rmSync(pastaDaVersao(release.id, v), {
          recursive: true,
          force: true,
        });
        return true;
      } catch {
        return false;
      }
    });
    if (apagadas.length)
      gravarEstado((e) => {
        e.instalados[release.id].versoes = e.instalados[
          release.id
        ].versoes.filter((v) => !apagadas.includes(v));
      });
    return final;
  } finally {
    emAndamento.delete(release.id);
  }
}

/** Versão ativa instalada (confere se a pasta ainda existe no disco). */
export function versaoInstalada(appId: string): string | null {
  const instalacao = lerEstado().instalados[appId];
  if (!instalacao) return null;
  return fs.existsSync(pastaDaVersao(appId, instalacao.ativa))
    ? instalacao.ativa
    : null;
}

/** Executável de uma versão instalada (ou null se a pasta estiver incompleta). */
function executavelDaVersao(
  release: AppRelease,
  versao: string,
): string | null {
  const pasta = pastaDaVersao(release.id, versao);
  return fs.existsSync(pasta)
    ? acharExecutavel(pasta, nomeExecutavel(release))
    : null;
}

/** Guarda a versão que abriu de fato (reserva para quando o Windows bloquear uma nova). */
function registrarQueAbriu(appId: string, versao: string) {
  gravarEstado((e) => {
    const atual = e.instalados[appId];
    if (atual) atual.ultimaQueAbriu = versao;
  });
}

/**
 * Abre o app instalado como processo independente do Launcher.
 *
 * Se o Windows (Smart App Control) bloquear a versão ativa — o que acontece com cada versão
 * nova até a Microsoft conhecer o arquivo —, abre a versão anterior que já funcionou e
 * devolve qual foi bloqueada, para a interface avisar. Nada é desativado no Windows: a
 * versão anterior simplesmente já é aceita por ele.
 */
export async function abrirApp(
  release: AppRelease,
): Promise<ResultadoAbertura> {
  const versao = versaoInstalada(release.id);
  if (!versao) throw new Error(`${release.name} ainda não está instalado.`);
  const exe = executavelDaVersao(release, versao);
  if (!exe)
    throw new Error(
      `Instalação incompleta de ${release.name}. Reinstale pelo Launcher.`,
    );
  try {
    await abrirExecutavel(exe, { nomeApp: release.name });
    registrarQueAbriu(release.id, versao);
    return { versaoAberta: versao };
  } catch (erro) {
    if (!(erro instanceof ErroAoAbrir) || !erro.bloqueadoPeloWindows)
      throw erro;
    const instalacao = lerEstado().instalados[release.id];
    const alternativas = versoesAlternativas(
      instalacao?.versoes ?? [],
      versao,
      instalacao?.ultimaQueAbriu,
    );
    for (const anterior of alternativas) {
      const exeAnterior = executavelDaVersao(release, anterior);
      if (!exeAnterior) continue;
      try {
        await abrirExecutavel(exeAnterior, { nomeApp: release.name });
        registrarQueAbriu(release.id, anterior);
        return { versaoAberta: anterior, versaoBloqueada: versao };
      } catch (outro) {
        // Também bloqueada (ou falhou): tenta a próxima; sem alternativas, vale o erro original.
        if (!(outro instanceof ErroAoAbrir)) throw outro;
      }
    }
    throw erro;
  }
}

/** Pasta onde o app está (versão ativa) ou a pasta geral do app. */
export function pastaParaMostrar(appId: string): string {
  const versao = versaoInstalada(appId);
  return versao ? pastaDaVersao(appId, versao) : pastaDoApp(appId);
}
