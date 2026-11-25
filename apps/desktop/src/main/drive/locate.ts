/**
 * Procura, no computador, a pasta ESTOQUE sincronizada pelo Google Drive para Desktop.
 *
 * O usuário só informa o link; aqui o ID da pasta vira um caminho do Windows. Para pastas
 * compartilhadas adicionadas ao "Meu Drive", o Drive para Desktop cria
 * `<unidade>:\.shortcut-targets-by-id\<ID>\<nome da pasta>`. Sem `electron`: o acesso ao disco
 * é injetado, para testar sem Drive instalado.
 */
import path from "node:path";

/** Operações de disco usadas na busca (injetadas nos testes). */
export type DiscoDrive = {
  /** Letras de unidade existentes (ex.: ["C", "G"]). */
  unidades: () => string[];
  /** Nomes das subpastas de `pasta` (vazio se não existir ou não for legível). */
  subpastas: (pasta: string) => string[];
  /** Pasta do usuário (para `%USERPROFILE%\Meu Drive`). */
  home: () => string;
};

export type ResultadoBusca =
  | { situacao: "encontrada"; caminho: string }
  | { situacao: "ambigua"; candidatos: string[] }
  | { situacao: "drive-nao-encontrado" }
  | { situacao: "pasta-nao-adicionada" };

const NOMES_MEU_DRIVE = ["Meu Drive", "My Drive"];

/** Raízes onde o Drive para Desktop costuma montar o "Meu Drive". */
function raizesMeuDrive(disco: DiscoDrive): string[] {
  const raizes: string[] = [];
  for (const letra of disco.unidades()) {
    const unidade = `${letra}:\\`;
    for (const nome of NOMES_MEU_DRIVE)
      if (disco.subpastas(unidade).includes(nome))
        raizes.push(path.win32.join(unidade, nome));
  }
  for (const nome of NOMES_MEU_DRIVE) {
    const dentroDoHome = path.win32.join(disco.home(), nome);
    if (disco.subpastas(disco.home()).includes(nome)) raizes.push(dentroDoHome);
  }
  return raizes;
}

/** Acha a pasta do link (pelo ID) entre os atalhos do Drive para Desktop. */
export function localizarPastaDrive(
  idPasta: string,
  disco: DiscoDrive,
): ResultadoBusca {
  const meusDrives = raizesMeuDrive(disco);
  const unidadesDrive = disco
    .unidades()
    .map((l) => `${l}:\\`)
    .filter((u) => disco.subpastas(u).includes(".shortcut-targets-by-id"));

  if (!meusDrives.length && !unidadesDrive.length)
    return { situacao: "drive-nao-encontrado" };

  const candidatos: string[] = [];
  for (const unidade of unidadesDrive) {
    const atalho = path.win32.join(unidade, ".shortcut-targets-by-id", idPasta);
    const filhas = disco.subpastas(atalho);
    // O atalho guarda uma pasta com o nome real (ex.: ESTOQUE); se houver só uma, é ela.
    for (const nome of filhas) candidatos.push(path.win32.join(atalho, nome));
  }
  if (candidatos.length === 1)
    return { situacao: "encontrada", caminho: candidatos[0]! };
  if (candidatos.length > 1) {
    const estoque = candidatos.filter(
      (c) => path.win32.basename(c).toUpperCase() === "ESTOQUE",
    );
    if (estoque.length === 1)
      return { situacao: "encontrada", caminho: estoque[0]! };
    return { situacao: "ambigua", candidatos };
  }
  // Mesma conta do dono da pasta: ela já está no "Meu Drive", sem atalho. Aqui só o nome identifica.
  const proprias = meusDrives
    .map((raiz) => path.win32.join(raiz, "ESTOQUE"))
    .filter((p) => disco.subpastas(path.win32.dirname(p)).includes("ESTOQUE"));
  if (proprias.length === 1)
    return { situacao: "encontrada", caminho: proprias[0]! };
  if (proprias.length > 1) return { situacao: "ambigua", candidatos: proprias };
  return { situacao: "pasta-nao-adicionada" };
}
