/**
 * Ponte com o motor Python (opcional).
 *
 * O motor é o `engine/` do SOUL Cars Studio: leitura de CRLV, OCR, recorte
 * de fundo, reconhecimento de fotos, ficha do Carros na Web, textos com IA e
 * render do vídeo. É Python e continua em Python — reescrever OCR e modelos
 * de visão em TypeScript não faria sentido.
 *
 * O app conversa com ele por uma linha de JSON na entrada e uma na saída
 * (`engine/main.py`), mantendo um processo aberto para não pagar o tempo de
 * inicialização a cada chamada.
 *
 * **Sem o motor, o app funciona**: estoque, pastas, fichas, balanço,
 * relatório, publicação, relatórios do Meta Ads e o editor de criativos não
 * dependem dele. Só as automações de documento, foto e vídeo precisam.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import * as caminhos from "../caminhos";

export type Emitir = (canal: string, carga: unknown) => void;

let processo: ChildProcessWithoutNullStreams | null = null;
let fila: Promise<unknown> = Promise.resolve();

/** Onde procurar o `engine/` do Studio: ao lado do app ou na config. */
export function pastaMotor(): string | null {
  const salva = caminhos.lerConfig().pastaMotor as string | undefined;
  const candidatos = [
    salva,
    path.join(process.resourcesPath, "engine"),
    path.join(app.getAppPath(), "engine"),
    path.resolve(app.getAppPath(), "..", "soul-cars-studio", "engine"),
    path.resolve(app.getAppPath(), "..", "..", "soul-cars-studio", "engine"),
    path.join(caminhos.raizDados(), "engine"),
  ].filter((c): c is string => !!c);
  return candidatos.find((c) => fs.existsSync(path.join(c, "main.py"))) ?? null;
}

/** O python do ambiente virtual do motor (`engine/.venv`). */
export function pythonMotor(): string | null {
  const pasta = pastaMotor();
  if (!pasta) return null;
  const candidatos = [
    path.join(
      caminhos.userData(),
      "engine-venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
    path.join(pasta, ".venv", "Scripts", "python.exe"),
    path.join(pasta, ".venv", "bin", "python"),
  ];
  return candidatos.find((p) => fs.existsSync(p)) ?? null;
}

export function estadoMotor() {
  const pasta = pastaMotor();
  const python = pythonMotor();
  return {
    python: !!python,
    bibliotecas: !!python,
    tesseract:
      naPath("tesseract") ||
      (fs.existsSync("C:/Program Files/Tesseract-OCR/tesseract.exe")
        ? "C:/Program Files/Tesseract-OCR/tesseract.exe"
        : null),
    ffmpeg: naPath("ffmpeg"),
    uv: !!naPath("uv"),
    venv: pasta ? path.join(pasta, ".venv") : null,
    engine: pasta,
  };
}

export function instalarMotor(emitir: Emitir) {
  const uv = naPath("uv");
  const pasta = pastaMotor();
  if (!uv)
    throw new Error(
      "Instale uv pelo Git CMD: winget install --id astral-sh.uv -e. Depois reabra o app.",
    );
  if (!pasta)
    throw new Error(
      "Pasta engine não encontrada. Escolha a pasta nas configurações.",
    );
  return new Promise<void>((resolver, rejeitar) => {
    const p = spawn(uv, ["sync", "--all-groups", "--project", pasta], {
      windowsHide: true,
      env: {
        ...process.env,
        UV_PROJECT_ENVIRONMENT: path.join(caminhos.userData(), "engine-venv"),
        UV_CACHE_DIR: path.join(caminhos.userData(), "uv-cache"),
      },
    });
    let ultima = "";
    const log = (bytes: Buffer) => {
      ultima = bytes.toString("utf8");
      emitir("estoque:log", { texto: ultima });
    };
    p.stdout.on("data", log);
    p.stderr.on("data", log);
    p.on("error", rejeitar);
    p.on("close", (code) =>
      code === 0
        ? resolver()
        : rejeitar(new Error(ultima || "Falha na instalação do motor.")),
    );
  });
}

/** Procura um executável no PATH (o `which` do Unix, à mão). */
function naPath(nome: string): string | null {
  const exts =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
      : [""];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const e of exts) {
      const alvo = path.join(dir, nome + e.toLowerCase());
      try {
        if (fs.existsSync(alvo)) return alvo;
      } catch {
        /* diretório inacessível */
      }
    }
  }
  return null;
}

function garantirProcesso(emitir: Emitir) {
  if (processo && processo.exitCode === null && !processo.killed)
    return processo;
  const python = pythonMotor();
  const pasta = pastaMotor();
  if (!python || !pasta) {
    throw new Error(
      "O motor opcional não está instalado. O estoque, o balanço e os criativos funcionam sem ele " +
        "(veja docs/05-motor-python.md).",
    );
  }
  processo = spawn(python, ["-u", path.join(pasta, "main.py")], {
    cwd: pasta,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      SOUL_DATA_DIR: caminhos.userData(),
      U2NET_HOME: path.join(caminhos.userData(), "modelos", "rembg"),
      HF_HOME: path.join(caminhos.userData(), "modelos", "huggingface"),
    },
  });
  const ativo = processo;
  ativo.stderr.on("data", () => {
    /* stdout é reservado ao protocolo JSON. */
  });
  ativo.on("error", (erro) => falharMotor(erro.message));
  ativo.on("exit", () => {
    if (processo === ativo) {
      processo = null;
      falharMotor("O motor foi encerrado. Tente novamente.");
    }
  });

  let buffer = "";
  ativo.stdout.setEncoding("utf8");
  ativo.stdout.on("data", (pedaco: string) => {
    buffer += pedaco;
    let corte: number;
    while ((corte = buffer.indexOf("\n")) >= 0) {
      const linha = buffer.slice(0, corte).trim();
      buffer = buffer.slice(corte + 1);
      if (!linha) continue;
      try {
        const resposta = JSON.parse(linha) as Record<string, unknown>;
        if ("progress" in resposta) {
          emitir("engine:progresso", resposta.progress);
          continue;
        }
        pendente?.(resposta);
      } catch {
        /* linha que não é JSON: o motor imprimiu algo solto */
      }
    }
  });
  return ativo;
}

let pendente: ((resposta: Record<string, unknown>) => void) | null = null;
let rejeitarPendente: ((erro: Error) => void) | null = null;
function falharMotor(mensagem: string) {
  rejeitarPendente?.(new Error(mensagem));
  rejeitarPendente = null;
  pendente = null;
}

/** Chama um método do motor. As chamadas entram numa fila: o motor é um só. */
export function chamarMotor<T = unknown>(
  metodo: string,
  params: unknown,
  emitir: Emitir,
): Promise<T> {
  const proxima = fila.then(
    () =>
      new Promise<T>((resolver, rejeitar) => {
        const p = garantirProcesso(emitir);
        rejeitarPendente = (erro) => {
          clearTimeout(tempo);
          rejeitar(erro);
        };
        const tempo = setTimeout(() => {
          pendente = null;
          rejeitarPendente = null;
          p.kill();
          rejeitar(
            new Error(`O motor não respondeu a "${metodo}" em 15 minutos.`),
          );
        }, 15 * 60_000);

        pendente = (resposta) => {
          clearTimeout(tempo);
          pendente = null;
          rejeitarPendente = null;
          if ("error" in resposta) rejeitar(new Error(String(resposta.error)));
          else resolver(resposta.result as T);
        };
        p.stdin.write(
          JSON.stringify({ method: metodo, params: params ?? {} }) + "\n",
        );
      }),
  );
  // A fila nunca "quebra": um erro numa chamada não trava as seguintes.
  fila = proxima.catch(() => undefined);
  return proxima;
}

export function reiniciarMotor() {
  falharMotor("O motor foi reiniciado.");
  processo?.kill();
  processo = null;
  pendente = null;
}

/**
 * Render do vídeo: processo separado, com log ao vivo.
 *
 * É um trabalho de minutos (transcrição + ffmpeg), então sai do canal de
 * requisição/resposta e manda cada linha para a interface pelo evento
 * `video:log`.
 */
export function gerarVideo(
  args: {
    pasta: string;
    veiculo: string;
    motor: string;
    preco: string;
    python?: string | null;
  },
  emitir: Emitir,
): Promise<{ caminho: string; segundos: number }> {
  const pasta = pastaMotor();
  const python = args.python || pythonMotor();
  if (!python || !pasta)
    throw new Error(
      "Instale o motor opcional de vídeo (docs/05-motor-python.md).",
    );

  const inicio = Date.now();
  const p = spawn(
    python,
    [
      "-u",
      path.join(pasta, "video", "render.py"),
      args.pasta,
      args.veiculo,
      args.motor,
      args.preco,
    ],
    {
      cwd: pasta,
      windowsHide: true,
    },
  );

  return new Promise((resolver, rejeitar) => {
    let ultima = "";
    const ler = (pedaco: Buffer) => {
      for (const linha of pedaco.toString("utf8").split(/\r?\n/)) {
        if (!linha.trim()) continue;
        ultima = linha.trim();
        emitir("video:log", ultima);
      }
    };
    p.stdout.on("data", ler);
    p.stderr.on("data", ler);
    p.on("error", rejeitar);
    p.on("close", (codigo) => {
      if (codigo) return rejeitar(new Error(ultima || "Falha ao gerar vídeo."));
      resolver({
        caminho: ultima.split(": ").at(-1)?.trim() ?? "",
        segundos: Math.round((Date.now() - inicio) / 1000),
      });
    });
  });
}
