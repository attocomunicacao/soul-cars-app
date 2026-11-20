/**
 * Testes (Vitest) de src/main/update-command.ts: o comando que inicia o instalador do Launcher
 * tem de funcionar com `%`, `&` e `^` no caminho. No Windows roda o `cmd` de verdade com um
 * "instalador" falso (um .cmd) e confere se ele recebeu os argumentos.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  comandoDeAtualizacao,
  VARIAVEL_INSTALADOR,
} from "../src/main/update-command";

describe("comandoDeAtualizacao", () => {
  it("não coloca o caminho na linha de comando: ele vai por variável de ambiente", () => {
    const c = comandoDeAtualizacao("C:\\Users\\a&b%c^d\\setup.exe", {});
    expect(c.args.join(" ")).not.toContain("a&b");
    expect(c.env[VARIAVEL_INSTALADOR]).toBe("C:\\Users\\a&b%c^d\\setup.exe");
    expect(c.args).toContain("/v:on");
  });

  it("recusa caminho com ! ou aspas, que a expansão atrasada não suporta", () => {
    expect(() => comandoDeAtualizacao("C:\\a!b\\setup.exe")).toThrow(
      /atualização automática/,
    );
    expect(() => comandoDeAtualizacao('C:\\a"b\\setup.exe')).toThrow();
  });

  it.skipIf(process.platform !== "win32")(
    "inicia o instalador mesmo com % & ^ no caminho",
    async () => {
      const base = fs.mkdtempSync(path.join(os.tmpdir(), "soul-upd-"));
      const dir = path.join(base, "u&s%TEMP%^r (x)");
      fs.mkdirSync(dir);
      // "Instalador" falso: uma cópia do node.exe. O script de pré-carga (NODE_OPTIONS) grava os
      // argumentos que ele recebeu. É um .exe de verdade, como o NSIS, iniciado pelo `start`.
      const instalador = path.join(dir, "setup.exe");
      fs.copyFileSync(process.execPath, instalador);
      const saida = path.join(base, "recebido.json");
      const pre = path.join(base, "pre.cjs");
      fs.writeFileSync(
        pre,
        `require("fs").writeFileSync(${JSON.stringify(saida)}, JSON.stringify(process.argv.slice(1)));`,
      );

      const { comando, args, env } = comandoDeAtualizacao(instalador);
      spawn(comando, args, {
        stdio: "ignore",
        windowsHide: true,
        windowsVerbatimArguments: true,
        env: {
          ...env,
          NODE_OPTIONS: `--require=${pre.split(path.sep).join("/")}`,
        },
      });

      const limite = Date.now() + 20_000;
      while (!fs.existsSync(saida) && Date.now() < limite)
        await new Promise((r) => setTimeout(r, 200));
      expect(fs.existsSync(saida)).toBe(true);
      // O node lê "/S" como o nome do script (vira C:\S); o resto chega como foi enviado.
      const recebido = JSON.parse(fs.readFileSync(saida, "utf8")) as string[];
      expect(path.basename(recebido[0])).toBe("S");
      expect(recebido.slice(1)).toEqual(["--updated", "--force-run"]);
      // O "instalador" falso ainda pode estar encerrando: a limpeza não deve reprovar o teste.
      try {
        fs.rmSync(base, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 300,
        });
      } catch {
        /* a pasta temporária fica para o sistema limpar */
      }
    },
    30_000,
  );
});
