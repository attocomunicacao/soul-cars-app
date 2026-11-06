"""Consulta na web com várias fontes, sem depender de nenhum site no ar.

Usa páginas pequenas com a mesma marcação do Ficha Completa e substitui a rede por texto fixo.
"""

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from specs import carros_na_web as cnw  # noqa: E402
from specs import web_lookup as ficha_web  # noqa: E402
from specs import ficha_completa as fichacompleta  # noqa: E402

BLOCO = "<p>x</p>" * 400  # as páginas reais têm muito mais que 2000 caracteres

PAGINA = (
    "<html><body><h1>Mercedes-benz Gla 250 Sport 2.0 Turbo 2016</h1>"
    "<div>Informações</div><div>Ano</div><div>2016</div><div>Combustível</div><div>Gasolina</div>"
    "<div>Configuração</div><div>SUV</div><div>Lugares</div><div>5</div><div>Portas</div><div>4</div>"
    "<h2>Ficha Técnica</h2><div>Transmissão</div><div>Câmbio</div><div>Automatizado</div>"
    "<div>Quantidade de marchas</div><div>7</div><div>Direção</div><div>Assistência</div><div>Elétrica</div>"
    "<h2>Equipamentos</h2><h3>Conforto</h3><div>Ar-condicionado</div><div>Teto solar elétrico</div>"
    "<h3>Infotenimento</h3><div>Conexão Bluetooth</div>"
    "<h3>Segurança</h3><div>Freios ABS</div><div>Airbags frontais</div>"
    "<h2>Avaliações</h2><div>Ruim</div></body></html>" + BLOCO
)


class TestLeituraDaFicha(unittest.TestCase):
    def test_dados_tecnicos(self):
        d = fichacompleta.ler_ficha(PAGINA)["tecnicos"]
        self.assertEqual(d["ano"], "2016")
        self.assertEqual(d["lugares"], "5")
        self.assertEqual(d["portas"], "4")
        self.assertEqual(d["combustivel"], "Gasolina")
        self.assertEqual(d["cambio"], "Automatizado de 7 marchas")
        self.assertEqual(d["direcao"], "Elétrica")

    def test_equipamentos_por_grupo_e_nao_misturam_avaliacoes(self):
        e = fichacompleta.ler_ficha(PAGINA)["equipamentos"]
        self.assertEqual(e["conforto"], ["Ar-condicionado", "Teto solar elétrico"])
        self.assertEqual(e["infotenimento"], ["Conexão Bluetooth"])
        self.assertEqual(e["seguranca"], ["Freios ABS", "Airbags frontais"])

    def test_pagina_sem_ficha_e_recusada(self):
        with self.assertRaises(fichacompleta.FonteIndisponivel):
            fichacompleta.ler_ficha("<html><body>nada aqui</body></html>" + BLOCO)

    def test_equipamentos_desta_fonte_nao_sao_de_serie(self):
        with mock.patch.object(fichacompleta, "_pegar", return_value=PAGINA):
            r = fichacompleta.ficha("fc:/carros/mercedes-benz/gla-250-sport-2-0-turbo-2016")
        self.assertFalse(r["equipamentos_de_serie"])
        self.assertEqual(r["fonte"], "Ficha Completa")

    def test_codigo_invalido(self):
        with self.assertRaises(ValueError):
            fichacompleta.ficha("fc:/../etc/passwd")


class TestOrdemDasFontes(unittest.TestCase):
    def test_usa_a_reserva_quando_a_primeira_falha(self):
        reserva = {"modelo": "GLA 250", "versoes": [{"codigo": "fc:/carros/x/y-2016", "titulo": "Y", "ano": "2016"}], "busca": ""}
        with mock.patch.object(cnw, "buscar", side_effect=cnw.SiteComErro("bloqueado. Detalhe")), mock.patch.object(
            fichacompleta, "buscar", return_value=reserva
        ):
            r = ficha_web.buscar("GLA 250", "2016")
        self.assertEqual(r["fonte"], "Ficha Completa")
        self.assertEqual(r["avisos"], ["Carros na Web: bloqueado"])

    def test_primeira_fonte_vence_quando_responde(self):
        principal = {"modelo": "ARGO", "versoes": [{"codigo": "1", "titulo": "Argo", "ano": "2022"}], "busca": ""}
        with mock.patch.object(cnw, "buscar", return_value=principal), mock.patch.object(fichacompleta, "buscar") as reserva:
            r = ficha_web.buscar("Fiat Argo", "2022")
        self.assertEqual(r["fonte"], "Carros na Web")
        reserva.assert_not_called()

    def test_todas_falhando_explica_cada_uma(self):
        with mock.patch.object(cnw, "buscar", side_effect=ValueError("a")), mock.patch.object(
            fichacompleta, "buscar", side_effect=ValueError("b")
        ):
            with self.assertRaises(ValueError) as ctx:
                ficha_web.buscar("X", "2020")
        self.assertIn("Carros na Web: a", str(ctx.exception))
        self.assertIn("Ficha Completa: b", str(ctx.exception))

    def test_ficha_vai_para_a_fonte_do_codigo(self):
        with mock.patch.object(fichacompleta, "ficha", return_value={"fonte": "Ficha Completa"}) as fc:
            ficha_web.ficha("fc:/carros/a/b-2016")
        fc.assert_called_once()
        with mock.patch.object(cnw, "ficha", return_value={"tecnicos": {}, "equipamentos": {}}):
            r = ficha_web.ficha("123")
        self.assertTrue(r["equipamentos_de_serie"])
        self.assertEqual(r["fonte"], "Carros na Web")


def _paginas(mapa):
    def pegar(caminho, tentativas=2):
        if caminho not in mapa:
            raise fichacompleta.PaginaInexistente("404")
        return mapa[caminho]

    return pegar


class TestNomeDoCadastro(unittest.TestCase):
    """O nome do cadastro tem palavras que o site não usa; ainda assim acha o modelo certo."""

    MAPA = {
        "/carros/ford/": '<a href="/carros/ford/fiesta/"></a><a href="/carros/ford/fiesta-sedan/"></a><a href="/carros/ford/ka/"></a>',
        "/carros/ford/fiesta/": '<a href="/carros/ford/fiesta-1-6-2013"></a><a href="/carros/ford/fiesta-se-1-6-16v-2013"></a><a href="/carros/ford/fiesta-1-0-2012"></a>',
        "/carros/ford/fiesta-sedan/": '<a href="/carros/ford/fiesta-sedan-1-6-2013"></a>',
        "/carros/chevrolet/": '<a href="/carros/chevrolet/corsa/"></a><a href="/carros/chevrolet/corsa-sedan/"></a>',
        "/carros/chevrolet/corsa/": '<a href="/carros/chevrolet/corsa-wind-1-0-2005"></a>',
        "/carros/chevrolet/corsa-sedan/": '<a href="/carros/chevrolet/corsa-sedan-joy-1-0-2005"></a>',
    }

    def setUp(self):
        fichacompleta._memoria.clear()
        self.patch = mock.patch.object(fichacompleta, "_pegar", side_effect=_paginas(self.MAPA))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()

    def test_new_fiesta_hatch_acha_fiesta_e_nao_o_sedan(self):
        r = fichacompleta.buscar("Ford New Fiesta Hatch", "2013")
        caminhos = [v["codigo"] for v in r["versoes"]]
        self.assertEqual(caminhos, ["fc:/carros/ford/fiesta-1-6-2013", "fc:/carros/ford/fiesta-se-1-6-16v-2013"])
        self.assertEqual(r["ignoradas"], ["hatch", "new"])

    def test_modelo_mais_especifico_vence(self):
        r = fichacompleta.buscar("Chevrolet Corsa Sedan", "2005")
        self.assertEqual([v["codigo"] for v in r["versoes"]], ["fc:/carros/chevrolet/corsa-sedan-joy-1-0-2005"])

    def test_filtra_pelo_ano(self):
        r = fichacompleta.buscar("Ford Fiesta", "2012")
        self.assertEqual([v["ano"] for v in r["versoes"]], ["2012"])

    def test_limite_de_consultas_pausa_a_fonte(self):
        fichacompleta._pausado_ate = fichacompleta.time.time() + 600
        self.patch.stop()
        try:
            with self.assertRaises(fichacompleta.FonteIndisponivel) as ctx:
                fichacompleta._pegar("/carros/ford/")
            self.assertIn("limitando consultas", str(ctx.exception))
        finally:
            fichacompleta._pausado_ate = 0.0
            self.patch.start()


if __name__ == "__main__":
    unittest.main()
