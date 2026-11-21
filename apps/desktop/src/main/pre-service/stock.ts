/**
 * Estoque que a IA enxerga: veículos disponíveis e as fotos de cada pasta.
 *
 * Lê o CSV do BNDV (`dados/bndv_veiculos.csv`), cruza com o DES.md e com as fotos em
 * `ESTOQUE/<id>_…/FOTOS`. Só é "disponível" quem está em estoque no BNDV e tem fotos na pasta.
 */
import fs from "node:fs";
import path from "node:path";
import { nativeImage } from "electron";
import * as caminhos from "../core/paths";
import { ehAtivo, lerCsv } from "../inventory/folder-sync";
import { arquivoNaRaiz, pastaFotos } from "../studio/files";
import {
  fotosNumeradas,
  normalizar,
  type VeiculoIa,
} from "../../shared/pre-service";
import { lerKmEValor } from "../../shared/des-md";

// ------------------------------------------------------------ estoque e fotos
/** Veículos disponíveis: status "DISPONÍVEL ESTOQUE", ativos no último download do BNDV e com fotos na pasta. */
export function veiculosDisponiveis(): VeiculoIa[] {
  let linhas: Record<string, string>[];
  try {
    linhas = lerCsv(caminhos.CSV_VEICULOS());
  } catch {
    return [];
  }
  return (
    linhas
      .filter(
        (v) =>
          ehAtivo(v) &&
          normalizar(v.status).trim().startsWith("disponivel estoque"),
      )
      .map((v) => {
        const n = Number(
          String(v.salePrice ?? v.price ?? "").replace(",", "."),
        );
        const id = String(v.idVehicle ?? "");
        const des = desMdDo(id);
        return {
          id,
          marca: String(v.brand ?? "").trim(),
          modelo: String(v.model ?? "").trim(),
          placa: String(v.plate ?? "").toUpperCase(),
          // O valor do DES.md (o anunciado) vale mais que o do BNDV, que muitas vezes vem zerado.
          preco:
            des.valor ||
            (Number.isFinite(n) && n > 0
              ? Math.round(n).toLocaleString("pt-BR")
              : ""),
          km: des.km || String(v.km ?? "").trim(),
        };
      })
      // Regra da loja: só fica disponível (catálogo e IA) quem está em estoque no BNDV E tem fotos na pasta.
      .filter((v) => v.id && fotosDo(v.id).length > 0)
  );
}

/** Quilometragem e valor do DES.md da pasta do veículo ("" quando não há DES.md ou o campo). */
function desMdDo(id: string): { km: string; valor: string } {
  try {
    const pasta = pastaDoVeiculo(id);
    const arq = pasta && arquivoNaRaiz(pasta, "DES.md");
    return arq
      ? lerKmEValor(fs.readFileSync(arq, "utf8"))
      : { km: "", valor: "" };
  } catch {
    return { km: "", valor: "" };
  }
}

function pastaDoVeiculo(id: string): string | null {
  const raiz = caminhos.ESTOQUE();
  if (!fs.existsSync(raiz)) return null;
  const nome = fs.readdirSync(raiz).find((d) => d.split("_")[0] === id);
  return nome ? path.join(raiz, nome) : null;
}
/** Fotos numeradas de `ESTOQUE/<id>_…/FOTOS` (ou FOTO, Imagens…), em ordem (caminhos completos). */
export function fotosDo(id: string): string[] {
  const p = pastaDoVeiculo(id);
  const dir = p && pastaFotos(p);
  if (!dir || !fs.existsSync(dir)) return [];
  return fotosNumeradas(fs.readdirSync(dir)).map((f) => path.join(dir, f));
}
export const miniatura = (arquivo: string) => {
  const img = nativeImage.createFromPath(arquivo);
  return img.isEmpty() ? "" : img.resize({ width: 240 }).toDataURL();
};
