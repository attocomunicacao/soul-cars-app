/** Vitrine do estoque atual (acesso a disco e banco): a junção dos dados está em `vitrine-dados.ts`. */
import { nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import * as caminhos from "../caminhos";
import { banco } from "../studio/banco";
import * as repo from "../studio/repositorio";
import { listarEstoque } from "../studio/arquivos";
import { dadosBndv } from "./balanco";
import {
  montarVitrine,
  type CartaoVitrine,
  type FichaMin,
} from "./vitrine-dados";

export type { CartaoVitrine };

const cache = new Map<string, string | null>();

/** Lê a foto, reduz para 520 px de largura e devolve como JPEG em data URL (com cache por arquivo e data). */
function reduzirFoto(arquivo: string): string | null {
  try {
    const chave = `${arquivo}|${fs.statSync(arquivo).mtimeMs}`;
    if (cache.has(chave)) return cache.get(chave)!;
    const imagem = nativeImage.createFromPath(arquivo);
    let url: string | null = null;
    if (!imagem.isEmpty()) {
      const { width } = imagem.getSize();
      const pronta = width > 520 ? imagem.resize({ width: 520 }) : imagem;
      url = "data:image/jpeg;base64," + pronta.toJPEG(80).toString("base64");
    }
    cache.set(chave, url);
    return url;
  } catch {
    return null;
  }
}

export function vitrine(): CartaoVitrine[] {
  const dados = dadosBndv();
  if (!dados) return [];
  const pastas = listarEstoque(caminhos.ESTOQUE()).map((p) => ({
    nome: p.nome,
    caminho: p.caminho,
    fotos: p.fotos.map((f) =>
      path.isAbsolute(f) ? f : path.join(p.caminho, f),
    ),
  }));
  const fichas = repo.listarVeiculos(banco()) as unknown as FichaMin[];
  return montarVitrine(dados.linhas, pastas, fichas, reduzirFoto, new Date());
}
