/**
 * Grava e aplica o sidecar `.soul-veiculo.json` da pasta de cada veículo (ver
 * `shared/vehicle-sidecar.ts`). É a ponte entre os computadores que dividem o ESTOQUE no Drive.
 *
 * O marcador `sidecar:<pasta>` na tabela `config` guarda o último sidecar gravado ou aplicado
 * aqui; só um sidecar mais novo que ele é aplicado. Não importa `electron`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { gravarAtomico } from "../core/atomic-write";
import {
  CAMPOS_SIDECAR,
  NOME_SIDECAR,
  lerSidecar,
  montarSidecar,
  sidecarEhNovo,
} from "../../shared/vehicle-sidecar";
import * as repo from "./repository";

type Veiculo = Record<string, unknown> & { pasta?: string | null };

const chaveMarcador = (pasta: string) => `sidecar:${pasta.toLowerCase()}`;

/** A pasta do veículo, só se ela existir no disco (Drive desconectado = sem gravar nada). */
function pastaExistente(veiculo: Veiculo | null): string | null {
  const pasta = veiculo?.pasta;
  if (typeof pasta !== "string" || !pasta) return null;
  return fs.existsSync(pasta) ? pasta : null;
}

/**
 * Grava o sidecar do veículo com os valores atuais do banco. Sem pasta no disco, não faz nada.
 * Devolve `true` se gravou.
 */
export function gravarSidecar(
  db: DatabaseSync,
  veiculoId: number,
  agora = new Date(),
): boolean {
  const veiculo = repo.obterVeiculo(db, veiculoId) as Veiculo | null;
  const pasta = pastaExistente(veiculo);
  if (!veiculo || !pasta) return false;
  const sidecar = montarSidecar(veiculo, os.hostname(), agora);
  gravarAtomico(
    path.join(pasta, NOME_SIDECAR),
    JSON.stringify(sidecar, null, 2),
  );
  repo.salvarConfig(db, chaveMarcador(pasta), sidecar.atualizadoEm);
  return true;
}

/**
 * Aplica ao banco o sidecar da pasta do veículo, se ele for mais novo que o último visto aqui.
 * Devolve `true` se algo foi aplicado. Sidecar ausente, ilegível ou antigo é ignorado.
 */
export function aplicarSidecar(db: DatabaseSync, veiculoId: number): boolean {
  const veiculo = repo.obterVeiculo(db, veiculoId) as Veiculo | null;
  const pasta = pastaExistente(veiculo);
  if (!pasta) return false;
  let texto: string;
  try {
    texto = fs.readFileSync(path.join(pasta, NOME_SIDECAR), "utf8");
  } catch {
    return false; // ainda não existe, ou o Drive não terminou de baixar
  }
  const sidecar = lerSidecar(texto);
  if (!sidecar) return false;
  const marcador = repo.obterConfig(db, chaveMarcador(pasta));
  if (!sidecarEhNovo(sidecar, marcador)) return false;
  const patch: Record<string, string | number | null> = {};
  for (const c of CAMPOS_SIDECAR)
    if (c in sidecar.campos) patch[c] = sidecar.campos[c] ?? null;
  repo.atualizarVeiculo(db, veiculoId, patch);
  repo.salvarConfig(db, chaveMarcador(pasta), sidecar.atualizadoEm);
  return true;
}
