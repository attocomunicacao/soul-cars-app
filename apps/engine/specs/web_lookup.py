"""Consulta na web para preencher a ficha: várias fontes, uma de cada vez, até uma responder.

Ordem: Carros na Web (equipamentos separados em série/opcional) e Ficha Completa (reserva).
Se uma fonte estiver bloqueada, fora do ar ou não achar o modelo, a seguinte é tentada sozinha;
o que falhou fica registrado em `avisos` para a interface mostrar. Nenhuma exige chave ou paga.
"""

from __future__ import annotations

from specs import carros_na_web as cnw
from specs import ficha_completa as fichacompleta

FONTES = (("Carros na Web", cnw), ("Ficha Completa", fichacompleta))


def _curto(exc: Exception) -> str:
    return str(exc).split(". ")[0].strip().rstrip(".")


def buscar(nome: str, ano: str | int | None = None) -> dict:
    """Versões do modelo/ano na primeira fonte que responder."""
    avisos: list[str] = []
    for rotulo, fonte in FONTES:
        try:
            resultado = fonte.buscar(nome, ano)
        except Exception as exc:  # cada fonte falha do seu jeito; a próxima assume
            avisos.append(f"{rotulo}: {_curto(exc)}")
            continue
        return {**resultado, "fonte": rotulo, "avisos": avisos}
    raise ValueError("Nenhuma fonte respondeu. " + " · ".join(avisos))


def ficha(codigo: str) -> dict:
    """Ficha da versão escolhida, na fonte de onde ela veio."""
    if str(codigo).startswith("fc:"):
        return fichacompleta.ficha(codigo)
    resultado = cnw.ficha(codigo)
    return {**resultado, "equipamentos_de_serie": True, "fonte": "Carros na Web"}
