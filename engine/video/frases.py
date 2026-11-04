"""Formação de blocos curtos por pontuação, pausas e custo de quebra linguística.

O particionamento preserva palavras e timestamps. Não reescreve a fala e não usa
LLM: evita separar números/unidades, locuções conhecidas e conectores do complemento.
"""

import math
import re

from contexto import nucleo, sem_acento
import expressoes

MAX_PALAVRAS = 3
CONECTORES = {"a", "o", "as", "os", "um", "uma", "e", "de", "do", "da", "dos", "das",
              "em", "com", "por", "para", "na", "no", "nas", "nos", "sem", "nenhum", "nenhuma"}
UNIDADES = {"mil", "reais", "km", "quilometros", "cavalos", "litros", "anos"}
LOCUCOES = (
    "retoque de pintura", "laudo cautelar", "unico dono", "mascara negra", "direcao eletrica",
    "vidro eletrico", "vidros eletricos", "retrovisor eletrico", "trava eletrica", "cambio automatico",
    "cambio manual", "ar condicionado", "central multimidia", "computador de bordo", "soul cars",
    "na loja", "por apenas", "acabou de chegar", "em otimo estado", "estado de conservacao",
)


def normal(w):
    return sem_acento(nucleo(w["w"]))


def _particionar(palavras, cabe):
    ns = [normal(w) for w in palavras]
    penalidades = [0.0] * (len(palavras) + 1)
    for locucao in LOCUCOES:
        termos = locucao.split()
        for i in range(len(ns) - len(termos) + 1):
            if ns[i:i+len(termos)] == termos:
                for j in range(i+1, i+len(termos)):
                    penalidades[j] += 12
    for i in range(1, len(ns)):
        if expressoes.ligacao_numerica(palavras[i-1]["w"], palavras[i]["w"]):
            penalidades[i] = math.inf

    n = len(palavras)
    custos, cortes = [math.inf] * (n+1), [None] * (n+1)
    custos[n] = 0
    for inicio in range(n-1, -1, -1):
        alcance = min(n, inicio+4)
        while alcance < n and expressoes.ligacao_numerica(palavras[alcance-1]["w"], palavras[alcance]["w"]):
            alcance += 1
        for fim in range(inicio+1, alcance+1):
            grupo = palavras[inicio:fim]
            quantidade = fim-inicio
            numerico = any(re.search(r"\d", t) for t in ns[inicio:fim]) and any(t in UNIDADES for t in ns[inicio:fim])
            expressao_numerica = quantidade > 1 and all(
                expressoes.ligacao_numerica(a["w"], b["w"]) for a, b in zip(grupo, grupo[1:]))
            if quantidade > 4 and not expressao_numerica:
                continue
            if quantidade > MAX_PALAVRAS and not (numerico or expressao_numerica):
                continue
            if quantidade > 1 and cabe and not cabe(grupo) and not expressao_numerica:
                continue
            duracao = max(0, grupo[-1]["e"] - grupo[0]["s"])
            custo = 1 + (2.2 if quantidade == 1 and n > 1 else 0) + (0.6 if quantidade == 4 else 0)
            custo += max(0, duracao - 1.7) ** 2 * 2
            if fim < n:
                custo += penalidades[fim]
                if ns[fim-1] in CONECTORES:
                    custo += 10
            custo += custos[fim]
            if custo < custos[inicio]:
                custos[inicio], cortes[inicio] = custo, fim
    grupos, posicao = [], 0
    while posicao < n:
        fim = cortes[posicao]
        grupos.append(palavras[posicao:fim])
        posicao = fim
    return grupos


def agrupar(palavras: list, cabe=None) -> list:
    palavras = expressoes.normalizar(palavras)
    clausulas, atual = [], []
    for w in palavras:
        if atual and (w["s"] - atual[-1]["e"] > 0.55 or atual[-1]["w"][-1:] in ",;:.!?"):
            clausulas.append(atual)
            atual = []
        atual.append(w)
    if atual:
        clausulas.append(atual)
    return [grupo for clausula in clausulas for grupo in _particionar(clausula, cabe)]
