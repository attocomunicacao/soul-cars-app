/**
 * Pasta dos modelos de recorte de fundo (variável U2NET_HOME do motor/rembg), dentro
 * dos dados do app, para não baixar de novo a cada execução.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Onde o rembg guarda os modelos de recorte (variável U2NET_HOME do motor).
 *
 * Se o computador já tem modelos em `~/.rembg` (o padrão do rembg), usa a mesma pasta e não baixa nada
 * de novo (o modelo rápido tem ~180 MB, o de qualidade ~900 MB). Senão, guarda dentro dos dados do app.
 */
export function pastaDeModelos(
  userData: string,
  home: string,
  existe: (caminho: string) => boolean = fs.existsSync,
): string {
  const padraoDoRembg = path.join(home, ".rembg");
  return existe(path.join(padraoDoRembg, "models"))
    ? padraoDoRembg
    : path.join(userData, "modelos", "rembg");
}
