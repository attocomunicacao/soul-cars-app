/**
 * Configuração do estoque compartilhado no Google Drive.
 *
 * O usuário cola o link da pasta ESTOQUE; o app procura a pasta sincronizada pelo Google Drive
 * para Desktop (`estoque_drive_detectar`) e vincula (`estoque_vincular`). Se a busca automática
 * não achar, dá para escolher a pasta à mão. Nada é movido, copiado nem apagado.
 */
import { useCallback, useEffect, useState } from "react";
import { invoke, open } from "../../lib/desktop-bridge";
import { extrairIdPastaDrive } from "../../../../shared/drive-link";

type Deteccao =
  | { situacao: "link-invalido" }
  | { situacao: "encontrada"; caminho: string }
  | { situacao: "ambigua"; candidatos: string[] }
  | { situacao: "drive-nao-encontrado" }
  | { situacao: "pasta-nao-adicionada" };

type Resultado = { atualizados: number; conflitos: string[] };

const AVISOS: Record<Exclude<Deteccao["situacao"], "encontrada">, string> = {
  "link-invalido": "Esse link não parece ser de uma pasta do Google Drive.",
  "drive-nao-encontrado":
    "Não achei o Google Drive para Desktop neste computador. Instale e entre com a sua conta; depois tente de novo.",
  "pasta-nao-adicionada":
    "O Drive está instalado, mas a pasta ainda não está neste computador. Abra o link no navegador, escolha “Organizar › Adicionar atalho ao Meu Drive” e tente de novo.",
  ambigua: "Achei mais de uma pasta. Escolha a pasta ESTOQUE manualmente.",
};

/** Seção de Configurações: vincular o ESTOQUE à pasta do Google Drive. */
export function DriveSettings() {
  const [atual, setAtual] = useState("");
  const [link, setLink] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");

  const carregar = useCallback(async () => {
    try {
      const c = await invoke<{ estoque: string }>("caminhos_app");
      setAtual(c.estoque);
    } catch (e) {
      setAviso(String(e instanceof Error ? e.message : e));
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Roda uma ação mostrando o erro de operação ao usuário. */
  async function executar(fn: () => Promise<void>) {
    setOcupado(true);
    setAviso("");
    setOk("");
    try {
      await fn();
      await carregar();
    } catch (e) {
      setAviso(String(e instanceof Error ? e.message : e));
    } finally {
      setOcupado(false);
    }
  }

  const vincular = async (pasta: string) => {
    const r = await invoke<Resultado>("estoque_vincular", { pasta });
    setOk(
      `Estoque vinculado: ${pasta}. ${r.atualizados} veículo(s) reapontado(s)` +
        (r.conflitos.length
          ? `; ${r.conflitos.length} ficaram como estavam (já existe pasta igual no Drive).`
          : "."),
    );
  };

  const procurar = () =>
    executar(async () => {
      const r = await invoke<Deteccao>("estoque_drive_detectar", { link });
      if (r.situacao === "encontrada") await vincular(r.caminho);
      else setAviso(AVISOS[r.situacao]);
    });

  const escolherManual = () =>
    executar(async () => {
      const p = await open({
        directory: true,
        title: "Selecione a pasta ESTOQUE do Drive",
      });
      if (typeof p === "string") await vincular(p);
    });

  const desvincular = () =>
    executar(async () => {
      await invoke("estoque_desvincular");
      setOk(
        "Voltou para o estoque da pasta de dados. As pastas do Drive não foram apagadas.",
      );
    });

  return (
    <section>
      <h3>Estoque no Google Drive</h3>
      <p>
        Para ver fotos e documentos que outro computador inseriu, cole o link da
        pasta ESTOQUE. É preciso ter o Google Drive para Desktop instalado.
      </p>
      <div className="campo-com-botao">
        <label>
          Link da pasta
          <input
            value={link}
            placeholder="https://drive.google.com/drive/folders/…"
            onChange={(e) => setLink(e.target.value)}
          />
        </label>
        <button
          disabled={ocupado || !extrairIdPastaDrive(link)}
          onClick={procurar}
        >
          Procurar e vincular
        </button>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="plain" disabled={ocupado} onClick={escolherManual}>
          Escolher a pasta manualmente…
        </button>
        <button className="plain" disabled={ocupado} onClick={desvincular}>
          Usar estoque local
        </button>
      </div>
      <p>
        <strong>Estoque em uso:</strong> {atual}
      </p>
      {aviso && (
        <div role="alert" className="notice error">
          <span>{aviso}</span>
        </div>
      )}
      {ok && (
        <div role="status" className="notice">
          <span>{ok}</span>
        </div>
      )}
    </section>
  );
}
