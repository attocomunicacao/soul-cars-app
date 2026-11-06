"""Curvas normalizadas. Bézier resolve x(t) antes de avaliar y(t), como no CSS."""

import math


def bezier(t: float, x1: float, y1: float, x2: float, y2: float) -> float:
    if not all(math.isfinite(v) for v in (t, x1, y1, x2, y2)) or not (0 <= x1 <= 1 and 0 <= x2 <= 1):
        raise ValueError("Curva Bézier inválida.")
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0

    def avaliar(u, a, b):
        return 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * b + u ** 3

    baixo, alto = 0.0, 1.0
    for _ in range(28):
        u = (baixo + alto) / 2
        if avaliar(u, x1, x2) < t:
            baixo = u
        else:
            alto = u
    return avaliar((baixo + alto) / 2, y1, y2)


def mola_amortecida(t: float) -> float:
    """Resposta criticamente amortecida: assenta sem rebote nem salto no final."""
    t = min(1.0, max(0.0, t))
    # Correção Hermite do resíduo garante posição e velocidade finais exatas.
    k = 8.0
    residuo = (1 + k) * math.exp(-k)
    velocidade = k * k * math.exp(-k)
    return (1 - (1 + k * t) * math.exp(-k * t)
            + residuo * (3 * t * t - 2 * t ** 3)
            - velocidade * (t ** 3 - t * t))


CURVAS = {
    "linear": lambda t: t,
    "suave": lambda t: bezier(t, 0.25, 0.46, 0.45, 1.0),
    "visibilidade": lambda t: bezier(t, 0.4, 0.0, 0.2, 1.0),
    "saida": lambda t: bezier(t, 0.4, 0.0, 0.8, 0.2),
    "mola": mola_amortecida,
}


def progresso(nome: str, t: float) -> float:
    if nome not in CURVAS or not math.isfinite(t):
        raise ValueError("Curva de movimento desconhecida ou tempo inválido.")
    return CURVAS[nome](min(1.0, max(0.0, t)))
