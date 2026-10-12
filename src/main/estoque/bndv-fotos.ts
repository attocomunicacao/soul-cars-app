/**
 * Baixa a foto de capa de cada veículo ativo do BNDV para `dados/fotos-bndv/`.
 *
 * Serve de reserva para a vitrine do estoque atual quando a pasta do veículo ainda não tem fotos.
 * O arquivo se chama `<idBndv>-<hash da URL>.<ext>`: URL nova gera arquivo novo e o antigo é apagado,
 * URL igual não baixa de novo. Só aceita https, imagens e até 8 MB. O token do BNDV só vai junto
 * se a foto estiver no mesmo servidor da API.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const LIMITE_FOTO = 8 * 1024 * 1024;
const EXTENSOES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Registro = Record<string, unknown>;

export const nomeDaFoto = (id: string, url: string, ext: string) =>
  `${id}-${crypto.createHash("sha1").update(url).digest("hex").slice(0, 8)}.${ext}`;

/** Foto já baixada deste veículo (a mais recente), ou null. */
export function fotoBaixada(pasta: string, id: string): string | null {
  try {
    const achadas = fs
      .readdirSync(pasta)
      .filter((n) => n.startsWith(`${id}-`) && /\.(jpg|png|webp)$/i.test(n))
      .map((n) => path.join(pasta, n))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return achadas[0] ?? null;
  } catch {
    return null;
  }
}

export type OpcoesFotos = {
  pasta: string;
  urlDaApi: string;
  cabecalhos: Record<string, string>;
  log?: (texto: string, tom?: "normal" | "aviso" | "erro" | "ok") => void;
  buscar?: typeof fetch;
};

async function baixar(
  url: string,
  o: OpcoesFotos,
): Promise<{ dados: Buffer; ext: string } | null> {
  const buscar = o.buscar ?? fetch;
  const mesmoServidor = new URL(url).host === new URL(o.urlDaApi).host;
  for (const comToken of mesmoServidor ? [false, true] : [false]) {
    const r = await buscar(url, {
      headers: comToken ? o.cabecalhos : {},
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (r.status === 401 || r.status === 403) continue;
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext = EXTENSOES[tipo];
    if (!ext) return null;
    if (Number(r.headers.get("content-length") ?? 0) > LIMITE_FOTO) return null;
    const dados = Buffer.from(await r.arrayBuffer());
    return dados.length > 0 && dados.length <= LIMITE_FOTO
      ? { dados, ext }
      : null;
  }
  return null;
}

/** `itens`: veículos do BNDV; `urlDe` extrai a URL da foto de cada um. Nunca lança. */
export async function baixarFotosBndv(
  itens: Registro[],
  urlDe: (item: Registro) => string,
  o: OpcoesFotos,
): Promise<{ baixadas: number; falhas: number }> {
  let baixadas = 0;
  let falhas = 0;
  const fila = itens
    .filter((i) => i.active !== false && /^https:\/\//i.test(urlDe(i)))
    .map((i) => ({ id: String(i.idVehicle), url: urlDe(i) }));
  fs.mkdirSync(o.pasta, { recursive: true });

  const trabalhar = async () => {
    for (let item = fila.shift(); item; item = fila.shift()) {
      try {
        const existente = fotoBaixada(o.pasta, item.id);
        const prefixo = nomeDaFoto(item.id, item.url, "x").slice(0, -1);
        if (existente && path.basename(existente).startsWith(prefixo)) continue;
        const foto = await baixar(item.url, o);
        if (!foto) {
          falhas++;
          continue;
        }
        const destino = path.join(
          o.pasta,
          nomeDaFoto(item.id, item.url, foto.ext),
        );
        fs.writeFileSync(destino, foto.dados);
        if (existente && existente !== destino)
          fs.rmSync(existente, { force: true });
        baixadas++;
      } catch {
        falhas++;
      }
    }
  };
  await Promise.all([trabalhar(), trabalhar(), trabalhar(), trabalhar()]);
  if (falhas)
    o.log?.(`${falhas} foto(s) do BNDV não puderam ser baixadas.`, "aviso");
  return { baixadas, falhas };
}
