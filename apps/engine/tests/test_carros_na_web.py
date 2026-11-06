"""Leitura do Carros na Web, sem depender do site no ar.

As páginas de verdade são grandes e são do site; aqui usamos trechos pequenos com a
mesma marcação (o link da versão, os rótulos da ficha e as duas cores de ícone dos
equipamentos), que é o que os leitores precisam entender.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from specs import carros_na_web as cnw  # noqa: E402

CATALOGO = """
<html><body>
<td><a HREF="fichadetalhe.asp?codigo=18294"><img src="thumb/argo.jpg"
   title="Ficha t&eacute;cnica, equipamentos e fotos do Fiat&nbsp;Argo&nbsp;Drive 1.0"></a></td>
<td><a HREF="fichadetalhe.asp?codigo=18296"><img src="thumb/trekking.jpg"
   title="Ficha t&eacute;cnica, equipamentos e fotos do Fiat&nbsp;Argo&nbsp;Trekking 1.3"></a></td>
</body></html>
"""

FICHA = """
<html><body>
<font>Compartilhe:</font>
<font>Fiat Argo Drive 1.0</font>
<tr><td>Ano</td><td>2022</td></tr>
<tr><td>Combust&iacute;vel</td><td>Flex (&aacute;lcool/gasolina)</td></tr>
<tr><td>Configura&ccedil;&atilde;o</td><td>Hatchback</td></tr>
<tr><td>Lugares</td><td>5</td></tr>
<tr><td>Portas</td><td>4</td></tr>
<tr><td>TRANSMISS&Atilde;O</td></tr>
<tr><td>C&acirc;mbio</td><td>Manual</td><td>de 5 marchas</td></tr>
<tr><td>C&oacute;digo do c&acirc;mbio</td><td>C513</td></tr>
<tr><td>DIRE&Ccedil;&Atilde;O</td></tr>
<tr><td>Assist&ecirc;ncia</td><td>El&eacute;trica</td></tr>
<td><font>Equipamentos</font></td>
<td colspan="4"><font COLOR="darkred">&nbsp;SEGURAN&Ccedil;A</font></td>
<tr>
  <td><img src="/imgsite/verde.gif" title="Equipamento de s&eacute;rie"> </td>
  <td valign=top><font>Freios ABS</font></td>
  <td><img src="/imgsite/amarelo.gif" title="Equipamento opcional"> </td>
  <td valign=top><font>Controle de estabilidade</font></td>
</tr>
<td colspan="4"><font COLOR="darkred">&nbsp;CONFORTO</font></td>
<tr>
  <td><img src="/imgsite/verde.gif" title="Equipamento de s&eacute;rie"> </td>
  <td valign=top><font>Ar-condicionado</font></td>
  <td><img src="/imgsite/verde.gif" title="Equipamento de s&eacute;rie"> </td>
  <td valign=top><font>Dire&ccedil;&atilde;o assistida</font></td>
</tr>
<td colspan="4"><font COLOR="darkred">&nbsp;INFOTENIMENTO</font></td>
<tr>
  <td><img src="/imgsite/verde.gif" title="Equipamento de s&eacute;rie"> </td>
  <td valign=top><font>Conex&atilde;o Bluetooth</font></td>
  <td><img src="/imgsite/amarelo.gif" title="Equipamento opcional"> </td>
  <td valign=top><font>Central multim&iacute;dia</font></td>
</tr>
</body></html>
"""


class TestBusca(unittest.TestCase):
    def test_tira_a_marca_do_nome(self):
        self.assertEqual(cnw._modelo_de("FIAT ARGO"), "ARGO")
        self.assertEqual(cnw._modelo_de("Mercedes Benz GLA 250"), "GLA 250")
        self.assertEqual(cnw._modelo_de("Fiorino"), "FIORINO")

    def test_le_as_versoes_do_catalogo(self):
        versoes = []
        for achado in cnw.re.finditer(r'(?i)fichadetalhe\.asp\?codigo=(\d+)"', CATALOGO):
            vizinho = cnw.re.search(r'(?i)title="([^"]+)"', CATALOGO[achado.end() : achado.end() + 400])
            rotulo = cnw._texto(vizinho.group(1))
            versoes.append((achado.group(1), cnw.re.sub(r"(?i)^ficha t[eé]cnica,[^d]*do\s+", "", rotulo).strip()))
        self.assertEqual(versoes, [("18294", "Fiat Argo Drive 1.0"), ("18296", "Fiat Argo Trekking 1.3")])


class TestFicha(unittest.TestCase):
    def setUp(self):
        self.linhas = cnw._linhas(FICHA)
        self.rotulos = {cnw._sem_acento(x) for x in [
            "Ano", "Combustível", "Configuração", "Lugares", "Portas", "Câmbio",
            "Código do câmbio", "Assistência", "TRANSMISSÃO", "DIREÇÃO",
        ]}

    def test_campos_tecnicos(self):
        valor = lambda r, n=1: cnw._valor_apos(self.linhas, r, self.rotulos, n)  # noqa: E731
        self.assertEqual(valor("Configuração"), "Hatchback")
        self.assertEqual(valor("Lugares"), "5")
        self.assertEqual(valor("Portas"), "4")
        self.assertEqual(valor("Câmbio", 2), "Manual de 5 marchas")
        depois = self.linhas[next(i for i, l in enumerate(self.linhas) if cnw._sem_acento(l) == "DIRECAO"):]
        self.assertEqual(cnw._valor_apos(depois, "Assistência", self.rotulos, 1), "Elétrica")

    def test_so_equipamentos_de_serie(self):
        itens = cnw._equipamentos(FICHA)
        self.assertEqual(itens["seguranca"], ["Freios ABS"])
        self.assertEqual(itens["conforto"], ["Ar-condicionado", "Direção assistida"])
        self.assertEqual(itens["infotenimento"], ["Conexão Bluetooth"])
        # Os opcionais (ícone amarelo) não podem entrar no anúncio.
        todos = sum(itens.values(), [])
        self.assertNotIn("Controle de estabilidade", todos)
        self.assertNotIn("Central multimídia", todos)


TEXTO_COPIADO = """Compartilhe:
Fiat Argo Drive 1.0
Ano
2022
Combustível
Flex (álcool/gasolina)
Configuração
Hatchback
Lugares 5
Portas
4
TRANSMISSÃO
Câmbio
Manual
de 5 marchas
DIREÇÃO
Assistência
Elétrica
"""


class TestTextoColado(unittest.TestCase):
    def test_le_os_dados_tecnicos_do_texto_copiado(self):
        d = cnw.ficha_texto(TEXTO_COPIADO)
        self.assertEqual(d["tecnicos"]["ano"], "2022")
        self.assertEqual(d["tecnicos"]["lugares"], "5")
        self.assertEqual(d["tecnicos"]["cambio"], "Manual de 5 marchas")
        self.assertEqual(d["tecnicos"]["direcao"], "Elétrica")
        # Equipamentos só de série: do texto não dá para saber, então ficam vazios.
        self.assertEqual(sum(d["equipamentos"].values(), []), [])

    def test_texto_que_nao_e_a_ficha_da_erro_claro(self):
        with self.assertRaises(ValueError):
            cnw.ficha_texto("oi")
        with self.assertRaises(ValueError):
            cnw.ficha_texto("a\nb\nc\nd\ne\nf")


class TestPausa(unittest.TestCase):
    def tearDown(self):
        cnw._pausado_ate = 0.0

    def test_apos_erro_do_site_nao_consulta_de_novo_na_janela_de_pausa(self):
        cnw._pausado_ate = cnw.time.time() + 600
        with self.assertRaises(cnw.SiteComErro) as ctx:
            cnw.buscar("GLA 250", "2016")
        self.assertIn("não vai consultar o site de novo", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
