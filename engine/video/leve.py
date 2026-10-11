"""Versão leve do vídeo, só para anúncio (Meta Ads).

Recodifica o VIDEO_*.mp4 que o Editor Mágico já gerou (render.py): a composição, as tarjas, as
legendas e a trilha continuam idênticas, muda só a codificação (H.264 a ~10 Mbps, áudio AAC 160 kbps).
O render e o VIDEO_*.mp4 não são tocados.

O arquivo vai para <pasta do veículo>/ANUNCIO/ANUNCIO_<mesmo sufixo>.mp4. Essa subpasta é de propósito:
na raiz, em VIDEO e em PROJETO, qualquer outro .mp4 seria confundido com o vídeo bruto (render.py) ou
quebraria a regra de "um único VIDEO_*.mp4" da publicação no Instagram.

Uso: python leve.py <pasta_do_veiculo>
"""
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import log, probe_duration, progresso, run_ffmpeg  # noqa: E402

PASTA_SAIDA = "ANUNCIO"
PREFIXO_FINAL = "VIDEO_"
PREFIXO_SAIDA = "ANUNCIO_"
TAXA_VIDEO = "10M"
TAXA_PICO = "12M"

_TAXA = ["-b:v", TAXA_VIDEO, "-maxrate", TAXA_PICO, "-bufsize", "20M", "-profile:v", "high"]
# (nome, argumentos de vídeo): primeiro o codificador Intel; se falhar, o x264 na CPU.
CODIFICADORES = [
    ("h264_qsv", ["-c:v", "h264_qsv", *_TAXA]),
    ("libx264", ["-c:v", "libx264", "-preset", "medium", *_TAXA, "-pix_fmt", "yuv420p"]),
]
AUDIO = ["-c:a", "aac", "-b:a", "160k", "-ar", "48000"]


def localizar_final(root: Path) -> Path:
    """O único VIDEO_*.mp4 da pasta do veículo, a mesma regra da publicação no Instagram."""
    finais = [p for p in root.iterdir()
              if p.is_file() and re.fullmatch(r"VIDEO_.+\.mp4", p.name, re.IGNORECASE)]
    if len(finais) != 1:
        raise RuntimeError(
            f"Esperava 1 vídeo editado VIDEO_*.mp4 em {root}; encontrei {len(finais)}. "
            "Gere o vídeo no Editor Mágico antes."
        )
    return finais[0]


def nome_saida(final: Path) -> str:
    return PREFIXO_SAIDA + final.name[len(PREFIXO_FINAL):]


def montar_comando(entrada: Path, saida: Path, args_video: list) -> list:
    return ["ffmpeg", "-hide_banner", "-y", "-i", str(entrada),
            "-map", "0:v:0", "-map", "0:a:0?", *args_video, *AUDIO,
            "-movflags", "+faststart", str(saida)]


def gerar(folder: str, codificadores: list = None) -> Path:
    t0 = time.time()
    root = Path(folder)
    if not root.is_dir():
        raise RuntimeError(f"Pasta do veículo não encontrada: {root}")
    final = localizar_final(root)
    destino = root / PASTA_SAIDA
    destino.mkdir(exist_ok=True)
    saida = destino / nome_saida(final)
    parcial = destino / (saida.stem + ".parcial.mp4")

    progresso(1, "Lendo o vídeo editado")
    dur = probe_duration(final)
    tamanho_final = final.stat().st_size
    log(f"Vídeo editado {final.name}: {dur:.2f}s, {tamanho_final / 1e6:.0f} MB -> {saida.name}")

    ultimo_erro = None
    for nome, args_video in (codificadores or CODIFICADORES):
        parcial.unlink(missing_ok=True)
        log(f"Codificando a versão leve ({nome}, {TAXA_VIDEO}bps)...")
        try:
            run_ffmpeg(montar_comando(final, parcial, args_video), dur, 3, 97, "Gerando a versão leve")
            ultimo_erro = None
            break
        except RuntimeError as e:
            ultimo_erro = e
            parcial.unlink(missing_ok=True)
            log(f"  ({nome} indisponível ou falhou; tentando o próximo codificador)")
    if ultimo_erro is not None:
        raise ultimo_erro

    # Só troca o arquivo final depois de conferir que o vídeo saiu inteiro.
    if not parcial.is_file() or parcial.stat().st_size < 10_000:
        parcial.unlink(missing_ok=True)
        raise RuntimeError("A versão leve ficou vazia ou muito pequena.")
    gerado = probe_duration(parcial)
    if abs(gerado - dur) > 1.0:
        parcial.unlink(missing_ok=True)
        raise RuntimeError(f"A versão leve saiu incompleta: {gerado:.1f}s de {dur:.1f}s esperados.")
    os.replace(parcial, saida)
    progresso(100, "Versão leve pronta")
    log(f"Final {tamanho_final / 1e6:.0f} MB -> leve {saida.stat().st_size / 1e6:.0f} MB")
    log(f"PRONTO em {time.time() - t0:.0f}s: {saida}")
    return saida


if __name__ == "__main__":
    try:
        gerar(sys.argv[1])
    except Exception as e:  # mensagem limpa para o app
        log(f"ERRO: {e}")
        sys.exit(1)
