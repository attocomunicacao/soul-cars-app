"""O motor fala UTF-8 pelo pipe, mesmo no Windows (cp1252 por padrão)."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

MAIN = Path(__file__).resolve().parent.parent / "main.py"


class TestUtf8(unittest.TestCase):
    def test_acentos_voltam_em_utf8(self):
        pedido = json.dumps({"method": "ação"}, ensure_ascii=False) + "\n"
        r = subprocess.run(
            [sys.executable, "-u", str(MAIN)],
            input=pedido.encode("utf-8"),
            capture_output=True,
            env={"PATH": "", "SYSTEMROOT": __import__("os").environ.get("SYSTEMROOT", "")},
        )
        resposta = json.loads(r.stdout.decode("utf-8"))
        self.assertEqual(resposta["error"], "Método desconhecido: ação")


if __name__ == "__main__":
    unittest.main()
