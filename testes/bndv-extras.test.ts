import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  descobrirExtras,
  escolherCampos,
  selecaoDasEscolhas,
  textoDoValor,
  tipoBase,
  type CampoGql,
  type TipoGql,
} from "../src/main/estoque/bndv-esquema";
import { baixarFotosBndv, fotoBaixada } from "../src/main/estoque/bndv-fotos";
import { podarCampoDoErro, removerCampoEm } from "../src/main/estoque/graphql";

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
    campo("photos", lista(objeto("Photo"))),
    campo("brand", objeto("Brand")),
  ];
  const tipos = {
    Color: [campo("id", escalar("Int")), campo("name", escalar("String"))],
    Fuel: [campo("description", escalar("String"))],
    Photo: [campo("id", escalar("Int")), campo("url", escalar("String"))],
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
      ["foto", "photos", "url"],
    ]);
    expect(selecaoDasEscolhas(e)).toBe(
      "x_km: km x_cor: color { name } x_cambio: gearbox x_combustivel: fuel { description } " +
        "x_anoModelo: yearModel x_anoFab: yearManufacture x_versao: versionName x_foto: photos { url }",
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

describe("fotos do BNDV", () => {
  let pasta: string;
  beforeEach(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "soul-fotos-"));
  });
  afterEach(() => fs.rmSync(pasta, { recursive: true, force: true }));

  const foto = (tipo: string, bytes = 10, status = 200) =>
    ({
      ok: status === 200,
      status,
      headers: new Headers({
        "content-type": tipo,
        "content-length": String(bytes),
      }),
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    }) as unknown as Response;

  it("baixa uma vez por URL, troca a foto quando a URL muda e só aceita https e imagem", async () => {
    const chamadas: string[] = [];
    const buscar = (async (url: string) => {
      chamadas.push(url);
      return url.includes("/texto") ? foto("text/html") : foto("image/jpeg");
    }) as unknown as typeof fetch;
    const base = {
      pasta,
      urlDaApi: "https://api.test/graphql",
      cabecalhos: {},
      buscar,
    };
    const itens = [
      { idVehicle: 1, active: true, u: "https://cdn.test/a.jpg" },
      { idVehicle: 2, active: true, u: "http://inseguro.test/b.jpg" },
      { idVehicle: 3, active: true, u: "https://cdn.test/texto" },
      { idVehicle: 4, active: false, u: "https://cdn.test/d.jpg" },
    ];
    const urlDe = (i: Record<string, unknown>) => String(i.u);
    const r = await baixarFotosBndv(itens, urlDe, base);
    expect(r).toEqual({ baixadas: 1, falhas: 1 });
    expect(fotoBaixada(pasta, "1")).toMatch(/1-[0-9a-f]{8}\.jpg$/);
    expect(fotoBaixada(pasta, "2")).toBeNull();
    expect(fotoBaixada(pasta, "4")).toBeNull();

    // Mesma URL: não baixa de novo.
    const antes = chamadas.length;
    await baixarFotosBndv([itens[0]], urlDe, base);
    expect(chamadas.length).toBe(antes);

    // URL nova: baixa e apaga a antiga.
    const velha = fotoBaixada(pasta, "1")!;
    await baixarFotosBndv(
      [{ ...itens[0], u: "https://cdn.test/a2.jpg" }],
      urlDe,
      base,
    );
    const nova = fotoBaixada(pasta, "1")!;
    expect(nova).not.toBe(velha);
    expect(fs.existsSync(velha)).toBe(false);
    expect(
      fs.readdirSync(pasta).filter((n) => n.startsWith("1-")),
    ).toHaveLength(1);
  });

  it("só manda o token ao mesmo servidor da API, e só depois de um 401", async () => {
    const vistos: { url: string; auth: string | undefined }[] = [];
    const buscar = (async (
      url: string,
      init: { headers?: Record<string, string> },
    ) => {
      const auth = init.headers?.Authorization;
      vistos.push({ url, auth });
      return url.startsWith("https://api.test") && !auth
        ? foto("image/png", 5, 401)
        : foto("image/png");
    }) as unknown as typeof fetch;
    const base = {
      pasta,
      urlDaApi: "https://api.test/graphql",
      cabecalhos: { Authorization: "Bearer segredo" },
      buscar,
    };
    const urlDe = (i: Record<string, unknown>) => String(i.u);
    await baixarFotosBndv(
      [
        { idVehicle: 1, active: true, u: "https://api.test/img/1.png" },
        { idVehicle: 2, active: true, u: "https://outro.test/2.png" },
      ],
      urlDe,
      base,
    );
    expect(
      vistos.filter((v) => v.url.includes("api.test")).map((v) => !!v.auth),
    ).toEqual([false, true]);
    expect(
      vistos.filter((v) => v.url.includes("outro.test")).map((v) => v.auth),
    ).toEqual([undefined]);
  });

  it("recusa arquivo grande demais", async () => {
    const buscar = (async () =>
      foto("image/jpeg", 9 * 1024 * 1024)) as unknown as typeof fetch;
    const r = await baixarFotosBndv(
      [{ idVehicle: 1, active: true, u: "https://cdn.test/grande.jpg" }],
      (i) => String(i.u),
      { pasta, urlDaApi: "https://api.test/graphql", cabecalhos: {}, buscar },
    );
    expect(r.baixadas).toBe(0);
    expect(r.falhas).toBe(1);
  });
});
