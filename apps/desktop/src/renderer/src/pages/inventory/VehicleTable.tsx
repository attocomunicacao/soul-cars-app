/**
 * Lista "Veículos nas pastas" da página Estoque.
 *
 *  - Busca por nome, placa, versão ou ano.
 *  - Chave "BNDV": mostra só os veículos em estoque no BNDV (mesma lista da vitrine,
 *    comando `estoque_vitrine`), casando por pasta, id do Studio ou placa.
 *  - Selos de produção (fotos, vídeo, documento) de cada pasta, relidos a cada 15 s.
 *  - A linha inteira abre a ficha (Studio); o botão de pasta abre o Explorador.
 */
import { Icon } from "../../app/icons";
import { useEffect, useState } from "react";
import { cartaoDaFicha, type CartaoVitrine } from "../../../../shared/showcase";
import type { Veiculo } from "../../lib/database";
import { invoke, openPath } from "../../lib/desktop-bridge";
import { moedaCentavos } from "../../lib/format";
import {
  statusProducao,
  type StatusProducao,
} from "../../lib/production-status";

/** Selos ✓/✗ de fotos, vídeo e documento de um veículo. */
function ProductionBadges({ status }: { status?: StatusProducao }) {
  if (!status) return null;
  const itens: [string, boolean, string][] = [
    [
      "Fotos",
      status.fotos.length > 0,
      status.fotos.length
        ? `${status.fotos.length} foto(s) na pasta`
        : "Sem fotos",
    ],
    [
      "Vídeo",
      !!(status.video_bruto || status.video_final),
      status.video_final
        ? "Vídeo final gerado"
        : status.video_bruto
          ? "Vídeo bruto na pasta"
          : "Sem vídeo",
    ],
    [
      "Documento",
      status.doc_pdf,
      status.doc_pdf ? "PDF do documento na pasta" : "Sem documento",
    ],
  ];
  return (
    <span className="selos-anexos">
      {itens.map(([nome, ok, dica]) => (
        <span
          key={nome}
          className={ok ? "selo ok" : "selo falta"}
          title={dica}
          aria-label={`${nome}: ${ok ? "sim" : "não"}`}
        >
          {nome}
        </span>
      ))}
    </span>
  );
}

/** Lê a situação de produção de cada pasta agora e a cada 15 s (limpa o timer ao sair). */
function useStatusDasPastas(lista: Veiculo[], ativo: boolean) {
  const [anexos, setAnexos] = useState<Record<string, StatusProducao>>({});
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const ler = async () => {
      const pastas = lista.map((v) => v.pasta).filter((p): p is string => !!p);
      const lidos = await Promise.all(
        pastas.map((p) =>
          statusProducao(p)
            .then((s) => [p, s] as const)
            .catch(() => null),
        ),
      );
      if (!vivo) return;
      setAnexos(
        Object.fromEntries(
          lidos.filter((l): l is [string, StatusProducao] => !!l),
        ),
      );
    };
    void ler();
    const timer = setInterval(() => void ler(), 15_000);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [lista, ativo]);
  return anexos;
}

type Props = {
  /** Veículos lidos das pastas (importarEstoque). */
  lista: Veiculo[];
  /** Abre a ficha do veículo (Studio). */
  abrirFicha: (veiculo: Veiculo) => void;
  /** Mostra um erro de operação no aviso do app. */
  aoErro: (mensagem: string) => void;
};

export function VehicleTable({ lista, abrirFicha, aoErro }: Props) {
  const [busca, setBusca] = useState("");
  const anexos = useStatusDasPastas(lista, true);

  // Filtro "só em estoque no BNDV": usa a mesma lista da vitrine (veículos não vendidos).
  const [soEstoque, setSoEstoque] = useState(true);
  const [noEstoque, setNoEstoque] = useState<CartaoVitrine[] | null>(null);
  useEffect(() => {
    if (!soEstoque) return;
    let ativo = true;
    invoke<CartaoVitrine[]>("estoque_vitrine")
      .then((c) => ativo && setNoEstoque(c))
      .catch((e) => {
        if (!ativo) return;
        aoErro(String(e));
        setSoEstoque(false);
      });
    return () => {
      ativo = false;
    };
  }, [soEstoque, lista, aoErro]);

  const emEstoque = (v: Veiculo) =>
    !!noEstoque && !!cartaoDaFicha(noEstoque, v);
  const filtrados = lista
    .filter((v) => !soEstoque || !noEstoque || emEstoque(v))
    .filter((v) =>
      [v.nome, v.placa, v.versao, v.ano]
        .join(" ")
        .toLowerCase()
        .includes(busca.toLowerCase()),
    );

  return (
    <section className="panel">
      <div className="actions">
        <h2>
          Veículos nas pastas
          <span className="vitrine-total"> · {filtrados.length}</span>
        </h2>
        <label className="search">
          <Icon nome="busca" />
          <input
            aria-label="Buscar veículo"
            placeholder="Buscar nome, placa ou versão"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <button
          role="switch"
          aria-checked={soEstoque}
          className={soEstoque ? "chave ligada" : "chave"}
          title="Mostra só os veículos que estão em estoque no BNDV (não vendidos)"
          onClick={() => setSoEstoque(!soEstoque)}
        >
          <span className="chave-trilho" aria-hidden="true" />
          Só em estoque
        </button>
      </div>
      <table className="tabela-veiculos">
        <thead>
          <tr>
            <th>Veículo</th>
            <th>Placa</th>
            <th>Ano</th>
            <th>Preço</th>
            <th>Produção</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((v) => (
            <tr
              key={v.id}
              className="clicavel"
              tabIndex={0}
              title="Abrir a ficha deste veículo"
              onClick={() => abrirFicha(v)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && e.key === "Enter")
                  abrirFicha(v);
              }}
            >
              <td>
                <strong>{v.nome}</strong>
                {v.versao && <small>{v.versao}</small>}
              </td>
              <td className="num">{v.placa || "—"}</td>
              <td className="num">{v.ano || "—"}</td>
              <td className="num">
                {v.preco == null ? "—" : moedaCentavos(v.preco)}
              </td>
              <td>
                <div className="producao-linha">
                  <span className="badge">{v.status}</span>
                  <ProductionBadges
                    status={v.pasta ? anexos[v.pasta] : undefined}
                  />
                </div>
              </td>
              <td>
                <div className="acoes-linha">
                  <button
                    className="plain small"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirFicha(v);
                    }}
                  >
                    Abrir ficha
                    <Icon nome="seta" />
                  </button>
                  <button
                    className="plain small icon-only"
                    disabled={!v.pasta}
                    aria-label="Abrir pasta"
                    title={
                      v.pasta
                        ? "Abre a pasta do veículo no Explorador de Arquivos"
                        : "Veículo sem pasta vinculada"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      aoErro("");
                      openPath(v.pasta!).catch((err) => aoErro(String(err)));
                    }}
                  >
                    <Icon nome="pasta" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filtrados.length && (
        <div className="empty">
          <h3>Nenhum veículo encontrado</h3>
          <p>
            {busca
              ? "Nenhum veículo combina com essa busca."
              : "Atualize o BNDV ou escolha, nas Configurações, a pasta que contém ESTOQUE."}
          </p>
        </div>
      )}
    </section>
  );
}
