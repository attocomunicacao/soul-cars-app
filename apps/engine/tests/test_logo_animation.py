"""Valida o encerramento animado com quadros reais do FFmpeg."""
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video"))
import logo_animation as animacao_logo


class AnimacaoLogoTests(unittest.TestCase):
    def test_rejeita_duracao_invalida(self):
        with self.assertRaises(ValueError):
            animacao_logo.filtros(0, 0, 320, 568, "30")

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg ausente")
    def test_fade_aproximacao_e_centro_nos_quadros_reais(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            original = raiz / "marca.png"
            imagem = Image.new("RGB", (160, 160), (25, 25, 25))
            imagem.paste((255, 255, 255), (40, 40, 120, 120))
            imagem.save(original)
            filtros = animacao_logo.filtros(0, 5, 320, 568, "30")
            filtros.append("[card]select='eq(n,0)+eq(n,30)+eq(n,75)+eq(n,130)+eq(n,149)'[teste]")
            resultado = subprocess.run([
                "ffmpeg", "-v", "error", "-y", "-filter_complex_threads", "2",
                "-loop", "1", "-framerate", "30", "-t", "5", "-i", str(original),
                "-filter_complex", ";".join(filtros), "-map", "[teste]", "-fps_mode", "vfr",
                "-frames:v", "5", str(raiz / "%03d.png")], capture_output=True, text=True, timeout=25)
            self.assertEqual(resultado.returncode, 0, resultado.stderr)
            quadros = sorted(raiz.glob("[0-9][0-9][0-9].png"))
            self.assertEqual(len(quadros), 5)
            larguras = []
            for i, arquivo in enumerate(quadros):
                with Image.open(arquivo) as quadro:
                    cinza = quadro.convert("L")
                    if i in (0, 4):
                        self.assertLess(cinza.getextrema()[1], 65)
                    else:
                        caixa = cinza.point(lambda v: 255 if v > 200 else 0).getbbox()
                        self.assertIsNotNone(caixa)
                        self.assertAlmostEqual((caixa[0] + caixa[2]) / 2, 160, delta=1)
                        self.assertAlmostEqual((caixa[1] + caixa[3]) / 2, 284, delta=1)
                        larguras.append(caixa[2] - caixa[0])
            self.assertLess(larguras[0], larguras[-1])
            self.assertLessEqual(larguras[-1], 166)


if __name__ == "__main__":
    unittest.main()
