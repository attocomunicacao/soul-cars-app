"""OCR de equipamentos com um print gerado no formato do Carros na Web.

O print é desenhado em tamanho real (fonte de ~13 px, ícones de check verdes e um
ícone amarelo de opcional), com os 40 itens do resultado de referência do sistema antigo.
"""

import io
import json
import sys
import unicodedata
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from documents import ocr  # noqa: E402

QA = Path(__file__).resolve().parent / "fixtures" / "expected-equipment.json"
CHAVES = {"ocr-safety": "seguranca", "ocr-comfort": "conforto", "ocr-media": "infotenimento"}
TITULOS = {"seguranca": "SEGURANÇA", "conforto": "CONFORTO", "infotenimento": "INFOTENIMENTO"}
OPCIONAL = "Rodas de liga leve"


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper().strip()


def fonte(tamanho: int, negrito=False):
    for nome in (("arialbd.ttf" if negrito else "arial.ttf"), "segoeui.ttf"):
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()


def gerar_print(esperado: dict, escala: float = 1.0) -> bytes:
    s = lambda v: round(v * escala)  # noqa: E731
    img = Image.new("RGB", (s(760), s(620)), "white")
    d = ImageDraw.Draw(img)
    d.text((s(20), s(12)), "Equipamentos", fill=(170, 20, 30), font=fonte(s(20)))
    y = s(52)
    for cat, itens in esperado.items():
        d.text((s(40), y), TITULOS[cat], fill=(170, 20, 30), font=fonte(s(12)))
        y += s(22)
        for i, item in enumerate(itens):
            x = s(40) if i % 2 == 0 else s(400)
            row_y = y + (i // 2) * s(18)
            cor = (230, 190, 30) if item == OPCIONAL else (60, 160, 60)
            d.rectangle((x, row_y + s(2), x + s(11), row_y + s(13)), fill=cor)
            d.text((x + s(17), row_y), item, fill=(40, 40, 40), font=fonte(s(13)))
        y += ((len(itens) + 1) // 2) * s(18) + s(16)
    d.text((s(200), y + s(8)), "Legenda:    Equipamento de série     Equipamento opcional", fill=(40, 40, 40), font=fonte(s(12)))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


@unittest.skipUnless(QA.exists(), "resultado de referência indisponível")
class TestOcr(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.esperado = {CHAVES[k]: v.split("\n") for k, v in json.loads(QA.read_text("utf-8"))}
        cls.resultado = ocr.equipamentos(gerar_print(cls.esperado))

    def test_separa_as_tres_categorias(self):
        self.assertEqual(self.resultado["titulos"], 3)

    def test_reconhece_os_itens(self):
        acertos = total = 0
        for cat, itens in self.esperado.items():
            lidos = {norm(x.replace(" [OPCIONAL — confirmar no veículo]", "")): x for x in self.resultado["itens"][cat]}
            for item in itens:
                total += 1
                if norm(item) in lidos:
                    acertos += 1
                else:
                    print(f"\n  faltou [{cat}] {item}")
        extras = [
            f"[{cat}] {x}" for cat, lista in self.resultado["itens"].items() for x in lista
            if norm(x.replace(" [OPCIONAL — confirmar no veículo]", "")) not in {norm(e) for e in self.esperado[cat]}
        ]
        for x in extras:
            print("  lido  ", x)
        print(f"\nOCR: {acertos}/{total} itens exatos")
        self.assertGreaterEqual(acertos / total, 0.9)

    def test_marca_opcional_amarelo(self):
        opcionais = [x for x in self.resultado["itens"]["conforto"] if "OPCIONAL" in x]
        self.assertEqual([norm(x.split(" [")[0]) for x in opcionais], [norm(OPCIONAL)])


class TestIconeInicial(unittest.TestCase):
    """O ✅ do print às vezes vira uma letra colada no item ('JFreios ABS')."""

    def test_remove_letra_colada(self):
        self.assertEqual(ocr._limpar("JFreios ABS"), "Freios ABS")

    def test_remove_letra_separada(self):
        self.assertEqual(ocr._limpar("E Airbags frontais"), "Airbags frontais")

    def test_mantem_item_que_comeca_com_letra_de_verdade(self):
        for item in ("Ar quente", "Ar-condicionado", "HD interno", "Conta-giros", "Rádio FM"):
            self.assertEqual(ocr._limpar(item), item)


if __name__ == "__main__":
    unittest.main()
