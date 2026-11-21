/**
 * Aba Loja do Pré-atendimento: dados da loja usados no contexto da IA.
 */
import { useState } from "react";
import { type LojaIa } from "../../../../shared/pre-service";
import { type Painel, type Agir } from "./shared";

// ------------------------------------------------------------------ Loja
const CAMPOS_LOJA: [keyof LojaIa, string, boolean][] = [
  ["nome", "Nome", false],
  ["endereco", "Endereço", false],
  ["horario", "Horário", true],
  ["telefone", "Telefone", false],
  ["site", "Site", false],
  ["financiamento", "Financiamento", true],
  ["troca", "Troca", true],
  ["extra", "Outras informações", true],
];
export function StoreTab({ p, agir }: { p: Painel; agir: Agir }) {
  const [loja, setLoja] = useState(p.loja);
  return (
    <div className="panel">
      <h2>Dados da loja</h2>
      <p className="hint">
        A IA só fala de horário, endereço e condições com o que está aqui. O
        último horário de visita (16h em dia útil, 15h no sábado) é conferido à
        parte.
      </p>
      {/* Campos curtos em duas colunas; textos longos na largura toda. */}
      <div className="grid grid-2">
        {CAMPOS_LOJA.filter(([, , longo]) => !longo).map(([k, rotulo]) => (
          <label key={k}>
            {rotulo}
            <input
              value={loja[k]}
              onChange={(e) => setLoja({ ...loja, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {CAMPOS_LOJA.filter(([, , longo]) => longo).map(([k, rotulo]) => (
        <label key={k}>
          {rotulo}
          <textarea
            rows={2}
            value={loja[k]}
            onChange={(e) => setLoja({ ...loja, [k]: e.target.value })}
          />
        </label>
      ))}
      <div className="actions">
        <button
          className="primary"
          onClick={() => void agir("pre_loja_salvar", { patch: loja })}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
