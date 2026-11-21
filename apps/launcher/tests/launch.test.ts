/**
 * Testes (Vitest) de src/main/launch.ts e src/shared/launch-errors.ts com processos reais
 * (o próprio Node faz o papel do app): abrir com sucesso, fechar logo, executável ausente
 * e bloqueio confirmado pelo Windows (Smart App Control).
 */
import { describe, expect, it } from "vitest";
import { abrirExecutavel, ErroAoAbrir } from "../src/main/launch";
import {
  MARCA_SMART_APP_CONTROL,
  mensagemDeFalha,
  pareceBloqueio,
} from "../src/shared/launch-errors";

const NODE = process.execPath;
const semBloqueio = async () => false;
const comBloqueio = async () => true;

describe("abrirExecutavel", () => {
  it("resolve quando o app passa dos primeiros instantes rodando", async () => {
    await expect(
      abrirExecutavel(NODE, {
        nomeApp: "Teste",
        args: ["-e", "setTimeout(() => {}, 1500)"],
        observarMs: 400,
        verificarBloqueio: semBloqueio,
      }),
    ).resolves.toBeUndefined();
  });

  it("fechar com código 0 logo de cara não é erro (app já estava aberto)", async () => {
    await expect(
      abrirExecutavel(NODE, {
        nomeApp: "Teste",
        args: ["-e", "process.exit(0)"],
        observarMs: 3000,
        verificarBloqueio: semBloqueio,
      }),
    ).resolves.toBeUndefined();
  });

  it("app que fecha logo com erro vira mensagem clara", async () => {
    const erro = await abrirExecutavel(NODE, {
      nomeApp: "Soul Cars",
      args: ["-e", "process.exit(3)"],
      observarMs: 3000,
      verificarBloqueio: semBloqueio,
    }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroAoAbrir);
    expect(erro.message).toMatch(/fechou logo ao abrir \(código 3\)/);
    expect(erro.message).not.toContain(MARCA_SMART_APP_CONTROL);
  });

  it("bloqueio confirmado pelo Windows vira a mensagem do Smart App Control", async () => {
    const erro = await abrirExecutavel(NODE, {
      nomeApp: "Soul Cars",
      args: ["-e", "process.exit(1)"],
      observarMs: 3000,
      verificarBloqueio: comBloqueio,
    }).catch((e) => e);
    expect(erro.bloqueadoPeloWindows).toBe(true);
    expect(erro.message).toContain("O Windows bloqueou o Soul Cars");
    expect(erro.message).toContain(MARCA_SMART_APP_CONTROL);
  });

  it("executável inexistente: pede para reinstalar, sem acusar o Windows", async () => {
    const erro = await abrirExecutavel("C:/nao/existe/SoulCars.exe", {
      nomeApp: "Soul Cars",
      verificarBloqueio: semBloqueio,
    }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroAoAbrir);
    expect(erro.message).toMatch(/não foi encontrado|Não foi possível abrir/);
    expect(erro.message).not.toContain(MARCA_SMART_APP_CONTROL);
  });
});

describe("mensagemDeFalha", () => {
  it("erro 4551 do Windows já indica bloqueio, mesmo sem consultar o registro", () => {
    const falha = {
      tipo: "nao-iniciou" as const,
      codigo: "UNKNOWN",
      errno: -4551,
      mensagem: "spawn UNKNOWN",
    };
    expect(pareceBloqueio(falha)).toBe(true);
    expect(mensagemDeFalha("Soul Cars", falha, false)).toContain(
      MARCA_SMART_APP_CONTROL,
    );
  });

  it("código genérico (UNKNOWN, EACCES) sozinho não acusa o Smart App Control", () => {
    for (const codigo of ["UNKNOWN", "EACCES"]) {
      const falha = {
        tipo: "nao-iniciou" as const,
        codigo,
        mensagem: `spawn ${codigo}`,
      };
      expect(pareceBloqueio(falha)).toBe(false);
      expect(mensagemDeFalha("Soul Cars", falha, false)).not.toContain(
        MARCA_SMART_APP_CONTROL,
      );
    }
  });
});
