/**
 * Cabeçalho da página Estoque: barra de pasta (reler, abrir pasta, atualizar BNDV),
 * métricas do balanço e as abas "Veículos" / "Abrir relatório completo".
 */
import type { Veiculo } from "../../lib/database";
import { invoke, openPath } from "../../lib/desktop-bridge";
import { moedaCentavos } from "../../lib/format";
import type { Balanco } from "../../types";

type BarraProps = {
  /** Veículo aberto (na ficha) ou null na lista. */
  selecionado: Veiculo | null;
  /** Mostra o botão "Atualizar BNDV" (só na página Estoque, não na ficha). */
  mostrarAtualizar: boolean;
  ocupado: boolean;
  /** Relê as pastas. */
  reler: () => void;
  /** Busca no BNDV e grava os CSVs/pastas. */
  atualizarBndv: () => void;
  aoErro: (mensagem: string) => void;
};

/** Barra fixa acima do estoque e da ficha: reler pastas, abrir pasta e atualizar o BNDV. */
export function FolderBar({
  selecionado,
  mostrarAtualizar,
  ocupado,
  reler,
  atualizarBndv,
  aoErro,
}: BarraProps) {
  function abrirPasta() {
    aoErro("");
    (selecionado
      ? Promise.resolve(selecionado.pasta!)
      : invoke<{ estoque: string }>("caminhos_app").then((c) => c.estoque)
    )
      .then((pasta) => openPath(pasta))
      .catch((e) => aoErro(String(e)));
  }
  return (
    <div className="barra-pasta">
      <button disabled={ocupado} onClick={reler}>
        Reler pastas
      </button>
      <button
        disabled={Boolean(selecionado && !selecionado.pasta)}
        title={
          selecionado
            ? !selecionado.pasta
              ? "Este veículo ainda não tem pasta vinculada."
              : "Abre no Explorador de Arquivos a pasta deste veículo."
            : "Abre no Explorador de Arquivos a pasta ESTOQUE, com uma pasta por veículo."
        }
        onClick={abrirPasta}
      >
        {selecionado ? "Abrir pasta" : "Abrir pasta do estoque"}
      </button>
      {mostrarAtualizar && (
        <button className="primary" disabled={ocupado} onClick={atualizarBndv}>
          {ocupado ? "Processando…" : "Atualizar BNDV"}
        </button>
      )}
    </div>
  );
}

type MetricasProps = {
  balanco: Balanco | null;
  /** Quantidade usada quando o balanço ainda não tem o número do BNDV. */
  totalLista: number;
  /** Aba atual da página Estoque. */
  aba: string;
  ocupado: boolean;
  /** Abre a vitrine do estoque atual. */
  abrirVitrine: () => void;
  /** Volta para a lista de veículos. */
  abrirLista: () => void;
  /** Gera e abre o relatório completo. */
  abrirRelatorio: () => void;
};

/** Métricas do balanço (estoque, custo, receita, margem bruta) e as abas da página. */
export function InventoryMetrics({
  balanco,
  totalLista,
  aba,
  ocupado,
  abrirVitrine,
  abrirLista,
  abrirRelatorio,
}: MetricasProps) {
  // Consignados não entram no custo patrimonial; a margem é bruta (regras do balanço no main).
  const metricas: [string, string | number][] = [
    ["Estoque", balanco?.bndv?.estoqueN ?? totalLista],
    ["Custo do estoque", moedaCentavos(balanco?.bndv?.estoqueCusto ?? 0)],
    ["Receita de vendas", moedaCentavos(balanco?.bndv?.receita ?? 0)],
    ["Margem bruta", moedaCentavos(balanco?.bndv?.margem ?? 0)],
  ];
  return (
    <>
      <div className="metrics">
        {metricas.map(([rotulo, valor]) =>
          rotulo === "Estoque" ? (
            <button
              key={rotulo}
              className="metric-link"
              title="Ver os veículos em estoque"
              onClick={abrirVitrine}
            >
              <small>{rotulo}</small>
              <strong>{valor}</strong>
            </button>
          ) : (
            <div key={rotulo}>
              <small>{rotulo}</small>
              <strong>{valor}</strong>
            </div>
          ),
        )}
      </div>
      <nav>
        <button
          className={aba === "veiculos" ? "selected" : ""}
          onClick={abrirLista}
        >
          Veículos
        </button>
        <button disabled={ocupado} onClick={abrirRelatorio}>
          Abrir relatório completo
        </button>
      </nav>
    </>
  );
}
