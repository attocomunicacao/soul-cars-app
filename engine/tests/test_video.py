"""Tratamento das palavras transcritas antes de virarem legenda (engine/video/render.py)."""

import sys
import unittest
import tempfile
from pathlib import Path

VIDEO = Path(__file__).resolve().parents[1] / "video"
sys.path.insert(0, str(VIDEO))
import render  # noqa: E402


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
        for nome in ("render.py", "transcribe.py", "correcoes.txt", "assets/TRILHA.flac", "assets/LOGO_SOUL.jpg", "assets/Lato-Black.ttf"):
            self.assertTrue((VIDEO / nome).is_file(), nome)

    def test_fonte_encontrada(self):
        self.assertTrue(render.FONT.is_file())


if __name__ == "__main__":
    unittest.main()
