/**
 * Relatórios do Meta Ads: lê a planilha exportada (.xlsx) e mostra resultados por campanha.
 */
import { useEffect, useState } from "react";
import { lerXlsx, comoRegistros } from "../../../lib/xlsx";
import { gerarRelatorio, type Relatorio } from "../../../lib/ads-reports";
import {
  salvarRelatorio,
  listarRelatorios,
  excluirRelatorio,
  type RelatorioSalvo,
} from "../../../lib/database";
export function AdsReports() {
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null),
    [historico, setHistorico] = useState<RelatorioSalvo[]>([]);
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [aviso, setAviso] = useState("");
  useEffect(() => {
    void listarRelatorios()
      .then(setHistorico)
      .catch((e) => setErro(String(e)));
  }, []);
  async function processar(f: File) {
    setOcupado(true);
    setErro("");
    try {
      const sheets = await lerXlsx(await f.arrayBuffer());
      const sheet =
        sheets.find((s) => /raw data report/i.test(s.nome)) ?? sheets[0];
      if (!sheet) throw new Error("Planilha vazia.");
      const { cabecalho, registros } = comoRegistros(sheet);
      let r = gerarRelatorio(cabecalho, registros);
      const anterior = historico.find((h) => h.tipo === r.tipo);
      if (anterior)
        r = gerarRelatorio(cabecalho, registros, JSON.parse(anterior.dados));
      await salvarRelatorio(r.tipo, f.name, r.periodo.inicio, r.periodo.fim, r);
      setRelatorio(r);
      setHistorico(await listarRelatorios());
    } catch (err) {
      setErro(String(err));
    } finally {
      setOcupado(false);
    }
  }
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Copiado.");
    } catch (e) {
      setErro(String(e));
    }
  }
  return (
    <section className="panel">
      <h2>Relatórios Meta Ads</h2>
      <p>
        Importe Raw Data Report (.xlsx). O app identifica o tipo e compara com o
        relatório anterior.
      </p>
      <label>
        Importar XLSX
        <input
          type="file"
          accept=".xlsx"
          disabled={ocupado}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void processar(f);
          }}
        />
      </label>
      {erro && (
        <p role="alert" className="notice error">
          {erro}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      <div className="actions">
        {historico.map((h) => (
          <div key={h.id}>
            <button
              onClick={() => {
                try {
                  setRelatorio(JSON.parse(h.dados));
                } catch (e) {
                  setErro(String(e));
                }
              }}
            >
              {h.arquivo} · {h.inicio}
            </button>
            <button
              aria-label={`Excluir relatório ${h.arquivo}`}
              onClick={async () => {
                if (!window.confirm(`Excluir ${h.arquivo} do histórico?`))
                  return;
                try {
                  await excluirRelatorio(h.id);
                  setHistorico(await listarRelatorios());
                } catch (e) {
                  setErro(String(e));
                }
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {relatorio && (
        <>
          <h3>
            {relatorio.periodo.inicio} a {relatorio.periodo.fim}
          </h3>
          <button
            onClick={() =>
              copiar(relatorio.blocos.map((b) => b.texto).join("\n\n\n"))
            }
          >
            Copiar todos os blocos
          </button>
          <div className="grid">
            {relatorio.blocos.map((b, i) => (
              <article key={i}>
                <div className="actions">
                  <h3>{b.titulo}</h3>
                  <button onClick={() => copiar(b.texto)}>Copiar</button>
                </div>
                <pre>{b.texto}</pre>
              </article>
            ))}
          </div>
          {relatorio.observacoes.map((o, i) => (
            <p key={i}>{o}</p>
          ))}
        </>
      )}
    </section>
  );
}
