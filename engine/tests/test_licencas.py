"""Licenças das dependências do motor: nenhuma de copyleft forte e a lista de avisos sempre em dia."""

import importlib.util
import re
import tomllib
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("avisos", RAIZ / "scripts" / "gerar-avisos-licencas.py")
avisos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(avisos)


class TestLicencas(unittest.TestCase):
    def test_nenhuma_dependencia_de_copyleft_forte(self):
        fortes = [(n, lic) for n, _, lic, _ in avisos.pacotes() if avisos.COPYLEFT_FORTE.search(lic)]
        self.assertEqual(fortes, [], "Dependência com GPL/AGPL/LGPL: avalie antes de usar em software fechado")

    def test_todo_pacote_instalado_tem_licenca_identificada(self):
        sem = [n for n, _, lic, _ in avisos.pacotes() if lic == "VERIFICAR"]
        self.assertEqual(sem, [], "Inclua a licença em OVERRIDES (scripts/gerar-avisos-licencas.py)")

    def test_lista_de_avisos_cobre_o_uv_lock(self):
        lock = tomllib.loads((RAIZ / "engine" / "uv.lock").read_text(encoding="utf-8"))
        esperados = {(p["name"], p["version"]) for p in lock["package"] if p["name"] != "soul-engine"}
        texto = (RAIZ / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
        presentes = set(re.findall(r"^\| ([^| ]+) \| ([^| ]+) \|", texto, re.M))
        self.assertEqual(
            sorted(esperados - presentes),
            [],
            "THIRD_PARTY_NOTICES.md desatualizado: rode scripts/gerar-avisos-licencas.py",
        )

    def test_fontes_embutidas_tem_texto_da_licenca(self):
        self.assertTrue((RAIZ / "engine" / "video" / "assets" / "Lato-OFL.txt").is_file())
        self.assertTrue((RAIZ / "engine" / "video" / "assets" / "Lora-OFL.txt").is_file())
        self.assertTrue((RAIZ / "engine" / "video" / "assets" / "Lora-SemiBoldItalic.ttf").is_file())
        self.assertTrue((RAIZ / "engine" / "tessdata" / "LICENSE-tesseract.txt").is_file())


if __name__ == "__main__":
    unittest.main()
