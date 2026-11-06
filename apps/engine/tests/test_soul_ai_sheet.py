"""Planilha da Soul IA: abas, cabeçalho e limpeza de caracteres inválidos."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl  # noqa: E402

from spreadsheets import soul_ai_sheet as soulia_planilha  # noqa: E402


class TestSouliaPlanilha(unittest.TestCase):
    def test_exporta_abas_e_limpa_controle(self):
        with tempfile.TemporaryDirectory() as t:
            pasta = Path(t)
            entrada = pasta / "dados.json"
            entrada.write_text(
                json.dumps(
                    {
                        "abas": [
                            {"nome": "Leads", "colunas": ["Nome", "Msgs"], "linhas": [["Ana", 3], ["Bia\x07", 5]]},
                            {"nome": "Resumo", "colunas": ["Item", "Valor"], "linhas": []},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            saida = pasta / "pasta" / "memoria.xlsx"
            r = soulia_planilha.exportar(str(entrada), str(saida))
            self.assertEqual(r["linhas"], 2)
            wb = openpyxl.load_workbook(saida)
            self.assertEqual(wb.sheetnames, ["Leads", "Resumo"])
            linhas = list(wb["Leads"].values)
            self.assertEqual(linhas[0], ("Nome", "Msgs"))
            self.assertEqual(linhas[2], ("Bia", 5))


if __name__ == "__main__":
    unittest.main()
