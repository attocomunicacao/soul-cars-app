/**
 * Abertura de um app instalado, com verificação de que ele realmente começou.
 *
 * Antes o Launcher disparava o processo e não esperava nada: se o Windows bloqueasse o
 * executável (Smart App Control), o clique em "Abrir" simplesmente não fazia nada.
 * Agora:
 *   1. espera o processo ser criado ("spawn") ou recusado ("error");
 *   2. observa os primeiros segundos: se ele fechar logo, é falha;
 *   3. em caso de falha, consulta o registro de segurança do Windows (CodeIntegrity)
 *      para saber se foi bloqueio, e devolve uma mensagem clara.
 *
 * Sem Electron, para poder ser testado com processos reais (tests/launch.test.ts).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { mensagemDeFalha, type FalhaAoAbrir } from "../shared/launch-errors";

/** Consulta se o Windows bloqueou `exe` a partir de `desde` (injetável nos testes). */
export type VerificadorDeBloqueio = (
  exe: string,
  desde: Date,
) => Promise<boolean>;

export type OpcoesAbertura = {
  /** Nome exibido nas mensagens. */
  nomeApp: string;
  /** Argumentos do executável. */
  args?: string[];
  /** Quanto tempo observar o começo do processo (padrão 4 s). */
  observarMs?: number;
  /** Verificador de bloqueio (padrão: registro CodeIntegrity do Windows). */
  verificarBloqueio?: VerificadorDeBloqueio;
};

/** Erro de abertura com a mensagem pronta para o usuário. */
export class ErroAoAbrir extends Error {
  constructor(
    mensagem: string,
    readonly falha: FalhaAoAbrir,
    readonly bloqueadoPeloWindows: boolean,
  ) {
    super(mensagem);
    this.name = "ErroAoAbrir";
  }
}

/**
 * Procura no registro "Microsoft-Windows-CodeIntegrity/Operational" os eventos de bloqueio
 * (3033 e 3077) que citam o executável depois de `desde`. Fora do Windows, ou se a consulta
 * falhar, responde "não" (a mensagem fica genérica, nunca acusa o Windows sem prova).
 */
export const bloqueioNoRegistroDoWindows: VerificadorDeBloqueio = (
  exe,
  desde,
) => {
  if (process.platform !== "win32") return Promise.resolve(false);
  const segundos = Math.max(
    5,
    Math.ceil((Date.now() - desde.getTime()) / 1000) + 5,
  );
  // Só o nome do arquivo entra no filtro (sem aspas nem caracteres especiais do usuário).
  const nome = path.basename(exe).replace(/[^\w.-]/g, "");
  const script =
    `$desde=(Get-Date).AddSeconds(-${segundos});` +
    "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-CodeIntegrity/Operational';Id=3033,3077;StartTime=$desde} -ErrorAction SilentlyContinue" +
    ` | Where-Object { $_.Message -like '*${nome}*' } | Measure-Object | ForEach-Object { $_.Count }`;
  return new Promise((ok) => {
    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      // stdin fechado: com um pipe aberto, o PowerShell fica esperando entrada e não termina.
      { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
    );
    let saida = "";
    ps.stdout.on("data", (d: Buffer) => (saida += d.toString()));
    ps.on("error", () => ok(false));
    ps.on("close", () => ok(Number.parseInt(saida.trim(), 10) > 0));
    setTimeout(() => {
      ps.kill();
      ok(false);
    }, 8000).unref();
  });
};

/**
 * Abre `exe` como processo independente do Launcher. Resolve quando o app passou dos
 * primeiros segundos rodando; rejeita com ErroAoAbrir (mensagem pronta) se não abriu.
 */
export async function abrirExecutavel(
  exe: string,
  opcoes: OpcoesAbertura,
): Promise<void> {
  const inicio = new Date();
  const observarMs = opcoes.observarMs ?? 4000;
  const verificar = opcoes.verificarBloqueio ?? bloqueioNoRegistroDoWindows;

  const falha = await new Promise<FalhaAoAbrir | null>((resolver) => {
    let filho;
    try {
      filho = spawn(exe, opcoes.args ?? [], {
        cwd: path.dirname(exe),
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
    } catch (erro) {
      const e = erro as NodeJS.ErrnoException;
      return resolver({
        tipo: "nao-iniciou",
        codigo: e.code,
        errno: e.errno,
        mensagem: e.message,
      });
    }
    let observando: NodeJS.Timeout | undefined;
    filho.once("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(observando);
      resolver({
        tipo: "nao-iniciou",
        codigo: e.code,
        errno: e.errno,
        mensagem: e.message,
      });
    });
    filho.once("spawn", () => {
      observando = setTimeout(() => {
        filho.unref(); // passou do começo: segue sozinho, independente do Launcher
        resolver(null);
      }, observarMs);
    });
    filho.once("exit", (codigo) => {
      if (!observando) return; // o "error" já respondeu
      clearTimeout(observando);
      // Fechar com código 0 logo de cara é normal quando o app já estava aberto
      // (instância única: ele só traz a janela existente para a frente).
      resolver(
        codigo === 0
          ? null
          : {
              tipo: "fechou-logo",
              codigoSaida: codigo,
              ms: Date.now() - inicio.getTime(),
            },
      );
    });
  });

  if (!falha) return;
  const bloqueado = await verificar(exe, inicio).catch(() => false);
  throw new ErroAoAbrir(
    mensagemDeFalha(opcoes.nomeApp, falha, bloqueado),
    falha,
    bloqueado,
  );
}
