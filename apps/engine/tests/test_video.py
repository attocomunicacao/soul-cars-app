"""Tratamento das palavras transcritas antes de virarem legenda (apps/engine/video/render.py)."""

import shutil
import subprocess
import sys
import unittest
import tempfile
from pathlib import Path
from unittest import mock

VIDEO = Path(__file__).resolve().parents[1] / "video"
sys.path.insert(0, str(VIDEO))
import render  # noqa: E402
import light_export as leve  # noqa: E402


def palavras(*textos):
    return [{"w": t, "s": i * 0.5, "e": i * 0.5 + 0.4} for i, t in enumerate(textos)]


def texto(ws):
    return " ".join(w["w"] for w in ws)


class TestVigiaRender(unittest.TestCase):
    def executar(self, programa, limite):
        popen = subprocess.Popen

        def abrir(cmd, *args, **kwargs):
            if cmd[0] == sys.executable:
                cmd = [cmd[0], *cmd[4:]]  # remove opções exclusivas do FFmpeg
            return popen(cmd, *args, **kwargs)

        with mock.patch.object(render.subprocess, "Popen", side_effect=abrir), \
                mock.patch.object(render, "log"):
            render.run_ffmpeg([sys.executable, "-u", "-c", programa], 10, 40, 98,
                              "Teste", limite_sem_avanco=limite)

    def test_interrompe_processo_travado_mesmo_com_progresso_repetido(self):
        with self.assertRaisesRegex(RuntimeError, "sem avanço"):
            self.executar("import time\nwhile True:\n print('out_time_us=0', flush=True)\n time.sleep(.1)", 0.3)

    def test_avanco_real_renova_o_prazo(self):
        self.executar("import time\nfor i in range(8):\n print(f'out_time_us={i * 100000}', flush=True)\n time.sleep(.2)", 1)

    def test_preserva_detalhe_de_erro_do_ffmpeg(self):
        with self.assertRaisesRegex(RuntimeError, "falha simulada"):
            self.executar("import sys; print('falha simulada', file=sys.stderr); sys.exit(1)", 10)


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
        for nome in ("render.py", "transcribe.py", "corrections.txt", "light_export.py", "assets/soul-logo.jpg", "assets/Lato-Black.ttf", "assets/Lato-OFL.txt"):
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

    def test_mensagem_clara_quando_falta_o_ffmpeg(self):
        with tempfile.TemporaryDirectory() as pasta:
            root = Path(pasta)
            (root / "VIDEO_A.mp4").write_bytes(b"x")
            with mock.patch("light_export.shutil.which", return_value=None):
                with self.assertRaisesRegex(RuntimeError, "ffmpeg não foi encontrado"):
                    leve.gerar(str(root))
            self.assertFalse((root / "ANUNCIO").exists())

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


class TestTrilha(unittest.TestCase):
    def test_ordem_de_busca_veiculo_depois_app_e_sem_trilha_embutida(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict("os.environ", {"SOUL_DATA_DIR": d}):
            dados = Path(d)
            assets = dados / "veiculo" / "ASSETS"
            assets.mkdir(parents=True)
            with mock.patch.object(render, "ENGINE", dados / "engine"):  # sem cópia local
                self.assertIsNone(render.localizar_trilha(assets))
                (dados / "trilha").mkdir()
                do_app = dados / "trilha" / "TRILHA.flac"
                do_app.write_bytes(b"app")
                self.assertEqual(render.localizar_trilha(assets), do_app)
                do_veiculo = assets / "TRILHA.wav"
                do_veiculo.write_bytes(b"veiculo")
                self.assertEqual(render.localizar_trilha(assets), do_veiculo)

    def test_sem_variavel_de_dados_nao_quebra(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict("os.environ", {}, clear=False):
            import os

            os.environ.pop("SOUL_DATA_DIR", None)
            with mock.patch.object(render, "ENGINE", Path(d)):
                self.assertIsNone(render.localizar_trilha(Path(d) / "ASSETS"))

    def test_trilha_nao_vai_no_repositorio(self):
        raiz = Path(__file__).resolve().parents[3]
        self.assertIn("TRILHA", (raiz / ".gitignore").read_text(encoding="utf-8"))


class TestRunFfmpeg(unittest.TestCase):
    @unittest.skipUnless(TEM_FFMPEG, "ffmpeg não encontrado")
    def test_nao_deixa_pipes_abertos(self):
        import gc
        import warnings

        cmd = ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "anullsrc", "-t", "0.2", "-f", "null", "-"]
        with warnings.catch_warnings(record=True) as avisos:
            warnings.simplefilter("always")
            render.run_ffmpeg(cmd, 0.2, 0, 100, "teste")
            gc.collect()
        recursos = [a for a in avisos if issubclass(a.category, ResourceWarning)]
        self.assertEqual(recursos, [])

    @unittest.skipUnless(TEM_FFMPEG, "ffmpeg não encontrado")
    def test_erro_do_ffmpeg_continua_subindo(self):
        with self.assertRaises(RuntimeError):
            render.run_ffmpeg(["ffmpeg", "-v", "error", "-i", "nao-existe.mp4", "-f", "null", "-"], 1, 0, 100, "x")


if __name__ == "__main__":
    unittest.main()
