/**
 * Vitrine do estoque atual: um cartão por veículo em estoque (foto, preço, km), no estilo
 * da lista do BNDV, com atalho para a ficha.
 */
import { useEffect, useMemo, useState } from "react";
import type { CartaoVitrine } from "../../../../shared/showcase";
import { invoke } from "../../lib/desktop-bridge";
import { moeda } from "../../lib/format";
import type { Veiculo } from "../../lib/database";

const km = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR") + " km";

/** Estoque atual em cartões, no estilo da lista do BNDV. */
export function Showcase({
  lista,
  abrir,
  voltar,
}: {
  lista: Veiculo[];
  abrir: (v: Veiculo) => void;
  voltar: () => void;
}) {
  const [cartoes, setCartoes] = useState<CartaoVitrine[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    invoke<CartaoVitrine[]>("estoque_vitrine")
      .then((c) => ativo && setCartoes(c))
      .catch((e) => ativo && setErro(String(e)));
    return () => {
      ativo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo || !cartoes) return cartoes ?? [];
    return cartoes.filter((c) =>
      [c.marca, c.modelo, c.placa, c.detalhes.versao, c.detalhes.cor]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [cartoes, busca]);

  return (
    <section className="panel vitrine">
      <div className="actions">
        <h2>
          Estoque atual
          {cartoes && (
            <span className="vitrine-total"> · {cartoes.length}</span>
          )}
        </h2>
        <button onClick={voltar}>← Voltar ao estoque</button>
      </div>
      <input
        className="vitrine-busca"
        placeholder="Buscar marca, modelo, placa ou cor"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {erro && (
        <div role="alert" className="notice error">
          {erro}
        </div>
      )}
      {!cartoes && !erro && <p className="empty">Carregando o estoque…</p>}
      {cartoes && !filtrados.length && (
        <p className="empty">
          {cartoes.length
            ? "Nenhum veículo encontrado nessa busca."
            : "Nenhum veículo em estoque. Clique em Atualizar BNDV."}
        </p>
      )}
      <div className="vitrine-grade">
        {filtrados.map((c) => {
          const ficha = lista.find((v) => v.id === c.estudio?.id) ?? null;
          const detalhes: [string, string][] = [
            ["Placa", c.placa || "—"],
            ["Quilometragem", km(c.detalhes.km)],
            ["Cor", c.detalhes.cor ?? "—"],
            ["Câmbio", c.detalhes.cambio ?? "—"],
            ["Combustível", c.detalhes.combustivel ?? "—"],
            ["Ano", c.detalhes.ano ?? "—"],
          ];
          return (
            <article key={c.idBndv} className="vitrine-cartao">
              <header>
                <h3>
                  {c.marca} <span>{c.modelo}</span>
                </h3>
                <em>{c.consignado ? "CONSIGNADO" : "ESTOQUE"}</em>
              </header>
              <small className="vitrine-versao">
                {c.detalhes.versao ?? " "}
              </small>
              <div className="vitrine-corpo">
                <div className="vitrine-foto">
                  {c.foto ? (
                    <img alt={`${c.marca} ${c.modelo}`} src={c.foto} />
                  ) : (
                    <span>Sem foto</span>
                  )}
                </div>
                <dl>
                  {detalhes.map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt>{rotulo}</dt>
                      <dd>{valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <footer>
                <div className="vitrine-preco" title="Preço de tabela no BNDV">
                  {moeda(c.tabela)}
                </div>
                <button
                  className="primary"
                  disabled={!ficha}
                  title={
                    ficha
                      ? "Abrir a ficha no Studio"
                      : "Clique em Reler pastas para criar a ficha deste veículo"
                  }
                  onClick={() => ficha && abrir(ficha)}
                >
                  Abrir no Studio →
                </button>
              </footer>
              {c.dias != null && (
                <small className="vitrine-dias">
                  {c.dias === 0
                    ? "Entrou hoje"
                    : `${c.dias} ${c.dias === 1 ? "dia" : "dias"} em estoque`}
                </small>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
