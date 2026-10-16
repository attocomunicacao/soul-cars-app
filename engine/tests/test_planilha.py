"""Edição da planilha de finanças: células, linhas novas, exclusão e totais."""

import datetime as dt
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl  # noqa: E402
from openpyxl.worksheet.table import Table  # noqa: E402

import planilha  # noqa: E402


def _criar(pasta: Path) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "OUTUBRO"
    ws.append([])
    ws.append([None, "VENCIMENTO", "DESTINATÁRIO", "VALOR"])
    ws.append([None, dt.datetime(2026, 10, 5), "ENEL", 100.0])
    ws.append([None, dt.datetime(2026, 10, 5), "VIVO", 50.0])
    ws.append([None, "05/10/2026", "TOTAL", "=SUM(OUTUBRO!$D$3:$D$4)"])
    ws.append([])
    ws.append([None, "VENCIMENTO", "DESTINATÁRIO", "VALOR"])
    ws.append([None, dt.datetime(2026, 10, 20), "GESSE", 200.0])
    ws.append([None, "20/10/2026", "TOTAL", "=SUM(OUTUBRO!$D$8:$D$8)"])
    ws.add_table(Table(displayName="T1", ref="B2:D5"))
    ws.add_table(Table(displayName="T2", ref="B7:D9"))
    caminho = pasta / "fin.xlsx"
    wb.save(caminho)
    return caminho


class TestPlanilha(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.pasta = Path(self._tmp.name)
        self.arquivo = _criar(self.pasta)
        self.backups = self.pasta / "bk"

    def tearDown(self):
        self._tmp.cleanup()

    def _aplicar(self, ops, lido_em=None):
        return planilha.aplicar(str(self.arquivo), ops, lido_em, str(self.backups))

    def _ws(self):
        return self._ws_de("OUTUBRO")

    def _ws_de(self, aba):
        return openpyxl.load_workbook(self.arquivo)[aba]

    def test_edita_vencimento_e_valor(self):
        self._aplicar(
            [
                {"op": "celula", "aba": "OUTUBRO", "linha": 3, "coluna": 4, "valor": "12.5", "tipo": "numero"},
                {"op": "celula", "aba": "OUTUBRO", "linha": 3, "coluna": 2, "valor": "2026-11-07", "tipo": "data"},
            ]
        )
        ws = self._ws()
        self.assertEqual(ws["D3"].value, 12.5)
        self.assertEqual(ws["B3"].value, dt.datetime(2026, 11, 7))
        self.assertEqual(ws["D5"].value, "=SUM('OUTUBRO'!$D$3:$D$4)")

    def test_so_vencimento_e_valor_mudam_pelo_app(self):
        with self.assertRaises(ValueError):
            self._aplicar([{"op": "celula", "aba": "OUTUBRO", "linha": 3, "coluna": 3, "valor": "x"}])

    def test_nao_edita_cabecalho_nem_total(self):
        for linha in (2, 5):
            with self.assertRaises(ValueError):
                self._aplicar([{"op": "celula", "aba": "OUTUBRO", "linha": linha, "coluna": 4, "valor": "1"}])

    def test_novo_mes_copia_contas_e_zera_as_variaveis(self):
        variaveis = [["enel"], ["gesse"]]
        self._aplicar([{"op": "novo_mes", "aba": "OUTUBRO", "variaveis": variaveis}])
        wb = openpyxl.load_workbook(self.arquivo)
        self.assertEqual(wb.sheetnames, ["OUTUBRO", "NOVEMBRO"])
        ws = wb["NOVEMBRO"]
        self.assertEqual(ws["C3"].value, "ENEL")
        self.assertIsNone(ws["D3"].value)  # variável
        self.assertEqual(ws["D4"].value, 50.0)  # fixa
        self.assertIsNone(ws["D8"].value)
        self.assertEqual(ws["B3"].value, dt.datetime(2026, 11, 5))
        self.assertEqual(ws["B8"].value, dt.datetime(2026, 11, 20))
        self.assertEqual(ws["B5"].value, "05/11/2026")
        self.assertEqual(ws["D5"].value, "=SUM('NOVEMBRO'!$D$3:$D$4)")
        self.assertEqual([t.ref for t in ws.tables.values()], ["B2:D5", "B7:D9"])
        nomes = [t.displayName for w in wb for t in w.tables.values()]
        self.assertEqual(len(nomes), len(set(nomes)))
        self.assertEqual(wb["OUTUBRO"]["D3"].value, 100.0)  # o mês de origem não muda

    def test_novo_mes_de_dezembro_vira_janeiro_do_ano_seguinte(self):
        wb = openpyxl.load_workbook(self.arquivo)
        wb["OUTUBRO"].title = "DEZEMBRO"
        for linha in wb["DEZEMBRO"].iter_rows(min_col=2, max_col=2):
            for c in linha:
                if isinstance(c.value, dt.datetime):
                    c.value = c.value.replace(month=12)
        wb.save(self.arquivo)
        self._aplicar([{"op": "novo_mes", "aba": "DEZEMBRO"}])
        ws = self._ws_de("JANEIRO")
        self.assertEqual(ws["B3"].value, dt.datetime(2027, 1, 5))

    def test_novo_mes_nao_repete_aba_existente(self):
        self._aplicar([{"op": "novo_mes", "aba": "OUTUBRO"}])
        with self.assertRaises(ValueError):
            self._aplicar([{"op": "novo_mes", "aba": "OUTUBRO"}])

    def test_otimizar_corrige_totais_e_datas(self):
        wb = openpyxl.load_workbook(self.arquivo)
        wb["OUTUBRO"]["D5"].value = "=SUM(OUTUBRO!$D$3:$D$3)"
        wb["OUTUBRO"]["B8"].value = dt.datetime(2026, 9, 20)
        wb.save(self.arquivo)
        planilha.otimizar(str(self.arquivo), str(self.backups))
        ws = self._ws()
        self.assertEqual(ws["D5"].value, "=SUM('OUTUBRO'!$D$3:$D$4)")
        self.assertEqual(ws["B8"].value, dt.datetime(2026, 10, 20))

    def test_recusa_arquivo_alterado_depois_da_leitura(self):
        with self.assertRaises(ValueError):
            self._aplicar([{"op": "celula", "aba": "OUTUBRO", "linha": 3, "coluna": 4, "valor": "1"}], lido_em=1.0)

    def test_guarda_backup_e_aba_invalida_nao_grava(self):
        with self.assertRaises(ValueError):
            self._aplicar([{"op": "celula", "aba": "NADA", "linha": 3, "coluna": 4}])
        self.assertFalse(self.backups.exists())
        self._aplicar([{"op": "celula", "aba": "OUTUBRO", "linha": 3, "coluna": 4, "valor": "7", "tipo": "numero"}])
        self.assertEqual(len(list(self.backups.glob("fin-*.xlsx"))), 1)


if __name__ == "__main__":
    unittest.main()
