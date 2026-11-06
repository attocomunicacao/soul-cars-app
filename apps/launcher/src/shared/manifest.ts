/**
 * Manifesto de versões do Launcher (regras puras, sem Electron, testadas em tests/).
 *
 * Cada GitHub Release publica um `manifest.json` (gerado por
 * `scripts/release/create-manifest.mjs`). O Launcher lê sempre o da release mais
 * recente em `.../releases/latest/download/manifest.json`, compara com o que está
 * instalado e oferece instalar, atualizar ou abrir cada app do catálogo.
 *
 * Formato (schemaVersion 1):
 * {
 *   "schemaVersion": 1,
 *   "generatedAt": "2026-11-05T12:00:00Z",
 *   "launcher": { "version": "1.0.0", "notes": "...", "downloads": { "win32-x64": Download } },
 *   "apps": [{ "id": "soul-cars", "name": "Soul Cars", "version": "1.0.0", ... }]
 * }
 */

/** Arquivo para download de uma plataforma: endereço https, SHA-256 (hex) e tamanho em bytes. */
export type Download = { url: string; sha256: string; size: number };

/** Uma entrada do catálogo: um app que o Launcher sabe instalar. */
export type AppRelease = {
  /** Identificador estável (nome da pasta de instalação). */
  id: string;
  /** Nome exibido. */
  name: string;
  /** Frase curta exibida no cartão do app. */
  tagline: string;
  /** Versão semântica (1.2.3). */
  version: string;
  /** Data ISO da publicação. */
  releasedAt: string;
  /** Notas da versão (texto simples, uma novidade por linha). */
  notes: string;
  /** Executável dentro do pacote, por sistema (ex.: { win32: "SoulCars.exe" }). */
  executable: Record<string, string>;
  /** Pacotes por plataforma (ex.: "win32-x64"). */
  downloads: Record<string, Download>;
};

/** Versão mais recente do próprio Launcher. */
export type LauncherRelease = {
  version: string;
  notes: string;
  downloads: Record<string, Download>;
};

/** O manifesto inteiro. */
export type Manifest = {
  schemaVersion: 1;
  generatedAt: string;
  launcher: LauncherRelease;
  apps: AppRelease[];
};

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Nome de executável seguro: sem barras nem "..", para não sair da pasta do app. */
const EXECUTAVEL = /^[\w .-]+\.(exe|app|AppImage)$|^[\w.-]+$/;

/** Erro de manifesto inválido (mensagem em português para mostrar ao usuário). */
export class ManifestoInvalido extends Error {}

/** Opções de leitura. `permitirHttpLocal` só é usado em testes com um servidor em 127.0.0.1. */
export type OpcoesLeitura = { permitirHttpLocal?: boolean };

/** Endereço aceito para download: https sempre; http só em 127.0.0.1/localhost no modo de teste. */
export function urlPermitida(url: string, opcoes: OpcoesLeitura = {}): boolean {
  if (url.startsWith("https://")) return true;
  return (
    !!opcoes.permitirHttpLocal &&
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)
  );
}

function exigir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new ManifestoInvalido(`Manifesto inválido: ${mensagem}`);
}

function texto(v: unknown, campo: string, max = 20_000): string {
  exigir(typeof v === "string" && v.length <= max, `${campo} deve ser texto`);
  return v;
}

function lerDownloads(
  v: unknown,
  campo: string,
  opcoes: OpcoesLeitura,
): Record<string, Download> {
  exigir(v && typeof v === "object", `${campo} ausente`);
  const saida: Record<string, Download> = {};
  for (const [plataforma, d] of Object.entries(v as Record<string, unknown>)) {
    exigir(
      /^[a-z0-9]+-[a-z0-9]+$/.test(plataforma),
      `plataforma ${plataforma}`,
    );
    const item = d as Record<string, unknown>;
    exigir(item && typeof item === "object", `${campo}.${plataforma}`);
    const url = texto(item.url, `${campo}.${plataforma}.url`, 2048);
    // Só https: o SHA-256 confere o conteúdo, e o https protege o manifesto no caminho.
    exigir(
      urlPermitida(url, opcoes),
      `${campo}.${plataforma}.url precisa ser https`,
    );
    const sha256 = texto(
      item.sha256,
      `${campo}.${plataforma}.sha256`,
      64,
    ).toLowerCase();
    exigir(SHA256.test(sha256), `${campo}.${plataforma}.sha256`);
    exigir(
      Number.isSafeInteger(item.size) && (item.size as number) > 0,
      `${campo}.${plataforma}.size`,
    );
    saida[plataforma] = { url, sha256, size: item.size as number };
  }
  return saida;
}

/** Valida o JSON recebido e devolve um Manifest tipado (lança ManifestoInvalido). */
export function lerManifesto(
  json: unknown,
  opcoes: OpcoesLeitura = {},
): Manifest {
  exigir(json && typeof json === "object", "não é um objeto");
  const m = json as Record<string, unknown>;
  exigir(
    m.schemaVersion === 1,
    "schemaVersion não suportado (atualize o Launcher)",
  );
  const l = m.launcher as Record<string, unknown>;
  exigir(l && typeof l === "object", "launcher ausente");
  exigir(SEMVER.test(String(l.version)), "launcher.version");
  exigir(Array.isArray(m.apps), "apps deve ser uma lista");
  const ids = new Set<string>();
  const apps = (m.apps as Record<string, unknown>[]).map((a, i) => {
    exigir(a && typeof a === "object", `apps[${i}]`);
    const id = texto(a.id, `apps[${i}].id`, 64);
    exigir(ID.test(id) && !ids.has(id), `apps[${i}].id`);
    ids.add(id);
    exigir(SEMVER.test(String(a.version)), `apps[${i}].version`);
    const executable: Record<string, string> = {};
    for (const [so, nome] of Object.entries(
      (a.executable ?? {}) as Record<string, unknown>,
    )) {
      exigir(
        typeof nome === "string" && EXECUTAVEL.test(nome),
        `apps[${i}].executable.${so}`,
      );
      executable[so] = nome;
    }
    return {
      id,
      name: texto(a.name, `apps[${i}].name`, 80),
      tagline: texto(a.tagline ?? "", `apps[${i}].tagline`, 200),
      version: String(a.version),
      releasedAt: texto(a.releasedAt ?? "", `apps[${i}].releasedAt`, 40),
      notes: texto(a.notes ?? "", `apps[${i}].notes`),
      executable,
      downloads: lerDownloads(a.downloads, `apps[${i}].downloads`, opcoes),
    } satisfies AppRelease;
  });
  return {
    schemaVersion: 1,
    generatedAt: texto(m.generatedAt ?? "", "generatedAt", 40),
    launcher: {
      version: String(l.version),
      notes: texto(l.notes ?? "", "launcher.notes"),
      downloads: lerDownloads(l.downloads ?? {}, "launcher.downloads", opcoes),
    },
    apps,
  };
}

/**
 * Compara versões semânticas: negativo se a < b, zero se iguais, positivo se a > b.
 * Pré-lançamento (1.0.0-beta) vem antes da versão final (1.0.0).
 */
export function compararVersoes(a: string, b: string): number {
  const [na, pa = ""] = a.split("-", 2);
  const [nb, pb = ""] = b.split("-", 2);
  const xa = na.split(".").map(Number);
  const xb = nb.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (xa[i] ?? 0) - (xb[i] ?? 0);
    if (d) return d;
  }
  if (pa === pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  return pa < pb ? -1 : 1;
}

/** Chave da plataforma usada no manifesto (ex.: "win32-x64"). */
export const chavePlataforma = (platform: string, arch: string) =>
  `${platform}-${arch}`;

/** Situação de um app no Launcher, calculada a partir do manifesto e do que está instalado. */
export type SituacaoApp =
  "nao-instalado" | "atualizado" | "atualizacao-disponivel" | "indisponivel";

/** Decide o botão principal do cartão do app (instalar, atualizar ou abrir). */
export function situacaoDoApp(
  release: AppRelease | undefined,
  instalada: string | null,
  plataforma: string,
): SituacaoApp {
  const temPacote = !!release?.downloads[plataforma];
  if (!instalada) return temPacote ? "nao-instalado" : "indisponivel";
  if (release && temPacote && compararVersoes(release.version, instalada) > 0)
    return "atualizacao-disponivel";
  return "atualizado";
}

/**
 * Versões a apagar depois de instalar: mantém a ativa, a anterior (para voltar atrás) e
 * a última que abriu de fato. Esta é a reserva quando o Windows (Smart App Control) ainda
 * bloqueia uma versão nova: ela nunca é apagada, mesmo após várias atualizações seguidas.
 */
export function versoesParaLimpar(
  instaladas: string[],
  ativa: string,
  manter = 2,
  ultimaQueAbriu?: string,
): string[] {
  const ordenadas = [...instaladas].sort((a, b) => compararVersoes(b, a));
  const preservar = new Set([
    ativa,
    ...ordenadas.filter((v) => v !== ativa).slice(0, manter - 1),
  ]);
  if (ultimaQueAbriu) preservar.add(ultimaQueAbriu);
  return ordenadas.filter((v) => !preservar.has(v));
}

/**
 * Versões para tentar quando a ativa é bloqueada pelo Windows, em ordem: primeiro a última
 * que abriu de fato; depois as demais instaladas, da mais nova para a mais antiga.
 */
export function versoesAlternativas(
  instaladas: string[],
  ativa: string,
  ultimaQueAbriu?: string,
): string[] {
  const outras = [...new Set(instaladas)]
    .filter((v) => v !== ativa)
    .sort((a, b) => compararVersoes(b, a));
  if (ultimaQueAbriu && outras.includes(ultimaQueAbriu))
    return [ultimaQueAbriu, ...outras.filter((v) => v !== ultimaQueAbriu)];
  return outras;
}
