/**
 * Documento CRLV na ficha: leitura do PDF (com senha ou por OCR), campos extraídos e
 * cópia como DOC.md. Sem PDF na pasta, "Ler documento" pede o arquivo, anexa e lê de
 * uma vez (antes o botão ficava desativado sem explicar o motivo).
 */
import { useEffect, useState, type ReactNode } from "react";
import { open } from "../../../lib/desktop-bridge";
import {
  copiarComoDoc,
  documentoNaPasta,
  statusProducao,
  type StatusProducao,
} from "../../../lib/production-status";

/** Documento (CRLV): anexar o PDF, ler e preencher a ficha. Fica na aba Ficha. */
export function CrlvDocument({
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

  /** Motivo dos botões desativados quando o veículo ainda não tem pasta. */
  const semPasta = pasta
    ? undefined
    : "Vincule a pasta do veículo na aba Produção";
  /** Abre o seletor do PDF do CRLV; devolve o caminho ou null se cancelar. */
  async function escolherPdf() {
    const p = await open({
      title: "Escolha o PDF do documento (CRLV)",
      filters: [{ name: "CRLV", extensions: ["pdf"] }],
    });
    return typeof p === "string" ? p : null;
  }

  return (
    <fieldset className="documento-crlv">
      <legend>Documento (CRLV)</legend>
      <p>
        {!pasta
          ? "Vincule a pasta do veículo (aba Produção) para anexar o documento."
          : status?.doc_pdf
            ? "✓ Documento encontrado na pasta"
            : "Nenhum PDF do CRLV na pasta. Anexe o arquivo ou use “Ler documento”, que pede o PDF e já preenche a ficha."}
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
          title={semPasta}
          onClick={() =>
            tarefa(verificar, "Verificação do documento atualizada.")
          }
        >
          Verificar documento
        </button>
        <button
          className={status?.doc_pdf ? "" : "primary"}
          disabled={ocupado || !pasta}
          title={semPasta}
          onClick={() =>
            tarefa(async () => {
              const p = await escolherPdf();
              if (!p) return false;
              await copiarComoDoc(pasta!, p);
            }, "Seleção concluída. O documento escolhido foi anexado como DOC.pdf.")
          }
        >
          Anexar documento
        </button>
        <button
          className={status?.doc_pdf ? "primary" : ""}
          disabled={ocupado || !pasta}
          title={
            semPasta ??
            (status?.doc_pdf
              ? "Lê o CRLV da pasta e preenche os campos abaixo"
              : "Escolha o PDF do CRLV: ele é anexado à pasta e lido em seguida")
          }
          onClick={() =>
            tarefa(async () => {
              if (!status?.doc_pdf) {
                const p = await escolherPdf();
                if (!p) return false;
                await copiarComoDoc(pasta!, p);
              }
              const d = await documentoNaPasta(pasta!);
              await documento(d.caminho, senha);
            }, "Documento lido. Confira os campos e clique em Salvar ficha.")
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
