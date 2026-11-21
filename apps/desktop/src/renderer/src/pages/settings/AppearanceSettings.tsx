/**
 * Seção "Aparência" das Configurações: alterna entre o tema claro e o escuro.
 * Quem aplica e lembra a escolha é `public/shared/theme.js` (carregado no index.html antes da pintura,
 * seguindo o tema do sistema na primeira vez); aqui só pedimos a troca e acompanhamos o tema atual.
 */
import { useEffect, useState } from "react";
import { Segmentado } from "../../app/components";

type Tema = "light" | "dark";
type TemaGlobal = { apply: (tema: Tema, guardar?: boolean) => void };

const temaAtual = (): Tema =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

/** Escolha de tema claro ou escuro; a escolha fica guardada neste computador. */
export function AppearanceSettings() {
  const [tema, setTema] = useState<Tema>(temaAtual);

  useEffect(() => {
    const aoMudar = () => setTema(temaAtual());
    document.addEventListener("soul:theme-changed", aoMudar);
    return () => document.removeEventListener("soul:theme-changed", aoMudar);
  }, []);

  const escolher = (novo: Tema) =>
    (window as unknown as { SoulTheme?: TemaGlobal }).SoulTheme?.apply(
      novo,
      true,
    );

  return (
    <section>
      <h3>Aparência</h3>
      <p>
        O tema segue o do Windows na primeira vez. Aqui você escolhe um e ele
        fica guardado neste computador. O editor de criativos continua claro.
      </p>
      <Segmentado
        rotulo="Tema do aplicativo"
        opcoes={[
          ["light", "Claro"],
          ["dark", "Escuro"],
        ]}
        valor={tema}
        aoMudar={escolher}
      />
    </section>
  );
}
