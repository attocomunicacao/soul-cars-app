/**
 * Consulta paginada à API GraphQL do BNDV, tolerante a mudanças do schema.
 *
 * Sem dependência do Electron para poder ser testada. Duas defesas:
 *  1. Servidores GraphQL costumam recusar uma consulta inválida com HTTP 400 *e um corpo
 *     com `errors`*. Esse corpo é lido (não basta olhar o status) e o motivo aparece na
 *     mensagem para o usuário.
 *  2. Se o BNDV renomear ou tirar um campo, a consulta segue sem ele (avisando no log)
 *     em vez de parar a atualização inteira; os campos "extras" também são largados se
 *     a falha não puder ser ligada a um campo.
 */

export type Log = (
  texto: string,
  tom?: "normal" | "aviso" | "erro" | "ok",
) => void;
export type Registro = Record<string, unknown>;
export type Pagina = { itens: Registro[]; total: number };
export type ErroGraphql = {
  message: string;
  locations?: { line: number; column: number }[];
};
type Resposta = {
  data?: Record<
    string,
    { paginationOut: { totalRows: number }; items: Registro[] }
  >;
  errors?: ErroGraphql[];
};

const MAX_PODAS = 12;

export const montarConsulta = (raiz: string, pagina: number, selecao: string) =>
  `query { ${raiz}(pagination:{page:${pagina},pageSize:20},filters:{}) { paginationOut { totalRows } items { ${selecao} } } }`;

/** Nome do campo que o servidor diz não existir (HotChocolate ou graphql-js). */
export function campoInexistente(mensagem: string): string | null {
  const m =
    /Cannot query field ["`'](\w+)["`']/i.exec(mensagem) ??
    /field\s+["`'](\w+)["`']\s+does not exist/i.exec(mensagem) ??
    /Unknown field ["`'](\w+)["`']/i.exec(mensagem);
  return m ? m[1] : null;
}

/** Remove da seleção o campo na posição `pos` (com o bloco `{ ... }` dele, se houver) e os pais que ficarem vazios. */
export function removerCampoEm(selecao: string, pos: number): string {
  const nome = /^[A-Za-z_]\w*/.exec(selecao.slice(pos));
  if (!nome) return selecao;
  // Campo com apelido ("x_km: km"): o apelido sai junto, senão sobra um "x_km:" solto.
  const apelido = /([A-Za-z_]\w*)\s*:\s*$/.exec(selecao.slice(0, pos));
  const inicio = apelido ? apelido.index : pos;
  let fim = pos + nome[0].length;
  let i = fim;
  while (selecao[i] === " " || selecao[i] === "\n") i++;
  if (selecao[i] === "{") {
    let nivel = 0;
    for (; i < selecao.length; i++) {
      if (selecao[i] === "{") nivel++;
      else if (selecao[i] === "}" && --nivel === 0) {
        fim = i + 1;
        break;
      }
    }
  }
  let saida = selecao.slice(0, inicio) + " " + selecao.slice(fim);
  // Um objeto sem nenhum campo dentro não é GraphQL válido: remove o pai também.
  for (;;) {
    const vazio = /(?:[A-Za-z_]\w*\s*:\s*)?[A-Za-z_]\w*\s*\{\s*\}/.exec(saida);
    if (!vazio) break;
    saida =
      saida.slice(0, vazio.index) +
      " " +
      saida.slice(vazio.index + vazio[0].length);
  }
  return saida.replace(/\s+/g, " ").trim();
}

/** Acha, na seleção, o campo que causou o erro (pela posição que o servidor informa; senão, se o nome for único). */
export function podarCampoDoErro(
  query: string,
  selecao: string,
  erros: ErroGraphql[],
): { selecao: string; campo: string } | null {
  const inicio = query.indexOf(selecao);
  if (inicio < 0) return null;
  for (const erro of erros) {
    const nome = campoInexistente(erro.message);
    if (!nome) continue;
    const local = erro.locations?.[0];
    if (local && local.line === 1) {
      const pos = local.column - 1 - inicio;
      if (pos >= 0 && selecao.startsWith(nome, pos))
        return { selecao: removerCampoEm(selecao, pos), campo: nome };
    }
    const ocorrencias = [...selecao.matchAll(new RegExp(`\\b${nome}\\b`, "g"))];
    if (ocorrencias.length === 1)
      return {
        selecao: removerCampoEm(selecao, ocorrencias[0].index!),
        campo: nome,
      };
  }
  return null;
}

export type Opcoes = {
  url: string;
  cabecalhos: Record<string, string>;
  log?: Log;
  /** Para testes. */
  buscar?: typeof fetch;
};

/** Uma consulta avulsa (ex.: introspecção do esquema). Devolve o JSON, com ou sem `errors`. */
export async function consultar(
  opcoes: Opcoes,
  query: string,
): Promise<Resposta & { status: number }> {
  const resposta = await (opcoes.buscar ?? fetch)(opcoes.url, {
    method: "POST",
    headers: opcoes.cabecalhos,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await resposta.text();
  let json: Resposta | null = null;
  try {
    json = JSON.parse(texto) as Resposta;
  } catch {
    /* corpo que não é JSON */
  }
  if (!json)
    throw new Error(
      `O BNDV respondeu HTTP ${resposta.status}: ${texto.replace(/\s+/g, " ").trim().slice(0, 200)}`,
    );
  return { ...json, status: resposta.status };
}

export async function puxar(
  opcoes: Opcoes,
  raiz: string,
  core: string,
  extra: string,
  chave: string,
): Promise<Pagina> {
  const buscar = opcoes.buscar ?? fetch;
  const itens: Registro[] = [];
  const vistos = new Set<unknown>();
  let total = 0;
  let selecao = extra ? `${core} ${extra}` : core;
  let comExtras = Boolean(extra);
  let podas = 0;

  const enviar = async (pagina: number) => {
    const query = montarConsulta(raiz, pagina, selecao);
    const resposta = await buscar(opcoes.url, {
      method: "POST",
      headers: opcoes.cabecalhos,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(60_000),
    });
    const texto = await resposta.text();
    let json: Resposta | null = null;
    try {
      json = JSON.parse(texto) as Resposta;
    } catch {
      /* corpo que não é JSON */
    }
    if (!resposta.ok && !Array.isArray(json?.errors))
      throw new Error(
        `O BNDV respondeu HTTP ${resposta.status}` +
          (texto.trim()
            ? `: ${texto.replace(/\s+/g, " ").trim().slice(0, 300)}`
            : "") +
          ". Tente atualizar novamente; se persistir, confira o login na janela do BNDV.",
      );
    return { query, json: json ?? {}, status: resposta.status };
  };

  for (let pagina = 0; pagina <= 200; pagina++) {
    let r = await enviar(pagina);
    while (r.json.errors?.length) {
      const erros = r.json.errors;
      const poda =
        podas < MAX_PODAS ? podarCampoDoErro(r.query, selecao, erros) : null;
      if (poda) {
        if (poda.campo === chave)
          throw new Error(
            `O BNDV não tem mais o campo "${chave}" em ${raiz}, que o app usa para identificar os registros.`,
          );
        podas++;
        selecao = poda.selecao;
        opcoes.log?.(
          `O BNDV não tem mais o campo "${poda.campo}" em ${raiz}; seguindo sem ele.`,
          "aviso",
        );
      } else if (comExtras) {
        comExtras = false;
        selecao = core;
        opcoes.log?.(
          `A consulta de ${raiz} falhou com os campos extras; refazendo só com os essenciais.`,
          "aviso",
        );
      } else {
        throw new Error(
          `a API recusou a consulta de ${raiz} (HTTP ${r.status}): ${erros[0].message}`,
        );
      }
      r = await enviar(pagina);
    }
    const d = r.json.data?.[raiz];
    if (!d) throw new Error(`a API não devolveu ${raiz}.`);
    if (d.paginationOut?.totalRows) total = d.paginationOut.totalRows;
    if (!d.items.length) break;
    for (const it of d.items) {
      if (!vistos.has(it[chave])) {
        vistos.add(it[chave]);
        itens.push(it);
      }
    }
  }
  return { itens, total };
}
