import { invoke } from "./desktop";
import { statusProducao } from "./producao";

export type Slot = "main" | "left" | "center" | "right" | "original";
export type FotoSalva = { slot: Slot; mime: string; nome: string };

const enc = encodeURIComponent;

export async function salvarFoto(veiculo: number, slot: Slot, file: File) {
  await invoke("foto_salvar", new Uint8Array(await file.arrayBuffer()), {
    headers: {
      "x-veiculo": String(veiculo),
      "x-slot": slot,
      "x-mime": file.type,
      "x-nome": enc(file.name || "imagem colada"),
    },
  });
}

/** Fotos salvas do veículo, prontas para o editor (File preserva nome e tipo). */
export async function carregarFotos(
  veiculo: number,
  slots?: readonly Slot[],
): Promise<{ slot: Slot; file: File }[]> {
  const lista = await invoke<FotoSalva[]>("fotos_listar", { veiculo });
  return Promise.all(
    lista
      .filter((f) => !slots || slots.includes(f.slot))
      .map(async (f) => {
        const bytes = await invoke<ArrayBuffer>("foto_ler", {
          veiculo,
          slot: f.slot,
        });
        return {
          slot: f.slot,
          file: new File([bytes], f.nome, { type: f.mime }),
        };
      }),
  );
}

/** Importa as fotos numeradas na pasta do estoque: 1 (principal), 6 (traseira), 7 (interna). */
export const importarFotosPadrao = (veiculo: number, pasta: string) =>
  invoke<number>("fotos_importar_padrao", { veiculo, pasta });

export const contarFotos = async (veiculo: number) =>
  (await invoke<FotoSalva[]>("fotos_listar", { veiculo })).length;

export const FOTOS_VITRINE = [1, 2, 4] as const;
export type NumeroVitrine = (typeof FOTOS_VITRINE)[number];

/** As três peças usam recortes independentes da pasta, sem trocar a principal. */
export async function localizarFotosVitrine(pasta: string) {
  const status = await statusProducao(pasta);
  const pastaFotos =
    status.principal?.replace(/[\\/][^\\/]+$/, "") ?? `${pasta}\\FOTOS`;
  return {
    pastaFotos,
    fotos: FOTOS_VITRINE.map((numero) => {
      const original = status.fotos.find((nome) =>
        new RegExp(`^${numero}\\.(jpeg|jpg|webp|png)$`, "i").test(nome),
      );
      const recorte = status.fotos.find(
        (nome) => nome.toLowerCase() === `${numero}_sem_fundo.png`,
      );
      return {
        numero,
        origem: original ? `${pastaFotos}\\${original}` : null,
        recorte: recorte ? `${pastaFotos}\\${recorte}` : null,
      };
    }),
  };
}

export async function carregarFotosVitrine(
  pasta: string,
): Promise<{ numero: NumeroVitrine; file: File; original?: File }[]> {
  const { fotos } = await localizarFotosVitrine(pasta);
  return Promise.all(
    fotos
      .filter((foto) => foto.recorte)
      .map(async (foto) => {
        const bytes = await invoke<ArrayBuffer>("estoque_ler", {
          raiz: pasta,
          caminho: foto.recorte,
        });
        let original: File | undefined;
        if (foto.origem) {
          const origem = await invoke<ArrayBuffer>("estoque_ler", {
            raiz: pasta,
            caminho: foto.origem,
          });
          const nome = foto.origem.split(/[\\/]/).pop()!;
          const mime = /\.png$/i.test(nome)
            ? "image/png"
            : /\.webp$/i.test(nome)
              ? "image/webp"
              : "image/jpeg";
          original = new File([origem], nome, { type: mime });
        }
        return {
          numero: foto.numero,
          file: new File([bytes], `${foto.numero}_sem_fundo.png`, {
            type: "image/png",
          }),
          original,
        };
      }),
  );
}

export const apagarArquivosVeiculo = (veiculo: number) =>
  invoke("veiculo_apagar_arquivos", { veiculo });

/** destino: pasta do veículo no estoque (grava em <destino>\CRIATIVO); sem ela, Imagens\SOUL Cars\<pasta>. */
export async function salvarCriativo(
  pasta: string,
  nome: string,
  blob: Blob,
  destino?: string | null,
): Promise<string> {
  return invoke<string>(
    "criativo_salvar",
    new Uint8Array(await blob.arrayBuffer()),
    {
      headers: {
        "x-pasta": enc(pasta),
        "x-nome": enc(nome),
        "x-destino": enc(destino ?? ""),
      },
    },
  );
}
