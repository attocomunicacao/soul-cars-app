import { useEffect, useState } from "react";
import { obterLoja, salvarLoja, obterConfig, salvarConfig } from "./lib/db";
import type { Loja } from "./lib/des";
export function Configuracoes() {
  const [loja, setLoja] = useState<Loja | null>(null),
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
  }, []);
  async function salvar() {
    setOcupado(true);
    try {
      if (loja) await salvarLoja(loja);
      await salvarConfig("campanha_modelo", campanhaModelo.trim() || null);
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
      <p>
        O app não usa nenhum serviço pago. Os textos dos anúncios saem pelo
        prompt pronto (Ficha › Textos pelo chat), que você cola no chat que já
        usa. Revise a ficha e os anúncios antes de publicar.
      </p>
      <button disabled={ocupado} onClick={salvar}>
        Salvar dados da loja
      </button>
      <p role="status">{aviso}</p>
    </div>
  );
}
