/**
 * Gravação atômica de arquivos de estado: escreve num temporário ao lado e só então troca o
 * original por ele. Se o app fechar, o disco encher ou a troca falhar no meio, o arquivo
 * antigo continua inteiro (nunca fica um JSON cortado) e o temporário é apagado.
 *
 * Sem dependência do Electron nem de `paths.ts`, para ser testável e usada por qualquer módulo.
 */
import fs from "node:fs";
import path from "node:path";

/** O antivírus do Windows costuma segurar um arquivo recém-gravado por instantes. */
const CODIGOS_DE_ARQUIVO_OCUPADO = new Set(["EBUSY", "EPERM", "EACCES"]);
const TENTATIVAS_DA_TROCA = 5;
const ESPERA_ENTRE_TENTATIVAS_MS = 25;

/** Espera síncrona curta (a gravação de estado é síncrona de propósito: não pode ser interrompida). */
function esperar(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Troca `origem` por `destino`, tentando de novo se o arquivo estiver ocupado. */
function trocar(origem: string, destino: string) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      fs.renameSync(origem, destino);
      return;
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException).code ?? "";
      if (
        !CODIGOS_DE_ARQUIVO_OCUPADO.has(codigo) ||
        tentativa >= TENTATIVAS_DA_TROCA
      )
        throw erro;
      esperar(ESPERA_ENTRE_TENTATIVAS_MS * tentativa);
    }
  }
}

/**
 * Grava `conteudo` em `arquivo` de forma atômica, criando a pasta se faltar.
 * Em caso de erro, o original não é tocado e o temporário é removido.
 */
export function gravarAtomico(arquivo: string, conteudo: string | Uint8Array) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  // Nome próprio de cada processo: duas gravações ao mesmo tempo não pisam no mesmo temporário.
  const temporario = `${arquivo}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporario, conteudo);
    trocar(temporario, arquivo);
  } catch (erro) {
    try {
      fs.rmSync(temporario, { force: true });
    } catch {
      /* o erro original é o que importa */
    }
    throw erro;
  }
}
