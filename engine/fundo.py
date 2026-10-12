"""Remoção de fundo local (rembg).

Porta do antigo remover_fundo.py: mantém só o maior objeto (o carro) e preenche buracos internos,
para que vidros e para-brisa não fiquem transparentes.

Modelo padrão: ISNet (~170 MB), cerca de 15 vezes mais rápido que o BiRefNet no processador (medido:
2 a 4 s contra 35 a 60 s por foto de 1600x1200, mais 2 s contra 28 s para carregar). O BiRefNet
(~900 MB) continua disponível como `MODELO_QUALIDADE`, pedindo `modelo="birefnet-general"`.
O modelo é baixado no primeiro uso.
"""

from __future__ import annotations

import io
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

MODELO = "isnet-general-use"
MODELO_QUALIDADE = "birefnet-general"  # mais lento (~900 MB); só se o recorte padrão falhar numa foto
MAX_PIXELS = 50_000_000


@lru_cache(maxsize=2)
def _sessao(modelo: str):
    from rembg import new_session

    return new_session(modelo)


def limpar_mascara(alpha: np.ndarray) -> np.ndarray:
    solido = alpha > 128
    # mantém só o maior objeto (o carro), descarta sobras soltas
    rotulos, n = ndimage.label(solido)
    if n > 1:
        tamanhos = ndimage.sum(solido, rotulos, range(1, n + 1))
        solido = rotulos == (int(np.argmax(tamanhos)) + 1)
    # preenche vidros e qualquer buraco fechado dentro do carro
    preenchido = ndimage.binary_fill_holes(solido)
    fechado = ndimage.binary_closing(preenchido, structure=np.ones((15, 15)), iterations=2)
    preenchido = ndimage.binary_fill_holes(fechado | preenchido)
    saida = alpha.copy()
    saida[preenchido & ~(alpha > 128)] = 255  # buracos viram opacos
    saida[~ndimage.binary_dilation(preenchido, iterations=3)] = 0  # resíduos fora do carro somem
    return saida


def _abrir(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Não foi possível abrir a foto. Use PNG, JPG ou WebP.") from exc
    if image.width * image.height > MAX_PIXELS:
        raise ValueError("A foto excede 50 megapixels.")
    return image.convert("RGB")


def remover(data: bytes, modelo: str = MODELO, progresso=None) -> bytes:
    """PNG com fundo transparente, nas MESMAS dimensões da foto original
    (o sistema de piso real depende do alinhamento com a foto com fundo)."""
    from rembg import remove

    # O recorte não tem como medir o avanço por dentro: o app mostra a etapa atual,
    # com as porcentagens tiradas do tempo médio de cada uma.
    aviso = progresso or (lambda pct, texto="": None)
    aviso(5, "Abrindo a foto")
    imagem = _abrir(data)
    aviso(15, "Carregando o modelo de recorte")
    sessao = _sessao(modelo)
    aviso(30, "Separando o carro do fundo")
    mascara = remove(imagem, session=sessao, only_mask=True)
    aviso(80, "Fechando vidros e acertando as bordas")
    alpha = limpar_mascara(np.array(mascara.convert("L")))
    aviso(92, "Gravando o PNG")
    rgba = imagem.convert("RGBA")
    rgba.putalpha(Image.fromarray(alpha))
    buf = io.BytesIO()
    rgba.save(buf, "PNG", optimize=False)
    aviso(100, "Recorte pronto")
    return buf.getvalue()


def remover_arquivo(origem: str, destino: str | None = None, modelo: str = MODELO, progresso=None) -> str:
    """Recorta um arquivo do disco. Sem destino, grava <nome>_sem_fundo.png ao lado."""
    src = Path(origem)
    if not src.is_file():
        raise ValueError(f"Foto não encontrada: {origem}")
    out = Path(destino) if destino else src.with_name(f"{src.stem}_sem_fundo.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(remover(src.read_bytes(), modelo, progresso))
    return str(out)
