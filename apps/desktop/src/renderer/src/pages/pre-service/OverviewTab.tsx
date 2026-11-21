/**
 * Aba Visão geral do Pré-atendimento: números do atendimento, estado da IA e leads em andamento.
 */
import { Kpi, Selo, Vazio, ha } from "../../app/components";
import { type Painel, type Agir } from "./shared";

const STATUS = {
  ativo: ["info", "Com a IA"],
  humano: ["atencao", "Com a equipe"],
  encerrado: ["neutro", "Encerrado"],
} as const;

// ------------------------------------------------------------------ Visão geral
export function OverviewTab({ p, agir }: { p: Painel; agir: Agir }) {
  const comIa = p.chats.filter((c) => c.status === "ativo").length;
  const comEquipe = p.chats.filter((c) => c.status === "humano").length;
  return (
    <>
      <div className="kpis">
        <Kpi
          destaque
          rotulo="Leads com a IA"
          valor={comIa}
          apoio={`${p.chats.length} no total`}
        />
        <Kpi rotulo="Passados à equipe" valor={comEquipe} />
        <Kpi rotulo="Aguardando aprovação" valor={p.rascunhos.length} />
        <Kpi
          rotulo="Estoque disponível"
          valor={p.estoque}
          apoio={`${p.exemplos.length} exemplos ensinados · ${p.exemplosReais} reais`}
        />
      </div>
      <div className="duas-colunas">
        <div className="panel">
          <h2>Leads</h2>
          <p className="hint">
            {p.laco.rodando ? "Verificando" : "Parado"}
            {p.laco.ultimaRodada
              ? ` · última verificação ${ha(p.laco.ultimaRodada)}`
              : ""}
          </p>
          {p.chats.length === 0 ? (
            <Vazio titulo="Nenhum lead ainda">
              Os leads aparecem aqui quando recebem a etiqueta de gatilho no
              uTalk.
            </Vazio>
          ) : (
            <ul className="lista-leads">
              {p.chats.map((c) => (
                <li key={c.chatId}>
                  <div>
                    <strong>{c.nome}</strong>{" "}
                    <Selo tom={STATUS[c.status][0]}>{STATUS[c.status][1]}</Selo>
                    {c.ultima && (
                      <p className="hint">
                        {c.ultima.role === "user" ? "Lead: " : "IA: "}
                        {c.ultima.content.slice(0, 120)}
                      </p>
                    )}
                    {c.resumo && (
                      <details>
                        <summary className="hint">Ficha do lead</summary>
                        <pre className="auditoria-bruto">{c.resumo}</pre>
                      </details>
                    )}
                  </div>
                  <span className="actions">
                    {c.status !== "ativo" && (
                      <button
                        className="small"
                        onClick={() =>
                          void agir("pre_reativar", { chatId: c.chatId })
                        }
                      >
                        Devolver à IA
                      </button>
                    )}
                    <button
                      className="plain small"
                      title="Tira o lead só deste app; nada é apagado no uTalk"
                      onClick={() =>
                        void agir("pre_esquecer", { chatId: c.chatId })
                      }
                    >
                      Esquecer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Registro</h2>
          {p.registros.length === 0 ? (
            <p className="hint">Nada registrado ainda.</p>
          ) : (
            <ul className="registro-ia">
              {p.registros.map((r, i) => (
                <li key={i} className={r.tipo === "erro" ? "erro" : ""}>
                  <span className="hint">
                    {new Date(r.em).toLocaleString("pt-BR")} · {r.tipo}
                  </span>
                  <span>{r.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
