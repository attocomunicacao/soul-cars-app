/**
 * Testes (Vitest) de src/main/crm/utalk-api.ts (cliente somente leitura do uTalk): organização do
 * token e mensagem clara quando o uTalk recusa o token.
 */
import { describe, expect, it } from "vitest";
import { descobrirOrganizacao, type Buscar } from "../src/main/crm/utalk-api";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status });

describe("cliente do uTalk", () => {
  it("descobre a organização ativa do token", async () => {
    const buscar: Buscar = async () =>
      resposta({
        organizations: [
          { id: "A", name: "Antiga", active: false },
          { id: "B", name: "SOUL Cars", active: true },
        ],
      });
    expect(await descobrirOrganizacao(buscar, "t")).toEqual({
      id: "B",
      nome: "SOUL Cars",
    });
  });

  it("explica quando o token é recusado", async () => {
    const buscar: Buscar = async () => resposta({}, 401);
    await expect(descobrirOrganizacao(buscar, "ruim")).rejects.toThrow(
      /recusou o token/,
    );
  });

  it("avisa quando o token não tem organização", async () => {
    const buscar: Buscar = async () => resposta({ organizations: [] });
    await expect(descobrirOrganizacao(buscar, "t")).rejects.toThrow(
      /nenhuma organização/,
    );
  });
});
