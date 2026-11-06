"""DOC.md gerado pelo app x DOC.md do sistema antigo (CRLVs reais do estoque)."""

import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from documents import crlv  # noqa: E402
import main  # noqa: E402

# Os CRLVs digitalizados não têm texto: a leitura passa pelo OCR, como no app.
ler = main._ler_com_ocr_se_preciso if hasattr(main, "_ler_com_ocr_se_preciso") else crlv.read_pdf


def ler(dados: bytes, incluir_texto: bool = False) -> dict:
    return main._ler_com_ocr_se_preciso(dados, None, incluir_texto=incluir_texto)

ESTOQUE = Path(os.environ.get("SOUL_ESTOQUE", r"tests/fixtures/estoque-opcional"))


def pastas():
    if not ESTOQUE.is_dir():
        return []
    return [p for p in sorted(ESTOQUE.iterdir()) if (p / "DOC.md").exists() and list(p.glob("*.pdf"))]


def cabecalho(texto: str) -> str:
    """Só a parte dos campos (antes do texto integral), normalizada."""
    parte = texto.replace("\r\n", "\n").split("\n---\n")[0].strip()
    # O leitor antigo às vezes colava o aviso do QR Code no valor.
    return re.sub(r"\s*Valide este QR ?code.*", "", parte, flags=re.I)


@unittest.skipUnless(pastas(), "CRLVs de referência indisponíveis")
class TestDocMd(unittest.TestCase):
    def test_campos_do_doc_md_batem(self):
        for pasta in pastas():
            with self.subTest(pasta=pasta.name):
                pdf = next(pasta.glob("*.pdf"))
                lido = ler(pdf.read_bytes(), incluir_texto=True)
                gerado = crlv.markdown(lido["values"], lido.get("paginas_texto", []))
                antigo = cabecalho((pasta / "DOC.md").read_text(encoding="utf-8"))
                if not lido.get("ocr"):
                    self.assertEqual(cabecalho(gerado), antigo)
                    continue
                # Digitalizado: o DOC.md de hoje tem de manter a estrutura e só pode
                # trocar "NÃO IDENTIFICADO" por um valor lido, nunca o contrário.
                titulos = lambda t: re.findall(r"^## (.*)$", t, re.M)  # noqa: E731
                self.assertEqual(titulos(cabecalho(gerado)), titulos(antigo))
                separador = "\n## "
                for bloco_novo, bloco_antigo in zip(
                    cabecalho(gerado).split(separador), antigo.split(separador)
                ):
                    # Ano impossível no DOC.md antigo (ex.: "0805") era lixo do OCR: não serve de referência.
                    ano_invalido = bloco_antigo.startswith(("EXERCÍCIO", "ANO FABRICAÇÃO", "ANO MODELO")) and not re.search(
                        r"\n(19|20)\d{2}\s*$", bloco_antigo
                    )
                    if "NÃO IDENTIFICADO" not in bloco_antigo and not ano_invalido:
                        self.assertEqual(bloco_novo, bloco_antigo)

    def test_estrutura_do_texto_integral(self):
        pasta = pastas()[0]
        pdf = next(pasta.glob("*.pdf"))
        lido = crlv.read_pdf(pdf.read_bytes(), incluir_texto=True)
        com_texto = crlv.markdown(lido["values"], lido["paginas_texto"])
        sem_texto = crlv.markdown(lido["values"], lido["paginas_texto"], incluir_texto=False)
        self.assertIn("# TEXTO INTEGRAL DO PDF", com_texto)
        self.assertIn("## PÁGINA 1\n\n```text\n", com_texto)
        self.assertNotIn("# TEXTO INTEGRAL", sem_texto)
        self.assertTrue(sem_texto.startswith("# DOCUMENTO\n\n## CÓDIGO RENAVAM\n"))

    def test_campo_vazio_vira_nao_identificado(self):
        md = crlv.markdown({"placa": "ABC1D23"}, [])
        self.assertIn("## PLACA\nABC1D23", md)
        self.assertIn("## CHASSI\nNÃO IDENTIFICADO", md)
        self.assertIn("## \nNÃO IDENTIFICADO", md)  # bloco CAT, sem título


if __name__ == "__main__":
    unittest.main()
