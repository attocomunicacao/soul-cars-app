/**
 * Testes (Vitest) de src/main/download.ts com um servidor HTTP local: progresso,
 * SHA-256 conferido e arquivo adulterado recusado (nada fica no disco).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { baixarVerificado } from "../src/main/download";

const conteudo = Buffer.from("pacote de teste do Soul Cars ".repeat(2000));
const sha = createHash("sha256").update(conteudo).digest("hex");
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-download-"));
let servidor: http.Server;
let base = "";

beforeAll(async () => {
  servidor = http.createServer((_req, res) => {
    res.writeHead(200, { "content-length": conteudo.length });
    res.end(conteudo);
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
  fs.rmSync(pasta, { recursive: true, force: true });
});

describe("baixarVerificado", () => {
  it("baixa, avisa o progresso e confere o SHA-256", async () => {
    const fracoes: number[] = [];
    const destino = path.join(pasta, "ok.zip");
    await baixarVerificado(
      { url: `${base}/ok.zip`, sha256: sha, size: conteudo.length },
      destino,
      (f) => fracoes.push(f),
    );
    expect(fs.readFileSync(destino).equals(conteudo)).toBe(true);
    expect(fracoes.at(-1)).toBe(1);
  });

  it("recusa conteúdo que não confere e apaga o arquivo parcial", async () => {
    const destino = path.join(pasta, "ruim.zip");
    await expect(
      baixarVerificado(
        {
          url: `${base}/ruim.zip`,
          sha256: "0".repeat(64),
          size: conteudo.length,
        },
        destino,
        () => {},
      ),
    ).rejects.toThrow(/SHA-256/);
    expect(fs.existsSync(destino)).toBe(false);
    expect(fs.existsSync(`${destino}.part`)).toBe(false);
  });
});
