"""Legendas SOUL: Lato Black branca, frases naturais e biblioteca contextual.

Cada palavra tem posição e relógio próprios. A composição permanece fixa durante
a revelação, sem remontar a linha a cada palavra. Entradas usam curvas amortecidas,
com amplitude pequena e duração adaptada ao tempo disponível. Glow sutil da mesma cor,
sem contorno; todas as palavras em maiúsculas, no mesmo tamanho e fonte.
"""

from __future__ import annotations

from pathlib import Path

import contexto
import composicao
import frases
from motion.ass import eventos as eventos_ass
from motion.presets import gerar as gerar_motion

W, H = 1080, 1920
LEG_Y = 1400
LEG_PEQUENA = composicao.CORPO
LEG_MAX_PALAVRAS = 3
LEG_COR_DESTAQUE = "&HFFFFFF&"   # destaque sem variação de cor
LEG_COR_NORMAL = "&HFFFFFF&"
GLOW_ALFA = 0xD6                 # aproximadamente 16% de opacidade


def ass_time(t: float) -> str:
    t = max(t, 0)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def agrupar_legendas(frase: list, cabe=None) -> list:
    """Delega a formação linguística dos blocos ao motor de frases."""
    return frases.agrupar(frase, cabe)


# O motor de motion cuida do tempo e das propriedades; aqui só ligamos o plano
# semântico das legendas ao adaptador ASS.
def eventos_da_animacao(plano: dict, largura: float, ini: float, fim: float, glow: bool = False) -> list:
    if round(fim, 2) <= round(ini, 2):
        return []
    animacao = gerar_motion(
        plano["animacao"], ini, fim, plano.get("origem", (W // 2, LEG_Y)),
        forca=(0.9, 1.0, 1.1)[plano["intensidade"]], direcao=plano["direcao"],
        destaque=plano.get("destaque_motion", False), saida_nome=plano.get("saida", "suave"),
    )
    return eventos_ass(animacao, glow=glow)


def gerar_ass(words: list, video_end: float, out: Path, fonte: Path, veiculo: str = "") -> list:
    """Grava o ASS e devolve o plano usado (para registrar no log)."""
    plano = contexto.planejar(words, lambda f: agrupar_legendas(f, lambda g: composicao.cabe_sem_reduzir(g, fonte)), veiculo)
    estilo = ("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
              "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
              "Alignment, MarginL, MarginR, MarginV, Encoding\n")
    cabecalho = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {W}\nPlayResY: {H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n" + estilo
        + f"Style: Leg,Lato Black,{LEG_PEQUENA},{LEG_COR_NORMAL},&H000000FF,&H00000000,&H00000000,"
        "0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1\n"
        + f"Style: Glow,Lato Black,{LEG_PEQUENA},&H{GLOW_ALFA:02X}FFFFFF,&H000000FF,&H00000000,&H00000000,"
        "0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    linhas = []
    for n, p in enumerate(plano):
        ini = p["palavras"][0]["s"]
        prox = plano[n + 1]["palavras"][0]["s"] if n + 1 < len(plano) else video_end
        fim = min(p["palavras"][-1]["e"] + 0.35, prox, video_end)
        if fim <= ini:
            continue
        composicao_palavras = composicao.distribuir(p, fonte, LEG_Y)
        p["composicao_efetiva"] = composicao_palavras[0]["composicao"] if composicao_palavras else p.get("composicao")
        for w, item in zip(p["palavras"], composicao_palavras):
            # A antecipação de 20 ms compensa o fade sem revelar a frase inteira.
            inicio = max(ini, w["s"] - 0.02)
            if round(inicio, 2) >= round(fim, 2):
                continue
            palavra_plano = {**p, "origem": (round(item["x"], 2), round(item["y"], 2)),
                             "destaque_motion": item["destaque"]}
            for glow in (True, False):
                camada, estilo_nome = (0, "Glow") if glow else (1, "Leg")
                fonte_marcas = (f"\\fn{item['fonte']}\\fs{item['tamanho']}"
                                f"\\i{int(item['italico'])}\\b0")
                fonte_marcas += f"\\1c{LEG_COR_DESTAQUE if item['destaque'] else LEG_COR_NORMAL}"
                for a, b, marcas in eventos_da_animacao(palavra_plano, item["largura"], inicio, fim, glow):
                    linhas.append(
                        f"Dialogue: {camada},{ass_time(a)},{ass_time(b)},{estilo_nome},,0,0,0,,"
                        f"{{{marcas}{fonte_marcas}}}{item['texto']}")
    out.write_text(cabecalho + "\n".join(linhas) + "\n", encoding="utf-8")
    return plano
