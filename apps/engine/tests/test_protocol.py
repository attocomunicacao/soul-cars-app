"""Protocolo do motor (main.py): nenhuma requisição derruba o laço, todo erro vira {"error"}."""

import io
import json
import subprocess
import sys
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

ENGINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINE))

import main  # noqa: E402


def responder(**requisicao) -> dict:
    """Passa a requisição por processar_linha e devolve a resposta já decodificada."""
    with redirect_stderr(io.StringIO()):
        linha = main.processar_linha(json.dumps(requisicao))
    assert "\n" not in linha, "a resposta precisa caber em uma linha"
    return json.loads(linha)


class TestProcessarLinha(unittest.TestCase):
    def test_ping_responde(self):
        r = responder(method="ping")
        self.assertIn("result", r)

    def test_metodo_desconhecido(self):
        self.assertEqual(responder(method="nao_existe"), {"error": "Método desconhecido: nao_existe"})

    def test_linha_que_nao_e_json(self):
        with redirect_stderr(io.StringIO()):
            r = json.loads(main.processar_linha("isto não é json"))
        self.assertIn("error", r)

    def test_requisicao_que_nao_e_objeto(self):
        with redirect_stderr(io.StringIO()):
            r = json.loads(main.processar_linha("[1, 2]"))
        self.assertIn("objeto JSON", r["error"])

    def test_params_que_nao_e_objeto(self):
        r = responder(method="ping", params=[1])
        self.assertIn("params", r["error"])

    def test_params_ausente_ou_nulo_vira_objeto_vazio(self):
        self.assertIn("result", responder(method="ping", params=None))

    def test_campo_ausente_tem_mensagem_util(self):
        r = responder(method="soulia_planilha", params={})
        self.assertIn("Campo ausente", r["error"])
        self.assertIn("entrada", r["error"])

    def test_resposta_nao_serializavel_vira_erro_e_nao_derruba(self):
        with mock.patch.dict(main.METHODS, {"ping": lambda _p: {"dado": b"bytes"}}):
            r = responder(method="ping")
        self.assertIn("error", r)

    def test_nan_vira_erro(self):
        # NaN não é JSON válido: o JSON.parse do app rejeitaria a linha e a chamada ficaria pendurada.
        with mock.patch.dict(main.METHODS, {"ping": lambda _p: {"x": float("nan")}}):
            r = responder(method="ping")
        self.assertIn("error", r)

    def test_acentos_preservados(self):
        with mock.patch.dict(main.METHODS, {"ping": lambda _p: {"texto": "ação"}}):
            self.assertEqual(responder(method="ping")["result"]["texto"], "ação")


class TestLaco(unittest.TestCase):
    def test_laco_continua_depois_de_um_erro(self):
        """Pelo processo real: uma requisição ruim não pode impedir a seguinte."""
        entrada = "\n".join(
            [
                "isto não é json",
                json.dumps({"method": "nao_existe"}),
                json.dumps({"method": "ping"}),
            ]
        ) + "\n"
        r = subprocess.run(
            [sys.executable, "-u", str(ENGINE / "main.py")],
            input=entrada.encode("utf-8"),
            capture_output=True,
            timeout=60,
        )
        linhas = [json.loads(x) for x in r.stdout.decode("utf-8").splitlines() if x.strip()]
        self.assertEqual(len(linhas), 3)
        self.assertIn("error", linhas[0])
        self.assertIn("error", linhas[1])
        self.assertIn("result", linhas[2])


if __name__ == "__main__":
    unittest.main()
