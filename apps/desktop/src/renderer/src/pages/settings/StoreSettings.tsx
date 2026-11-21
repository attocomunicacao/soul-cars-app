/**
 * Configurações da loja: dados da revenda, conta do Instagram e token pessoal do uTalk
 * (guardado cifrado no main, nunca devolvido à interface).
 */
import { useEffect, useState } from "react";
import {
  obterLoja,
  salvarLoja,
  obterConfig,
  salvarConfig,
} from "../../lib/database";
import type { Loja } from "../../lib/description-generator";
/** Campos da loja com rótulo legível e altura (linhas) de cada caixa. */
const ROTULOS = [
  ["loja", "Nome da loja", 1],
  ["contato", "Contato (WhatsApp)", 1],
  ["horario", "Horário de atendimento", 3],
  ["endereco", "Endereço", 3],
] as const;

/** Formulário com os dados da revenda e a campanha modelo. */
export function StoreSettings() {
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
    <section>
      <h3>Dados da loja</h3>
      <p>Aparecem nas descrições, nos anúncios e nas artes.</p>
      {loja && (
        <div className="grid grid-2">
          {ROTULOS.map(([k, rotulo, linhas]) => (
            <label key={k}>
              {rotulo}
              <textarea
                rows={linhas}
                style={{ minHeight: 0 }}
                value={loja[k]}
                onChange={(e) => setLoja({ ...loja, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
      <label>
        Campanha modelo no Gerenciador de Anúncios
        <input
          value={campanhaModelo}
          onChange={(e) => setCampanhaModelo(e.target.value)}
          placeholder="Nome que aparece no passo a passo do anúncio"
        />
      </label>
      <small>
        O app não usa nenhum serviço pago: os textos dos anúncios saem pelo
        prompt pronto (Ficha › Textos pelo chat), que você cola no chat que já
        usa.
      </small>
      <div className="actions" style={{ marginTop: 18 }}>
        <button className="primary" disabled={ocupado} onClick={salvar}>
          Salvar dados da loja
        </button>
        <span role="status" className="status-texto">
          {aviso}
        </span>
      </div>
    </section>
  );
}
