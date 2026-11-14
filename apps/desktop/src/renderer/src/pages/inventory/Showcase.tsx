/**
 * Vitrine do estoque atual: um cartão por veículo em estoque (foto grande, preço em
 * destaque e ficha técnica resumida), com atalho para a ficha no Studio.
 */
import { Icon } from "../../app/icons";
import { useEffect, useMemo, useState } from "react";
import type { CartaoVitrine } from "../../../../shared/showcase";
import { invoke } from "../../lib/desktop-bridge";
import { moeda } from "../../lib/format";
import type { Veiculo } from "../../lib/database";

const km = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR") + " km";

/** Estoque atual em cartões: foto, preço, dados principais e botão para a ficha. */
export function Showcase({
  lista,
  abrir,
}: {
  lista: Veiculo[];
  abrir: (v: Veiculo) => void;
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
        <label className="search">
          <Icon nome="busca" />
          <input
            aria-label="Buscar na vitrine"
            placeholder="Buscar marca, modelo, placa ou cor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
      </div>
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
              <div className="vitrine-foto">
                {c.foto ? (
                  <img alt={`${c.marca} ${c.modelo}`} src={c.foto} />
                ) : (
                  <span>Sem foto</span>
                )}
                <em>{c.consignado ? "Consignado" : "Estoque"}</em>
              </div>
              <div className="vitrine-info">
                <h3>
                  {c.marca} {c.modelo}
                </h3>
                <small className="vitrine-versao">
                  {c.detalhes.versao ?? " "}
                </small>
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
                <div>
                  <div
                    className="vitrine-preco"
                    title="Preço de tabela no BNDV"
                  >
                    {moeda(c.tabela)}
                  </div>
                  {c.dias != null && (
                    <small className="vitrine-dias">
                      {c.dias === 0
                        ? "Entrou hoje"
                        : `${c.dias} ${c.dias === 1 ? "dia" : "dias"} em estoque`}
                    </small>
                  )}
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
                  Abrir ficha
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
