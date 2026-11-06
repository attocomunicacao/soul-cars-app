/**
 * Instalação, atualização e abertura dos apps do catálogo.
 *
 * Fluxo de instalar/atualizar um app:
 *   1. baixa o pacote .zip da plataforma (download.ts, com SHA-256);
 *   2. extrai numa pasta temporária ao lado (`<versão>.extraindo`);
 *   3. confere se o executável existe e renomeia para `apps/<id>/<versão>`;
 *   4. marca a versão como ativa e apaga as antigas (mantém a anterior para voltar atrás).
 *
 * A versão em uso nunca é sobrescrita: uma atualização interrompida não estraga o app.
 * Os dados do usuário (banco, configurações, pastas do estoque) ficam fora daqui,
 * na pasta de dados do próprio app, e não são tocados pelo Launcher.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AppRelease } from "../shared/manifest";
import { versoesParaLimpar } from "../shared/manifest";
import { pastaDaVersao, pastaDoApp, pastaDownloads } from "./config";
import { baixarVerificado } from "./download";
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
    const zip = path.join(
      pastaDownloads(),
      `${release.id}-${release.version}-${plataforma}.zip`,
    );
    avisar("baixando", 0);
    await baixarVerificado(download, zip, (f) => avisar("baixando", f));
    avisar("verificando");

    const final = pastaDaVersao(release.id, release.version);
    const temporaria = `${final}.extraindo`;
    fs.rmSync(temporaria, { recursive: true, force: true });
    avisar("extraindo");
    await extrairZip(zip, temporaria);
    if (!acharExecutavel(temporaria, executavel))
      throw new Error(`O pacote baixado não contém ${executavel}.`);
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(temporaria, final);
    fs.rmSync(zip, { force: true });

    // Marca como ativa e limpa versões antigas (se alguma estiver aberta, fica para depois).
    const estado = gravarEstado((e) => {
      const atual = e.instalados[release.id] ?? {
        ativa: release.version,
        versoes: [],
      };
      const versoes = [...new Set([...atual.versoes, release.version])];
      e.instalados[release.id] = { ativa: release.version, versoes };
    });
    const sobras = versoesParaLimpar(
      estado.instalados[release.id].versoes,
      release.version,
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

/** Abre o app instalado como processo independente do Launcher. */
export function abrirApp(release: AppRelease): void {
  const versao = versaoInstalada(release.id);
  if (!versao) throw new Error(`${release.name} ainda não está instalado.`);
  const pasta = pastaDaVersao(release.id, versao);
  const exe = acharExecutavel(pasta, nomeExecutavel(release));
  if (!exe)
    throw new Error(
      `Instalação incompleta de ${release.name}. Reinstale pelo Launcher.`,
    );
  const filho = spawn(exe, [], {
    cwd: path.dirname(exe),
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  filho.unref();
}

/** Pasta onde o app está (versão ativa) ou a pasta geral do app. */
export function pastaParaMostrar(appId: string): string {
  const versao = versaoInstalada(appId);
  return versao ? pastaDaVersao(appId, versao) : pastaDoApp(appId);
}
