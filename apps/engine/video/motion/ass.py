"""Adaptador ASS: timeline → eventos, com o mesmo estado no começo/fim de cada trecho."""

from .model import Animacao


def numero(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".")


def propriedades(e: dict, sombra: bool, glow: bool = False) -> str:
    opacidade = min(1.0, max(0.0, e.get("opacidade", 1))) * (0.16 if glow else 0.56 if sombra else 1)
    alfa = round(255 * (1 - opacidade))
    escala = e.get("escala", 1) * 100
    blur = e.get("blur", 0) + (5 if glow else 9 if sombra else 0.6)
    return (f"\\fscx{numero(escala)}\\fscy{numero(escala)}\\blur{numero(blur)}"
            f"\\alpha&H{alfa:02X}&")


def eventos(animacao: Animacao, sombra: bool = False, fps: float = 100, glow: bool = False) -> list:
    if sombra and glow:
        raise ValueError("Escolha sombra ou glow para a camada auxiliar.")
    if set(animacao.trilhas) - {"x", "y", "escala", "opacidade", "blur"}:
        raise ValueError("O adaptador ASS não suporta uma das propriedades da timeline.")
    eventos_ass = []
    for a, b, e0, e1 in animacao.segmentos(fps):
        dy = 6 if sombra else 0
        x0, y0 = e0.get("x", 0), e0.get("y", 0) + dy
        x1, y1 = e1.get("x", 0), e1.get("y", 0) + dy
        if abs(x0 - x1) + abs(y0 - y1) < 1e-8:
            posicao = f"\\pos({numero(x0)},{numero(y0)})"
        else:
            posicao = f"\\move({numero(x0)},{numero(y0)},{numero(x1)},{numero(y1)})"
        marcas = "\\an5" + posicao + propriedades(e0, sombra, glow)
        if any(abs(e0[k] - e1[k]) > 1e-8 for k in e0):
            marcas += f"\\t(0,{round((b-a)*1000)},{propriedades(e1, sombra, glow)})"
        eventos_ass.append((a, b, marcas))
    return eventos_ass
