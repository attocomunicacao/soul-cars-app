/**
 * Avisos de pausa de anúncio: lista veículos vendidos que ainda têm anúncio ativo e
 * avisa quando os dados do BNDV estão antigos.
 */
import { useEffect, useState } from "react";
import {
  anunciosParaPausar,
  dadosDoBndvAntigos,
  dataBr,
  hoje,
  type AvisoPausa,
} from "../../../../shared/ad-readiness";
import {
  listarAnuncios,
  marcarAnuncioPausado,
  type Veiculo,
} from "../../lib/database";
import { ask, invoke } from "../../lib/desktop-bridge";

type Vendas = { vendas: Record<string, string>; atualizadoEm: string | null };

/**
 * Banner no topo das duas interfaces: lembra de pausar a campanha de veículo vendido
 * e avisa quando os dados do BNDV estão velhos demais para detectar vendas.
 */
export function AdPauseAlerts({
  veiculos,
  abrir,
}: {
  veiculos: Veiculo[];
  abrir: (veiculo: Veiculo) => void;
}) {
  const [avisos, setAvisos] = useState<AvisoPausa[]>([]);
  const [antigos, setAntigos] = useState<string | null | false>(false);
  const [erro, setErro] = useState("");
  const [contador, setContador] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const abertos = (await listarAnuncios()).filter((a) => !a.pausado_dia);
      if (!abertos.length) {
        if (ativo) {
          setAvisos([]);
          setAntigos(false);
        }
        return;
      }
      const { vendas, atualizadoEm } = await invoke<Vendas>("anuncios_vendas");
      if (!ativo) return;
      setAvisos(anunciosParaPausar(abertos, vendas));
      setAntigos(
        dadosDoBndvAntigos(abertos.length, atualizadoEm) ? atualizadoEm : false,
      );
      setErro("");
    }
    const rodar = () =>
      void carregar().catch((e) => ativo && setErro(String(e)));
    rodar();
    const timer = setInterval(rodar, 60_000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [veiculos, contador]);

  async function pausada(a: AvisoPausa) {
    if (
      !(await ask(
        `Você já pausou a campanha de ${a.anuncio.modelo} no Gerenciador de Anúncios?`,
      ))
    )
      return;
    await marcarAnuncioPausado(a.anuncio.id, hoje());
    setContador((c) => c + 1);
  }

  if (!avisos.length && antigos === false && !erro) return null;
  return (
    <>
      {avisos.map((a) => {
        const veiculo = veiculos.find((v) => v.id === a.anuncio.veiculo_id);
        return (
          <div key={a.anuncio.id} role="alert" className="notice error">
            <strong>Pause a campanha de {a.anuncio.modelo}</strong> (
            {a.anuncio.campanha}): veículo vendido em {dataBr(a.vendidoEm)}.{" "}
            {veiculo && (
              <button onClick={() => abrir(veiculo)}>Abrir veículo</button>
            )}{" "}
            <button
              onClick={() => void pausada(a).catch((e) => setErro(String(e)))}
            >
              Marcar como pausada
            </button>
          </div>
        );
      })}
      {antigos !== false && (
        <div role="status" className="notice">
          Há anúncios no ar, mas os dados de vendas do BNDV{" "}
          {antigos
            ? `são de ${new Date(antigos).toLocaleString("pt-BR")}`
            : "ainda não foram baixados"}
          . Clique em Atualizar BNDV para o app detectar vendas e avisar a
          pausa.
        </div>
      )}
      {erro && (
        <div role="alert" className="notice error">
          Aviso de pausa: {erro}
        </div>
      )}
    </>
  );
}
