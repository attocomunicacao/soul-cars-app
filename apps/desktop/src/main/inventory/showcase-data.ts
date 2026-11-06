/**
 * Vitrine do estoque atual: um cartão por veículo em estoque, no estilo da lista do BNDV.
 *
 * Parte pura (sem Electron, testável). Junta três fontes, cada uma com o que ela sabe:
 *  - BNDV (CSVs): marca, modelo, placa, preço de tabela, entrada, consignação;
 *  - Studio (banco): versão, ano, quilometragem, cor, câmbio e combustível, quando a ficha foi preenchida;
 *  - pasta do veículo: a imagem 2 do painel de fotos do Studio (a mesma que vai para os criativos), reduzida para a tela.
 * O que nenhuma fonte tem aparece como "—" na interface (nunca inventado).
 */
import type { CartaoVitrine } from "../../shared/showcase";
import type { LinhaVeiculo } from "./balance";

export type { CartaoVitrine };

export type PastaMin = { nome: string; caminho: string; fotos: string[] };
export type FichaMin = {
  id: number;
  placa: string | null;
  pasta: string | null;
  versao: string | null;
  ano: string | number | null;
  km: number | string | null;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
};

const idDaPasta = (nome: string) => /^(\d+)_/.exec(nome)?.[1] ?? null;
const texto = (v: unknown) => {
  const t = v == null ? "" : String(v).trim();
  return t || null;
};
const numero = (v: unknown) => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : n;
};

/** Dias entre a entrada (AAAA-MM-DD) e hoje; null se a data não for válida. */
export function diasDesde(entrada: string, hoje = new Date()): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(entrada);
  if (!d) return null;
  const dia = Date.UTC(+d[1], +d[2] - 1, +d[3]);
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((agora - dia) / 86_400_000));
}

/**
 * Qual foto mostrar: a **imagem 2** do painel de fotos do Studio (a segunda na ordem natural, ignorando
 * os recortes `_sem_fundo`). Se só houver uma, ela; se a 2 não abrir (ex.: HEIC), as seguintes e por fim a 1.
 */
export function ordemDeFotos(fotos: string[]): string[] {
  const reais = fotos.filter((f) => !/_sem_fundo\.[a-z]+$/i.test(f));
  if (reais.length < 2) return reais;
  return [reais[1], ...reais.slice(2), reais[0]];
}

/** Parte pura: só junta os dados. `reduzir` devolve a foto pronta para a tela. */
export function montarVitrine(
  linhas: LinhaVeiculo[],
  pastas: PastaMin[],
  fichas: FichaMin[],
  reduzir: (arquivo: string) => string | null,
  hoje = new Date(),
): CartaoVitrine[] {
  return linhas
    .filter((l) => !l.vendido)
    .map((l) => {
      const pasta =
        pastas.find((p) => idDaPasta(p.nome) === l.id) ??
        pastas.find((p) => l.placa && p.nome.toUpperCase().includes(l.placa)) ??
        null;
      const ficha =
        fichas.find((f) => pasta && f.pasta === pasta.caminho) ??
        fichas.find(
          (f) => l.placa && (f.placa ?? "").trim().toUpperCase() === l.placa,
        ) ??
        null;
      let foto: string | null = null;
      for (const arquivo of ordemDeFotos(pasta?.fotos ?? [])) {
        foto = reduzir(arquivo);
        if (foto) break;
      }
      const anoBndv =
        l.anoFab && l.anoModelo && l.anoFab !== l.anoModelo
          ? `${l.anoFab}/${l.anoModelo}`
          : l.anoModelo || l.anoFab || null;
      return {
        idBndv: l.id,
        marca: l.marca,
        modelo: l.modelo,
        placa: l.placa,
        tabela: l.tabela,
        consignado: l.consignado,
        dias: diasDesde(l.entrada, hoje),
        entrada: l.entrada,
        pasta: pasta?.caminho ?? null,
        foto,
        detalhes: {
          km: numero(ficha?.km) ?? numero(l.km),
          cor: texto(ficha?.cor) ?? texto(l.cor),
          cambio: texto(ficha?.cambio) ?? texto(l.cambio),
          combustivel: texto(ficha?.combustivel) ?? texto(l.combustivel),
          ano: texto(ficha?.ano) ?? anoBndv,
          versao: texto(ficha?.versao) ?? texto(l.versao),
        },
        estudio: ficha ? { id: ficha.id } : null,
      };
    })
    .sort((a, b) =>
      `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, "pt-BR"),
    );
}
