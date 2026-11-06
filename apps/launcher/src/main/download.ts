/**
 * Download com progresso e verificação SHA-256.
 *
 * O arquivo é gravado como `<destino>.part` enquanto baixa e só recebe o nome final
 * depois que o tamanho e o SHA-256 conferem com o manifesto. Um arquivo corrompido
 * ou adulterado nunca chega a ser extraído nem executado.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import type { Download } from "../shared/manifest";

/** Calcula o SHA-256 (hex) de um arquivo já baixado. */
export async function sha256DoArquivo(arquivo: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const parte of fs.createReadStream(arquivo))
    hash.update(parte as Buffer);
  return hash.digest("hex");
}

/** Downloads em andamento por arquivo de destino (um pedido repetido reaproveita o mesmo). */
const emAndamento = new Map<
  string,
  { promessa: Promise<string>; ouvintes: Set<(fracao: number) => void> }
>();

/**
 * Baixa `download.url` para `destino`, avisando a fração concluída (0 a 1).
 * Se o destino já existe com o SHA-256 certo (download anterior), não baixa de novo.
 *
 * Dois pedidos para o mesmo destino ao mesmo tempo (ex.: dois cliques em "Atualizar")
 * compartilham um único download: antes, cada um gravava no mesmo `.part` e o segundo
 * falhava com ENOENT quando o primeiro renomeava o arquivo.
 */
export function baixarVerificado(
  download: Download,
  destino: string,
  aoProgresso: (fracao: number) => void,
  sinal?: AbortSignal,
): Promise<string> {
  const chave = path.resolve(destino).toLowerCase();
  const atual = emAndamento.get(chave);
  if (atual) {
    atual.ouvintes.add(aoProgresso);
    return atual.promessa;
  }
  const ouvintes = new Set([aoProgresso]);
  const promessa = baixar(
    download,
    destino,
    (f) => ouvintes.forEach((o) => o(f)),
    sinal,
  ).finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, { promessa, ouvintes });
  return promessa;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renomeia o `.part` para o nome final. O antivírus do Windows costuma prender um .exe
 * recém-gravado por alguns instantes (EBUSY/EPERM): tenta de novo antes de desistir.
 */
async function renomearComInsistencia(origem: string, destino: string) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      fs.rmSync(destino, { force: true });
      fs.renameSync(origem, destino);
      return;
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException).code;
      if (
        tentativa >= 8 ||
        !["EBUSY", "EPERM", "EACCES"].includes(codigo ?? "")
      )
        throw erro;
      await esperar(400 * tentativa);
    }
  }
}

/** O download de fato: grava num `.part` exclusivo, confere tamanho e SHA-256, renomeia. */
async function baixar(
  download: Download,
  destino: string,
  aoProgresso: (fracao: number) => void,
  sinal?: AbortSignal,
): Promise<string> {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  if (
    fs.existsSync(destino) &&
    (await sha256DoArquivo(destino)) === download.sha256
  ) {
    aoProgresso(1);
    return destino;
  }
  // Nome exclusivo: nem outro processo nem um resto de tentativa anterior usam o mesmo arquivo.
  const parcial = `${destino}.${process.pid}-${Date.now()}.part`;
  const resposta = await fetch(download.url, {
    redirect: "follow",
    signal: sinal,
  });
  if (!resposta.ok || !resposta.body)
    throw new Error(`Falha no download (${resposta.status}).`);

  const hash = createHash("sha256");
  const saida = fs.createWriteStream(parcial);
  let recebidos = 0;
  try {
    const corpo = Readable.fromWeb(
      resposta.body as unknown as WebReadableStream,
    );
    for await (const parte of corpo) {
      const bloco = parte as Buffer;
      hash.update(bloco);
      recebidos += bloco.length;
      if (!saida.write(bloco))
        await new Promise<void>((r) => saida.once("drain", () => r()));
      aoProgresso(Math.min(recebidos / download.size, 1));
    }
    await new Promise<void>((ok, falha) =>
      saida.end((erro?: Error | null) => (erro ? falha(erro) : ok())),
    );
  } catch (erro) {
    saida.destroy();
    fs.rmSync(parcial, { force: true });
    throw erro;
  }

  const obtido = hash.digest("hex");
  if (recebidos !== download.size || obtido !== download.sha256) {
    fs.rmSync(parcial, { force: true });
    throw new Error(
      "O arquivo baixado não confere com a assinatura SHA-256 do manifesto. Tente de novo.",
    );
  }
  await renomearComInsistencia(parcial, destino);
  return destino;
}
