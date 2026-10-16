import { useEffect, useState, type ReactNode } from "react";
import { open } from "./lib/desktop";
import {
  copiarComoDoc,
  documentoNaPasta,
  statusProducao,
  type StatusProducao,
} from "./lib/producao";

/** Documento (CRLV): anexar o PDF, ler e preencher a ficha. Fica na aba Ficha. */
export function DocumentoCrlv({
  pasta,
  documento,
  onBusy,
  children,
}: {
  pasta: string | null;
  documento: (origem: string, senha: string) => Promise<void>;
  onBusy: (valor: boolean) => void;
  /** Campos da ficha que vêm do documento, mostrados dentro da mesma seção. */
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<StatusProducao | null>(null);
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let ativo = true;
    let consultando = false;
    setStatus(null);
    async function consultar() {
      if (!pasta || consultando) return;
      consultando = true;
      try {
        const s = await statusProducao(pasta);
        if (ativo) setStatus(s);
      } catch (e) {
        if (ativo) setAviso(String(e));
      } finally {
        consultando = false;
      }
    }
    void consultar();
    const timer = setInterval(() => void consultar(), 5000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [pasta]);

  async function verificar() {
    if (pasta) setStatus(await statusProducao(pasta));
  }
  async function tarefa(fn: () => Promise<unknown>, mensagem = "Concluído.") {
    setOcupado(true);
    onBusy(true);
    setAviso("");
    try {
      const resultado = await fn();
      await verificar();
      setAviso(resultado === false ? "Seleção cancelada." : mensagem);
    } catch (e) {
      setAviso(String(e));
    } finally {
      setOcupado(false);
      onBusy(false);
    }
  }

  return (
    <fieldset className="documento-crlv">
      <legend>Documento (CRLV)</legend>
      <p>
        {status?.doc_pdf
          ? "✓ Documento encontrado na pasta"
          : "○ Nenhum documento PDF encontrado"}
        {status?.doc_md ? " · DOC.md já gerado" : ""}
      </p>
      {aviso && (
        <p className="notice" role="status">
          {aviso}
        </p>
      )}
      <div className="actions">
        <button
          disabled={ocupado || !pasta}
          onClick={() =>
            tarefa(verificar, "Verificação do documento atualizada.")
          }
        >
          Verificar documento
        </button>
        <button
          className="primary"
          disabled={ocupado || !pasta}
          onClick={() =>
            tarefa(async () => {
              const p = await open({
                title: "Anexar documento do veículo",
                filters: [{ name: "CRLV", extensions: ["pdf"] }],
              });
              if (typeof p !== "string") return false;
              await copiarComoDoc(pasta!, p);
            }, "Seleção concluída. O documento escolhido foi anexado como DOC.pdf.")
          }
        >
          Anexar documento
        </button>
        <button
          disabled={ocupado || !status?.doc_pdf}
          onClick={() =>
            tarefa(async () => {
              const d = await documentoNaPasta(pasta!);
              await documento(d.caminho, senha);
            })
          }
        >
          Ler documento e preencher ficha
        </button>
      </div>
      <label>
        Senha do CRLV (se necessário)
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </label>
      {children}
    </fieldset>
  );
}
