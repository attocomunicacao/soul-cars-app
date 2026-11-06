"""Limites reais da tinta e da animação das tarjas."""
import math
import json
import sys
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video"))
import render
import banner_animation as animacao_tarjas
from PIL import Image, ImageChops


class TarjasLayoutTests(unittest.TestCase):
    def test_fundos_com_mesma_largura_e_textos_centralizados(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            glow = raiz / "glow.png"
            for textos in (("FIAT ARGO 2022", "1.0 • MANUAL", "R$ 57.900"),
                           ("ARGO", "1.0 FLEX MANUAL COMPLETO", "R$ 999.999.999")):
                tarjas = []
                for i, (texto, spec) in enumerate(zip(textos, render.TARJAS)):
                    png = raiz / f"t{i}.png"
                    w, y = render.tarja_png(texto, spec, png, glow if i == 2 else None)
                    tarjas.append((png, w, y, spec))
                maior = max(t[1] for t in tarjas)
                alinhadas = render.uniformizar_larguras(tarjas, glow)
                for png, w, _, spec in alinhadas:
                    self.assertEqual(w, maior)
                    with Image.open(png) as imagem:
                        self.assertEqual(imagem.width, maior)
                        fundo = Image.new("RGB", imagem.size, spec[4])
                        caixa = ImageChops.difference(imagem.convert("RGB"), fundo).getbbox()
                        self.assertAlmostEqual((caixa[0] + caixa[2]) / 2, maior / 2, delta=0.5)
                        self.assertEqual(imagem.getpixel((0, 0)), spec[4] + (255,))
                with Image.open(glow) as brilho:
                    self.assertEqual(brilho.width, maior)
                    self.assertAlmostEqual(sum(brilho.getchannel("A").getbbox()[::2]) / 2, maior / 2, delta=1)

    def test_margens_iguais_e_nomes_extensos_dentro_da_area_segura(self):
        with tempfile.TemporaryDirectory() as pasta:
            for texto in ("FIAT ARGO 2022", "1.0 • MANUAL", "R$ 57.900", "ÁGIL ação", "W" * 250):
                for spec in render.TARJAS:
                    arquivo = Path(pasta) / "tarja.png"
                    largura, _ = render.tarja_png(texto, spec, arquivo)
                    with Image.open(arquivo) as imagem:
                        fundo = Image.new("RGB", imagem.size, spec[4])
                        caixa = ImageChops.difference(imagem.convert("RGB"), fundo).getbbox()
                        self.assertIsNotNone(caixa)
                        margens = (caixa[0], caixa[1], imagem.width - caixa[2], imagem.height - caixa[3])
                        self.assertEqual(margens, (render.PADDING_TARJA,) * 4, texto)
                        self.assertLessEqual(largura, render.LARGURA_MAX_TARJA)
                        self.assertGreaterEqual((1080 - (largura + 2 * render.BORDA_GLOW) * animacao_tarjas.ESCALA_MAXIMA) / 2, 64)

    def test_crescimento_continuo_limitado_sem_retorno(self):
        expr = animacao_tarjas.escala_permanencia(1.05, 48.5)
        def valor(t):
            return eval(expr, {"__builtins__": {}, "min": min, "max": max,
                               "cos": math.cos, "PI": math.pi, "t": t})
        self.assertEqual(valor(0), 1)
        self.assertAlmostEqual(valor(49), 1.05)
        amostras = [valor(i / 60) for i in range(3000)]
        self.assertGreater(max(amostras), 1.049)
        self.assertGreaterEqual(min(amostras), 1)
        self.assertLessEqual(max(amostras), 1.05)
        self.assertTrue(all(b >= a for a, b in zip(amostras, amostras[1:])))
        self.assertLess(max(abs(b-a) for a, b in zip(amostras, amostras[1:])), 0.002)

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg ausente")
    def test_escala_real_preserva_alpha_e_centro(self):
        with tempfile.TemporaryDirectory() as pasta:
            png = Path(pasta) / "original.png"
            imagem = Image.new("RGBA", (620, 240), (0, 0, 0, 0))
            imagem.paste((255, 255, 255, 255), (60, 60, 560, 180))
            imagem.save(png)
            for tempo, largura_esperada in ((0, 500), (5, 525)):
                saida = Path(pasta) / f"quadro{tempo}.png"
                comando = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-i", str(png),
                           "-vf", animacao_tarjas.filtro_escala(0, 5, "30"), "-ss", str(tempo),
                           "-frames:v", "1", "-update", "1", str(saida)]
                resultado = subprocess.run(comando, capture_output=True, text=True, timeout=40)
                self.assertEqual(resultado.returncode, 0, resultado.stderr)
                with Image.open(saida) as quadro:
                    alpha = quadro.convert("RGBA").getchannel("A")
                    caixa = alpha.point(lambda v: 255 if v > 127 else 0).getbbox()
                    self.assertAlmostEqual(caixa[2] - caixa[0], largura_esperada, delta=2)
                    self.assertAlmostEqual((caixa[0] + caixa[2]) / 2, 310, delta=1)
                    self.assertAlmostEqual((caixa[1] + caixa[3]) / 2, 120, delta=1)
                    self.assertEqual(alpha.getpixel((0, 0)), 0)

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg/ffprobe ausentes")
    def test_render_completo_fecha_a_cena_e_o_cartao_final(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            bruto = raiz / "bruto.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                            "testsrc2=s=270x480:r=30:d=2", "-f", "lavfi", "-i",
                            "sine=frequency=440:duration=2", "-c:v", "libx264",
                            "-preset", "ultrafast", "-c:a", "aac", str(bruto)],
                           check=True, capture_output=True, timeout=20)
            work = raiz / ".soul_tmp"
            work.mkdir()
            (work / "bruto_words.json").write_text(json.dumps([]), encoding="utf-8")

            executar_real = render.run_ffmpeg
            etapas = []

            def executar(cmd, *args):
                cmd = list(cmd)
                if "hevc_qsv" in cmd:
                    cmd[cmd.index("hevc_qsv")] = "libx264"
                    cmd[cmd.index("-b:v")+1] = "2M"
                    cmd[-1:-1] = ["-preset", "ultrafast", "-threads", "2"]
                cmd[cmd.index("hvc1")] = "avc1"
                executar_real(cmd, *args, limite_sem_avanco=10)
                etapas.append(Path(cmd[-1]).name)

            with mock.patch.object(render, "run_ffmpeg", side_effect=executar), \
                    mock.patch.object(render, "localizar_trilha", return_value=None), \
                    mock.patch.object(render, "log"):
                render.main(str(raiz), "FIAT ARGO 2022", "1.0 • MANUAL", "R$ 57.900")
            final = next(raiz.glob("VIDEO_*.mp4"))
            self.assertAlmostEqual(render.probe_duration(final), 7, delta=0.1)
            self.assertEqual(etapas, ["cena.mp4", "encerramento.mp4", "saida.mp4"])
            # Decodifica também a transição e todo o cartão, além de conferir áudio.
            resultado = subprocess.run(["ffmpeg", "-v", "error", "-i", str(final),
                                        "-f", "null", "-"], capture_output=True, timeout=20)
            self.assertEqual(resultado.returncode, 0, resultado.stderr)
            resultado = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                                        "-show_entries", "stream=duration", "-of", "csv=p=0", str(final)],
                                       capture_output=True, text=True, timeout=10)
            self.assertAlmostEqual(float(resultado.stdout.strip()), 7, delta=0.1)

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg ausente")
    def test_glow_anima_somente_a_mascara_das_letras_do_valor(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            mascara = raiz / "glow.png"
            render.tarja_png("R$ 57.900", render.TARJAS[2], raiz / "preco.png", mascara)
            picos = []
            caixas = []
            for tempo in (0, 2.5):
                saida = raiz / f"glow{tempo}.png"
                resultado = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mascara),
                                           "-vf", f"setpts=PTS+{tempo}/TB,{animacao_tarjas.filtro_glow_valor()}",
                                           "-frames:v", "1", "-update", "1", str(saida)],
                                          capture_output=True, text=True, timeout=20)
                self.assertEqual(resultado.returncode, 0, resultado.stderr)
                with Image.open(saida) as imagem:
                    alpha = imagem.convert("RGBA").getchannel("A")
                    picos.append(alpha.getextrema()[1])
                    caixas.append(alpha.getbbox())
                    self.assertEqual(alpha.getpixel((0, 0)), 0)
                    self.assertGreater(caixas[-1][0], 0)
            self.assertGreater(picos[1], picos[0] * 3)
            self.assertLessEqual(picos[1], 141)


if __name__ == "__main__":
    unittest.main()
