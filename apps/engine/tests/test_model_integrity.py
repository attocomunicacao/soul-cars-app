"""Integridade do modelo de imagem (media/vision.py) e limpeza da pasta de trabalho do vídeo.

O CLIP é baixado de fora: agora cada arquivo tem versão fixa e SHA-256 conferido antes de ser usado.
Os testes usam um servidor HTTP local com arquivos pequenos e falsos: nunca baixam o modelo de verdade.
"""

import hashlib
import http.server
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video"))

from media import vision  # noqa: E402
import render  # noqa: E402

MODELO = b"modelo-falso-" * 200_000  # ~2,6 MB: passa do mínimo de 1 MB do código
TOKENIZADOR = b'{"tokenizer": "falso"}' * 100_000
SHA = lambda dados: hashlib.sha256(dados).hexdigest()  # noqa: E731


class _Servidor:
    """Serve MODELO e TOKENIZADOR e conta quantos pedidos chegaram."""

    def __init__(self, corpo_modelo=MODELO):
        conteudo = {"/onnx/model.onnx": corpo_modelo, "/tokenizer.json": TOKENIZADOR}
        pedidos = []

        class Manipulador(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                pedidos.append(self.path)
                corpo = conteudo.get(self.path)
                if corpo is None:
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Length", str(len(corpo)))
                self.end_headers()
                self.wfile.write(corpo)

            def log_message(self, *args):
                pass

        self.pedidos = pedidos
        self.httpd = http.server.HTTPServer(("127.0.0.1", 0), Manipulador)
        self.url = f"http://127.0.0.1:{self.httpd.server_port}/"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def fechar(self):
        self.httpd.shutdown()
        self.httpd.server_close()


class TestDownloadVerificado(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.TemporaryDirectory()
        self.addCleanup(self.pasta.cleanup)
        ambiente = mock.patch.dict(os.environ, {"SOUL_DATA_DIR": self.pasta.name})
        ambiente.start()
        self.addCleanup(ambiente.stop)

    def _com(self, servidor, sha_modelo=SHA(MODELO), sha_token=SHA(TOKENIZADOR)):
        arquivos = {
            "model.onnx": ("onnx/model.onnx", sha_modelo),
            "tokenizer.json": ("tokenizer.json", sha_token),
        }
        for alvo in (mock.patch.object(vision, "REPO", servidor.url), mock.patch.object(vision, "ARQUIVOS", arquivos)):
            alvo.start()
            self.addCleanup(alvo.stop)

    def test_baixa_confere_e_marca_como_verificado(self):
        servidor = _Servidor()
        self.addCleanup(servidor.fechar)
        self._com(servidor)
        destino = vision.baixar()
        self.assertEqual((destino / "model.onnx").read_bytes(), MODELO)
        self.assertEqual((destino / "tokenizer.json").read_bytes(), TOKENIZADOR)
        self.assertEqual((destino / "model.onnx.sha256").read_text().strip(), f"{SHA(MODELO)} {len(MODELO)}")
        self.assertEqual(sorted(servidor.pedidos), ["/onnx/model.onnx", "/tokenizer.json"])

    def test_arquivo_adulterado_e_recusado_e_nao_fica_nada(self):
        servidor = _Servidor(corpo_modelo=b"ADULTERADO" * 300_000)
        self.addCleanup(servidor.fechar)
        self._com(servidor)
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            vision.baixar()
        destino = vision.pasta_modelo()
        self.assertFalse((destino / "model.onnx").exists())
        self.assertEqual([p.name for p in destino.iterdir() if p.name.endswith(".parcial")], [])

    def test_segunda_chamada_nao_baixa_de_novo(self):
        servidor = _Servidor()
        self.addCleanup(servidor.fechar)
        self._com(servidor)
        vision.baixar()
        pedidos = len(servidor.pedidos)
        vision.baixar()
        self.assertEqual(len(servidor.pedidos), pedidos)

    def test_arquivo_antigo_sem_marca_e_conferido_e_trocado_se_nao_bater(self):
        # Instalações anteriores baixaram da branch "main", sem conferência: um arquivo diferente é refeito.
        servidor = _Servidor()
        self.addCleanup(servidor.fechar)
        self._com(servidor)
        destino = vision.pasta_modelo()
        (destino / "model.onnx").write_bytes(b"OUTRO" * 400_000)
        (destino / "tokenizer.json").write_bytes(TOKENIZADOR)
        vision.baixar()
        self.assertEqual((destino / "model.onnx").read_bytes(), MODELO)
        self.assertIn("/onnx/model.onnx", servidor.pedidos)
        self.assertNotIn("/tokenizer.json", servidor.pedidos)  # esse já estava certo

    def test_arquivo_antigo_correto_ganha_a_marca_sem_baixar(self):
        servidor = _Servidor()
        self.addCleanup(servidor.fechar)
        self._com(servidor)
        destino = vision.pasta_modelo()
        (destino / "model.onnx").write_bytes(MODELO)
        (destino / "tokenizer.json").write_bytes(TOKENIZADOR)
        vision.baixar()
        self.assertEqual(servidor.pedidos, [])
        self.assertTrue((destino / "model.onnx.sha256").exists())

    def test_arquivo_marcado_mas_alterado_depois_e_refeito(self):
        servidor = _Servidor()
        self.addCleanup(servidor.fechar)
        self._com(servidor)
        destino = vision.baixar()
        (destino / "model.onnx").write_bytes(b"CORROMPIDO" * 300_000)  # tamanho diferente do marcado
        vision.baixar()
        self.assertEqual((destino / "model.onnx").read_bytes(), MODELO)

    def test_revisao_e_hashes_fixos_no_codigo(self):
        # Sem "main": a URL aponta para um commit, e os dois arquivos têm SHA-256 de 64 hex.
        self.assertRegex(vision.REPO, r"/resolve/[0-9a-f]{40}/$")
        for _, (_, sha) in vision.ARQUIVOS.items():
            self.assertRegex(sha, r"^[0-9a-f]{64}$")


class TestLimpezaDoTrabalho(unittest.TestCase):
    def _trabalho(self):
        pasta = tempfile.TemporaryDirectory()
        self.addCleanup(pasta.cleanup)
        work = Path(pasta.name) / ".soul_tmp"
        (work / "fontes").mkdir(parents=True)
        for nome in ("cena.mp4", "saida.mp4", "audio16k.wav", "tarja1.png", "VIDEO_bruto_words.json", "fontes/lato.ttf"):
            (work / nome).write_bytes(b"x")
        return work

    def test_em_falha_guarda_so_a_transcricao(self):
        work = self._trabalho()
        render.limpar_trabalho(work, manter_transcricao=True)
        self.assertEqual([p.name for p in work.iterdir()], ["VIDEO_bruto_words.json"])

    def test_no_sucesso_apaga_tudo(self):
        work = self._trabalho()
        render.limpar_trabalho(work)
        self.assertFalse(work.exists())

    def test_pasta_inexistente_nao_da_erro(self):
        render.limpar_trabalho(Path(tempfile.gettempdir()) / "nao-existe-soul-tmp", manter_transcricao=True)


if __name__ == "__main__":
    unittest.main()
