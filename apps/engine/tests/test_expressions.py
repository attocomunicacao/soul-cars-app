"""Regressões de valores fragmentados e quebras de expressões numéricas."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video"))
import composition as composicao
import speech_context as contexto
import expressions as expressoes
import phrases as frases
import captions as legendas
import render


def palavras(textos):
    return [{"w": texto, "s": i * .3, "e": i * .3 + .2} for i, texto in enumerate(textos)]


class TestExpressoes(unittest.TestCase):
    def test_recompoe_moeda_sem_espacos_e_com_tempo_completo(self):
        for partes in (["R", "$49.900,00"], ["R$", "49.900,00"],
                       ["R", "$", "49.900,00"], ["R$ 49.900,00"],
                       ["R$", "49", ".900", ",00"],
                       ["R", "$", "49", ".", "900", ",", "00"]):
            with self.subTest(partes=partes):
                ws = palavras(partes)
                copia = [dict(w) for w in ws]
                resultado = render.fix_words(ws, "RENAULT DUSTER", [])
                self.assertEqual(resultado, [{"w": "R$49.900,00", "s": 0, "e": ws[-1]["e"]}])
                self.assertEqual(ws, copia)
                self.assertEqual(expressoes.normalizar(resultado), resultado)

    def test_outros_simbolos_e_pontuacao_final(self):
        for partes, esperado in ((["US$", "1,200.50!"], "US$1,200.50!"),
                                 (["€", "900,00"], "€900,00"),
                                 (["R", "$49.900,00", "."], "R$49.900,00.")):
            self.assertEqual(expressoes.normalizar(palavras(partes))[0]["w"], esperado)

    def test_nao_junta_numeros_independentes_nem_inventa_simbolo(self):
        for textos in (["R", "2014"], ["49", "900"], ["R$49", "2014"],
                       ["49.900,00", "reais"], ["quarenta", "e", "nove"]):
            ws = palavras(textos)
            self.assertEqual(expressoes.normalizar(ws), ws)

    def test_nao_atravessa_pausa_longa(self):
        ws = palavras(["R", "$49.900,00"])
        ws[1].update(s=3, e=4)
        self.assertEqual(expressoes.normalizar(ws), ws)

    def test_valor_unico_no_plano_e_no_ass(self):
        ws = palavras(["Por", "apenas", "R", "$49", ".", "900", ",", "00", "."])
        with tempfile.TemporaryDirectory() as pasta:
            arquivo = Path(pasta) / "legendas.ass"
            plano = legendas.gerar_ass(ws, 4, arquivo, render.FONT)
            tokens = [w for p in plano for w in p["palavras"]]
            self.assertEqual([w["w"] for w in tokens], ["Por", "apenas", "R$49.900,00."])
            self.assertEqual((tokens[-1]["s"], tokens[-1]["e"]), (ws[2]["s"], ws[-1]["e"]))
            self.assertIn("R$49.900,00.", arquivo.read_text(encoding="utf-8"))
            self.assertTrue(any(p["assunto"] == "preco" for p in plano))

    def test_unidade_fica_no_mesmo_bloco_mesmo_com_pouca_largura(self):
        for textos in (["Por", "apenas", "62", "mil", "reais."],
                       ["com", "123", "mil", "quilômetros", "rodados"],
                       ["tem", "150", "cv"], ["desconto", "10", "%"]):
            ws = palavras(textos)
            grupos = frases.agrupar(ws, cabe=lambda g: False)
            self.assertEqual([w for g in grupos for w in g], ws)
            for a, b in zip(grupos, grupos[1:]):
                self.assertFalse(expressoes.ligacao_numerica(a[-1]["w"], b[0]["w"]))

    def test_numero_e_unidade_na_mesma_linha_em_todos_os_layouts(self):
        for nome in composicao.PADROES:
            for textos in (["62", "mil", "reais"], ["apenas", "150", "cv"], ["10", "%"]):
                with self.subTest(layout=nome, textos=textos):
                    itens = composicao.distribuir({"palavras": palavras(textos), "destaque": None,
                                                  "composicao": nome}, render.FONT)
                    for a, b in zip(itens, itens[1:]):
                        if expressoes.ligacao_numerica(a["texto"], b["texto"]):
                            self.assertEqual(a["y"], b["y"])


if __name__ == "__main__":
    unittest.main()
