/**
 * Estado persistente do Launcher (`launcher-state.json` na pasta de dados do Launcher).
 *
 *  - instalados: para cada app, a versão ativa e as versões presentes no disco;
 *  - preferencias: fechar ao abrir um app, verificar ao iniciar;
 *  - catalogo: o último manifesto válido, para funcionar sem internet.
 *
 * A gravação é atômica (arquivo temporário + rename) para não corromper o estado
 * se o computador desligar no meio.
 */
import fs from "node:fs";
import path from "node:path";
import type { Preferencias } from "../shared/api";
import type { Manifest } from "../shared/manifest";
import { arquivoEstado } from "./config";

/** Versões de um app no disco. */
export type Instalacao = { ativa: string; versoes: string[] };

export type Estado = {
  instalados: Record<string, Instalacao>;
  preferencias: Preferencias;
  catalogo: Manifest | null;
  verificadoEm: string | null;
};

const PADRAO: Estado = {
  instalados: {},
  preferencias: { fecharAoAbrir: true, verificarAoIniciar: true },
  catalogo: null,
  verificadoEm: null,
};

let cache: Estado | null = null;

/** Lê o estado (com valores padrão para o que faltar ou estiver estragado). */
export function lerEstado(): Estado {
  if (cache) return cache;
  try {
    const lido = JSON.parse(
      fs.readFileSync(arquivoEstado(), "utf8"),
    ) as Partial<Estado>;
    cache = {
      ...PADRAO,
      ...lido,
      preferencias: { ...PADRAO.preferencias, ...lido.preferencias },
      instalados: lido.instalados ?? {},
    };
  } catch {
    cache = structuredClone(PADRAO);
  }
  return cache;
}

/** Aplica uma mudança e grava o estado de forma atômica. */
export function gravarEstado(mudar: (e: Estado) => void): Estado {
  const estado = lerEstado();
  mudar(estado);
  const destino = arquivoEstado();
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const temporario = `${destino}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(estado, null, 2), "utf8");
  fs.renameSync(temporario, destino);
  return estado;
}
