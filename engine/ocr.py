"""OCR local (Tesseract, português): equipamentos a partir de print e CRLV escaneado."""

from __future__ import annotations

import io
import os
import re
import shutil
import unicodedata
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

MAX_PIXELS = 20_000_000


# O Windows pode entregar o caminho com o prefixo \\?\ (resource_dir do app instalado);
# o Tesseract não abre o .traineddata por um caminho assim.
PREFIXO_LONGO = "\\\\?\\"
TESSDATA = Path(str(Path(__file__).resolve().parent).removeprefix(PREFIXO_LONGO)) / "tessdata"


@lru_cache(maxsize=1)
def _tesseract():
    import pytesseract

    exe = os.environ.get("SOUL_TESSERACT") or shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if not exe or not Path(exe).is_file():
        raise RuntimeError("Tesseract OCR não encontrado. Instale com: winget install UB-Mannheim.TesseractOCR")
    pytesseract.pytesseract.tesseract_cmd = exe
    os.environ["TESSDATA_PREFIX"] = str(TESSDATA)  # português do projeto (evita escrever em Arquivos de Programas)
    return pytesseract


def _normalize(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()


def abrir_imagem(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Não foi possível abrir a imagem. Use PNG, JPG ou WebP.") from exc
    if image.width * image.height > MAX_PIXELS:
        raise ValueError("Imagem muito grande. Recorte a área (até 20 megapixels).")
    fundo = Image.new("RGB", image.size, "white")
    fundo.paste(image.convert("RGBA"), mask=image.convert("RGBA").split()[3])
    return fundo


def _sem_icones(image: Image.Image) -> Image.Image:
    """Apaga ícones de check verdes/amarelos (o OCR os lê como letras, ex.: 'EE')."""
    px = np.asarray(image).astype(int)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    verde = (g > r + 40) & (g > b + 30)
    amarelo = (r > 180) & (g > 140) & (b < 110) & (r - b > 90)
    limpo = np.asarray(image).copy()
    limpo[verde | amarelo] = 255
    return Image.fromarray(limpo)


def linhas(image: Image.Image, limpar_icones: bool = True) -> tuple[list[dict], float]:
    """Linhas reconhecidas com caixa nas coordenadas da imagem original.

    limpar_icones apaga os checks verdes/amarelos das listas de equipamentos; em
    documentos (CRLV) fica desligado, senão o fundo colorido comeria o texto.
    """
    if limpar_icones:
        image = _sem_icones(image)
    scale = min(2.5, (12_000_000 / (image.width * image.height)) ** 0.5)
    trabalho = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS) if scale > 1.05 else image
    scale = trabalho.width / image.width
    tess = _tesseract()
    # PSM 11 (texto esparso) lida bem com listas em colunas, como no sistema antigo.
    data = tess.image_to_data(
        trabalho, lang="por", config="--psm 11 -c preserve_interword_spaces=1",
        output_type=tess.Output.DICT,
    )
    grupos: dict[tuple, list[int]] = {}
    for i, word in enumerate(data["text"]):
        if word.strip() and float(data["conf"][i]) >= 0:
            grupos.setdefault((data["block_num"][i], data["par_num"][i], data["line_num"][i]), []).append(i)
    out = []
    for idx in grupos.values():
        idx.sort(key=lambda i: data["left"][i])
        x0 = min(data["left"][i] for i in idx) / scale
        y0 = min(data["top"][i] for i in idx) / scale
        x1 = max(data["left"][i] + data["width"][i] for i in idx) / scale
        y1 = max(data["top"][i] + data["height"][i] for i in idx) / scale
        text = " ".join(data["text"][i].strip() for i in idx)
        out.append({"text": text, "x0": x0, "y0": y0, "x1": x1, "y1": y1})
    return out, scale


_CATEGORIAS = {"SEGURANCA": "seguranca", "CONFORTO": "conforto", "INFOTENIMENTO": "infotenimento"}


# Uma letra solta no começo é o ícone de check lido como texto (J, E, B, 3...).
# Só cai fora quando o que vem depois é mesmo o início de uma palavra ("JFreios ABS",
# "E Airbags"), nunca em itens que começam com uma letra de verdade ("Ar quente").
_ICONE_INICIAL = re.compile(r"^[A-Za-zÀ-ÿ0-9]\s*(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zá-ÿ])")


def _limpar(s: str) -> str:
    s = re.sub(r"^[^\w]+", "", s.strip(), flags=re.UNICODE)
    s = _ICONE_INICIAL.sub("", s)
    return s.strip()


def _amarelo(pixels: np.ndarray, line: dict) -> bool:
    """Ícone amarelo de equipamento opcional à esquerda do texto."""
    h, w = pixels.shape[:2]
    x1 = max(0, int(line["x0"]))
    x0 = max(0, x1 - 28)
    y0 = max(0, int(line["y0"]) - 3)
    y1 = min(h, int(line["y1"]) + 3)
    area = pixels[y0:y1, x0:x1].astype(int)
    if area.size == 0:
        return False
    r, g, b = area[..., 0], area[..., 1], area[..., 2]
    return int(((r > 200) & (g > 150) & (b < 90) & (r > g * 1.1)).sum()) > 25


def equipamentos(data: bytes, modo: str = "auto") -> dict:
    """modo: 'auto' (separa pelos títulos) ou seguranca/conforto/infotenimento."""
    if modo not in ("auto", *_CATEGORIAS.values()):
        raise ValueError(f"Categoria inválida: {modo}")
    image = abrir_imagem(data)
    pixels = np.asarray(image)
    found, _ = linhas(image)

    heads, bottom = [], float("inf")
    for line in found:
        n = _normalize(_limpar(line["text"])).strip()
        if re.search(r"LEGENDA|EQUIPAMENTO DE SERIE|EQUIPAMENTO OPCIONAL", n):
            bottom = min(bottom, line["y0"])
            continue
        if n in _CATEGORIAS:
            heads.append({"id": _CATEGORIAS[n], "y": line["y0"]})
    heads.sort(key=lambda h: h["y"])

    result = {v: [] for v in _CATEGORIAS.values()}
    unassigned = 0
    # Linha a linha (itens na mesma altura, da esquerda para a direita), como no sistema antigo.
    altura = float(np.median([l["y1"] - l["y0"] for l in found])) if found else 1.0
    for line in sorted(found, key=lambda l: (round(l["y0"] / (altura * 0.6)), l["x0"])):
        text = _limpar(line["text"])
        n = _normalize(text).strip()
        if not text or re.fullmatch(r"(EQUIPAMENTOS|SEGURANCA|CONFORTO|INFOTENIMENTO)", n) or line["y0"] >= bottom:
            continue
        cat = modo if modo != "auto" else next((h["id"] for h in reversed(heads) if h["y"] < line["y0"]), None)
        if not cat:
            unassigned += 1
            continue
        if _amarelo(pixels, line):
            text += " [OPCIONAL — confirmar no veículo]"
        if not any(_normalize(item) == _normalize(text) for item in result[cat]):
            result[cat].append(text)
    return {"itens": result, "titulos": len(heads), "fora": unassigned}


def pagina_pdf_itens(image: Image.Image, scale: float) -> list[dict]:
    """Itens no formato do crlv.extract (coordenadas em pontos do PDF)."""
    found, _ = linhas(image, limpar_icones=False)
    return [{"text": l["text"].strip(), "x": l["x0"] / scale, "y": l["y1"] / scale} for l in found if l["text"].strip()]
