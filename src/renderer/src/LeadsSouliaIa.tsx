import { useState } from "react";
import { SouliaIa } from "./SouliaIa";
import { VisaoCrm } from "./VisaoCrm";

type Aba = "painel" | "memoria";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "painel", rotulo: "Painel" },
  { id: "memoria", rotulo: "Memória (Soul IA)" },
];

/** Leads e Soul IA numa seção só: painel do CRM e desempenho juntos; a memória (dados sensíveis das conversas) fica em aba à parte. */
export function LeadsSouliaIa({
  aoErro,
}: {
  aoErro: (mensagem: string) => void;
}) {
  const [aba, setAba] = useState<Aba>("painel");
  return (
    <>
      <nav className="abas-leads" aria-label="Seções de Leads">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={aba === a.id ? "selected" : ""}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>
      {aba === "painel" && (
        <VisaoCrm aoErro={aoErro} irParaMemoria={() => setAba("memoria")} />
      )}
      {aba === "memoria" && <SouliaIa aoErro={aoErro} />}
    </>
  );
}
