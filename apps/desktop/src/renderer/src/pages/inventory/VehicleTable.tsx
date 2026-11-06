/**
 * Lista "Veículos nas pastas" da página Estoque.
 *
 *  - Busca por nome, placa, versão ou ano.
 *  - Chave "BNDV": mostra só os veículos em estoque no BNDV (mesma lista da vitrine,
 *    comando `estoque_vitrine`), casando por pasta, id do Studio ou placa.
 *  - Selos de produção (fotos, vídeo, documento) de cada pasta, relidos a cada 15 s.
 *  - Ações por linha: abrir a ficha (Studio) ou a pasta no Explorador.
 */
import { useEffect, useState } from "react";
import type { CartaoVitrine } from "../../../../shared/showcase";
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
        <span key={nome} className={ok ? "selo ok" : "selo falta"} title={dica}>
          {ok ? "✓" : "✗"} {nome}
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
    !!noEstoque?.some(
      (c) =>
        (v.pasta && c.pasta === v.pasta) ||
        (c.estudio && c.estudio.id === v.id) ||
        (!!c.placa &&
          (v.placa ?? "").trim().toUpperCase() === c.placa.toUpperCase()),
    );
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
        <h2>Veículos nas pastas</h2>
        <button
          role="switch"
          aria-checked={soEstoque}
          className={soEstoque ? "chave ligada" : "chave"}
          title="Mostra só os veículos que estão em estoque no BNDV (não vendidos)"
          onClick={() => setSoEstoque(!soEstoque)}
        >
          <span className="chave-trilho" aria-hidden="true" />
          BNDV
        </button>
        <input
          aria-label="Buscar veículo"
          placeholder="Buscar nome, placa ou versão"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Veículo</th>
            <th>Placa</th>
            <th>Ano</th>
            <th>Preço</th>
            <th>Produção</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((v) => (
            <tr key={v.id}>
              <td>
                <strong>{v.nome}</strong>
                <small>{v.versao}</small>
              </td>
              <td>{v.placa || "—"}</td>
              <td>{v.ano || "—"}</td>
              <td>{v.preco == null ? "—" : moedaCentavos(v.preco)}</td>
              <td>
                <span className="badge">{v.status}</span>
                <ProductionBadges
                  status={v.pasta ? anexos[v.pasta] : undefined}
                />
              </td>
              <td>
                <div className="acoes-linha">
                  <button onClick={() => abrirFicha(v)}>Abrir ficha →</button>
                  <button
                    disabled={!v.pasta}
                    title={
                      v.pasta
                        ? "Abre a pasta do veículo no Explorador de Arquivos"
                        : "Veículo sem pasta vinculada"
                    }
                    onClick={() => {
                      aoErro("");
                      openPath(v.pasta!).catch((e) => aoErro(String(e)));
                    }}
                  >
                    Abrir pasta
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filtrados.length && (
        <p className="empty">
          Nenhum veículo encontrado. Atualize o BNDV ou escolha a raiz que
          contém ESTOQUE nas configurações.
        </p>
      )}
    </section>
  );
}
