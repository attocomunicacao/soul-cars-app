/**
 * Segredos do app (hoje, só a chave da IA).
 *
 * Ficam num arquivo próprio, cifrados com o cofre do sistema (no Windows, o
 * DPAPI, ligado ao usuário). Nunca vão para o `soul.db` nem para os backups,
 * e a interface só consegue gravar, apagar e perguntar se existe: a leitura é
 * exclusiva do processo principal, que entrega a chave ao motor.
 *
 * Este módulo não importa o Electron: o cofre entra por `Cofre`, o que o
 * deixa testável. A ligação com o Electron está em `segredos-sistema.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const NOMES_PERMITIDOS = ["anthropic_api_key"] as const;
export type NomeSegredo = (typeof NOMES_PERMITIDOS)[number];

export type Cofre = {
  disponivel(): boolean;
  cifrar(texto: string): Buffer;
  decifrar(dados: Buffer): string;
};

const nomeValido = (nome: string): nome is NomeSegredo =>
  (NOMES_PERMITIDOS as readonly string[]).includes(nome);

export function criarSegredos(arquivo: string, cofre: Cofre) {
  const ler = (): Record<string, string> => {
    try {
      return JSON.parse(fs.readFileSync(arquivo, "utf8"));
    } catch {
      return {};
    }
  };
  const gravar = (dados: Record<string, string>) => {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const temporario = arquivo + ".tmp";
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), "utf8");
    fs.renameSync(temporario, arquivo);
  };
  const validar = (nome: string): NomeSegredo => {
    if (!nomeValido(nome)) throw new Error("Segredo desconhecido.");
    return nome;
  };

  return {
    existe(nome: string) {
      return Boolean(ler()[validar(nome)]);
    },
    /** Só o processo principal chama isto. Nunca exponha por IPC. */
    obter(nome: string): string | null {
      const cifrado = ler()[validar(nome)];
      if (!cifrado) return null;
      try {
        return cofre.decifrar(Buffer.from(cifrado, "base64"));
      } catch {
        return null;
      }
    },
    definir(nome: string, valor: string | null) {
      validar(nome);
      const dados = ler();
      if (valor === null || valor.trim() === "") {
        delete dados[nome];
      } else {
        if (!cofre.disponivel())
          throw new Error(
            "O cofre do sistema não está disponível; a chave não foi salva.",
          );
        const cifrado = cofre.cifrar(valor.trim());
        // Confere a volta antes de aceitar: não perder a chave por cifra quebrada.
        if (cofre.decifrar(cifrado) !== valor.trim())
          throw new Error("Falha ao proteger a chave; nada foi salvo.");
        dados[nome] = cifrado.toString("base64");
      }
      gravar(dados);
    },
  };
}

export type Segredos = ReturnType<typeof criarSegredos>;

/**
 * Tira a chave que versões anteriores guardavam em texto no banco.
 *
 * Move para o cofre e só então apaga do `soul.db` e das cópias de backup,
 * compactando os arquivos para o texto não sobrar em páginas livres.
 * Devolve quantos bancos foram limpos.
 */
export function migrarChaveDoBanco(
  segredos: Segredos,
  bancos: string[],
): number {
  const NOME = "anthropic_api_key";
  let limpos = 0;
  for (const arquivo of bancos) {
    if (!fs.existsSync(arquivo)) continue;
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(arquivo);
      const tabela = db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'config'",
        )
        .get();
      if (!tabela) continue;
      const linha = db
        .prepare("SELECT valor FROM config WHERE chave = ?")
        .get(NOME) as { valor: string } | undefined;
      if (!linha) continue;
      // O banco principal vem primeiro; os backups só são limpos se o cofre já
      // tem uma chave (a do banco principal ou a que o usuário salvou depois).
      if (!segredos.existe(NOME) && linha.valor)
        segredos.definir(NOME, linha.valor);
      if (!segredos.existe(NOME)) continue;
      db.prepare("DELETE FROM config WHERE chave = ?").run(NOME);
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.exec("VACUUM");
      limpos++;
    } catch {
      // Um backup ilegível não pode impedir o app de abrir.
    } finally {
      db?.close();
    }
  }
  return limpos;
}
