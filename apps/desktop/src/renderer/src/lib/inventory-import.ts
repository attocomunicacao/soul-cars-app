/**
 * Importa os veículos das pastas do ESTOQUE para o banco do Studio e devolve a lista
 * usada na página Estoque.
 */
import { invoke } from "./desktop-bridge";
import {
  atualizarVeiculo,
  criarVeiculo,
  listarVeiculos,
  obterConfig,
  salvarConfig,
  type Editavel,
  type Veiculo,
} from "./database";
import {
  lerDesExistente,
  lerInfoBndv,
  lerNomePasta,
  idEstoque,
  type PastaVeiculo,
} from "./inventory-parse";
let emAndamento: Promise<Veiculo[]> | null = null;
// Compartilha a origem do Electron; nenhum caminho pessoal fica no código.
export function importarEstoque() {
  return (emAndamento ??= executarImportacao().finally(() => {
    emAndamento = null;
  }));
}
async function executarImportacao() {
  const { estoque } = await invoke<{ estoque: string }>("caminhos_app");
  const pastas = await invoke<PastaVeiculo[]>("estoque_listar", {
    raiz: estoque,
  });
  const existentes = await listarVeiculos();
  for (const pasta of pastas) {
    const externo = idEstoque(pasta.nome);
    const existente =
      existentes.find((v) => v.pasta === pasta.caminho) ??
      existentes.find((v) => externo !== null && v.estoque_id === externo);
    if (
      existente &&
      (await obterConfig(`estoque_leitura:${pasta.caminho}`)) ===
        String(pasta.modificado)
    )
      continue;
    const { modelo, placa } = lerNomePasta(pasta.nome);
    const patch: Partial<Pick<Veiculo, Editavel>> = {
      nome: modelo,
      placa,
      pasta: pasta.caminho,
    };
    for (const arquivo of [pasta.info_md, pasta.des_md]) {
      if (!arquivo) continue;
      const texto = new TextDecoder().decode(
        await invoke<ArrayBuffer>("estoque_ler", {
          raiz: estoque,
          caminho: arquivo,
        }),
      );
      Object.assign(
        patch,
        arquivo === pasta.info_md ? lerInfoBndv(texto) : lerDesExistente(texto),
      );
      if (arquivo === pasta.des_md) patch.des_md = texto;
    }
    const id =
      existente?.id ??
      (await criarVeiculo({ nome: patch.nome || modelo, placa }));
    // Preserva progresso e ajustes do Studio ao reler a ficha do BNDV.
    await atualizarVeiculo(id, patch);
    await salvarConfig(
      `estoque_leitura:${pasta.caminho}`,
      String(pasta.modificado),
    );
  }
  const presentes = new Set(pastas.map((p) => p.caminho));
  return (await listarVeiculos()).filter(
    (v) => !v.pasta || presentes.has(v.pasta),
  );
}
