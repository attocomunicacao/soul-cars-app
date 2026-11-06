/**
 * Contrato entre a interface do Launcher e o processo principal (canais IPC e tipos).
 * O preload expõe exatamente estes métodos em `window.launcher`.
 */
import type { AppRelease, SituacaoApp } from "./manifest";

/** Estado de um app exibido no cartão da biblioteca. */
export type EstadoApp = {
  release: AppRelease;
  instalada: string | null;
  situacao: SituacaoApp;
  /** Pasta da versão ativa (para "Abrir pasta"). */
  pasta: string | null;
};

/** Visão completa que a interface desenha. */
export type EstadoLauncher = {
  versaoLauncher: string;
  plataforma: string;
  /** Erro ao ler o manifesto (sem internet, release ausente…), ou null. */
  erroCatalogo: string | null;
  /** Quando o catálogo foi lido pela última vez (ISO). */
  verificadoEm: string | null;
  /** Nova versão do Launcher disponível (ou null). */
  novoLauncher: { version: string; notes: string } | null;
  apps: EstadoApp[];
  preferencias: Preferencias;
  pastaInstalacao: string;
};

/** Preferências do usuário, gravadas em launcher-state.json. */
export type Preferencias = {
  /** Fecha o Launcher depois de abrir um app. */
  fecharAoAbrir: boolean;
  /** Verifica atualizações ao iniciar. */
  verificarAoIniciar: boolean;
};

/** Progresso de download/instalação enviado ao vivo para a interface. */
export type Progresso = {
  appId: string;
  etapa: "baixando" | "verificando" | "extraindo" | "concluido" | "erro";
  /** 0 a 1 durante o download. */
  fracao?: number;
  mensagem?: string;
};

/** Métodos expostos em `window.launcher` pelo preload. */
export type LauncherApi = {
  estado: () => Promise<EstadoLauncher>;
  verificar: () => Promise<EstadoLauncher>;
  instalar: (appId: string) => Promise<EstadoLauncher>;
  abrir: (appId: string) => Promise<void>;
  abrirPasta: (appId: string) => Promise<void>;
  atualizarLauncher: () => Promise<void>;
  salvarPreferencias: (p: Partial<Preferencias>) => Promise<EstadoLauncher>;
  abrirLink: (url: string) => Promise<void>;
  aoProgresso: (fn: (p: Progresso) => void) => () => void;
};

/** Nomes dos canais IPC (um lugar só para main e preload). */
export const CANAIS = {
  estado: "launcher:estado",
  verificar: "launcher:verificar",
  instalar: "launcher:instalar",
  abrir: "launcher:abrir",
  abrirPasta: "launcher:abrir-pasta",
  atualizarLauncher: "launcher:atualizar-launcher",
  salvarPreferencias: "launcher:preferencias",
  abrirLink: "launcher:abrir-link",
  progresso: "launcher:progresso",
} as const;
