import { useEffect, useState } from "react";
import { obterLoja, salvarLoja, obterConfig, salvarConfig } from "./lib/db";
import { invoke } from "./lib/desktop";
import type { Loja } from "./lib/des";
export function Configuracoes() {
  const [loja, setLoja] = useState<Loja | null>(null),
    [chave, setChave] = useState(""),
    [modoApi, setModoApi] = useState(false),
    [campanhaModelo, setCampanhaModelo] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    void obterLoja()
      .then(setLoja)
      .catch((e) => setAviso(String(e)));
    void obterConfig("campanha_modelo")
      .then((c) => setCampanhaModelo(c ?? ""))
      .catch((e) => setAviso(String(e)));
    void obterConfig("ia_modo_api")
      .then((c) => setModoApi(c === "1"))
      .catch((e) => setAviso(String(e)));
    void invoke<boolean>("segredo_existe", { nome: "anthropic_api_key" })
      .then((existe) => {
        if (existe)
          setAviso("Chave da Anthropic configurada neste computador.");
      })
      .catch((e) => setAviso(String(e)));
  }, []);
  async function salvar() {
    setOcupado(true);
    try {
      if (loja) await salvarLoja(loja);
      await salvarConfig("ia_modo_api", modoApi ? "1" : null);
      await salvarConfig("campanha_modelo", campanhaModelo.trim() || null);
      if (chave.trim())
        await invoke("segredo_definir", {
          nome: "anthropic_api_key",
          valor: chave.trim(),
        });
      setChave("");
      setAviso("Configurações salvas.");
    } catch (e) {
      setAviso(String(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div>
      <h3>Dados da loja</h3>
      {loja && (
        <div className="grid">
          {(["loja", "contato", "horario", "endereco"] as const).map((k) => (
            <label key={k}>
              {k}
              <textarea
                value={loja[k]}
                onChange={(e) => setLoja({ ...loja, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
      <label>
        Nome da campanha modelo (Gerenciador de Anúncios)
        <input
          value={campanhaModelo}
          onChange={(e) => setCampanhaModelo(e.target.value)}
          placeholder="Aparece no passo a passo do anúncio"
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={modoApi}
          onChange={(e) => setModoApi(e.target.checked)}
        />
        Ativar modo API (cobrado pela Anthropic). Desligado, os textos saem pelo
        prompt pronto, sem custo.
      </label>
      <label>
        Chave Anthropic para textos com IA
        <input
          type="password"
          disabled={!modoApi}
          autoComplete="off"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder="Informe somente para substituir a chave"
        />
      </label>
      <p>
        No modo API, gerar textos usa sua conta Anthropic e gera custo. Revise a
        ficha e os anúncios antes de publicar.
      </p>
      <button disabled={ocupado} onClick={salvar}>
        Salvar dados da loja e chave
      </button>
      <button
        disabled={ocupado}
        onClick={async () => {
          try {
            await invoke("segredo_definir", {
              nome: "anthropic_api_key",
              valor: null,
            });
            setAviso("Chave removida.");
          } catch (e) {
            setAviso(String(e));
          }
        }}
      >
        Remover chave
      </button>
      <p role="status">{aviso}</p>
    </div>
  );
}
