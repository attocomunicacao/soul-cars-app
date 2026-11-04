"""Recompõe símbolos e números fragmentados, sem inventar valores na fala."""

import re


MOEDA = re.compile(r"^(R\$|US\$|\$|€|£)(\d+(?:[.,]\d+)*)([.,!?;:]*)$", re.IGNORECASE)
UNIDADES = {"mil", "reais", "real", "km", "quilômetros", "quilometros", "cavalos",
            "cv", "litros", "anos", "%"}


def normalizar(palavras: list) -> list:
    """Um valor monetário ocupa um único item, do primeiro ao último fragmento.

    Só junta quando existe símbolo explícito. Não converte números por extenso
    nem concatena números vizinhos sem separador, como anos e preços distintos.
    """
    saida, i = [], 0
    while i < len(palavras):
        texto, melhor = "", None
        for j in range(i, min(len(palavras), i + 12)):
            parte = re.sub(r"\s+", "", palavras[j]["w"])
            if not parte:
                break
            if j > i:
                if palavras[j]["s"] - palavras[j-1]["e"] > 0.55:
                    break
                if parte[0].isdigit() and texto[-1:] not in ("$", "€", "£", ".", ","):
                    break
            texto += parte
            if not re.fullmatch(r"(?:R|US)?[$€£]?[\d.,!?;:]*", texto, re.IGNORECASE):
                break
            m = MOEDA.fullmatch(texto)
            if m:
                melhor = (j + 1, m[1].upper() + m[2] + m[3])
        if melhor:
            fim, texto = melhor
            saida.append({**palavras[i], "w": texto, "e": palavras[fim-1]["e"]})
            i = fim
        else:
            saida.append(dict(palavras[i]))
            i += 1
    return saida


def ligacao_numerica(anterior: str, seguinte: str) -> bool:
    """Número e unidade não devem ficar em blocos ou linhas diferentes."""
    a, b = anterior.lower().rstrip(",;:.!?"), seguinte.lower().rstrip(",;:.!?")
    return b in UNIDADES and (bool(re.search(r"\d", a)) or a == "mil")
