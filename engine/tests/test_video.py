"""Tratamento das palavras transcritas antes de virarem legenda (engine/video/render.py)."""

import shutil
import subprocess
import sys
import unittest
import tempfile
from pathlib import Path

VIDEO = Path(__file__).resolve().parents[1] / "video"
sys.path.insert(0, str(VIDEO))
import render  # noqa: E402
import leve  # noqa: E402


def palavras(*textos):
    return [{"w": t, "s": i * 0.5, "e": i * 0.5 + 0.4} for i, t in enumerate(textos)]


def texto(ws):
    return " ".join(w["w"] for w in ws)


class TestFixWords(unittest.TestCase):
    def test_junta_decimal_separado_pelo_whisper(self):
        r = render.fix_words(palavras("Fiesta", "1", ".6", "manual"), "FORD FIESTA", [])
        self.assertEqual(texto(r), "Fiesta 1.6 manual")

    def test_junta_decimal_com_pontuacao_no_fim(self):
        r = render.fix_words(palavras("câmbio", "1", ".6,", "flex"), "FORD FIESTA", [])
        self.assertEqual(texto(r), "câmbio 1.6, flex")

    def test_junta_pontuacao_solta(self):
        r = render.fix_words(palavras("aprovado", "100", "%", "na", "cautelar"), "FORD FIESTA", [])
        self.assertEqual(texto(r), "aprovado 100% na cautelar")

    def test_nao_junta_numeros_separados(self):
        r = render.fix_words(palavras("são", "2", "16", "polegadas"), "FORD FIESTA", [])
        self.assertEqual(texto(r), "são 2 16 polegadas")

    def test_corrige_nome_do_veiculo_parecido(self):
        # Usa a grafia digitada na tarja (maiúscula); a legenda do vídeo é toda em maiúsculas.
        r = render.fix_words(palavras("Chevrolet", "Onyx", "2020"), "CHEVROLET ONIX", [])
        self.assertEqual(texto(r), "Chevrolet ONIX 2020")

    def test_aplica_lista_de_correcoes(self):
        r = render.fix_words(palavras("sou", "cars", "carros"), "FORD FIESTA", [("sou cars", "Soul Cars")])
        self.assertEqual(texto(r), "Soul Cars carros")

    def test_tempos_se_mantem_apos_juntar(self):
        r = render.fix_words(palavras("1", ".6"), "FORD FIESTA", [])
        self.assertEqual((r[0]["s"], r[0]["e"]), (0.0, 0.9))


class TestAssets(unittest.TestCase):
    def test_localiza_video_em_todas_as_pastas_sem_reutilizar_final(self):
        for subpasta in ("PROJETO", "VIDEO", ""):
            with tempfile.TemporaryDirectory() as pasta:
                root = Path(pasta)
                origem = root / subpasta
                origem.mkdir(exist_ok=True)
                video = origem / "bruto.MOV"
                video.write_bytes(b"video")
                (root / "VIDEO_MODELO.mp4").write_bytes(b"final")
                self.assertEqual(render.localizar_video(root), video)
                (origem / "outro.mp4").write_bytes(b"outro")
                with self.assertRaisesRegex(RuntimeError, "encontrei 2"):
                    render.localizar_video(root)

    def test_arquivos_empacotados_existem(self):
        for nome in ("render.py", "transcribe.py", "correcoes.txt", "leve.py", "assets/TRILHA.flac", "assets/LOGO_SOUL.jpg", "assets/Lato-Black.ttf"):
            self.assertTrue((VIDEO / nome).is_file(), nome)

    def test_fonte_encontrada(self):
        self.assertTrue(render.FONT.is_file())


TEM_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def criar_video_final(destino: Path) -> None:
    """Vídeo mínimo (2 s, 270x480) com áudio, a 20 Mbps: bem mais pesado que a versão leve."""
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "testsrc2=s=270x480:r=30:d=2", "-f", "lavfi", "-i", "sine=d=2",
         "-c:v", "libx264", "-b:v", "20M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(destino)],
        check=True)


def codec_video(arquivo: Path) -> str:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name",
                        "-of", "csv=p=0", str(arquivo)], capture_output=True, text=True)
    return r.stdout.strip()


class TestVersaoLeve(unittest.TestCase):
    def test_nome_da_saida_acompanha_o_final(self):
        self.assertEqual(leve.nome_saida(Path("VIDEO_JEEP.mp4")), "ANUNCIO_JEEP.mp4")

    def test_exige_exatamente_um_video_final(self):
        with tempfile.TemporaryDirectory() as pasta:
            root = Path(pasta)
            with self.assertRaisesRegex(RuntimeError, "encontrei 0"):
                leve.localizar_final(root)
            (root / "VIDEO_A.mp4").write_bytes(b"x")
            (root / "bruto.MOV").write_bytes(b"x")  # bruto não conta
            self.assertEqual(leve.localizar_final(root).name, "VIDEO_A.mp4")
            (root / "video_b.mp4").write_bytes(b"x")
            with self.assertRaisesRegex(RuntimeError, "encontrei 2"):
                leve.localizar_final(root)

    def test_versao_leve_nao_vira_video_bruto_nem_segundo_video_final(self):
        with tempfile.TemporaryDirectory() as pasta:
            root = Path(pasta)
            (root / "VIDEO").mkdir()
            bruto = root / "VIDEO" / "bruto.MOV"
            bruto.write_bytes(b"bruto")
            (root / "VIDEO_JEEP.mp4").write_bytes(b"final")
            (root / leve.PASTA_SAIDA).mkdir()
            (root / leve.PASTA_SAIDA / "ANUNCIO_JEEP.mp4").write_bytes(b"leve")
            self.assertEqual(render.localizar_video(root), bruto)
            self.assertEqual(leve.localizar_final(root).name, "VIDEO_JEEP.mp4")

    @unittest.skipUnless(TEM_FFMPEG, "ffmpeg não encontrado")
    def test_gera_versao_leve_menor_sem_tocar_no_original(self):
        with tempfile.TemporaryDirectory() as pasta:
            root = Path(pasta)
            final = root / "VIDEO_TESTE.mp4"
            criar_video_final(final)
            antes = (final.stat().st_size, final.stat().st_mtime_ns)
            saida = leve.gerar(str(root))
            self.assertEqual(saida, root / "ANUNCIO" / "ANUNCIO_TESTE.mp4")
            self.assertEqual(codec_video(saida), "h264")
            self.assertLess(saida.stat().st_size, final.stat().st_size)
            self.assertEqual((final.stat().st_size, final.stat().st_mtime_ns), antes)
            self.assertEqual([p.name for p in root.iterdir() if p.is_file()], ["VIDEO_TESTE.mp4"])
            self.assertEqual([p.name for p in (root / "ANUNCIO").iterdir()], ["ANUNCIO_TESTE.mp4"])

    @unittest.skipUnless(TEM_FFMPEG, "ffmpeg não encontrado")
    def test_cai_para_x264_quando_o_primeiro_codificador_falha(self):
        with tempfile.TemporaryDirectory() as pasta:
            root = Path(pasta)
            criar_video_final(root / "VIDEO_TESTE.mp4")
            codificadores = [("inexistente", ["-c:v", "codificador_que_nao_existe"]), leve.CODIFICADORES[1]]
            saida = leve.gerar(str(root), codificadores)
            self.assertEqual(codec_video(saida), "h264")
            self.assertFalse(any(p.name.endswith(".parcial.mp4") for p in (root / "ANUNCIO").iterdir()))

    @unittest.skipUnless(TEM_FFMPEG, "ffmpeg não encontrado")
    def test_falha_total_nao_deixa_arquivo_parcial(self):
        with tempfile.TemporaryDirectory() as pasta:
            root = Path(pasta)
            criar_video_final(root / "VIDEO_TESTE.mp4")
            with self.assertRaises(RuntimeError):
                leve.gerar(str(root), [("inexistente", ["-c:v", "codificador_que_nao_existe"])])
            self.assertEqual(list((root / "ANUNCIO").iterdir()), [])


if __name__ == "__main__":
    unittest.main()
