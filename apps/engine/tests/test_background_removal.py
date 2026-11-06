"""Recorte de fundo (apps/engine/media/background_removal.py): modelo padrão rápido e limpeza da máscara."""

import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

TEM_DEPENDENCIAS = all(importlib.util.find_spec(m) for m in ("numpy", "scipy", "PIL"))


@unittest.skipUnless(TEM_DEPENDENCIAS, "grupo 'recorte' não instalado")
class TestFundo(unittest.TestCase):
    def setUp(self):
        from media import background_removal as fundo

        self.fundo = fundo

    def test_modelo_padrao_e_o_lite(self):
        # Medido: lite 14 a 24 s por foto (mantém teto e vidros escuros), completo 35 a 60 s,
        # ISNet 2 a 4 s mas corta teto solar. O padrão não pode voltar para o ISNet sem rever isso.
        self.assertEqual(self.fundo.MODELO, "birefnet-general-lite")
        self.assertEqual(self.fundo.MODELO_RAPIDO, "isnet-general-use")
        self.assertEqual(self.fundo.MODELO_QUALIDADE, "birefnet-general")

    def test_limpar_mascara_mantem_o_maior_objeto_e_fecha_buracos(self):
        import numpy as np

        alpha = np.zeros((120, 160), dtype=np.uint8)
        alpha[20:100, 20:120] = 255  # o carro
        alpha[50:60, 50:60] = 0  # vidro: buraco dentro do carro
        alpha[5:10, 140:150] = 255  # sobra solta, longe do carro
        saida = self.fundo.limpar_mascara(alpha)
        self.assertEqual(saida[55, 55], 255)  # buraco preenchido
        self.assertEqual(saida[7, 145], 0)  # sobra removida
        self.assertEqual(saida[60, 60], 255)  # carro intacto


if __name__ == "__main__":
    unittest.main()
