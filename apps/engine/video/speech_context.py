"""Motor de contexto da fala do vídeo (local, sem IA paga e sem rede).

Lê as palavras transcritas (com tempo), separa em frases, descobre do que cada frase trata
(preço, ano/km, especificação, equipamento, condição do carro, chamada para a loja…) e monta o
plano de animação das legendas: qual animação cada frase usa, com que intensidade, qual palavra
recebe destaque e para que lado ela entra.

O objetivo é um fluxo coerente, não um sorteio: o assunto escolhe a família de animações, o
vídeo ganha um arco (começa suave, sobe nas informações que vendem, fecha forte na chamada) e
nenhuma animação se repete em sequência. O mesmo vídeo sempre gera o mesmo plano; carros
diferentes variam entre as opções de cada assunto.
"""

from __future__ import annotations

import re
import unicodedata
import zlib
from expressions import normalizar

TIPOS = ("abertura", "neutro", "especificacao", "equipamento", "condicao", "ano_km", "preco", "chamada")

# Desempate: o assunto que "vende" ou chama para a loja vence um assunto genérico.
PRIORIDADE = ("chamada", "preco", "ano_km", "condicao", "equipamento", "especificacao", "abertura", "neutro")

# Termos (sem acento, minúsculos). Cada padrão vale 1 ponto por ocorrência.
LEXICO = {
    "chamada": [
        r"\bvenha\b", r"\bvem\b", r"\bchama\b", r"\bchame\b", r"\bagende\b", r"\bagendar\b", r"\bvisita\b",
        r"\bwhatsapp\b", r"\blink\b", r"\bligue\b", r"\bcontato\b", r"\baproveite\b", r"\bcorre\b",
        r"\bte esperamos\b", r"\bnossa loja\b", r"\bfinanciamos\b", r"\baceitamos\b", r"\bsoul cars\b",
        r"\bfale com\b", r"\bconhecer\b", r"\bleve\b", r"\bgaranta\b",
    ],
    "preco": [
        r"\breais\b", r"\br\$", r"\bvalor\b", r"\bpreco\b", r"\bparcela", r"\bentrada\b", r"\bfinanci",
        r"\ba vista\b", r"\bdesconto\b", r"\boferta\b", r"\boportunidade\b", r"\bcusta\b", r"\bsai por\b",
        r"\bpor apenas\b", r"\bfeirao\b",
    ],
    "ano_km": [
        r"\bano\b", r"\bquilometr", r"\bkm\b", r"\brodados\b", r"\brodou\b", r"\bmodelo\b",
        r"\b(?:19|20)\d{2}\b",
    ],
    "especificacao": [
        r"\bmotor\b", r"\bflex\b", r"\bcambio\b", r"\bmanual\b", r"\bautomatico\b", r"\bcvt\b", r"\bturbo\b",
        r"\bgasolina\b", r"\betanol\b", r"\bdiesel\b", r"\bcavalos\b", r"\bversao\b", r"\b\d[.,]\d\b",
        r"\bpotencia\b", r"\bconsumo\b", r"\beconomico\b", r"\beconomia\b",
    ],
    "equipamento": [
        r"\bar[- ]condicionado\b", r"\bdirecao\b", r"\bvidros? eletricos?\b", r"\btrava", r"\bairbag",
        r"\babs\b", r"\bmultimidia\b", r"\bcamera\b", r"\bsensor", r"\bteto\b", r"\bbancos?\b",
        r"\bcouro\b", r"\brodas?\b", r"\bfarol", r"\bled\b", r"\bbluetooth\b", r"\bcarplay\b",
        r"\bandroid auto\b", r"\bpiloto\b", r"\bcompleto\b", r"\bopcionais?\b", r"\bequipado\b",
        r"\bcomputador de bordo\b", r"\bcentral\b", r"\bpartida\b", r"\bkit\b",
        r"\bretrovis", r"\bfarois\b", r"\bvidros?\b",
    ],
    "condicao": [
        r"\bunico dono\b", r"\brevisado\b", r"\blaudo\b", r"\bcautelar\b", r"\bimpecavel\b", r"\bconserv",
        r"\bsem detalhes\b", r"\bpneus?\b", r"\bpintura\b", r"\brepintura\b", r"\bretoque\b", r"\boriginal\b",
        r"\bgarantia\b", r"\bprocedencia\b", r"\bipva\b", r"\bdocumentacao\b", r"\bquitado\b", r"\bzerinho\b",
        r"\bperfeito\b", r"\bbem cuidado\b", r"\bnovo\b", r"\bnova\b", r"\bmanutencao\b", r"\bhistorico\b",
        r"\bmascara\b", r"\blataria\b", r"\bpecas?\b",
        r"\bnovinh", r"\balinhamento\b",
    ],
    "abertura": [
        r"\bolha\b", r"\bconfira\b", r"\bbom dia\b", r"\bboa tarde\b", r"\bfala\b", r"\bcheguei\b",
        r"\bchegou\b", r"\bapresentando\b", r"\bnovidade\b",
        r"\bsenhoras\b", r"\bsenhores\b",
    ],
}
_COMPILADOS = {t: [re.compile(p) for p in ps] for t, ps in LEXICO.items()}

# Família de animações de cada assunto (a primeira é a "voz" do assunto; as outras são variações).
ANIMACOES = {
    "abertura": ["blur", "subida", "lateral", "aproximar"],
    "neutro": ["blur", "subida", "revelar", "descida"],
    "especificacao": ["deslize", "revelar", "acende", "lateral"],
    "equipamento": ["cascata", "subida", "acende", "descida"],
    "condicao": ["revelar", "subida", "blur", "recuar"],
    "ano_km": ["pop", "deslize", "acende", "aproximar"],
    "preco": ["zoom", "pop", "aproximar", "recuar"],
    "chamada": ["zoom", "deslize", "pop", "lateral"],
}
SAIDAS_POR_ASSUNTO = {
    "abertura": ["dissolver", "subir", "recuar"],
    "neutro": ["dissolver", "descer", "subir"],
    "especificacao": ["esquerda", "direita", "dissolver"],
    "equipamento": ["subir", "direita", "descer"],
    "condicao": ["dissolver", "recuar", "subir"],
    "ano_km": ["recuar", "dissolver", "esquerda"],
    "preco": ["recuar", "aproximar", "dissolver"],
    "chamada": ["subir", "aproximar", "direita"],
}
COMPOSICOES_POR_ASSUNTO = {
    "abertura": ["linha", "duas_linhas", "pilha"],
    "neutro": ["linha", "duas_linhas"],
    "especificacao": ["duas_linhas", "esquerda", "direita"],
    "equipamento": ["escada", "esquerda", "duas_linhas"],
    "condicao": ["duas_linhas", "linha", "direita"],
    "ano_km": ["linha", "duas_linhas", "pilha"],
    "preco": ["linha", "pilha", "duas_linhas"],
    "chamada": ["pilha", "escada", "duas_linhas"],
}
ENERGIA = {  # intensidade base (0 suave, 1 média, 2 forte)
    "abertura": 0, "neutro": 0, "especificacao": 1, "equipamento": 1,
    "condicao": 1, "ano_km": 1, "preco": 2, "chamada": 2,
}
DESTAQUE_OBRIGATORIO = {"preco", "chamada", "ano_km"}
ANIMACOES_TODAS = sorted({a for lista in ANIMACOES.values() for a in lista})


def sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn").lower()


def nucleo(palavra: str) -> str:
    """Palavra sem pontuação (mantém letras, números, %, $)."""
    return re.sub(r"[^\w%$À-ú]", "", palavra)


def texto_da(palavras: list) -> str:
    return sem_acento(" ".join(w["w"] for w in palavras))


def frases(words: list, pausa: float = 0.9) -> list:
    """Separa as palavras em frases: ponto final/exclamação/interrogação ou pausa longa."""
    words = normalizar(words)
    saida, atual = [], []
    for w in words:
        if atual and w["s"] - atual[-1]["e"] > pausa:
            saida.append(atual)
            atual = []
        atual.append(w)
        if re.search(r"[.!?]$", w["w"]):
            saida.append(atual)
            atual = []
    if atual:
        saida.append(atual)
    return saida


def classificar(palavras: list, primeira: bool = False) -> tuple:
    """(assunto, pontos por assunto). `primeira` dá preferência a 'abertura' quando nada vende."""
    texto = texto_da(palavras)
    pontos = {t: sum(len(p.findall(texto)) for p in ps) for t, ps in _COMPILADOS.items()}
    # "62 mil" e "mil reais" falam de preço ou de km: o contexto decide.
    if re.search(r"\b\d+\s*mil\b", texto):
        alvo = "ano_km" if re.search(r"\b(km|quilometr|rodado)", texto) else "preco"
        pontos[alvo] += 2
    if primeira and pontos["abertura"]:
        pontos["abertura"] += 2   # a saudação do começo do vídeo abre o fluxo, mesmo citando o carro
    melhor = max(pontos.values())
    if melhor == 0:
        return ("abertura" if primeira else "neutro"), pontos
    candidatos = [t for t in PRIORIDADE if pontos.get(t, 0) == melhor]
    return candidatos[0], pontos


def palavra_destaque(palavras: list, assunto: str):
    """Índice da palavra que merece destaque no assunto da frase (ou None)."""
    def achar(padroes):
        for i, w in enumerate(palavras):
            if any(re.search(p, sem_acento(nucleo(w["w"]))) for p in padroes):
                return i
        return None

    if assunto in ("preco", "ano_km"):
        for i, w in enumerate(palavras):
            if re.search(r"\d", w["w"]):
                return i
    if assunto == "chamada":
        achado = achar([r"^(venha|vem|chama|chame|agende|agendar|aproveite|corre|ligue|garanta)$"])
        if achado is not None:
            return achado
    if assunto in _COMPILADOS:
        for i, w in enumerate(palavras):
            n = sem_acento(nucleo(w["w"]))
            if len(n) >= 4 and any(p.search(n) for p in _COMPILADOS[assunto]):
                return i
    melhor = max(range(len(palavras)), key=lambda i: len(nucleo(palavras[i]["w"])))
    return melhor if len(nucleo(palavras[melhor]["w"])) >= 6 else None


def _semente(veiculo: str) -> int:
    return zlib.crc32(sem_acento(veiculo or "").encode("utf-8"))


def planejar(words: list, agrupar, veiculo: str = "") -> list:
    """Plano de legendas do vídeo.

    `agrupar(palavras_da_frase)` devolve a frase dividida em grupos curtos (cabem numa linha).
    Cada item do plano: palavras, assunto, animacao, intensidade (0-2), destaque (índice ou None),
    direcao (-1 esquerda, +1 direita) e ordem.
    """
    plano, anteriores, direcao, ultimo_destaque = [], [], 1, False
    ultima_saida, ultima_composicao = None, None
    todas = frases(words)
    for fi, frase in enumerate(todas):
        assunto_frase, _ = classificar(frase, primeira=(fi == 0))
        grupos = agrupar(frase)
        for gi, grupo in enumerate(grupos):
            ordem = len(plano)
            # O bloco curto tem prioridade: um preço no final não transforma
            # toda a apresentação do carro em uma frase sobre preço.
            assunto, pontos_grupo = classificar(grupo, primeira=(ordem == 0))
            if ordem > 0 and not any(pontos_grupo.values()):
                vizinhas = [w for g in grupos[max(0, gi-1):gi+2] for w in g]
                assunto, _ = classificar(vizinhas)
            variacao = _semente(f"{veiculo}|{fi}|{gi}|{texto_da(grupo)}")
            opcoes = list(ANIMACOES[assunto])
            # Nunca repete a animação anterior; evita também a de duas atrás, se houver outra.
            livres = [a for a in opcoes if a not in anteriores[-1:]] or opcoes
            melhores = [a for a in livres if a not in anteriores[-2:]] or livres
            # O assunto restringe a família; o trecho fixa a variação, sem sorteio por render.
            indice = variacao % len(melhores)
            animacao = melhores[indice % len(melhores)]
            if animacao in ("deslize",):
                direcao = -direcao
            intensidade = ENERGIA[assunto]
            posicao = (fi + 1) / len(todas)
            if ordem == 0:
                intensidade = 0                       # abertura sempre suave
            elif posicao > 0.8 and assunto != "neutro":
                intensidade = min(2, intensidade + 1)  # o vídeo acelera até a chamada final
            destaque = palavra_destaque(grupo, assunto)
            if destaque is not None and assunto not in DESTAQUE_OBRIGATORIO and ultimo_destaque:
                destaque = None                        # destaque não vira rotina: alterna
            ultimo_destaque = destaque is not None
            duracao = max(0.1, grupo[-1]["e"] - grupo[0]["s"])
            ritmo = len(grupo) / duracao
            escolhas_saida = [s for s in SAIDAS_POR_ASSUNTO[assunto] if s != ultima_saida]
            saida = escolhas_saida[(variacao >> 8) % len(escolhas_saida)]
            composicoes = COMPOSICOES_POR_ASSUNTO[assunto]
            if ritmo > 3.8:
                composicoes = ["linha", "duas_linhas"]
            if len(grupo) == 1:
                composicoes = ["linha"]
            elif len(grupo) > 3:
                composicoes = [c for c in composicoes if c != "pilha"]
            livres_composicao = [c for c in composicoes if c != ultima_composicao] or composicoes
            composicao = livres_composicao[(variacao >> 16) % len(livres_composicao)]
            ultima_saida, ultima_composicao = saida, composicao
            plano.append({
                "palavras": grupo, "assunto": assunto, "animacao": animacao,
                "intensidade": intensidade, "destaque": destaque, "direcao": direcao,
                "ordem": ordem, "frase": fi,
                "assunto_frase": assunto_frase, "saida": saida, "composicao": composicao,
                "ritmo": round(ritmo, 2),
                "criterio": f"{assunto}; {len(grupo)} palavras; {ritmo:.1f} palavras/s",
            })
            anteriores.append(animacao)
    return plano


def resumo(plano: list) -> str:
    """Uma linha por frase, para o log e para conferir o fluxo."""
    linhas = []
    for p in plano:
        texto = " ".join(w["w"] for w in p["palavras"])
        composicao = p.get("composicao_efetiva", p["composicao"])
        linhas.append(f"{p['ordem']:>3} {p['assunto']:<13} {p['animacao']:<10} -> {p['saida']:<10} "
                      f"{composicao:<12} i{p['intensidade']} {texto}")
    return "\n".join(linhas)
