/**
 * Onde cada coisa fica.
 *
 * Um lugar só para os caminhos, para nenhum módulo precisar adivinhar a
 * estrutura de pastas.
 *
 *   <raizDados>/            escolhida pelo usuário (Studio › Configurações)
 *   ├── ESTOQUE/            uma pasta por veículo (criada pelo Estoque)
 *   ├── dados/              CSVs do BNDV, balanco.json, RELATORIO.html
 *   └── .perfil-bndv/       sessão do navegador usada na extração
 *
 *   <userData>/             dados internos do app (AppData\Roaming\soul-cars-app)
 *   ├── config.json         preferências do app (inclusive a raizDados)
 *   ├── soul.db             banco do Studio
 *   ├── veiculos/<id>/fotos fotos do editor de criativos
 *   └── backups/            cópias diárias do banco
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export const URL_BNDV = "https://app.bndv.com.br/vehicles/search";
export const API_BNDV = "https://bndv-vehicle-api.azurewebsites.net/graphql";

/** Pastas internas do app: banco, fotos do editor, backups. */
export const userData = () => app.getPath("userData");
export const ARQUIVO_CONFIG = () => path.join(userData(), "config.json");
export const BANCO = () => path.join(userData(), "soul.db");
export const PASTA_VEICULOS = () => path.join(userData(), "veiculos");
export const PASTA_BACKUPS = () => path.join(userData(), "backups");

type Config = { raizDados?: string } & Record<string, unknown>;

let cache: Config | null = null;

export function lerConfig(): Config {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG(), "utf8")) as Config;
  } catch {
    cache = {};
  }
  return cache;
}

export function gravarConfig(patch: Config) {
  const atual = { ...lerConfig(), ...patch };
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(ARQUIVO_CONFIG(), JSON.stringify(atual, null, 2), "utf8");
  cache = atual;
  return atual;
}

/**
 * Raiz dos dados visíveis (ESTOQUE/ e dados/).
 *
 * Na primeira execução, se existir uma pasta de dados já usada (`dados-loja`
 * dentro do projeto, ou a do app Python antigo), ela é adotada — assim as
 * pastas e o balanço já criados continuam valendo.
 */
export function raizDados(): string {
  const salva = lerConfig().raizDados;
  if (salva) return salva;
  const base = app.getAppPath();
  const candidatos = [
    path.resolve(base, "dados-loja"),
    path.resolve(base, "..", "dados-loja"),
    path.resolve(base, "legado", "estoque-python"),
    path.resolve(base, "..", "soul-cars-estoque"),
  ];
  const herdada = candidatos.find((c) =>
    fs.existsSync(path.join(c, "ESTOQUE")),
  );
  const padrao = herdada ?? path.join(app.getPath("documents"), "SOUL Cars");
  gravarConfig({ raizDados: padrao });
  return padrao;
}

export const ESTOQUE = () => path.join(raizDados(), "ESTOQUE");
export const DADOS = () => path.join(raizDados(), "dados");
export const PERFIL_BNDV = () => path.join(raizDados(), ".perfil-bndv");

export const CSV_VEICULOS = () => path.join(DADOS(), "bndv_veiculos.csv");
export const CSV_VENDAS = () => path.join(DADOS(), "bndv_vendas.csv");
export const BALANCO_JSON = () => path.join(DADOS(), "balanco.json");
export const RELATORIO_HTML = () => path.join(DADOS(), "RELATORIO.html");
export const INDICE_CSV = () => path.join(ESTOQUE(), "_INDICE.csv");

/** Cria as pastas de saída se ainda não existirem. */
export function garantir() {
  for (const p of [ESTOQUE(), DADOS()]) fs.mkdirSync(p, { recursive: true });
}

/** Recursos empacotados (ícone, logo): ao lado do .exe em produção. */
export function recurso(nome: string) {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.resolve(app.getAppPath(), "resources");
  return path.join(base, nome);
}
