import { useEffect, useMemo, useState } from "react";
import {
  montarPrompt,
  validarResposta,
  type FichaIA,
  type TextosAnuncio,
} from "../../compartilhado/anuncio-ia";
import { obterLoja } from "./lib/db";
import { invoke } from "./lib/desktop";

/**
 * Modo "prompt pronto": o app monta o prompt, o usuário cola no chat que já paga,
 * devolve a resposta em JSON e o app valida antes de gerar o DES.md. Sem API, sem custo.
 */
export function PromptAnuncio({
  ficha,
  ocupado,
  aplicar,
}: {
  ficha: FichaIA;
  ocupado: boolean;
  aplicar: (textos: TextosAnuncio) => Promise<void>;
}) {
  const [loja, setLoja] = useState("");
  const [resposta, setResposta] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void obterLoja()
      .then((l) => ativo && setLoja(l.loja))
      .catch((e) => ativo && setMensagem(String(e)));
    return () => {
      ativo = false;
    };
  }, []);

  const prompt = useMemo(() => montarPrompt(ficha, loja), [ficha, loja]);

  async function copiar() {
    try {
      await invoke("copiar_texto", { texto: prompt });
      setCopiado(true);
      setMensagem("");
    } catch (e) {
      setMensagem(String(e));
    }
  }

  async function validar() {
    setMensagem("");
    const r = validarResposta(resposta, ficha);
    if (!r.ok) {
      setErros(r.erros);
      setAvisos([]);
      return;
    }
    setErros([]);
    setAvisos(r.avisos);
    try {
      await aplicar(r.textos);
    } catch (e) {
      setMensagem(String(e));
    }
  }

  return (
    <div className="panel">
      <h3>Textos do anúncio pelo chat (sem custo de API)</h3>
      <ol>
        <li>Copie o prompt abaixo.</li>
        <li>Cole no Claude ou no ChatGPT e peça só o JSON.</li>
        <li>Cole a resposta no segundo campo e valide.</li>
      </ol>
      <label>
        Prompt
        <textarea className="markdown" readOnly value={prompt} />
      </label>
      <div className="actions">
        <button disabled={ocupado} onClick={() => void copiar()}>
          {copiado ? "✓ Prompt copiado" : "Copiar prompt"}
        </button>
      </div>
      <label>
        Resposta do chat (JSON)
        <textarea
          className="markdown"
          value={resposta}
          onChange={(e) => {
            setResposta(e.target.value);
            setErros([]);
            setAvisos([]);
          }}
        />
      </label>
      <div className="actions">
        <button
          className="primary"
          disabled={ocupado || !resposta.trim()}
          onClick={() => void validar()}
        >
          Validar e gerar DES.md
        </button>
      </div>
      {erros.length > 0 && (
        <div role="alert" className="notice">
          <strong>A resposta tem problemas. Peça ao chat para corrigir:</strong>
          <ul>
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {avisos.length > 0 && (
        <p role="status" className="notice">
          Avisos: {avisos.join(" ")}
        </p>
      )}
      {mensagem && (
        <p role="alert" className="notice">
          {mensagem}
        </p>
      )}
    </div>
  );
}
