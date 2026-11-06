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

/**
 * Baixa `download.url` para `destino`, avisando a fração concluída (0 a 1).
 * Se o destino já existe com o SHA-256 certo (download anterior), não baixa de novo.
 */
export async function baixarVerificado(
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
  const parcial = `${destino}.part`;
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
  fs.renameSync(parcial, destino);
  return destino;
}
