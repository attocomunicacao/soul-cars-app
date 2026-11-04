"""Animações das tarjas (veículo, motor e preço) no alto do vídeo.

Cada predefinição devolve, para uma tarja, o filtro de preparo opcional (fade de transparência) e
as expressões x/y do `overlay` do ffmpeg. A escolha é por veículo (mesmo carro, mesma animação), então
carros diferentes variam e o padrão de cada vídeo se mantém. `SOUL_TARJAS=<nome>` força uma delas.
"""

from __future__ import annotations

import os
import unicodedata
import zlib

from motion import Animacao, Chave, Trilha
from motion.ffmpeg import expressao

W = 1080
PREDEFINICOES = ("deslize", "alternada", "subida", "descida")
DISTANCIA_VERTICAL = 110
ESCALA_MAXIMA = 1.05


def escala_permanencia(inicio: float, fim: float, relogio: str = "t") -> str:
    """Crescimento único de 100–105%, centro fixo e sem retorno ao tamanho inicial."""
    if fim <= inicio:
        return "1"
    p = f"max(0,min(1,({relogio}-{inicio})/{fim-inicio}))"
    return f"(1+{ESCALA_MAXIMA - 1:.6f}*({p})*({p})*(3-2*({p})))"


def filtro_glow_valor() -> str:
    """Modula somente o alfa do halo das letras, sem apagar o texto original."""
    return ("format=rgba,geq=r=255:g=255:b=255:"
            "a='alpha(X,Y)*(0.25+0.75*(0.5-0.5*cos(2*PI*T/5)))'")


def filtro_escala(inicio: float, fim: float, fps: str) -> str:
    """Transformação subpixel em canvas fixo: evita saltos de tamanho inteiro."""
    escala = escala_permanencia(inicio, fim, f"((on-1)/({fps}))")
    esquerda = f"W/2-W/2*{escala}"
    direita = f"W/2+W/2*{escala}"
    topo = f"H/2-H/2*{escala}"
    base = f"H/2+H/2*{escala}"
    return (f"format=gbrap,perspective=x0='{esquerda}':y0='{topo}':"
            f"x1='{direita}':y1='{topo}':x2='{esquerda}':y2='{base}':"
            f"x3='{direita}':y3='{base}':sense=destination:eval=frame:interpolation=cubic,format=rgba")


def saida_final(duracao: float, indice: int) -> tuple[float, float]:
    """As três tarjas permanecem até o fechamento da cena do veículo."""
    return max(0.0, duracao - 0.42 + indice * 0.05), duracao


def escolher(veiculo: str) -> str:
    forcada = os.environ.get("SOUL_TARJAS", "").strip().lower()
    if forcada in PREDEFINICOES:
        return forcada
    base = "".join(c for c in unicodedata.normalize("NFD", veiculo or "") if unicodedata.category(c) != "Mn")
    return PREDEFINICOES[zlib.crc32(base.lower().encode("utf-8")) % len(PREDEFINICOES)]


def filtros(predefinicao: str, indice: int, largura: int, y: int, entra: tuple, sai: tuple) -> dict:
    """`entra`/`sai`: (início, fim) em segundos. Devolve {"pre": filtro ou "", "x": expr, "y": expr}."""
    a, b = entra
    s0, s1 = sai
    if predefinicao not in PREDEFINICOES or not 0 <= a < b <= s0 < s1:
        raise ValueError("Tempos ou preset das tarjas inválidos.")
    centro = (W - largura) / 2

    def movimento(inicial, estavel):
        chaves = [Chave(0, inicial), Chave(b-a, estavel, "suave")]
        if s0 > b:
            chaves.append(Chave(s0-a, estavel))
        chaves.append(Chave(s1-a, inicial, "saida"))
        trilha = Trilha(tuple(chaves))
        return expressao(Animacao(a, s1, {"posicao": trilha}), "posicao")

    pre = (f"format=rgba,fade=t=in:st={a}:d={min(0.18, b-a)}:alpha=1,"
           f"fade=t=out:st={s0}:d={s1 - s0}:alpha=1")
    if predefinicao in ("deslize", "alternada"):
        lado = 1 if (predefinicao == "alternada" and indice % 2) else -1
        inicio = -largura if lado < 0 else W
        return {"pre": pre, "x": movimento(inicio, centro), "y": str(y)}
    sinal = 1 if predefinicao == "subida" else -1
    longe = y + sinal * DISTANCIA_VERTICAL
    return {"pre": pre, "x": str(centro), "y": movimento(longe, y)}
