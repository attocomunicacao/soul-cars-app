"""Reconhecimento de imagem local e gratuito (CLIP em ONNX).

Nada de API paga nem de chave: o modelo roda no próprio computador, como o recorte de
fundo. Na primeira vez ele é baixado (~350 MB) e fica guardado na pasta de dados do app.

Uso: `pontuar(caminhos, frases)` devolve, para cada foto, a chance de ela combinar com
cada frase (as frases em inglês funcionam melhor: o modelo foi treinado assim).
"""

from __future__ import annotations

import os
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

REPO = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/"
ARQUIVOS = {"model.onnx": "onnx/model.onnx", "tokenizer.json": "tokenizer.json"}
# Normalização oficial do CLIP.
MEDIA = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
DESVIO = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
LADO = 224


def pasta_modelo() -> Path:
    """Onde o modelo fica guardado (mesma pasta de dados do app, se ela existir)."""
    dados = os.environ.get("SOUL_DATA_DIR")
    base = os.environ.get("SOUL_DADOS") or os.environ.get("APPDATA") or str(Path.home())
    destino = Path(dados) / "clip" if dados else Path(base) / "soul-cars-app" / "clip"
    destino.mkdir(parents=True, exist_ok=True)
    return destino


def baixar(progresso=None) -> Path:
    """Garante os arquivos do modelo no disco e devolve a pasta."""
    aviso = progresso or (lambda pct, texto="": None)
    destino = pasta_modelo()
    for nome, caminho in ARQUIVOS.items():
        alvo = destino / nome
        if alvo.is_file() and alvo.stat().st_size > 1_000_000:
            continue
        parcial = alvo.with_suffix(alvo.suffix + ".parcial")
        aviso(2, f"Baixando o modelo de imagem ({nome}) — só na primeira vez")
        try:
            with urllib.request.urlopen(REPO + caminho, timeout=120) as resposta, open(parcial, "wb") as saida:
                total = int(resposta.headers.get("Content-Length") or 0)
                lidos = 0
                while bloco := resposta.read(1 << 20):
                    saida.write(bloco)
                    lidos += len(bloco)
                    if total:
                        aviso(2 + 28 * lidos / total, f"Baixando o modelo de imagem ({lidos >> 20} de {total >> 20} MB)")
        except OSError as exc:
            parcial.unlink(missing_ok=True)
            raise ValueError(f"Não foi possível baixar o modelo de imagem: {exc}") from exc
        parcial.replace(alvo)
    return destino


@lru_cache(maxsize=1)
def _sessao():
    import onnxruntime as ort
    from tokenizers import Tokenizer

    destino = pasta_modelo()
    sessao = ort.InferenceSession(str(destino / "model.onnx"), providers=["CPUExecutionProvider"])
    return sessao, Tokenizer.from_file(str(destino / "tokenizer.json"))


def _entrada(caminho: Path) -> np.ndarray:
    """Foto no formato que o CLIP espera: 224×224 no centro, normalizada."""
    with Image.open(caminho) as imagem:
        imagem = imagem.convert("RGB")
        escala = LADO / min(imagem.size)
        imagem = imagem.resize((round(imagem.width * escala), round(imagem.height * escala)), Image.BICUBIC)
        esquerda, topo = (imagem.width - LADO) // 2, (imagem.height - LADO) // 2
        imagem = imagem.crop((esquerda, topo, esquerda + LADO, topo + LADO))
        matriz = np.asarray(imagem, dtype=np.float32) / 255.0
    return ((matriz - MEDIA) / DESVIO).transpose(2, 0, 1)


def pontuar(caminhos: list[Path], frases: list[str], progresso=None) -> np.ndarray:
    """Matriz [foto][frase] com as chances (cada linha soma 1)."""
    baixar(progresso)
    aviso = progresso or (lambda pct, texto="": None)
    sessao, tokenizador = _sessao()

    codificadas = [tokenizador.encode(f) for f in frases]
    maior = max(len(c.ids) for c in codificadas)
    ids = np.array([c.ids + [0] * (maior - len(c.ids)) for c in codificadas], dtype=np.int64)
    mascara = np.array([[1] * len(c.ids) + [0] * (maior - len(c.ids)) for c in codificadas], dtype=np.int64)

    fotos = []
    for i, caminho in enumerate(caminhos):
        fotos.append(_entrada(caminho))
        aviso(35 + 25 * (i + 1) / len(caminhos), "Lendo as fotos")
    pixels = np.stack(fotos).astype(np.float32)

    aviso(65, "Reconhecendo o que há em cada foto")
    logits = sessao.run(["logits_per_image"], {"input_ids": ids, "attention_mask": mascara, "pixel_values": pixels})[0]
    expoentes = np.exp(logits - logits.max(axis=1, keepdims=True))
    return expoentes / expoentes.sum(axis=1, keepdims=True)
