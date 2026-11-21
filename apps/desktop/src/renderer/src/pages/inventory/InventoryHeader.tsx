/**
 * Cabeçalho da página Estoque: barra de ferramentas fixa (título, reler, abrir pasta,
 * atualizar BNDV), métricas do balanço e o controle segmentado Lista / Vitrine /
 * Relatório.
 */
import { Icon } from "../../app/icons";
import type { Veiculo } from "../../lib/database";
import { invoke, openPath } from "../../lib/desktop-bridge";
import { moedaCentavos } from "../../lib/format";
import type { Balanco } from "../../types";

type BarraProps = {
  /** Título mostrado à esquerda da barra (nome da página ou do veículo). */
  titulo: string;
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
  titulo,
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
      <h1 className="toolbar-title">{titulo}</h1>
      <button
        disabled={ocupado}
        onClick={reler}
        title="Lê de novo as pastas do estoque e o balanço"
      >
        <Icon nome="recarregar" />
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
        <Icon nome="pasta" />
        {selecionado ? "Abrir pasta" : "Abrir pasta do estoque"}
      </button>
      {mostrarAtualizar && (
        <button
          className="primary"
          disabled={ocupado}
          onClick={atualizarBndv}
          title="Baixa estoque e vendas do BNDV e atualiza as pastas"
        >
          <Icon nome="nuvem" />
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

/**
 * Métricas do balanço (estoque, custo, receita, margem bruta) e o controle
 * segmentado da página: Lista, Vitrine e Relatório completo.
 */
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
              title="Ver os veículos em estoque na vitrine"
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
      <nav className="segmented" aria-label="Modo de exibição do estoque">
        <button
          className={aba === "veiculos" ? "selected" : ""}
          aria-pressed={aba === "veiculos"}
          onClick={abrirLista}
        >
          Lista
        </button>
        <button
          className={aba === "vitrine" ? "selected" : ""}
          aria-pressed={aba === "vitrine"}
          onClick={abrirVitrine}
        >
          Vitrine
        </button>
        <button
          className={aba === "completo" ? "selected" : ""}
          aria-pressed={aba === "completo"}
          disabled={ocupado}
          onClick={abrirRelatorio}
        >
          Relatório completo
        </button>
      </nav>
    </>
  );
}
