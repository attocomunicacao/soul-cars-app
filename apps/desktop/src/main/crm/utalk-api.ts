/**
 * Cliente somente-leitura da API do uTalk (Umbler), sem Electron para poder ser testado.
 * Chamadas de leitura com paginação e limite de simultâneas. Nada é alterado no CRM.
 */

import { buscarComRetentativa } from "../core/http-retry";

export const BASE_UTALK = "https://app-utalk.umbler.com/api";

export type Buscar = (url: string, init: RequestInit) => Promise<Response>;

export type Pagina<T> = { items?: T[]; page?: { totalItems?: number } };

export class ErroUtalk extends Error {}

export async function pedir<T>(
  buscar: Buscar,
  token: string,
  caminho: string,
  consulta: Record<string, string | string[]> = {},
): Promise<T> {
  const url = new URL(BASE_UTALK + caminho);
  for (const [k, v] of Object.entries(consulta))
    for (const item of Array.isArray(v) ? v : [v])
      url.searchParams.append(k, item);
  let r: Response | undefined;
  let falha: unknown;
  try {
    // Leitura: repete rede e 502/503/504 (até 3 chamadas no total) e espera o `Retry-After` em 429.
    r = await buscarComRetentativa(
      buscar,
      url.toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
      { timeoutMs: 30_000, tentativasTransitorias: 2, tentativas429: 3 },
    );
  } catch (e) {
    falha = e;
  }
  if (!r) {
    const nome = falha instanceof Error ? falha.name : "";
    throw new ErroUtalk(
      nome === "TimeoutError" || nome === "AbortError"
        ? "O uTalk demorou demais para responder. Tente de novo em instantes."
        : "Não consegui falar com o uTalk (tentei 3 vezes). Confira a internet, o firewall ou a VPN e tente de novo.",
    );
  }
  if (r.status === 401 || r.status === 403)
    throw new ErroUtalk(
      "O uTalk recusou o token. Gere outro em account.umbler.com/profile e cadastre de novo.",
    );
  if (r.status === 429)
    throw new ErroUtalk("O uTalk pediu para esperar. Tente em um minuto.");
  if (!r.ok) throw new ErroUtalk(`O uTalk respondeu com erro ${r.status}.`);
  return (await r.json()) as T;
}

/** Roda `fn` sobre os itens, com no máximo `limite` chamadas ao mesmo tempo. */
export async function emLotes<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) },
    async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        saida[i] = await fn(itens[i]);
      }
    },
  );
  await Promise.all(trabalhadores);
  return saida;
}

/** Organização do token: a primeira ativa de `GET /v1/members/me/`. */
export async function descobrirOrganizacao(buscar: Buscar, token: string) {
  const eu = await pedir<{
    organizations?: { id: string; name?: string; active?: boolean }[];
  }>(buscar, token, "/v1/members/me/");
  const orgs = eu.organizations ?? [];
  const org = orgs.find((o) => o.active !== false) ?? orgs[0];
  if (!org) throw new ErroUtalk("Este token não tem nenhuma organização.");
  return { id: org.id, nome: org.name ?? "" };
}
