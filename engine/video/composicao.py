"""Biblioteca de composições: Lato Black uniforme, com geometria estável por bloco.

Calcula geometria e coloca o corpo branco em maiúsculas, sem alterar ordem ou tempos.
Fonte local Lato Black sob SIL OFL, sem variação de tamanho/peso nos destaques.
"""

from __future__ import annotations

from pathlib import Path

from PIL import ImageFont
import expressoes

LARGURA = 860
CORPO = 120
ENTRELINHA = 112
ESPACO = 24
CONECTORES_LINHA = {"E", "DE", "DO", "DA", "EM", "COM", "POR", "PARA", "NA", "NO", "O", "A", "OS", "AS", "UM", "UMA", "SEM"}
PADROES = {
    "linha": {"linhas": 1, "alinhamento": "centro"},
    "duas_linhas": {"linhas": 2, "alinhamento": "centro"},
    "pilha": {"linhas": 3, "alinhamento": "centro"},
    "escada": {"linhas": 2, "alinhamento": "escada"},
    "esquerda": {"linhas": 2, "alinhamento": "esquerda"},
    "direita": {"linhas": 2, "alinhamento": "direita"},
}


def limpar(texto: str) -> str:
    """Texto literal, sem permitir comandos ASS vindos da transcrição."""
    return " ".join(texto.replace("\\", "＼").replace("{", "(").replace("}", ")").split())


def distribuir(plano: dict, fonte: Path, y: int = 1400) -> list[dict]:
    """Mede o destaque real e fixa posições antes da revelação das palavras.

    Quebras sempre contíguas preservam a ordem da leitura. A redução é comum ao
    bloco, inclusive para palavras isoladas muito longas; a margem reserva espaço
    para blur, itálico e a pequena ultrapassagem da entrada.
    """
    palavras = plano["palavras"]
    if not palavras:
        return []
    itens = []
    for i, palavra in enumerate(palavras):
        destaque = i == plano["destaque"]
        tamanho = CORPO
        texto = limpar(palavra["w"]).upper()
        font = ImageFont.truetype(str(fonte), tamanho)
        bbox = font.getbbox(texto)
        # ASS usa a altura ascendente+descendente como referência de \fs;
        # Pillow mede pelo em. Sem essa conversão, cada palavra reserva mais
        # largura que sua tinta real e a folga se acumula entre palavras.
        fator_ass = tamanho / sum(font.getmetrics())
        largura = max(font.getlength(texto), bbox[2] - min(0, bbox[0])) * fator_ass + 4
        itens.append({"texto": texto, "largura": largura, "tamanho": tamanho,
                      "fonte": "Lato Black", "italico": False, "destaque": destaque})

    def largura_linha(linha):
        return sum(p["largura"] for p in linha) + ESPACO * (len(linha) - 1)

    nome = plano.get("composicao", "duas_linhas")
    if nome not in PADROES:
        raise ValueError("Composição de texto desconhecida.")
    padrao = PADROES[nome]
    linhas = [itens]
    tem_conector = any(i["texto"].strip(",;:.!?") in CONECTORES_LINHA for i in itens)
    cortes_permitidos = [i for i in range(1, len(itens))
                         if not expressoes.ligacao_numerica(itens[i-1]["texto"], itens[i]["texto"])]
    tem_ligacao = len(cortes_permitidos) < len(itens) - 1
    if tem_ligacao and not cortes_permitidos:
        nome = "linha"
    compacto = len(itens) == 2 and tem_conector and largura_linha(itens) <= LARGURA
    if compacto:
        nome = "linha"
    elif nome == "pilha" and len(itens) <= 3 and not tem_conector and not tem_ligacao:
        linhas = [[item] for item in itens]
    elif cortes_permitidos and (padrao["linhas"] > 1 or largura_linha(itens) > LARGURA):
        if nome == "linha":
            nome = "duas_linhas"  # quebra antes de reduzir o tamanho aprovado
        cortes = cortes_permitidos
        def custo(corte):
            a, b = largura_linha(itens[:corte]), largura_linha(itens[corte:])
            conector_solto = itens[corte-1]["texto"].strip(",;:.!?") in CONECTORES_LINHA
            return max(a, b) + abs(a - b) * 0.2 + (180 if conector_solto else 0)
        corte = min(cortes, key=custo)
        linhas = [itens[:corte], itens[corte:]]
    escala = min(1.0, LARGURA / max(largura_linha(linha) for linha in linhas))
    largura_bloco = max(largura_linha(linha) for linha in linhas) * escala
    for n, linha in enumerate(linhas):
        x = (1080 - largura_linha(linha) * escala) / 2
        if padrao["alinhamento"] == "esquerda":
            x = (1080 - largura_bloco) / 2
        elif padrao["alinhamento"] == "direita":
            x = (1080 + largura_bloco) / 2 - largura_linha(linha) * escala
        elif padrao["alinhamento"] == "escada":
            folga = max(0, (LARGURA - largura_linha(linha) * escala) / 2)
            x += min(24, folga) * (-1 if n % 2 == 0 else 1)
        for item in linha:
            largura = item["largura"] * escala
            item.update(x=x + largura / 2, y=y + (n - (len(linhas) - 1) / 2) * ENTRELINHA * escala,
                        tamanho=round(item["tamanho"] * escala, 2), largura=largura,
                        composicao=nome)
            x += largura + ESPACO * escala
    return itens


def cabe_sem_reduzir(palavras: list, fonte: Path) -> bool:
    itens = distribuir({"palavras": palavras, "destaque": None, "composicao": "duas_linhas"}, fonte)
    return all(item["tamanho"] >= CORPO - 0.01 for item in itens)
