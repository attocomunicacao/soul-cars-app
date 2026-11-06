"""Timeline numérica: keyframes, relógio absoluto e amostragem determinística."""

from dataclasses import dataclass
import math

from .curves import CURVAS, progresso


@dataclass(frozen=True)
class Chave:
    tempo: float
    valor: float
    curva: str = "suave"

    def __post_init__(self):
        if not math.isfinite(self.tempo) or not math.isfinite(self.valor) or self.tempo < 0 or self.curva not in CURVAS:
            raise ValueError("Keyframe de movimento inválido.")


@dataclass(frozen=True)
class Trilha:
    chaves: tuple[Chave, ...]

    def __post_init__(self):
        if not self.chaves or any(b.tempo <= a.tempo for a, b in zip(self.chaves, self.chaves[1:])):
            raise ValueError("Keyframes precisam de tempos estritamente crescentes.")

    def valor(self, tempo: float) -> float:
        if not math.isfinite(tempo):
            raise ValueError("Tempo de movimento inválido.")
        if tempo <= self.chaves[0].tempo:
            return self.chaves[0].valor
        for a, b in zip(self.chaves, self.chaves[1:]):
            if tempo < b.tempo:
                p = progresso(b.curva, (tempo - a.tempo) / (b.tempo - a.tempo))
                return a.valor + (b.valor - a.valor) * p
        return self.chaves[-1].valor


@dataclass(frozen=True)
class Animacao:
    inicio: float
    fim: float
    trilhas: dict[str, Trilha]

    def __post_init__(self):
        if (not math.isfinite(self.inicio) or not math.isfinite(self.fim)
                or self.inicio < 0 or self.fim <= self.inicio or not self.trilhas):
            raise ValueError("Intervalo de animação inválido.")
        if any(t.chaves[-1].tempo > self.fim - self.inicio + 1e-8 for t in self.trilhas.values()):
            raise ValueError("Keyframe ultrapassa a duração da animação.")

    def estado(self, tempo: float) -> dict[str, float]:
        return {nome: trilha.valor(tempo - self.inicio) for nome, trilha in self.trilhas.items()}

    def segmentos(self, fps: float = 100) -> list:
        """Amostra apenas transições; períodos constantes viram um único trecho.

        ASS tem resolução de centésimos. Os dois adaptadores usam essa grade,
        incluindo fronteiras exatas, sem eventos sobrepostos ou relógio reiniciado.
        """
        if not math.isfinite(fps) or not 1 <= fps <= 100:
            raise ValueError("Taxa de amostragem precisa estar entre 1 e 100 fps.")
        limites = sorted({0.0, self.fim - self.inicio,
                          *(c.tempo for t in self.trilhas.values() for c in t.chaves)})
        pontos = {round(self.inicio, 2), round(self.fim, 2)}
        for a, b in zip(limites, limites[1:]):
            movendo = any(abs(t.valor(a) - t.valor(b)) > 1e-8 for t in self.trilhas.values())
            n = max(1, math.ceil((b - a) * fps)) if movendo else 1
            pontos.update(round(self.inicio + a + (b - a) * i / n, 2) for i in range(n + 1))
        tempos = sorted(pontos)
        return [(a, b, self.estado(a), self.estado(b)) for a, b in zip(tempos, tempos[1:]) if b > a]


def transicao(inicio: float, fim: float, inicial: dict, estavel: dict, final: dict,
              entrada: float = 0.38, saida: float = 0.18, curva: str = "suave") -> Animacao:
    """Entrada → permanência → saída, com 20% de repouso mesmo em clipes curtos."""
    if set(inicial) != set(estavel) or set(estavel) != set(final):
        raise ValueError("Estados da transição precisam das mesmas propriedades.")
    if not all(math.isfinite(v) and v > 0 for v in (entrada, saida)) or fim <= inicio:
        raise ValueError("Durações de movimento inválidas.")
    dur = fim - inicio
    fator = min(1.0, dur * 0.8 / (entrada + saida))
    entra, sai = entrada * fator, saida * fator
    trilhas = {}
    for nome in inicial:
        curva_entrada = "visibilidade" if nome == "opacidade" else curva
        trilhas[nome] = Trilha((Chave(0, inicial[nome]), Chave(entra, estavel[nome], curva_entrada),
                               Chave(dur - sai, estavel[nome]), Chave(dur, final[nome], "saida")))
    return Animacao(inicio, fim, trilhas)
