"""Adaptador FFmpeg: compila a mesma amostragem numérica em expressão de overlay."""

from .ass import numero
from .modelo import Animacao


def expressao(animacao: Animacao, propriedade: str, fps: float = 60) -> str:
    trechos = animacao.segmentos(fps)
    resultado = numero(animacao.trilhas[propriedade].chaves[-1].valor)
    for a, b, e0, e1 in reversed(trechos):
        v0, v1 = e0[propriedade], e1[propriedade]
        valor = numero(v0)
        if abs(v1 - v0) > 1e-8:
            valor = f"({numero(v0)}+({numero(v1-v0)})*(t-{numero(a)})/{numero(b-a)})"
        resultado = f"if(lt(t,{numero(b)}),{valor},{resultado})"
    antes = numero(animacao.trilhas[propriedade].chaves[0].valor)
    return f"if(lt(t,{numero(round(animacao.inicio, 2))}),{antes},{resultado})"
