"""Chamada à API da Anthropic (engine/ia.py), com o cliente trocado por um de mentira."""

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ia  # noqa: E402

FICHA = {
    "nome": "FORD FIESTA",
    "ano": "2016",
    "versao": "1.5 16V",
    "cambio": "Manual",
    "combustivel": "Flex",
    "seguranca": "Airbag duplo\nFreios ABS",
    "conforto": "Ar-condicionado\nDireção elétrica",
    "infotenimento": "Central multimídia",
}

RESPOSTA = {
    "textos": [
        {"texto": f"Texto {i}", "destaques": ["airbag duplo", "Item inventado", "Freios ABS", "Central multimídia", "Ar-condicionado"]}
        for i in range(7)
    ],
    "titulos": [f"titulo {i}" for i in range(6)],
}


def resposta_falsa(stop_reason="end_turn", conteudo=None):
    bloco = SimpleNamespace(type="text", text=json.dumps(conteudo or RESPOSTA))
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[bloco],
        usage=SimpleNamespace(input_tokens=100, output_tokens=50),
    )


def cliente_falso(resposta):
    cliente = mock.MagicMock()
    cliente.beta.messages.create.return_value = resposta
    return cliente


class TestIa(unittest.TestCase):
    def chamar(self, resposta=None):
        cliente = cliente_falso(resposta or resposta_falsa())
        with mock.patch("anthropic.Anthropic", return_value=cliente) as construtor:
            resultado = ia.gerar_textos({"ficha": FICHA, "api_key": " sk-ant-teste "})
        return resultado, cliente.beta.messages.create.call_args.kwargs, construtor

    def test_usa_o_opus_atual(self):
        _, kwargs, _ = self.chamar()
        self.assertEqual(ia.MODELO, "claude-opus-5-5")
        self.assertEqual(kwargs["model"], "claude-opus-5-5")

    def test_nao_envia_parametros_que_o_modelo_recusa(self):
        _, kwargs, _ = self.chamar()
        for proibido in ("thinking", "temperature", "top_p", "top_k", "tool_choice"):
            self.assertNotIn(proibido, kwargs)
        self.assertNotEqual(kwargs["messages"][-1]["role"], "assistant")  # sem prefill

    def test_fallback_do_servidor_e_saida_estruturada(self):
        _, kwargs, _ = self.chamar()
        self.assertEqual(kwargs["fallbacks"], "default")
        self.assertEqual(kwargs["betas"], ["server-side-fallback-2026-07-01"])
        self.assertEqual(kwargs["output_config"]["format"]["type"], "json_schema")
        self.assertEqual(kwargs["output_config"]["effort"], "medium")

    def test_chave_sem_espacos_vai_para_o_cliente(self):
        _, _, construtor = self.chamar()
        self.assertEqual(construtor.call_args.kwargs["api_key"], "sk-ant-teste")

    def test_pos_processamento_nao_deixa_inventar_destaques_nem_passar_do_limite(self):
        r, _, _ = self.chamar()
        self.assertEqual(len(r["textos"]), 5)
        self.assertEqual(len(r["titulos"]), 5)
        self.assertTrue(all(t == t.upper() for t in r["titulos"]))
        for t in r["textos"]:
            self.assertLessEqual(len(t["destaques"]), 3)
            self.assertNotIn("Item inventado", t["destaques"])
        self.assertEqual(r["textos"][0]["destaques"][0], "Airbag duplo")  # volta com a grafia da ficha
        self.assertEqual(r["uso"], {"entrada": 100, "saida": 50})

    def test_recusa_e_corte_viram_erro_claro(self):
        with self.assertRaisesRegex(ValueError, "recusou"):
            self.chamar(resposta_falsa("refusal"))
        with self.assertRaisesRegex(ValueError, "cortada"):
            self.chamar(resposta_falsa("max_tokens"))

    def test_sem_chave_pede_configuracao(self):
        with self.assertRaisesRegex(ValueError, "Configurações"):
            ia.gerar_textos({"ficha": FICHA})


if __name__ == "__main__":
    unittest.main()
