/**
 * Cliente somente-leitura da API do uTalk (Umbler) para o módulo CRM · Leads, vindo do
 * Soul APP: respeita o limite da API (100 pedidos a cada 5 s; usamos 80), tenta de novo em
 * falha de rede ou 429 e percorre a paginação. Nada é alterado no CRM. Sem Electron: o
 * `fetch` é injetado para os testes.
 */
import { BASE_UTALK, type Buscar } from "./utalk-api";

const MAX_PEDIDOS = 80;
const JANELA_MS = 5000;

/** Erro da API com o status HTTP (0 = sem conexão). */
export class ErroApiUmbler extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

type Consulta = Record<
  string,
  string | number | boolean | string[] | undefined | null
>;
type PaginaApi<T> = { items?: T[]; page?: { maxTake?: number } };

/** Cliente com limite de taxa (uma instância por sincronização). */
export class ClienteUmbler {
  private enviados: number[] = [];
  constructor(
    private buscar: Buscar,
    private token: string,
    private esperar = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  private async segurar() {
    for (;;) {
      const agora = Date.now();
      this.enviados = this.enviados.filter((t) => agora - t < JANELA_MS);
      if (this.enviados.length < MAX_PEDIDOS) break;
      await this.esperar(JANELA_MS - (agora - this.enviados[0]) + 20);
    }
    this.enviados.push(Date.now());
  }

  /** GET com novas tentativas (rede: 2; limite 429: 4). */
  async get<T>(
    caminho: string,
    consulta: Consulta = {},
    tentativa = 0,
  ): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(consulta)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else qs.append(k, String(v));
    }
    await this.segurar();
    const url = `${BASE_UTALK}${caminho}${qs.toString() ? `?${qs}` : ""}`;
    let res: Response;
    try {
      res = await this.buscar(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      if (tentativa < 2) return this.get(caminho, consulta, tentativa + 1);
      throw new ErroApiUmbler(
        0,
        `Sem conexão com o uTalk (${(e as Error).message})`,
      );
    }
    if (res.status === 429 && tentativa < 4) {
      await this.esperar(2000 * (tentativa + 1));
      return this.get(caminho, consulta, tentativa + 1);
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403)
        throw new ErroApiUmbler(
          res.status,
          "Token do uTalk inválido ou sem permissão. Confira em Configurações.",
        );
      const corpo = await res.text().catch(() => "");
      throw new ErroApiUmbler(
        res.status,
        `Erro ${res.status} em ${caminho}: ${corpo.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }

  /** Percorre todas as páginas; `parar(item)` interrompe (janelas de data). */
  async todasAsPaginas<T>(
    caminho: string,
    consulta: Consulta = {},
    {
      parar,
      limite = 100_000,
    }: { parar?: (item: T) => boolean; limite?: number } = {},
  ): Promise<T[]> {
    const saida: T[] = [];
    let take = 50;
    let skip = 0;
    for (;;) {
      const dados = await this.get<PaginaApi<T>>(caminho, {
        ...consulta,
        Skip: skip,
        Take: take,
      });
      const itens = dados.items ?? [];
      let fim = false;
      for (const it of itens) {
        if (parar?.(it)) {
          fim = true;
          break;
        }
        saida.push(it);
      }
      if (fim || itens.length < take || saida.length >= limite) break;
      skip += itens.length;
      const max = dados.page?.maxTake;
      if (max && max > take) take = Math.min(max, 250);
    }
    return saida;
  }
}
