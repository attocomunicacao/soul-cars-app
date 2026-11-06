"""Contratos do motor de motion, sem precisar de mídia, modelos ou rede."""

import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video"))
from motion import Animacao, Chave, Trilha, transicao
from motion.curves import CURVAS, bezier, progresso
from motion.ass import eventos
from motion.ffmpeg import expressao
from motion.presets import PRESETS, SAIDAS, gerar


class TestCurvas(unittest.TestCase):
    def test_bezier_resolve_tempo_em_x_e_nao_apenas_parametro(self):
        self.assertAlmostEqual(bezier(0.5, 0.25, 0.1, 0.25, 1), 0.802403, places=5)
        for t in (0, 0.1, 0.5, 0.9, 1):
            self.assertAlmostEqual(bezier(t, 0, 0, 1, 1), t, places=6)

    def test_limites_monotonia_e_velocidade_final_suave(self):
        for nome in CURVAS:
            valores = [progresso(nome, i / 1000) for i in range(1001)]
            self.assertEqual(valores[0], 0)
            self.assertEqual(valores[-1], 1)
            self.assertTrue(all(a <= b + 1e-8 for a, b in zip(valores, valores[1:])), nome)
            self.assertTrue(all(0 <= v <= 1 for v in valores), nome)
        for nome in ("suave", "mola", "visibilidade"):
            self.assertLess((1 - progresso(nome, 0.9999)) / 0.0001, 0.01, nome)

    def test_rejeita_curva_invalida(self):
        with self.assertRaises(ValueError):
            bezier(0.5, -0.1, 0, 1, 1)
        with self.assertRaises(ValueError):
            progresso("desconhecida", 0.5)


class TestTimeline(unittest.TestCase):
    def animacao(self, inicio=2, fim=4):
        return transicao(inicio, fim,
                         {"x": 20, "opacidade": 0}, {"x": 100, "opacidade": 1},
                         {"x": 105, "opacidade": 0})

    def test_entrada_reposo_saida_e_relogio_absoluto(self):
        animacao = self.animacao()
        self.assertEqual(animacao.estado(1), {"x": 20, "opacidade": 0})
        self.assertEqual(animacao.estado(3), {"x": 100, "opacidade": 1})
        self.assertEqual(animacao.estado(5), {"x": 105, "opacidade": 0})
        self.assertGreater(animacao.estado(2.2)["opacidade"], 0)
        self.assertLess(animacao.estado(3.95)["opacidade"], 1)

    def test_preserva_reposo_em_trecho_curto(self):
        animacao = self.animacao(1, 1.12)
        self.assertEqual(animacao.estado(1.08)["opacidade"], 1)
        self.assertEqual(animacao.estado(1.12)["opacidade"], 0)

    def test_amostragem_sem_frestas_e_sem_reiniciar_estado(self):
        animacao = self.animacao()
        segmentos = animacao.segmentos()
        self.assertEqual(segmentos[0][0], 2)
        self.assertEqual(segmentos[-1][1], 4)
        for antes, depois in zip(segmentos, segmentos[1:]):
            self.assertEqual(antes[1], depois[0])
            self.assertEqual(antes[3], depois[2])
        self.assertTrue(any(b - a > 1 for a, b, _, _ in segmentos))  # repouso compacto
        # A aproximação linear dos segmentos precisa acompanhar a curva original.
        for a, b, e0, e1 in segmentos:
            real = animacao.estado((a+b)/2)
            self.assertLess(abs(real["x"] - (e0["x"]+e1["x"])/2), 0.15)
            self.assertLess(abs(real["opacidade"] - (e0["opacidade"]+e1["opacidade"])/2), 0.02)

    def test_dados_invalidos_sao_rejeitados(self):
        for tempo, valor in ((-1, 0), (0, math.nan), (math.inf, 1)):
            with self.assertRaises(ValueError):
                Chave(tempo, valor)
        with self.assertRaises(ValueError):
            Trilha((Chave(0, 1), Chave(0, 2)))
        with self.assertRaises(ValueError):
            Animacao(1, 2, {"x": Trilha((Chave(3, 2),))})
        with self.assertRaises(ValueError):
            self.animacao().segmentos(0)


class TestAdaptadores(unittest.TestCase):
    def test_biblioteca_de_saidas_altera_trajetoria_sem_quebrar_tempo(self):
        trajetorias = set()
        for entrada in PRESETS:
            for saida in SAIDAS:
                animacao = gerar(entrada, 1, 3, (540, 1400), saida_nome=saida)
                self.assertEqual(animacao.estado(2)["escala"], 1)
                self.assertEqual(animacao.estado(3)["opacidade"], 0)
                self.assertEqual(animacao.estado(2)["opacidade"], 1)
                e = animacao.estado(2.95)
                trajetorias.add(tuple(round(e[k], 3) for k in ("x", "y", "escala", "blur")))
        self.assertEqual(len(trajetorias), len(SAIDAS))

    def test_presets_tem_posicao_estavel_e_tamanho_final_exato(self):
        for nome in PRESETS:
            animacao = gerar(nome, 1, 3, (540, 1400))
            self.assertEqual(animacao.estado(2), {"x": 540, "y": 1400, "escala": 1, "opacidade": 1, "blur": 0})
            self.assertEqual(animacao.estado(3)["opacidade"], 0)
            self.assertTrue(all(math.isfinite(v) for e in (animacao.estado(1), animacao.estado(2), animacao.estado(3)) for v in e.values()))

    def test_sombra_compartilha_tempo_com_o_texto(self):
        animacao = gerar("subida", 1, 3, (540, 1400))
        texto, sombra = eventos(animacao), eventos(animacao, sombra=True)
        self.assertEqual([(a, b) for a, b, _ in texto], [(a, b) for a, b, _ in sombra])
        self.assertIn("\\alpha&HFF&", texto[0][2])
        self.assertIn("\\alpha&HFF&", texto[-1][2])
        self.assertFalse(any("\\fad" in tags for _, _, tags in texto))  # sem relógio de fade por segmento

    def test_ass_rejeita_propriedade_sem_suporte(self):
        animacao = Animacao(0, 1, {"rotacao": Trilha((Chave(0, 0), Chave(1, 90)))})
        with self.assertRaises(ValueError):
            eventos(animacao)

    def test_glow_discreto_centrado_e_sincronizado(self):
        animacao = gerar("subida", 1, 3, (540, 1400))
        texto, brilho = eventos(animacao), eventos(animacao, glow=True)
        self.assertEqual([(a, b) for a, b, _ in texto], [(a, b) for a, b, _ in brilho])
        from motion.ass import propriedades
        estado = animacao.estado(2)
        self.assertIn("\\alpha&HD6&", propriedades(estado, False, True))
        self.assertIn("\\blur5", propriedades(estado, False, True))
        with self.assertRaises(ValueError):
            eventos(animacao, sombra=True, glow=True)

    def test_ffmpeg_preserva_timeline_em_vez_de_outra_curva(self):
        animacao = gerar("subida", 1, 3, (540, 1400))
        expr = expressao(animacao, "y")
        # Subconjunto aritmético da expressão FFmpeg, sem avaliar código arbitrário.
        convertido = expr.replace("if(", "escolher(")
        for t in (0, 1, 1.05, 1.2, 1.38, 2, 2.9, 3, 4):
            valor = eval(convertido, {"__builtins__": {}},
                         {"t": t, "lt": lambda a, b: a < b, "escolher": lambda cond, a, b: a if cond else b})
            self.assertAlmostEqual(valor, animacao.estado(t)["y"], delta=0.03)
