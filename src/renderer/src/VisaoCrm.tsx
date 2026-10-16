import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  classificarEtiqueta,
  demandaPorModelo,
  emEstoque,
  ETAPAS,
  textoLimpo,
  type VeiculoEstoque,
} from "../../compartilhado/crm-etiquetas";
import type { CartaoVitrine } from "../../compartilhado/vitrine";
import { invoke } from "./lib/desktop";
import {
  CartoesDesempenho,
  PaineisDesempenho,
  SemMemoria,
  useDesempenho,
} from "./DesempenhoLeads";
import { haQuanto } from "./lib/tempo";

type Contagem = {
  id: string;
  nome: string;
  emoji: string | null;
  leads: number;
};
type Lead = {
  id: string;
  nome: string;
  desde: string | null;
  etiquetas: string[];
};
type Visao = {
  organizacao: string;
  atualizadoEm: string;
  totalLeads: number;
  emAtendimento: number | null;
  conversasNovas7d: number;
  conversasAbertas: number;
  aguardando: number;
  etiquetas: Contagem[];
  listaAguardando: Lead[];
  listaQuentes: Lead[];
};

const mensagem = (e: unknown) => String(e instanceof Error ? e.message : e);

function Cartao({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: number | null;
  tom?: "alerta" | "quente" | "frio" | "bom";
}) {
  return (
    <div className={`cartao-crm ${tom ?? ""}`}>
      <b>{valor === null ? "—" : valor}</b>
      <span>{rotulo}</span>
    </div>
  );
}

export type ItemBarra = { rotulo: string; valor: number; extra?: string };

/** Barras horizontais simples; a maior ocupa a largura toda. */
export function Barras({ itens }: { itens: ItemBarra[] }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="barras-crm">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <span className="barra-rotulo" title={i.rotulo}>
            {i.rotulo}
          </span>
          <span className="barra-trilho">
            <span
              className="barra-cheia"
              style={{ width: `${(i.valor / maximo) * 100}%` }}
            />
          </span>
          <span className="barra-valor">
            {i.valor}
            {i.extra ? <small> {i.extra}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ListaLeads({
  titulo,
  vazio,
  leads,
  rotuloTempo,
}: {
  titulo: string;
  vazio: string;
  leads: Lead[];
  rotuloTempo: string;
}) {
  return (
    <section className="panel">
      <h2>{titulo}</h2>
      {leads.length === 0 ? (
        <p>{vazio}</p>
      ) : (
        <ul className="lista-leads">
          {leads.map((l) => (
            <li key={l.id}>
              <span className="lead-nome">{l.nome}</span>
              <span className="lead-etiquetas">
                {l.etiquetas.slice(0, 3).join(" · ")}
              </span>
              <span className="lead-tempo" title={rotuloTempo}>
                {haQuanto(l.desde)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Dashboards do CRM em página própria, a partir das etiquetas do uTalk da loja: situação geral, funil de
 * atendimento, demanda por carro (cruzada com o estoque) e quem espera resposta. O token é cadastrado aqui e
 * fica cifrado no computador; a interface nunca o recebe de volta.
 */
export function VisaoCrm({
  aoErro,
  irParaMemoria,
}: {
  aoErro: (mensagem: string) => void;
  irParaMemoria: () => void;
}) {
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [visao, setVisao] = useState<Visao | null>(null);
  const [estoque, setEstoque] = useState<VeiculoEstoque[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [soSemEstoque, setSoSemEstoque] = useState(false);
  const vivo = useRef(true);
  const desempenho = useDesempenho(aoErro);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const atualizar = useCallback(async () => {
    setCarregando(true);
    try {
      const v = await invoke<Visao>("utalk_visao");
      if (vivo.current) setVisao(v);
    } catch (e) {
      if (vivo.current) aoErro(mensagem(e));
    } finally {
      if (vivo.current) setCarregando(false);
    }
    // O estoque é só um complemento: se falhar, a demanda aparece sem a coluna.
    invoke<CartaoVitrine[]>("estoque_vitrine")
      .then((cartoes) => {
        if (!vivo.current) return;
        setEstoque(
          cartoes.map((c) => ({
            marca: c.marca,
            modelo: c.modelo,
            ano: c.detalhes.ano,
          })),
        );
      })
      .catch(() => {
        if (vivo.current) setEstoque(null);
      });
  }, [aoErro]);

  useEffect(() => {
    invoke<{ configurado: boolean }>("utalk_estado")
      .then((e) => {
        if (!vivo.current) return;
        setConfigurado(e.configurado);
        if (e.configurado) void atualizar();
      })
      .catch((e) => aoErro(String(e)));
  }, [atualizar, aoErro]);

  async function salvar() {
    try {
      await invoke("utalk_token_salvar", { token });
      setToken("");
      setConfigurado(true);
      await atualizar();
    } catch (e) {
      aoErro(mensagem(e));
    }
  }

  async function remover() {
    try {
      await invoke("utalk_token_remover");
      setConfigurado(false);
      setVisao(null);
    } catch (e) {
      aoErro(String(e));
    }
  }

  /** Total de leads por tipo de etiqueta (etapas, encerrados, temperatura). */
  const totais = useMemo(() => {
    const porChave = new Map<string, number>();
    for (const e of visao?.etiquetas ?? []) {
      const c = classificarEtiqueta(e.nome, e.emoji);
      if (c.tipo === "outra" || c.tipo === "veiculo") continue;
      const k = `${c.tipo}:${c.chave}`;
      porChave.set(k, (porChave.get(k) ?? 0) + e.leads);
    }
    return (tipo: string, chave: string) =>
      porChave.get(`${tipo}:${chave}`) ?? null;
  }, [visao]);

  const demanda = useMemo(
    () => demandaPorModelo(visao?.etiquetas ?? []),
    [visao],
  );

  const linhas = useMemo(() => {
    const q = textoLimpo(busca);
    return demanda
      .map((d) => ({
        ...d,
        emEstoque: estoque ? emEstoque(d.modelo, null, estoque) : null,
      }))
      .filter((d) => !q || d.modelo.includes(q))
      .filter((d) => !soSemEstoque || d.emEstoque === 0);
  }, [demanda, estoque, busca, soSemEstoque]);

  const semEstoque = useMemo(
    () =>
      estoque
        ? demanda
            .filter((d) => emEstoque(d.modelo, null, estoque) === 0)
            .slice(0, 8)
        : [],
    [demanda, estoque],
  );

  if (configurado === null) return null;

  if (!configurado)
    return (
      <section className="panel">
        <h2>Conectar ao uTalk</h2>
        <p>
          Cole o token gerado em account.umbler.com/profile. Ele fica só neste
          computador, cifrado, e o app só lê os dados (não altera nada no CRM).
        </p>
        <label>
          Token do uTalk
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="primary"
          disabled={token.trim().length < 10}
          onClick={salvar}
        >
          Salvar token
        </button>
      </section>
    );

  const funil: ItemBarra[] = ETAPAS.map((e) => ({
    rotulo: e.rotulo,
    valor: totais("etapa", e.chave) ?? 0,
  }));

  return (
    <div className="painel-leads">
      <div className="acoes-linha">
        <button disabled={carregando} onClick={() => void atualizar()}>
          {carregando ? "Contando…" : "Atualizar"}
        </button>
        <button onClick={remover}>Trocar token</button>
        {visao && (
          <small>
            {visao.organizacao} · atualizado às{" "}
            {new Date(visao.atualizadoEm).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        )}
      </div>

      {carregando && !visao && (
        <p>Contando as etiquetas… (pode levar alguns segundos)</p>
      )}

      {visao && (
        <>
          <div className="grupo-kpi">
            <h3 className="rotulo-grupo">Leads</h3>
            <div className="cartoes-crm">
              <Cartao rotulo="leads no total" valor={visao.totalLeads} />
              <Cartao
                rotulo="em atendimento (sem finalizado/desqualificado)"
                valor={visao.emAtendimento}
              />
              <Cartao
                rotulo="aguardando sua resposta"
                valor={visao.aguardando}
                tom={visao.aguardando > 0 ? "alerta" : undefined}
              />
              <Cartao
                rotulo="leads quentes"
                valor={totais("temperatura", "quente")}
                tom="quente"
              />
              <Cartao
                rotulo="vendidos"
                valor={totais("etapa", "vendido")}
                tom="bom"
              />
            </div>
          </div>
          {desempenho && <CartoesDesempenho dados={desempenho} />}

          <div className="grade-crm">
            <section className="panel">
              <h2>Funil de atendimento</h2>
              <p className="dica-crm">
                Quantos leads têm cada etapa (o lead pode ter mais de uma
                etiqueta).
              </p>
              <Barras itens={funil} />
              <h3>Temperatura</h3>
              <Barras
                itens={[
                  {
                    rotulo: "Quente",
                    valor: totais("temperatura", "quente") ?? 0,
                  },
                  {
                    rotulo: "Frio",
                    valor: totais("temperatura", "frio") ?? 0,
                  },
                ]}
              />
              <h3>Encerrados</h3>
              <Barras
                itens={[
                  {
                    rotulo: "Finalizado",
                    valor: totais("encerrado", "finalizado") ?? 0,
                  },
                  {
                    rotulo: "Desqualificado",
                    valor: totais("encerrado", "desqualificado") ?? 0,
                  },
                ]}
              />
            </section>

            <section className="panel">
              <h2>Carros mais procurados</h2>
              <p className="dica-crm">
                Leads por modelo (todos os anos somados).
              </p>
              <Barras
                itens={demanda.slice(0, 12).map((d) => ({
                  rotulo: d.modelo,
                  valor: d.leads,
                }))}
              />
              {semEstoque.length > 0 && (
                <>
                  <h3>Procurados e sem estoque agora</h3>
                  <p className="dica-crm">
                    {semEstoque
                      .map((d) => `${d.modelo} (${d.leads})`)
                      .join(" · ")}
                  </p>
                </>
              )}
            </section>
          </div>

          {desempenho ? (
            <PaineisDesempenho dados={desempenho} />
          ) : (
            desempenho === null && <SemMemoria irParaMemoria={irParaMemoria} />
          )}

          <section className="panel">
            <h2>Demanda por carro</h2>
            <div className="acoes-linha">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar modelo (ex.: FIESTA)"
              />
              {estoque && (
                <label className="marcar-crm">
                  <input
                    type="checkbox"
                    checked={soSemEstoque}
                    onChange={(e) => setSoSemEstoque(e.target.checked)}
                  />
                  Só os sem estoque
                </label>
              )}
            </div>
            <table className="tabela-etiquetas">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Leads</th>
                  <th>Por ano</th>
                  <th>Em estoque</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((d) => (
                  <tr key={d.modelo}>
                    <td>{d.modelo}</td>
                    <td>{d.leads}</td>
                    <td className="anos-crm">
                      {d.anos
                        .map((a) => `${a.ano ?? "s/ ano"}: ${a.leads}`)
                        .join(" · ")}
                    </td>
                    <td>{d.emEstoque === null ? "—" : d.emEstoque}</td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={4}>Nenhum carro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <div className="grade-crm">
            <ListaLeads
              titulo="Esperando sua resposta (mais antigos primeiro)"
              vazio="Nenhuma conversa esperando resposta."
              leads={visao.listaAguardando}
              rotuloTempo="Tempo desde a última mensagem do cliente"
            />
            <ListaLeads
              titulo="Leads quentes (atividade mais recente primeiro)"
              vazio={
                totais("temperatura", "quente") === null
                  ? "Não achei a etiqueta QUENTE no uTalk."
                  : "Nenhum lead com a etiqueta QUENTE."
              }
              leads={visao.listaQuentes}
              rotuloTempo="Tempo desde a última atividade do lead"
            />
          </div>
        </>
      )}
    </div>
  );
}
