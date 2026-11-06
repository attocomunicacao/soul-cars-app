/**
 * Testes (Vitest) de src/main/inventory/bndv-graphql.ts (paginação e tolerância a mudanças do schema).
 */
import { describe, expect, it } from "vitest";
import {
  SessaoExpirada,
  campoInexistente,
  consultar,
  ehErroDeSessao,
  montarConsulta,
  podarCampoDoErro,
  puxar,
  removerCampoEm,
} from "../src/main/inventory/bndv-graphql";

const CORE =
  "idVehicle plate vehicleStatus { name } brand { name } model { name }";
const EXTRA = "status vehicle { daysInStock km yearModel }";

type Chamada = { query: string };

/** fetch de mentira: o `responder` decide status e corpo para cada consulta. */
function servidor(
  responder: (query: string, n: number) => { status: number; corpo: unknown },
) {
  const chamadas: Chamada[] = [];
  const buscar = (async (_url: string, init: { body: string }) => {
    const { query } = JSON.parse(init.body) as { query: string };
    chamadas.push({ query });
    const { status, corpo } = responder(query, chamadas.length);
    const texto = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => texto,
    };
  }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

const pagina = (itens: unknown[], total = itens.length) => ({
  status: 200,
  corpo: {
    data: { vehicles: { paginationOut: { totalRows: total }, items: itens } },
  },
});
const vazia = pagina([]);

describe("mensagens do servidor", () => {
  it("reconhece o campo inexistente nos dois formatos", () => {
    expect(
      campoInexistente('Cannot query field "foo" on type "Vehicle".'),
    ).toBe("foo");
    expect(
      campoInexistente("The field `foo` does not exist on the type `Vehicle`."),
    ).toBe("foo");
    expect(
      campoInexistente("Cannot return null for non-nullable field."),
    ).toBeNull();
  });
});

describe("poda da seleção", () => {
  it("remove um campo simples, um objeto inteiro e pais que ficam vazios", () => {
    const sel = "a b { c d } e";
    expect(removerCampoEm(sel, sel.indexOf("b"))).toBe("a e");
    expect(removerCampoEm(sel, sel.indexOf("c"))).toBe("a b { d } e");
    const so = "a b { c } e";
    expect(removerCampoEm(so, so.indexOf("c"))).toBe("a e");
  });

  it("acha o campo pela posição informada pelo servidor", () => {
    const query = montarConsulta("vehicles", 0, CORE);
    const coluna = query.indexOf("plate") + 1;
    const r = podarCampoDoErro(query, CORE, [
      {
        message: 'Cannot query field "plate" on type "V".',
        locations: [{ line: 1, column: coluna }],
      },
    ]);
    expect(r?.campo).toBe("plate");
    expect(r?.selecao).not.toContain("plate");
    expect(r?.selecao).toContain("brand { name }");
  });

  it("com o mesmo nome em vários lugares, só poda o que o servidor apontou", () => {
    const query = montarConsulta("vehicles", 0, CORE);
    const coluna = query.indexOf("name", query.indexOf("brand")) + 1;
    const r = podarCampoDoErro(query, CORE, [
      {
        message: 'Cannot query field "name" on type "Brand".',
        locations: [{ line: 1, column: coluna }],
      },
    ]);
    // brand { name } fica vazio e sai inteiro; os outros "name" continuam.
    expect(r?.selecao).toBe(
      "idVehicle plate vehicleStatus { name } model { name }",
    );
  });

  it("sem posição e com nome repetido, não adivinha", () => {
    const query = montarConsulta("vehicles", 0, CORE);
    expect(
      podarCampoDoErro(query, CORE, [
        { message: 'Cannot query field "name" on type "X".' },
      ]),
    ).toBeNull();
  });
});

describe("consulta ao BNDV", () => {
  const opcoes = (buscar: typeof fetch, avisos: string[] = []) => ({
    url: "https://exemplo.test/graphql",
    cabecalhos: { Authorization: "Bearer x" },
    log: (t: string) => void avisos.push(t),
    buscar,
  });

  it("caminho feliz: pagina até acabar e tira duplicados", async () => {
    const { buscar, chamadas } = servidor((_q, n) =>
      n === 1
        ? pagina([{ idVehicle: 1 }, { idVehicle: 2 }], 2)
        : n === 2
          ? pagina([{ idVehicle: 2 }], 2)
          : vazia,
    );
    const r = await puxar(opcoes(buscar), "vehicles", CORE, "", "idVehicle");
    expect(r.itens.map((i) => i.idVehicle)).toEqual([1, 2]);
    expect(r.total).toBe(2);
    expect(chamadas.length).toBe(3);
  });

  it("HTTP 400 com errors de campo inexistente: poda o campo e segue (o caso do relato)", async () => {
    const avisos: string[] = [];
    const { buscar, chamadas } = servidor((q, n) => {
      if (q.includes("daysInStock"))
        return {
          status: 400,
          corpo: {
            errors: [
              {
                message: 'Cannot query field "daysInStock" on type "Vehicle".',
                locations: [{ line: 1, column: q.indexOf("daysInStock") + 1 }],
              },
            ],
          },
        };
      return n < 4 ? pagina([{ idVehicle: n }], 2) : vazia;
    });
    const r = await puxar(
      opcoes(buscar, avisos),
      "vehicles",
      CORE,
      EXTRA,
      "idVehicle",
    );
    expect(r.itens.length).toBeGreaterThan(0);
    expect(avisos.join(" ")).toContain('"daysInStock"');
    // As consultas seguintes já não pedem o campo; km e yearModel continuam.
    const ultima = chamadas.at(-1)!.query;
    expect(ultima).not.toContain("daysInStock");
    expect(ultima).toContain("km yearModel");
  });

  it("400 com erro sem campo identificável: refaz só com os campos essenciais", async () => {
    const avisos: string[] = [];
    const { buscar, chamadas } = servidor((q, n) =>
      q.includes("yearModel")
        ? {
            status: 400,
            corpo: { errors: [{ message: "Erro qualquer de validação." }] },
          }
        : n < 4
          ? pagina([{ idVehicle: n }])
          : vazia,
    );
    const r = await puxar(
      opcoes(buscar, avisos),
      "vehicles",
      CORE,
      EXTRA,
      "idVehicle",
    );
    expect(r.itens.length).toBeGreaterThan(0);
    expect(chamadas.at(-1)!.query).not.toContain("yearModel");
    expect(avisos.join(" ")).toContain("essenciais");
  });

  it("400 sem JSON mostra o motivo e o status, sem vazar nada", async () => {
    const { buscar } = servidor(() => ({
      status: 400,
      corpo: "<html>Bad Request - token malformado</html>",
    }));
    await expect(
      puxar(opcoes(buscar), "vehicles", CORE, "", "idVehicle"),
    ).rejects.toThrow(/HTTP 400: <html>Bad Request - token malformado<\/html>/);
  });

  it("400 sem saída possível: erro com o status e a mensagem da API", async () => {
    const { buscar } = servidor(() => ({
      status: 400,
      corpo: { errors: [{ message: "Pagination invalid." }] },
    }));
    await expect(
      puxar(opcoes(buscar), "vehicles", CORE, "", "idVehicle"),
    ).rejects.toThrow(
      /recusou a consulta de vehicles \(HTTP 400\): Pagination invalid\./,
    );
  });

  it("não aceita seguir se o campo que identifica os registros sumiu", async () => {
    const { buscar } = servidor((q) => ({
      status: 400,
      corpo: {
        errors: [
          {
            message: 'Cannot query field "idVehicle" on type "V".',
            locations: [{ line: 1, column: q.indexOf("idVehicle") + 1 }],
          },
        ],
      },
    }));
    await expect(
      puxar(opcoes(buscar), "vehicles", CORE, "", "idVehicle"),
    ).rejects.toThrow(/não tem mais o campo "idVehicle"/);
  });

  it("não entra em laço: depois de muitas podas, desiste com a mensagem da API", async () => {
    let n = 0;
    const campos = Array.from({ length: 30 }, (_, i) => `c${i}`).join(" ");
    const { buscar, chamadas } = servidor((q) => {
      n++;
      const alvo = `c${n - 1}`;
      return {
        status: 400,
        corpo: {
          errors: [
            {
              message: `Cannot query field "${alvo}" on type "V".`,
              locations: [{ line: 1, column: q.indexOf(alvo) + 1 }],
            },
          ],
        },
      };
    });
    await expect(
      puxar(opcoes(buscar), "vehicles", "idVehicle", campos, "idVehicle"),
    ).rejects.toThrow();
    expect(chamadas.length).toBeLessThan(40);
  });
});

describe("sessão expirada no BNDV", () => {
  const api = (buscar: typeof fetch) => ({
    url: "https://exemplo.test/graphql",
    cabecalhos: {},
    buscar,
  });
  const expirada = servidor(() => ({
    status: 400,
    corpo: {
      errors: [
        {
          message:
            "Context creation failed: Authentication token is invalid, please log in",
        },
      ],
    },
  }));

  it("reconhece a mensagem do BNDV e os status 401/403", () => {
    expect(
      ehErroDeSessao(
        "Context creation failed: Authentication token is invalid, please log in",
        400,
      ),
    ).toBe(true);
    expect(ehErroDeSessao("Unauthorized", 401)).toBe(true);
    expect(ehErroDeSessao("qualquer", 403)).toBe(true);
    expect(ehErroDeSessao('Cannot query field "foo" on type "V".', 400)).toBe(
      false,
    );
    expect(ehErroDeSessao("Pagination invalid.", 400)).toBe(false);
  });

  it("consultar e puxar viram SessaoExpirada (e não tentam podar nem refazer)", async () => {
    await expect(
      consultar(api(expirada.buscar), "query { __typename }"),
    ).rejects.toBeInstanceOf(SessaoExpirada);
    await expect(
      puxar(api(expirada.buscar), "vehicles", "idVehicle", "km", "idVehicle"),
    ).rejects.toThrow(/sessão no BNDV expirou/);
    expect(expirada.chamadas.length).toBe(2);
  });

  it("um 401 sem corpo também é sessão expirada", async () => {
    const { buscar } = servidor(() => ({ status: 401, corpo: "" }));
    await expect(
      consultar(api(buscar), "query { __typename }"),
    ).rejects.toBeInstanceOf(SessaoExpirada);
  });

  it("consulta normal continua devolvendo os dados", async () => {
    const { buscar } = servidor(() => ({
      status: 200,
      corpo: { data: { __typename: "Query" } },
    }));
    const r = await consultar(api(buscar), "query { __typename }");
    expect(r.data).toEqual({ __typename: "Query" });
  });
});
