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
/** Quantos downloads chegaram ao servidor (para provar que dois pedidos viram um). */
let pedidos = 0;

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    pedidos++;
    if (req.url === "/parado") {
      // Manda um pedaço e para de responder, sem fechar a conexão.
      res.writeHead(200, { "content-length": conteudo.length });
      res.write(conteudo.subarray(0, 100));
      return;
    }
    res.writeHead(200, { "content-length": conteudo.length });
    res.end(conteudo);
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.closeAllConnections();
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
    expect(fs.readdirSync(pasta).filter((n) => n.endsWith(".part"))).toEqual(
      [],
    );
  });

  it("dois pedidos ao mesmo tempo compartilham um download (antes: ENOENT no rename)", async () => {
    const destino = path.join(pasta, "duplo.exe");
    const pacote = {
      url: `${base}/duplo.exe`,
      sha256: sha,
      size: conteudo.length,
    };
    const pedidosAntes = pedidos;
    const progressoA: number[] = [];
    const progressoB: number[] = [];
    const [a, b] = await Promise.all([
      baixarVerificado(pacote, destino, (f) => progressoA.push(f)),
      baixarVerificado(pacote, destino, (f) => progressoB.push(f)),
    ]);
    expect(a).toBe(destino);
    expect(b).toBe(destino);
    expect(pedidos).toBe(pedidosAntes + 1);
    expect(fs.readFileSync(destino).equals(conteudo)).toBe(true);
    expect(progressoA.at(-1)).toBe(1);
    expect(progressoB.at(-1)).toBe(1);
    expect(fs.readdirSync(pasta).filter((n) => n.endsWith(".part"))).toEqual(
      [],
    );
  });

  it("desiste de uma conexão parada em vez de travar", async () => {
    const destino = path.join(pasta, "parado.zip");
    await expect(
      baixarVerificado(
        { url: `${base}/parado`, sha256: sha, size: conteudo.length },
        destino,
        () => {},
        undefined,
        { inatividadeMs: 300 },
      ),
    ).rejects.toThrow(/parou de receber dados/);
    expect(fs.existsSync(destino)).toBe(false);
    expect(
      fs.readdirSync(pasta).filter((n) => n.startsWith("parado.zip.")),
    ).toEqual([]);
  });

  it("corta cedo se o servidor manda mais bytes que o manifesto declara", async () => {
    const destino = path.join(pasta, "excesso.zip");
    await expect(
      baixarVerificado(
        { url: `${base}/excesso.zip`, sha256: sha, size: 1000 },
        destino,
        () => {},
      ),
    ).rejects.toThrow(/mais dados do que o manifesto/);
    expect(fs.existsSync(destino)).toBe(false);
    expect(
      fs.readdirSync(pasta).filter((n) => n.startsWith("excesso.zip.")),
    ).toEqual([]);
  });

  it("apaga .part antigo de tentativas que morreram, mas não o recente", async () => {
    const destino = path.join(pasta, "orfao.zip");
    const antigo = `${destino}.1-1.part`;
    const recente = `${destino}.2-2.part`;
    fs.writeFileSync(antigo, "resto");
    fs.writeFileSync(recente, "em uso");
    const duasHoras = new Date(Date.now() - 2 * 60 * 60_000);
    fs.utimesSync(antigo, duasHoras, duasHoras);
    await baixarVerificado(
      { url: `${base}/orfao.zip`, sha256: sha, size: conteudo.length },
      destino,
      () => {},
    );
    expect(fs.existsSync(antigo)).toBe(false);
    expect(fs.existsSync(recente)).toBe(true);
  });
});
