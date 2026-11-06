/**
 * Descobre, pela introspecção da API GraphQL do BNDV, quais campos existem para km, cor,
 * câmbio, combustível, ano e versão do veículo, e monta a seleção para pedi-los.
 *
 * Os nomes não são fixos: o app pergunta ao BNDV a cada atualização e escolhe o que existir
 * (por nome conhecido, em português ou inglês). Cada campo pedido ganha um apelido `x_<papel>`,
 * então o resto do app não depende do nome real. Se a introspecção estiver desligada ou algo
 * falhar, a atualização segue sem os extras, como antes.
 */
import { consultar, type Opcoes } from "./bndv-graphql";

export type PapelExtra =
  "km" | "cor" | "cambio" | "combustivel" | "anoModelo" | "anoFab" | "versao";

export const PAPEIS: PapelExtra[] = [
  "km",
  "cor",
  "cambio",
  "combustivel",
  "anoModelo",
  "anoFab",
  "versao",
];

/** Nomes de campo que cada papel aceita (sem diferenciar maiúsculas). */
const NOMES: Record<PapelExtra, RegExp> = {
  km: /^(km|mileage|odometer|odometro|quilometragem|kilometer|kilometers)$/i,
  cor: /^(color|colour|cor|vehiclecolor)$/i,
  cambio: /^(gearbox|transmission|transmissao|cambio|gear|gearboxtype)$/i,
  combustivel: /^(fuel|fueltype|combustivel|fuelname)$/i,
  anoModelo: /^(yearmodel|modelyear|anomodelo|yearmod)$/i,
  anoFab:
    /^(yearmanufacture|manufactureyear|yearmanufacturing|yearfabrication|anofabricacao|yearfab|manufacturingyear)$/i,
  versao: /^(version|versionname|versao|trim)$/i,
};

/** Dentro de um objeto (ex.: `color { name }`), o primeiro destes campos de texto é o escolhido. */
const SUBCAMPOS = [
  "name",
  "description",
  "title",
  "url",
  "path",
  "link",
  "uri",
];

export type TipoGql = {
  kind: string;
  name: string | null;
  ofType?: TipoGql | null;
};
export type CampoGql = {
  name: string;
  type: TipoGql;
  args?: { name: string; defaultValue?: string | null; type: TipoGql }[];
};

/** Tira NON_NULL e LIST: devolve o tipo de verdade e se era lista. */
export function tipoBase(t: TipoGql): {
  nome: string | null;
  kind: string;
  lista: boolean;
} {
  let atual: TipoGql | null | undefined = t;
  let lista = false;
  while (atual && (atual.kind === "NON_NULL" || atual.kind === "LIST")) {
    if (atual.kind === "LIST") lista = true;
    atual = atual.ofType;
  }
  return { nome: atual?.name ?? null, kind: atual?.kind ?? "", lista };
}

const exigeArgumento = (c: CampoGql) =>
  (c.args ?? []).some(
    (a) => a.type.kind === "NON_NULL" && a.defaultValue == null,
  );

export type Escolha = { papel: PapelExtra; campo: string; sub: string | null };

/**
 * Escolhe um campo por papel. `tipos` tem os campos dos tipos-objeto citados
 * (para achar `name`/`url` dentro de `color`, `fuel`, `photo`…).
 */
export function escolherCampos(
  campos: CampoGql[],
  tipos: Record<string, CampoGql[]>,
): Escolha[] {
  const escolhas: Escolha[] = [];
  for (const papel of PAPEIS) {
    for (const c of campos) {
      if (!NOMES[papel].test(c.name) || exigeArgumento(c)) continue;
      const base = tipoBase(c.type);
      if (base.kind === "SCALAR" || base.kind === "ENUM") {
        escolhas.push({ papel, campo: c.name, sub: null });
        break;
      }
      if (base.kind === "OBJECT" && base.nome) {
        const internos = tipos[base.nome] ?? [];
        const sub = SUBCAMPOS.find((s) =>
          internos.some(
            (i) =>
              i.name === s &&
              !exigeArgumento(i) &&
              ["SCALAR", "ENUM"].includes(tipoBase(i.type).kind),
          ),
        );
        if (sub) {
          escolhas.push({ papel, campo: c.name, sub });
          break;
        }
      }
    }
  }
  return escolhas;
}

/** Trecho GraphQL com apelidos: `x_km: km x_cor: color { name }`. */
export function selecaoDasEscolhas(escolhas: Escolha[]): string {
  return escolhas
    .map((e) =>
      e.sub
        ? `x_${e.papel}: ${e.campo} { ${e.sub} }`
        : `x_${e.papel}: ${e.campo}`,
    )
    .join(" ");
}

/** Texto de um valor devolvido pelo BNDV (texto, número, objeto com name/url ou lista deles). */
export function textoDoValor(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    for (const item of v) {
      const t = textoDoValor(item);
      if (t) return t;
    }
    return "";
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const s of SUBCAMPOS) {
      const t = textoDoValor(o[s]);
      if (t) return t;
    }
  }
  return "";
}

// ----------------------------------------------------------- introspecção
const TIPO =
  "kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }";
const CAMPOS = `fields { name args { name defaultValue type { kind } } type { ${TIPO} } }`;

export type Descoberta = {
  tipoDosItens: string | null;
  campos: CampoGql[];
  escolhas: Escolha[];
  selecao: string;
};

async function camposDoTipo(api: Opcoes, nome: string): Promise<CampoGql[]> {
  const r = await consultar(
    api,
    `query { __type(name: ${JSON.stringify(nome)}) { ${CAMPOS} } }`,
  );
  if (r.errors?.length) throw new Error(r.errors[0].message);
  const dados = r.data as
    { __type?: { fields?: CampoGql[] } | null } | undefined;
  return dados?.__type?.fields ?? [];
}

/** Descobre os campos extras de `raiz` (ex.: "vehicles_web_app"). Nunca lança: erro vira `selecao` vazia. */
export async function descobrirExtras(
  api: Opcoes,
  raiz: string,
): Promise<Descoberta & { erro?: string }> {
  const vazio: Descoberta = {
    tipoDosItens: null,
    campos: [],
    escolhas: [],
    selecao: "",
  };
  try {
    const r = await consultar(
      api,
      `query { __schema { queryType { name ${CAMPOS} } } }`,
    );
    if (r.errors?.length) throw new Error(r.errors[0].message);
    const esquema = r.data as {
      __schema?: { queryType?: { fields?: CampoGql[] } };
    };
    const noRaiz = esquema.__schema?.queryType?.fields?.find(
      (c) => c.name === raiz,
    );
    const tipoPagina = noRaiz ? tipoBase(noRaiz.type).nome : null;
    if (!tipoPagina) throw new Error(`o BNDV não descreve o campo ${raiz}`);

    const items = (await camposDoTipo(api, tipoPagina)).find(
      (c) => c.name === "items",
    );
    const tipoItens = items ? tipoBase(items.type).nome : null;
    if (!tipoItens) throw new Error(`não achei o tipo dos itens de ${raiz}`);

    const campos = await camposDoTipo(api, tipoItens);
    // Tipos-objeto que podem esconder o texto (cor, combustível…).
    const tipos: Record<string, CampoGql[]> = {};
    for (const papel of PAPEIS) {
      for (const c of campos) {
        const base = tipoBase(c.type);
        if (
          NOMES[papel].test(c.name) &&
          base.kind === "OBJECT" &&
          base.nome &&
          !tipos[base.nome]
        )
          tipos[base.nome] = await camposDoTipo(api, base.nome);
      }
    }
    const escolhas = escolherCampos(campos, tipos);
    return {
      tipoDosItens: tipoItens,
      campos,
      escolhas,
      selecao: selecaoDasEscolhas(escolhas),
    };
  } catch (erro) {
    return {
      ...vazio,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}
