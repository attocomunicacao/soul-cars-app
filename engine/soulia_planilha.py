"""Planilha da Soul IA: leads, mensagens, eventos e resumo em um .xlsx.

Recebe as abas prontas (cabeçalho + linhas) de um arquivo JSON temporário, para não passar
centenas de milhares de linhas pela conversa com o app. Usa o modo de escrita do openpyxl, que
não guarda a planilha inteira na memória.
"""

import json
import os
import tempfile
from pathlib import Path


def _limpar(valor):
    """Excel recusa caracteres de controle; texto de mensagem às vezes traz."""
    if isinstance(valor, str):
        return "".join(c for c in valor if c in "\n\t" or ord(c) >= 32)[:32000]
    return valor


def exportar(entrada: str, saida: str) -> dict:
    from openpyxl import Workbook
    from openpyxl.cell import WriteOnlyCell
    from openpyxl.styles import Font

    dados = json.loads(Path(entrada).read_text(encoding="utf-8"))
    wb = Workbook(write_only=True)
    total = 0
    for aba in dados["abas"]:
        ws = wb.create_sheet(title=str(aba["nome"])[:31])
        larguras = aba.get("larguras") or []
        for i, largura in enumerate(larguras, start=1):
            ws.column_dimensions[chr(64 + i)].width = largura
        ws.freeze_panes = "A2"
        negrito = Font(bold=True)
        cabecalho = []
        for titulo in aba["colunas"]:
            c = WriteOnlyCell(ws, value=titulo)
            c.font = negrito
            cabecalho.append(c)
        ws.append(cabecalho)
        for linha in aba["linhas"]:
            ws.append([_limpar(v) for v in linha])
            total += 1
    destino = Path(saida)
    destino.parent.mkdir(parents=True, exist_ok=True)
    descritor, temporario = tempfile.mkstemp(suffix=".xlsx", dir=destino.parent)
    os.close(descritor)
    try:
        wb.save(temporario)
        os.replace(temporario, destino)
    finally:
        if os.path.exists(temporario):
            os.remove(temporario)
    return {"arquivo": str(destino), "linhas": total}
