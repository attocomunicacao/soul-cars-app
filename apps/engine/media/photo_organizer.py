"""Organização das fotos do veículo: o app reconhece o que cada foto mostra e propõe a
ordem de sempre, para renomear como 1.jpeg, 2.jpeg, 3.jpeg…

Tudo local e de graça (CLIP em ONNX, ver visao.py): nenhuma foto sai do computador.

Ordem de publicação:
    exteriores, da frente para a traseira → interior → porta-malas → roda → motor → resto.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

from media import vision as visao

EXTENSOES = {".jpg", ".jpeg", ".png", ".webp"}
MINIATURA = 320

# Cada tipo com a frase que o modelo entende (em inglês) e a posição na sequência.
TIPOS = [
    ("exterior", "a photo of a whole car parked outdoors, seen from outside"),
    ("interior", "a photo of the inside of a car: dashboard, steering wheel and seats"),
    ("porta_malas", "a photo of an open car trunk, the empty cargo area"),
    ("roda", "a close up photo of a car wheel, tire and hubcap"),
    ("motor", "a photo of a car engine bay under the open hood"),
]
ORDEM = ["exterior", "interior", "porta_malas", "roda", "motor"]
# Entre os exteriores, a ordem vai da frente para a traseira.
FRENTE = "the front of a car with headlights and the grille"
TRASEIRA = "the rear of a car with tail lights and the license plate on the tailgate"
NOMES = {
    "exterior": "exterior", "interior": "interior", "porta_malas": "porta-malas",
    "roda": "roda", "motor": "motor",
}


def _fotos_da_pasta(pasta: str) -> list[Path]:
    dir_fotos = next((Path(pasta) / n for n in ("FOTOS", "FOTO") if (Path(pasta) / n).is_dir()), None)
    if dir_fotos is None:
        raise ValueError(f"Pasta FOTOS não encontrada em {pasta}.")
    # O PNG recortado acompanha a foto principal e não entra na ordenação.
    return sorted(
        (p for p in dir_fotos.iterdir()
         if p.is_file() and p.suffix.lower() in EXTENSOES and "_sem_fundo" not in p.stem.lower()),
        key=lambda p: p.name.lower(),
    )


def _miniatura(caminho: Path) -> str:
    with Image.open(caminho) as imagem:
        imagem = imagem.convert("RGB")
        imagem.thumbnail((MINIATURA, MINIATURA))
        buf = io.BytesIO()
        imagem.save(buf, "JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def organizar(params: dict, progresso=None) -> dict:
    """Ordem sugerida para as fotos da pasta. Não renomeia nem move nada."""
    aviso = progresso or (lambda pct, texto="": None)
    arquivos = _fotos_da_pasta(params["pasta"])
    if not arquivos:
        raise ValueError("Nenhuma foto encontrada na pasta FOTOS.")

    aviso(1, f"Preparando {len(arquivos)} foto(s)")
    frases = [frase for _, frase in TIPOS] + [FRENTE, TRASEIRA]
    chances = visao.pontuar(arquivos, frases, aviso)

    aviso(85, "Montando a ordem das fotos")
    tipos = [TIPOS[int(linha[: len(TIPOS)].argmax())][0] for linha in chances]
    # Quanto maior, mais "traseira" a foto parece: serve para ordenar os exteriores.
    traseiro = [float(linha[-1] / (linha[-2] + linha[-1])) for linha in chances]

    def chave(i: int) -> tuple:
        tipo = tipos[i]
        posicao = ORDEM.index(tipo) if tipo in ORDEM else len(ORDEM)
        # Exteriores: da frente para a traseira. Os demais mantêm a ordem que já tinham.
        return (posicao, traseiro[i] if tipo == "exterior" else 0.0, i)

    ordem = sorted(range(len(arquivos)), key=chave)
    aviso(95, "Gerando as miniaturas")
    fotos = []
    for numero, i in enumerate(ordem, 1):
        angulo = "frente" if traseiro[i] < 0.35 else "traseira" if traseiro[i] > 0.6 else "lateral"
        fotos.append({
            "atual": arquivos[i].name,
            "novo": f"{numero}{arquivos[i].suffix.lower()}",
            "tipo": NOMES.get(tipos[i], tipos[i]),
            "descricao": f"exterior · {angulo}" if tipos[i] == "exterior" else NOMES.get(tipos[i], tipos[i]),
            "miniatura": _miniatura(arquivos[i]),
        })
    aviso(100, "Ordem pronta")
    return {"pasta": str(arquivos[0].parent), "fotos": fotos}
