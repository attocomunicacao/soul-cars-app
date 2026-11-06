/**
 * Testes (Vitest) de src/main/inventory/bndv-schema.ts (campos extras descobertos no GraphQL).
 */
import { describe, expect, it } from "vitest";
import {
  descobrirExtras,
  escolherCampos,
  selecaoDasEscolhas,
  textoDoValor,
  tipoBase,
  type CampoGql,
  type TipoGql,
} from "../src/main/inventory/bndv-schema";
import {
  podarCampoDoErro,
  removerCampoEm,
} from "../src/main/inventory/bndv-graphql";

const escalar = (nome: string): TipoGql => ({ kind: "SCALAR", name: nome });
const objeto = (nome: string): TipoGql => ({ kind: "OBJECT", name: nome });
const naoNulo = (t: TipoGql): TipoGql => ({
  kind: "NON_NULL",
  name: null,
  ofType: t,
});
const lista = (t: TipoGql): TipoGql => ({
  kind: "LIST",
  name: null,
  ofType: t,
});
const campo = (
  name: string,
  type: TipoGql,
  args: CampoGql["args"] = [],
): CampoGql => ({
  name,
  type,
  args,
});

describe("tipos do GraphQL", () => {
  it("tira NON_NULL e LIST e diz se era lista", () => {
    expect(tipoBase(naoNulo(lista(naoNulo(objeto("Foto")))))).toEqual({
      nome: "Foto",
      kind: "OBJECT",
      lista: true,
    });
    expect(tipoBase(escalar("Int"))).toEqual({
      nome: "Int",
      kind: "SCALAR",
      lista: false,
    });
  });
});

describe("escolha dos campos extras", () => {
  const veiculo: CampoGql[] = [
    campo("idVehicle", naoNulo(escalar("Int"))),
    campo("km", escalar("Int")),
    campo("color", objeto("Color")),
    campo("gearbox", escalar("String")),
    campo("fuel", objeto("Fuel")),
    campo("yearModel", escalar("Int")),
    campo("yearManufacture", escalar("Int")),
    campo("versionName", escalar("String")),
    campo("brand", objeto("Brand")),
  ];
  const tipos = {
    Color: [campo("id", escalar("Int")), campo("name", escalar("String"))],
    Fuel: [campo("description", escalar("String"))],
  };

  it("escolhe um campo por papel, entrando em objetos para achar o texto", () => {
    const e = escolherCampos(veiculo, tipos);
    expect(e.map((x) => [x.papel, x.campo, x.sub])).toEqual([
      ["km", "km", null],
      ["cor", "color", "name"],
      ["cambio", "gearbox", null],
      ["combustivel", "fuel", "description"],
      ["anoModelo", "yearModel", null],
      ["anoFab", "yearManufacture", null],
      ["versao", "versionName", null],
    ]);
    expect(selecaoDasEscolhas(e)).toBe(
      "x_km: km x_cor: color { name } x_cambio: gearbox x_combustivel: fuel { description } " +
        "x_anoModelo: yearModel x_anoFab: yearManufacture x_versao: versionName",
    );
  });

  it("ignora campo com argumento obrigatório, objeto sem texto e nome desconhecido", () => {
    const e = escolherCampos(
      [
        campo("km", escalar("Int"), [
          { name: "unidade", type: naoNulo(escalar("String")) },
        ]),
        campo("color", objeto("Color")),
        campo("quilometragemTotal", escalar("Int")),
      ],
      { Color: [campo("hex", escalar("String"))] },
    );
    expect(e).toEqual([]);
  });

  it("aceita argumento obrigatório que tem valor padrão", () => {
    const e = escolherCampos(
      [
        campo("km", escalar("Int"), [
          { name: "u", defaultValue: "1", type: naoNulo(escalar("Int")) },
        ]),
      ],
      {},
    );
    expect(e).toHaveLength(1);
  });
});

describe("valores devolvidos", () => {
  it("vira texto de qualquer formato razoável", () => {
    expect(textoDoValor(" Prata ")).toBe("Prata");
    expect(textoDoValor(82000)).toBe("82000");
    expect(textoDoValor({ name: "Flex" })).toBe("Flex");
    expect(
      textoDoValor([{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }]),
    ).toBe("https://x/a.jpg");
    expect(textoDoValor([null, { url: "" }, { title: "ok" }])).toBe("ok");
    expect(textoDoValor(null)).toBe("");
    expect(textoDoValor({})).toBe("");
  });
});

describe("poda de campo com apelido", () => {
  it("tira o apelido junto, sem deixar 'x_km:' solto", () => {
    const sel = "a x_km: km x_cor: color { name } b";
    expect(removerCampoEm(sel, sel.indexOf(": km") + 2)).toBe(
      "a x_cor: color { name } b",
    );
    expect(removerCampoEm(sel, sel.indexOf("name"))).toBe("a x_km: km b");
  });

  it("acha o campo real pela posição que o servidor informa", () => {
    const sel = "idVehicle x_km: km";
    const query = `query { v(p:1) { items { ${sel} } } }`;
    const r = podarCampoDoErro(query, sel, [
      {
        message: 'Cannot query field "km" on type "Vehicle".',
        locations: [{ line: 1, column: query.indexOf(": km") + 3 }],
      },
    ]);
    expect(r?.selecao).toBe("idVehicle");
  });
});

describe("descoberta pela introspecção", () => {
  const resposta = (corpo: unknown) =>
    ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(corpo),
    }) as Response;

  function servidor(rota: (query: string) => unknown) {
    const consultas: string[] = [];
    const buscar = (async (_u: string, init: { body: string }) => {
      const { query } = JSON.parse(init.body) as { query: string };
      consultas.push(query);
      return resposta(rota(query));
    }) as unknown as typeof fetch;
    return { buscar, consultas };
  }
  const api = (buscar: typeof fetch) => ({
    url: "https://api.test/graphql",
    cabecalhos: {},
    buscar,
  });

  it("percorre raiz → página → itens → objetos e devolve a seleção", async () => {
    const { buscar } = servidor((q) => {
      if (q.includes("__schema"))
        return {
          data: {
            __schema: {
              queryType: {
                fields: [
                  campo("vehicles_web_app", naoNulo(objeto("VehiclePage"))),
                ],
              },
            },
          },
        };
      if (q.includes('"VehiclePage"'))
        return {
          data: {
            __type: {
              fields: [
                campo("paginationOut", objeto("P")),
                campo("items", lista(objeto("Vehicle"))),
              ],
            },
          },
        };
      if (q.includes('"Vehicle"'))
        return {
          data: {
            __type: {
              fields: [
                campo("km", escalar("Int")),
                campo("color", objeto("Color")),
              ],
            },
          },
        };
      if (q.includes('"Color"'))
        return {
          data: { __type: { fields: [campo("name", escalar("String"))] } },
        };
      return { errors: [{ message: "inesperado" }] };
    });
    const d = await descobrirExtras(api(buscar), "vehicles_web_app");
    expect(d.erro).toBeUndefined();
    expect(d.tipoDosItens).toBe("Vehicle");
    expect(d.selecao).toBe("x_km: km x_cor: color { name }");
  });

  it("introspecção desligada ou resposta estranha: sem extras e sem lançar erro", async () => {
    const { buscar } = servidor(() => ({
      errors: [{ message: "GraphQL introspection is not allowed" }],
    }));
    const d = await descobrirExtras(api(buscar), "vehicles_web_app");
    expect(d.selecao).toBe("");
    expect(d.erro).toMatch(/introspection/);

    const sem = servidor(() => ({
      data: { __schema: { queryType: { fields: [] } } },
    }));
    expect(
      (await descobrirExtras(api(sem.buscar), "vehicles_web_app")).erro,
    ).toMatch(/não descreve/);
  });
});
