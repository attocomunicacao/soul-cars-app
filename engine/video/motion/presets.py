"""Vocabulário de motion: parâmetros centralizados, sem texto ou regras comerciais."""

from dataclasses import dataclass

from .modelo import transicao


@dataclass(frozen=True)
class Preset:
    dx: float = 0
    dy: float = 18
    escala: float = 0.98
    blur: float = 2.5
    entrada: float = 0.38
    curva: str = "suave"


PRESETS = {
    "blur": Preset(dy=10, blur=4),
    "subida": Preset(),
    "deslize": Preset(dx=-26, dy=0, escala=1),
    "zoom": Preset(dy=5, escala=1.035, blur=3, entrada=0.42),
    "pop": Preset(dy=12, escala=0.95, blur=1.5, entrada=0.44, curva="mola"),
    "revelar": Preset(dy=8, escala=0.99, blur=3),
    "cascata": Preset(dy=20, escala=1, blur=2),
    "acende": Preset(dy=4, escala=1, blur=2.5),
    "descida": Preset(dy=-18, escala=0.99, blur=2),
    "lateral": Preset(dx=26, dy=6, escala=1, blur=2),
    "aproximar": Preset(dy=0, escala=0.965, blur=2, entrada=0.42),
    "recuar": Preset(dy=0, escala=1.035, blur=2, entrada=0.42),
}


@dataclass(frozen=True)
class Saida:
    dx: float = 0
    dy: float = 0
    escala: float = 1
    blur: float = 1.2


SAIDAS = {
    "suave": Saida(dy=-4),
    "dissolver": Saida(),
    "subir": Saida(dy=-14),
    "descer": Saida(dy=14),
    "esquerda": Saida(dx=-22),
    "direita": Saida(dx=22),
    "recuar": Saida(escala=0.975, blur=2),
    "aproximar": Saida(escala=1.025, blur=2),
}


def gerar(nome: str, inicio: float, fim: float, origem: tuple, forca: float = 1,
          direcao: int = 1, destaque: bool = False, saida_nome: str = "suave"):
    if nome not in PRESETS or saida_nome not in SAIDAS or direcao not in (-1, 1) or not 0 < forca <= 2:
        raise ValueError("Preset de movimento inválido.")
    preset = PRESETS[nome]
    x, y = origem
    estavel = {"x": x, "y": y, "escala": 1.0, "opacidade": 1.0, "blur": 0.0}
    inicial = {"x": x + preset.dx * forca * direcao, "y": y + preset.dy * forca,
               "escala": 1 + (preset.escala - 1) * forca, "opacidade": 0.0, "blur": preset.blur}
    saida = SAIDAS[saida_nome]
    final = {**estavel, "x": x + saida.dx * forca, "y": y + saida.dy * forca,
             "escala": saida.escala, "opacidade": 0.0, "blur": saida.blur}
    return transicao(inicio, fim, inicial, estavel, final,
                     entrada=preset.entrada + (0.04 if destaque else 0), curva=preset.curva)
