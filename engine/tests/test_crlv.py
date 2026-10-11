"""Compara a leitura com os DOC.md gerados pelo sistema antigo.

Os CRLVs reais ficam fora do projeto (dados pessoais). SOUL_ESTOQUE aponta para a pasta
com as subpastas de veículos (cada uma com o PDF e o DOC.md); sem ela, os testes são ignorados.
"""

import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import crlv  # noqa: E402
import main  # noqa: E402

# Os CRLVs digitalizados não têm texto: a leitura passa pelo OCR, como no app.
ler = main._ler_com_ocr_se_preciso if hasattr(main, "_ler_com_ocr_se_preciso") else crlv.read_pdf


def ler(dados: bytes, incluir_texto: bool = False) -> dict:
    return main._ler_com_ocr_se_preciso(dados, None, incluir_texto=incluir_texto)

ESTOQUE = Path(os.environ.get("SOUL_ESTOQUE", r"tests/fixtures/estoque-opcional"))


def esperado(doc_md: Path) -> dict:
    doc = doc_md.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n---\n")[0]
    blocos = dict(re.findall(r"^## (.*)\n([\s\S]*?)(?=\n\n## |\Z)", doc, re.M))
    # O leitor antigo às vezes grudava o aviso do QR Code no valor (ex.: "2020 Valide este QR code com o app VIO");
    # o novo ignora esse texto, então a referência é limpa antes de comparar.
    limpar = lambda s: re.sub(r"\s*Valide este QR ?code.*$", "", s, flags=re.I)  # noqa: E731
    valor = lambda label: limpar(blocos.get("" if label == "CAT" else label, "").strip())  # noqa: E731
    return {fid: ("" if valor(label) == "NÃO IDENTIFICADO" else valor(label)) for fid, label in crlv.FIELDS}


# Campos que são anos: na referência antiga o OCR às vezes devolveu números impossíveis.
ANOS = {"exercicio", "fabricacao", "modelo"}


def pastas_com_crlv():
    if not ESTOQUE.is_dir():
        return []
    return [p for p in sorted(ESTOQUE.iterdir()) if (p / "DOC.md").exists() and list(p.glob("*.pdf"))]


@unittest.skipUnless(pastas_com_crlv(), "CRLVs de referência indisponíveis")
class TestCrlv(unittest.TestCase):
    def test_campos_iguais_ao_sistema_antigo(self):
        """CRLV digital (com texto): tem de sair igualzinho ao DOC.md do sistema antigo.

        CRLV digitalizado (lido por OCR): o DOC.md antigo é o mínimo, não o teto — ele
        deixou campos em branco que o leitor de hoje acha. Aqui só não pode CONTRADIZER
        um valor válido da referência.
        """
        melhorias = 0
        for pasta in pastas_com_crlv():
            with self.subTest(pasta=pasta.name):
                pdf = next(pasta.glob("*.pdf"))
                lido = ler(pdf.read_bytes())
                referencia = esperado(pasta / "DOC.md")
                if not lido.get("ocr"):
                    self.assertEqual(lido["values"], referencia)
                    continue
                for fid, _ in crlv.FIELDS:
                    antigo, novo = referencia.get(fid, ""), lido["values"][fid]
                    formato = crlv._FORMATOS.get(fid)
                    if formato and antigo and not re.fullmatch(formato[0], antigo):
                        continue  # valor inválido na referência (lixo do OCR antigo)
                    if fid in ANOS and antigo and not re.fullmatch(r"(19|20)\d{2}", antigo):
                        continue  # ex.: exercício "1015" — ano impossível, o antigo errou
                    if antigo:
                        self.assertEqual(novo, antigo, f"{pasta.name}: campo {fid}")
                    elif novo:
                        melhorias += 1
        print(f"OCR: {melhorias} campo(s) a mais que o sistema antigo")

    def test_senha(self):
        # CRLV real com senha "teste123": tem dados pessoais, então fica fora do repositório.
        protegido = Path(os.environ.get("SOUL_CRLV_PROTEGIDO", ""))
        if not protegido.is_file():
            self.skipTest("defina SOUL_CRLV_PROTEGIDO com o caminho de um CRLV protegido")
        with self.assertRaises(crlv.SenhaNecessaria):
            crlv.read_pdf(protegido.read_bytes())
        with self.assertRaises(crlv.SenhaNecessaria):
            crlv.read_pdf(protegido.read_bytes(), "errada")
        self.assertEqual(crlv.read_pdf(protegido.read_bytes(), "teste123")["values"]["placa"], "PJR1A63")


class TestSanitizar(unittest.TestCase):
    """PDF escaneado: o OCR erra campos de formato fixo; melhor vazio do que errado."""

    def test_descarta_renavam_com_letras(self):
        self.assertEqual(crlv.sanitizar({"renavam": "DE Ma Ea Ra"})["renavam"], "")

    def test_descarta_ano_ilegivel(self):
        self.assertEqual(crlv.sanitizar({"modelo": "am go"})["modelo"], "")

    def test_mantem_valores_validos(self):
        v = crlv.sanitizar({"renavam": "01234567890", "placa": "QDM0H07", "modelo": "2016", "chassi": "9BWZZZ377VT004251"})
        self.assertEqual(v, {"renavam": "01234567890", "placa": "QDM0H07", "modelo": "2016", "chassi": "9BWZZZ377VT004251"})

    def test_recupera_valor_com_ruido(self):
        self.assertEqual(crlv.sanitizar({"renavam": "0123 456 7890"})["renavam"], "01234567890")
        self.assertEqual(crlv.sanitizar({"placa": "qdm-0h07"})["placa"], "QDM0H07")


if __name__ == "__main__":
    unittest.main()
