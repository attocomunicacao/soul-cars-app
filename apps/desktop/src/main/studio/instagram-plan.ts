/**
 * Plano de publicação no Instagram de um veículo: escolhe os criativos do carrossel,
 * a capa e o vídeo (Reels) na pasta e monta as legendas a partir do DES.md.
 */
import fs from "node:fs";
import path from "node:path";
import { blocosDeCopia } from "../../shared/publication";
import { slugInstagram, type PlanoInstagram } from "../../shared/instagram";

export function montarPlanoInstagram(v: {
  id: number;
  nome: string;
  ano: string | null;
  pasta: string | null;
  des_md: string | null;
}): PlanoInstagram {
  const plano: PlanoInstagram = {
    veiculoId: v.id,
    nome: v.nome,
    pasta: v.pasta || "",
    arquivos: [],
    carrossel: "",
    reels: "",
    pendencias: [],
  };
  const blocos = blocosDeCopia(v.des_md || "");
  plano.carrossel =
    blocos.find((b) => /^1\.\s*TEXTO PRINCIPAL$/.test(b.label))?.text || "";
  plano.reels =
    blocos.find((b) => /^2\.\s*TEXTO PRINCIPAL$/.test(b.label))?.text || "";
  for (const [label, texto] of [
    ["1. TEXTO PRINCIPAL", plano.carrossel],
    ["2. TEXTO PRINCIPAL", plano.reels],
  ]) {
    if (!texto.trim()) plano.pendencias.push(`Gere ${label} na ficha.`);
    else if ([...texto].length > 2200)
      plano.pendencias.push(
        `${label} ultrapassa 2.200 caracteres. Encurte a legenda.`,
      );
  }
  if (!v.pasta || !fs.existsSync(v.pasta)) {
    plano.pendencias.push("Vincule uma pasta existente ao veículo.");
    return plano;
  }
  const criativos = path.join(v.pasta, "CRIATIVO");
  const nomes = fs.existsSync(criativos)
    ? fs
        .readdirSync(criativos)
        .filter((n) => fs.statSync(path.join(criativos, n)).isFile())
    : [];
  const base = slugInstagram(v.nome, v.ano);
  const encontrar = (sufixo: string) => {
    const candidatos = nomes.filter(
      (n) =>
        path.parse(n).name.toLowerCase() === `${base}-${sufixo}` &&
        /\.(png|jpe?g)$/i.test(n),
    );
    if (candidatos.length > 1) {
      plano.pendencias.push(
        `Há mais de um criativo ${base}-${sufixo}. Deixe uma versão em CRIATIVO.`,
      );
      return null;
    }
    if (!candidatos.length) {
      plano.pendencias.push(`Exporte ${base}-${sufixo} na aba Criativos.`);
      return null;
    }
    return path.join(criativos, candidatos[0]);
  };
  [2, 1, 3].forEach((numero, i) => {
    const caminho = encontrar(`carrossel-${numero}`);
    if (caminho)
      plano.arquivos.push({
        caminho,
        nome: path.basename(caminho),
        tipo: "carrossel",
        posicao: i + 1,
      });
  });
  const capa = encontrar("trafego-pago");
  if (capa)
    plano.arquivos.push({
      caminho: capa,
      nome: path.basename(capa),
      tipo: "capa",
    });
  const videos = fs
    .readdirSync(v.pasta)
    .filter(
      (n) =>
        /^VIDEO_.+\.mp4$/i.test(n) &&
        fs.statSync(path.join(v.pasta!, n)).isFile(),
    );
  if (videos.length !== 1)
    plano.pendencias.push(
      videos.length
        ? "Há mais de um vídeo editado VIDEO_*.mp4. Deixe apenas a versão que será publicada na pasta do veículo."
        : "Gere o vídeo editado pelo Editor Mágico.",
    );
  else
    plano.arquivos.push({
      caminho: path.join(v.pasta, videos[0]),
      nome: videos[0],
      tipo: "video",
    });
  return plano;
}
