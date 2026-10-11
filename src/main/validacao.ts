/**
 * Validação dos argumentos que a interface manda pelo IPC.
 *
 * Cada comando tem um esquema (`ipc-esquemas.ts`). Só o que o esquema declara
 * chega ao comando: campos a mais são descartados e campos errados viram erro
 * em português, antes de qualquer acesso a disco, banco ou processo.
 * Sem dependências externas de propósito.
 */
import path from "node:path";

export type Regra<T = unknown> = (valor: unknown, campo: string) => T;
export type Esquema = {
  args?: Record<string, Regra>;
  cabecalhos?: Record<string, Regra>;
  corpo?: "obrigatorio";
};

const erro = (campo: string, esperado: string): never => {
  throw new Error(`Argumento inválido: "${campo}" deve ser ${esperado}.`);
};

const ehObjetoPlano = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  !(v instanceof Uint8Array);

export const texto =
  (opcoes: { max?: number; vazio?: boolean } = {}): Regra<string> =>
  (v, campo) => {
    if (typeof v !== "string") return erro(campo, "um texto");
    if (v.includes("\0")) return erro(campo, "um texto sem caracteres nulos");
    if (!opcoes.vazio && v.trim() === "") return erro(campo, "não vazio");
    if (v.length > (opcoes.max ?? 4096))
      return erro(campo, `um texto de até ${opcoes.max ?? 4096} caracteres`);
    return v;
  };

export const numero: Regra<number> = (v, campo) =>
  typeof v === "number" && Number.isFinite(v) ? v : erro(campo, "um número");

export const inteiro: Regra<number> = (v, campo) =>
  typeof v === "number" && Number.isSafeInteger(v)
    ? v
    : erro(campo, "um número inteiro");

export const booleano: Regra<boolean> = (v, campo) =>
  typeof v === "boolean" ? v : erro(campo, "verdadeiro ou falso");

/** Id de veículo: número inteiro positivo, ou o mesmo número como texto (cabeçalhos). */
export const idVeiculo: Regra<number | string> = (v, campo) => {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return v;
  if (typeof v === "string" && /^\d{1,15}$/.test(v)) return v;
  return erro(campo, "um id de veículo");
};

export const umDe =
  <T extends string>(...valores: T[]): Regra<T> =>
  (v, campo) =>
    valores.includes(v as T)
      ? (v as T)
      : erro(campo, `um de: ${valores.join(", ")}`);

/** Campo que pode faltar ou ser nulo: vira `undefined`. */
export const opcional =
  <T>(regra: Regra<T>): Regra<T | undefined> =>
  (v, campo) =>
    v === undefined || v === null ? undefined : regra(v, campo);

export const lista =
  <T>(regra: Regra<T>, max = 1000): Regra<T[]> =>
  (v, campo) => {
    if (!Array.isArray(v)) return erro(campo, "uma lista");
    if (v.length > max) return erro(campo, `uma lista de até ${max} itens`);
    return v.map((item, i) => regra(item, `${campo}[${i}]`));
  };

export const objeto =
  (campos: Record<string, Regra>): Regra<Record<string, unknown>> =>
  (v, campo) => {
    if (!ehObjetoPlano(v)) return erro(campo, "um objeto");
    return aplicar(campos, v, campo);
  };

/** Objeto sem forma fixa (parâmetros do motor): precisa ser objeto e conter só dados. */
export const objetoLivre: Regra<Record<string, unknown>> = (v, campo) =>
  ehObjetoPlano(v) ? v : erro(campo, "um objeto");

/** Valor simples de consulta SQL. */
export const valorSql: Regra = (v, campo) => {
  if (
    v === null ||
    typeof v === "string" ||
    typeof v === "boolean" ||
    (typeof v === "number" && Number.isFinite(v))
  )
    return v;
  return erro(campo, "texto, número, booleano ou nulo");
};

/**
 * Consulta SQL vinda da interface. A interface precisa de SQL livre (o banco
 * é acessado por `lib/db.ts`), mas não de anexar outros bancos, carregar
 * extensões nem gravar arquivos fora da pasta de backups.
 */
export const consultaSql =
  (pastaBackups: () => string): Regra<string> =>
  (v, campo) => {
    const sql = texto({ max: 200_000 })(v, campo);
    if (/\battach\b|load_extension|\bdetach\b/i.test(sql))
      throw new Error("Comando SQL não permitido.");
    const into = /\bvacuum\s+into\s+'((?:[^']|'')*)'/i.exec(sql);
    if (/\bvacuum\s+into\b/i.test(sql)) {
      if (!into) throw new Error("Comando SQL não permitido.");
      const alvo = path.resolve(into[1].replace(/''/g, "'"));
      if (!dentroDe(pastaBackups(), alvo))
        throw new Error("Backup fora da pasta de backups.");
    }
    return sql;
  };

const minusculas = (s: string) =>
  process.platform === "win32" ? s.toLowerCase() : s;

export function dentroDe(raiz: string, alvo: string) {
  const r = minusculas(path.resolve(raiz));
  const a = minusculas(path.resolve(alvo));
  return a === r || a.startsWith(r + path.sep);
}

/** Caminho que precisa estar dentro de alguma das raízes autorizadas. */
export const caminhoEmRaizes =
  (raizes: () => string[]): Regra<string> =>
  (v, campo) => {
    const caminho = texto({ max: 1024 })(v, campo);
    if (!path.isAbsolute(caminho)) return erro(campo, "um caminho completo");
    if (!raizes().some((raiz) => dentroDe(raiz, caminho)))
      throw new Error(
        "Esta pasta está fora da pasta de dados do app. Atualize o Estoque ou ajuste a raiz em Configurações.",
      );
    return caminho;
  };

/** Caminho completo qualquer (escolhido pelo usuário num diálogo). */
export const caminhoQualquer: Regra<string> = (v, campo) => {
  const caminho = texto({ max: 1024 })(v, campo);
  return path.isAbsolute(caminho)
    ? caminho
    : erro(campo, "um caminho completo");
};

function aplicar(
  campos: Record<string, Regra>,
  origem: Record<string, unknown>,
  prefixo: string,
) {
  const saida: Record<string, unknown> = {};
  for (const [nome, regra] of Object.entries(campos)) {
    const valor = regra(origem[nome], prefixo ? `${prefixo}.${nome}` : nome);
    if (valor !== undefined) saida[nome] = valor;
  }
  return saida;
}

export const LIMITE_CORPO = 200 * 1024 * 1024;

/** Valida a chamada inteira e devolve só o que o comando pode ver. */
export function validarChamada(
  comando: string,
  esquema: Esquema,
  args: unknown,
  cabecalhos: unknown,
  corpo: Uint8Array | null,
) {
  const bruto = args === undefined || args === null ? {} : args;
  if (!ehObjetoPlano(bruto)) return erro("args", "um objeto");
  const brutoCab =
    cabecalhos === undefined || cabecalhos === null ? {} : cabecalhos;
  if (!ehObjetoPlano(brutoCab)) return erro("cabecalhos", "um objeto");

  const limpos = aplicar(esquema.args ?? {}, bruto, "");
  const limposCab = aplicar(esquema.cabecalhos ?? {}, brutoCab, "cabeçalho");

  if (corpo !== null && !(corpo instanceof Uint8Array))
    return erro("corpo", "bytes");
  if (corpo && corpo.byteLength > LIMITE_CORPO)
    throw new Error("Arquivo grande demais.");
  if (esquema.corpo === "obrigatorio" && !corpo)
    throw new Error(`O comando ${comando} exige um arquivo.`);
  const corpoFinal = esquema.corpo === "obrigatorio" ? corpo : null;
  return {
    args: limpos,
    cabecalhos: limposCab as Record<string, string>,
    corpo: corpoFinal,
  };
}
