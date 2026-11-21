/**
 * Cofre dos segredos opcionais do app (token do uTalk, token do Meta, chave do Groq).
 *
 * Os três eram guardados do mesmo jeito, com o mesmo código repetido: o valor é cifrado pelo
 * sistema (`safeStorage`) e gravado em base64 no `config.json`, e a interface nunca o recebe de
 * volta. Aqui fica uma implementação só. A fábrica recebe as dependências (cifragem e config) para
 * poder ser testada sem Electron; `secret-store.ts` a instancia com as reais.
 *
 * O formato gravado não mudou: `base64(safeStorage.encryptString(valor))`. Valores salvos por
 * versões anteriores continuam sendo lidos.
 */

/** O que o cofre usa da cifragem do sistema (o `safeStorage` do Electron cumpre isto). */
export type Cripto = {
  isEncryptionAvailable(): boolean;
  encryptString(texto: string): Buffer;
  decryptString(dados: Buffer): string;
};

export type DependenciasDoCofre = {
  cripto: Cripto;
  lerConfig: () => Record<string, unknown>;
  gravarConfig: (patch: Record<string, unknown>) => unknown;
};

/** Tira espaços e o prefixo "Bearer " que costuma vir junto quando o usuário cola um token. */
export function limparSegredo(valor: string): string {
  return valor.trim().replace(/^Bearer\s+/i, "");
}

/** Cria um cofre sobre a cifragem e o config informados. */
export function criarCofre(dep: DependenciasDoCofre) {
  return {
    /** Valor em claro guardado em `chave` do config, ou null se não há ou não dá para decifrar. */
    ler(chave: string): string | null {
      const guardado = dep.lerConfig()[chave];
      if (typeof guardado !== "string" || !guardado) return null;
      try {
        return dep.cripto.decryptString(Buffer.from(guardado, "base64"));
      } catch {
        return null;
      }
    },

    /**
     * Cifra `valor` e devolve o texto a gravar no config (base64). Falha com `semCifragem` se o
     * sistema não oferece cifragem: o segredo nunca é guardado em texto puro.
     */
    cifrar(valor: string, semCifragem: string): string {
      if (!dep.cripto.isEncryptionAvailable()) throw new Error(semCifragem);
      return dep.cripto.encryptString(valor).toString("base64");
    },

    /** Esquece o segredo guardado em `chave`. */
    apagar(chave: string) {
      dep.gravarConfig({ [chave]: "" });
    },
  };
}
