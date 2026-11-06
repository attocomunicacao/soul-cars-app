"""Motor de contexto da fala, animações das legendas e das tarjas (engine/video)."""

import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path

VIDEO = Path(__file__).resolve().parents[1] / "video"
sys.path.insert(0, str(VIDEO))
import banner_animation as animacao_tarjas  # noqa: E402
import speech_context as contexto  # noqa: E402
import composition as composicao  # noqa: E402
import captions as legendas  # noqa: E402
import render  # noqa: E402

FALA = (
    "Olha só esse Argo 2022 completo. "
    "Tem apenas 64 mil quilômetros rodados. Motor 1.0 flex e câmbio manual. "
    "Ar-condicionado, direção elétrica, vidros elétricos e central multimídia. "
    "Está impecável, com laudo cautelar aprovado e pneus novos. "
    "Por apenas 62 mil reais. "
    "Venha conhecer na Soul Cars, chama no WhatsApp!"
)


def falar(texto, pausa=0.25):
    """Palavras com tempo, como a transcrição devolve."""
    saida, t = [], 0.3
    for w in texto.split():
        d = 0.18 + 0.025 * len(w)
        saida.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)})
        t += d + (pausa if w[-1] in ".!?" else 0.04)
    return saida


def agrupar_simples(frase):
    return legendas.agrupar_legendas(frase)


class TestContexto(unittest.TestCase):
    def test_biblioteca_contextual_tem_diversidade_e_registros_validos(self):
        from motion.presets import PRESETS, SAIDAS
        plano = contexto.planejar(falar(FALA), agrupar_simples, "FIAT ARGO 2022")
        self.assertGreaterEqual(len({p["saida"] for p in plano}), 4)
        self.assertGreaterEqual(len({p["composicao"] for p in plano}), 3)
        for p in plano:
            self.assertIn(p["animacao"], PRESETS)
            self.assertIn(p["saida"], SAIDAS)
            self.assertIn(p["composicao"], composicao.PADROES)
            self.assertTrue(p["criterio"])
        for a, b in zip(plano, plano[1:]):
            self.assertNotEqual(a["saida"], b["saida"])

    def test_contexto_curto_nao_herda_preco_em_toda_a_apresentacao(self):
        plano = contexto.planejar(falar("Olha esse carro completo, por apenas 62 mil reais."), agrupar_simples, "X")
        self.assertEqual(plano[0]["assunto"], "abertura")
        self.assertTrue(any(p["assunto"] == "preco" for p in plano))

    def test_fala_rapida_usa_composicao_simples(self):
        palavras = [{"w": w, "s": i*0.1, "e": i*0.1+0.08} for i, w in enumerate("Venha conhecer hoje".split())]
        plano = contexto.planejar(palavras, agrupar_simples, "X")
        self.assertTrue(all(p["composicao"] in ("linha", "duas_linhas") for p in plano))

    def test_reconhece_o_assunto_de_cada_frase(self):
        esperado = ["abertura", "ano_km", "especificacao", "equipamento", "condicao", "preco", "chamada"]
        frases = contexto.frases(falar(FALA))
        self.assertEqual(len(frases), 7)
        obtido = [contexto.classificar(f, primeira=(i == 0))[0] for i, f in enumerate(frases)]
        self.assertEqual(obtido, esperado)

    def test_mil_depende_do_contexto(self):
        km = falar("Com 64 mil quilômetros rodados.")
        preco = falar("Sai por 62 mil reais.")
        self.assertEqual(contexto.classificar(km)[0], "ano_km")
        self.assertEqual(contexto.classificar(preco)[0], "preco")

    def test_sem_pista_vira_neutro_e_a_primeira_vira_abertura(self):
        frase = falar("Tudo certo por aqui")
        self.assertEqual(contexto.classificar(frase)[0], "neutro")
        self.assertEqual(contexto.classificar(frase, primeira=True)[0], "abertura")

    def test_destaque_segue_o_assunto(self):
        preco = falar("Por apenas 62 mil reais")
        self.assertEqual(preco[contexto.palavra_destaque(preco, "preco")]["w"], "62")
        chamada = falar("Venha conhecer hoje")
        self.assertEqual(chamada[contexto.palavra_destaque(chamada, "chamada")]["w"], "Venha")
        curta = falar("é um carro")
        self.assertIsNone(contexto.palavra_destaque(curta, "neutro"))

    def test_plano_nunca_repete_a_animacao_em_sequencia(self):
        plano = contexto.planejar(falar(FALA), agrupar_simples, "FIAT ARGO 2022")
        self.assertGreater(len(plano), 8)
        for antes, depois in zip(plano, plano[1:]):
            self.assertNotEqual(antes["animacao"], depois["animacao"])

    def test_plano_tem_arco_comeca_suave_e_fecha_forte(self):
        plano = contexto.planejar(falar(FALA), agrupar_simples, "FIAT ARGO 2022")
        self.assertEqual(plano[0]["intensidade"], 0)
        self.assertEqual(plano[-1]["intensidade"], 2)
        self.assertEqual(plano[-1]["assunto"], "chamada")

    def test_plano_e_deterministico_e_o_carro_varia(self):
        a = contexto.planejar(falar(FALA), agrupar_simples, "FIAT ARGO 2022")
        b = contexto.planejar(falar(FALA), agrupar_simples, "FIAT ARGO 2022")
        self.assertEqual([p["animacao"] for p in a], [p["animacao"] for p in b])
        outros = {
            tuple(p["animacao"] for p in contexto.planejar(falar(FALA), agrupar_simples, nome))
            for nome in ("FIAT ARGO", "VW GOL", "HONDA FIT", "JEEP RENEGADE", "KIA SOUL", "FORD KA")
        }
        self.assertGreater(len(outros), 1)

    def test_usa_so_animacoes_conhecidas_e_destaque_valido(self):
        for p in contexto.planejar(falar(FALA), agrupar_simples, "X"):
            self.assertIn(p["animacao"], contexto.ANIMACOES_TODAS)
            self.assertIn(p["intensidade"], (0, 1, 2))
            if p["destaque"] is not None:
                self.assertLess(p["destaque"], len(p["palavras"]))

    def test_destaque_obrigatorio_em_preco_e_chamada(self):
        plano = contexto.planejar(falar(FALA), agrupar_simples, "X")
        for assunto in ("preco", "chamada"):
            self.assertTrue(any(p["destaque"] is not None for p in plano if p["assunto"] == assunto))

    def test_destaque_nao_vira_rotina(self):
        plano = contexto.planejar(falar("Carro muito bonito, conservado, bem cuidado, lindo demais, perfeito."),
                                  agrupar_simples, "X")
        livres = [p for p in plano if p["assunto"] not in contexto.DESTAQUE_OBRIGATORIO]
        for antes, depois in zip(livres, livres[1:]):
            self.assertFalse(antes["destaque"] is not None and depois["destaque"] is not None)


class TestAgrupar(unittest.TestCase):
    def test_preserva_locucao_verbal_e_complemento(self):
        ws = falar("O carro acabou de chegar aqui na loja")
        grupos = legendas.agrupar_legendas(ws)
        textos = [" ".join(w["w"] for w in g) for g in grupos]
        self.assertIn("acabou de chegar", textos)
        self.assertTrue(any("na loja" in t for t in textos))
        self.assertEqual([w for g in grupos for w in g], ws)

    def test_preco_fica_curto_sem_separar_numero_e_unidade(self):
        ws = falar("Por apenas 62 mil reais.")
        grupos = legendas.agrupar_legendas(ws)
        self.assertEqual([[w["w"] for w in g] for g in grupos], [["Por", "apenas"], ["62", "mil", "reais."]])
        self.assertEqual([w for g in grupos for w in g], ws)

    def test_km_preserva_numero_unidade_e_tempos(self):
        ws = falar("com 64 mil quilômetros rodados.")
        grupos = legendas.agrupar_legendas(ws)
        self.assertTrue(any("64 mil quilômetros" in " ".join(w["w"] for w in g) for g in grupos))
        self.assertTrue(all(len(g) <= 4 for g in grupos))
        self.assertEqual([w for g in grupos for w in g], ws)

    def test_rebalanceia_ultima_palavra_sem_perder_ordem(self):
        ws = falar("um dois tres quatro cinco seis sete", pausa=0)
        grupos = legendas.agrupar_legendas(ws)
        self.assertTrue(all(len(g) >= 2 for g in grupos))
        self.assertEqual([w for g in grupos for w in g], ws)

    def test_quebra_em_pausa_e_respeita_o_limite(self):
        ws = falar("um dois tres quatro cinco seis")
        grupos = legendas.agrupar_legendas(ws)
        self.assertTrue(all(len(g) <= legendas.LEG_MAX_PALAVRAS for g in grupos))
        ws[3]["s"] += 2
        ws[3]["e"] += 2
        self.assertTrue(any(g[-1]["w"] == "tres" for g in legendas.agrupar_legendas(ws)))

    def test_pontuacao_nao_mistura_clausulas(self):
        grupos = legendas.agrupar_legendas(falar("Sim, mas bonito"))
        self.assertEqual([w["w"] for w in grupos[0]], ["Sim,"])
        saudacao = legendas.agrupar_legendas(falar("Senhoras e senhores, Fiat Argo 2022,"))
        self.assertEqual([w["w"] for w in saudacao[0]], ["Senhoras", "e", "senhores,"])

    def test_rebalanceia_palavra_isolada_no_meio_da_fala(self):
        ws = falar("faróis em máscara negra, pneus em ótimo estado")
        grupos = legendas.agrupar_legendas(ws)
        self.assertTrue(any("máscara negra," in " ".join(w["w"] for w in grupo) for grupo in grupos))
        self.assertEqual([w for grupo in grupos for w in grupo], ws)


class TestComposicaoEditorial(unittest.TestCase):
    def test_pilha_nao_isola_conectores(self):
        itens = composicao.distribuir({**self.plano("SENHORAS E SENHORES", None), "composicao": "pilha"}, render.FONT)
        linhas = {}
        for item in itens:
            linhas.setdefault(item["y"], []).append(item["texto"])
        self.assertNotIn(["E"], list(linhas.values()))
        self.assertTrue(all(i["tamanho"] == composicao.CORPO for i in itens))

    def test_biblioteca_preserva_tamanho_e_zona_util(self):
        for nome in composicao.PADROES:
            itens = composicao.distribuir({**self.plano("MOTOR FLEX MANUAL", None), "composicao": nome}, render.FONT)
            self.assertTrue(all(i["tamanho"] == composicao.CORPO for i in itens), nome)
            self.assertTrue(all(110 - 1e-6 <= i["x"] - i["largura"]/2 for i in itens), nome)
            self.assertTrue(all(i["x"] + i["largura"]/2 <= 970 + 1e-6 for i in itens), nome)
            self.assertTrue(all(1250 <= i["y"] <= 1550 for i in itens), nome)
            self.assertEqual([i["texto"] for i in itens], ["MOTOR", "FLEX", "MANUAL"])

    def plano(self, texto="Por apenas 62 mil", destaque=2):
        return {"palavras": falar(texto), "destaque": destaque, "animacao": "subida",
                "intensidade": 1, "direcao": 1, "assunto": "preco", "ordem": 0, "frase": 0}

    def test_duas_linhas_preservam_ordem_e_margens(self):
        p = self.plano()
        itens = composicao.distribuir(p, render.FONT)
        self.assertEqual([i["texto"] for i in itens], [w["w"].upper() for w in p["palavras"]])
        self.assertEqual(len({i["y"] for i in itens}), 2)
        self.assertEqual(len({i["tamanho"] for i in itens}), 1)
        self.assertTrue(all(i["fonte"] == "Lato Black" and not i["italico"] for i in itens))
        for item in itens:
            self.assertGreaterEqual(item["x"] - item["largura"] / 2, 110 - 0.01)
            self.assertLessEqual(item["x"] + item["largura"] / 2, 970 + 0.01)
        for anterior, depois in zip(itens, itens[1:]):
            self.assertTrue(anterior["y"] < depois["y"] or anterior["x"] < depois["x"])

    def test_palavra_extensa_cabe_com_a_fonte_padrao(self):
        item = composicao.distribuir(self.plano("Extraordinariamente" * 4, 0), render.FONT)[0]
        self.assertLessEqual(item["largura"], composicao.LARGURA + 1e-6)
        self.assertLess(item["tamanho"], composicao.CORPO)
        self.assertFalse(item["italico"])

    def test_texto_literal_nao_injeta_ass_e_preserva_caixa(self):
        self.assertEqual(composicao.limpar("Soul Cars"), "Soul Cars")
        limpo = composicao.limpar("{\\pos(0,0)}Soul\\N\nCars")
        self.assertNotIn("\\", limpo)
        self.assertNotIn("{", limpo)
        self.assertNotIn("\n", limpo)

    def test_entrada_curta_assenta_antes_do_fim_sem_intervalos_invalidos(self):
        p = self.plano("62", 0)
        for nome in contexto.ANIMACOES_TODAS:
            eventos = legendas.eventos_da_animacao({**p, "animacao": nome}, 150, 1.0, 1.12)
            self.assertTrue(eventos, nome)
            self.assertEqual(eventos[0][0], 1.0)
            self.assertEqual(eventos[-1][1], 1.12)
            self.assertTrue(all(1.0 <= a < b <= 1.12 for a, b, _ in eventos), nome)
            for antes, depois in zip(eventos, eventos[1:]):
                self.assertEqual(antes[1], depois[0])
            self.assertIn("\\alpha&HFF&", eventos[-1][2])

    def test_cada_palavra_so_aparece_na_sua_fala_e_termina_junto(self):
        p = self.plano("Venha conhecer hoje", 1)
        with tempfile.TemporaryDirectory() as pasta:
            ass = Path(pasta) / "editorial.ass"
            with unittest.mock.patch.object(contexto, "planejar", return_value=[p]):
                legendas.gerar_ass(p["palavras"], 4.0, ass, render.FONT)
            linhas = ass.read_text(encoding="utf-8").splitlines()
        for w in p["palavras"]:
            texto = w["w"].upper()
            eventos = [l.split(",", 9) for l in linhas if l.startswith("Dialogue: 1,") and l.endswith("}" + texto)]
            self.assertTrue(eventos, w["w"])
            esperado = legendas.ass_time(max(p["palavras"][0]["s"], w["s"] - 0.02))
            self.assertEqual(eventos[0][1], esperado)
            self.assertEqual(eventos[-1][2], legendas.ass_time(p["palavras"][-1]["e"] + 0.35))
        self.assertIn("\\i", "\n".join(linhas))

    def test_sem_fala_gera_ass_valido_sem_eventos(self):
        with tempfile.TemporaryDirectory() as pasta:
            ass = Path(pasta) / "vazio.ass"
            self.assertEqual(legendas.gerar_ass([], 3.0, ass, render.FONT), [])
            self.assertNotIn("Dialogue:", ass.read_text(encoding="utf-8"))


@unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg ausente")
class TestAssRenderiza(unittest.TestCase):
    def setUp(self):
        self.pasta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.pasta, True)

    def _queimar(self, ass, duracao=3):
        fontes = render.preparar_fontes(self.pasta / "fontes")
        a = str(ass).replace("\\", "/").replace(":", "\\:")
        f = str(fontes).replace("\\", "/").replace(":", "\\:")
        saida = self.pasta / "q.png"
        r = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
             "-i", f"color=c=0x5a6470:s=1080x1920:r=30:d={duracao}",
             "-vf", f"subtitles='{a}':fontsdir='{f}'", "-ss", "0.8", "-frames:v", "1", str(saida)],
            capture_output=True, text=True)
        return r, saida

    def test_cada_animacao_gera_um_ass_que_o_ffmpeg_aceita(self):
        palavras_teste = falar("Venha conhecer o Argo 2022 hoje", pausa=0.1)
        for nome in contexto.ANIMACOES_TODAS:
            for intensidade in (0, 1, 2):
                plano = [{"palavras": palavras_teste, "assunto": "neutro", "animacao": nome,
                          "intensidade": intensidade, "destaque": 0, "direcao": 1, "ordem": 0, "frase": 0}]
                ass = self.pasta / f"{nome}{intensidade}.ass"
                with unittest.mock.patch.object(contexto, "planejar", return_value=plano):
                    legendas.gerar_ass(palavras_teste, 4.0, ass, render.FONT, "X")
                conteudo = ass.read_text(encoding="utf-8")
                self.assertNotIn("nan", conteudo)
                r, saida = self._queimar(ass)
                self.assertEqual(r.returncode, 0, f"{nome} i{intensidade}: {r.stderr[:200]}")
                self.assertTrue(saida.is_file() and saida.stat().st_size > 5000)

    def test_sem_contorno_com_glow_da_mesma_cor_sem_sombra_preta(self):
        ass = self.pasta / "l.ass"
        legendas.gerar_ass(falar(FALA), 20.0, ass, render.FONT, "FIAT ARGO 2022")
        linhas = ass.read_text(encoding="utf-8").splitlines()
        estilos = [l for l in linhas if l.startswith("Style:")]
        self.assertEqual(len(estilos), 2)
        for estilo in estilos:
            campos = estilo.split(",")
            self.assertEqual(campos[15:18], ["1", "0", "0"], estilo)  # BorderStyle, Outline 0, Shadow 0
        brilhos = [l for l in linhas if l.startswith("Dialogue: 0,")]
        textos = [l for l in linhas if l.startswith("Dialogue: 1,")]
        self.assertTrue(brilhos and textos)
        self.assertTrue(all(",Glow," in l and "\\blur" in l for l in brilhos))
        self.assertNotIn("Sombra", "\n".join(linhas))
        self.assertEqual(set(re.findall(r"\\1c(&H[0-9A-F]+&)", "\n".join(linhas))), {"&HFFFFFF&"})
        for brilho, texto in zip(brilhos, textos):
            self.assertEqual(brilho.split(",")[1:3], texto.split(",")[1:3])
            self.assertEqual(re.findall(r"\\1c(&H[0-9A-F]+&)", brilho), re.findall(r"\\1c(&H[0-9A-F]+&)", texto))
            self.assertEqual(re.findall(r"\\(?:pos|move)\([^)]*\)", brilho), re.findall(r"\\(?:pos|move)\([^)]*\)", texto))
        self.assertFalse(any("\\bord" in l for l in linhas))

    def test_gerar_ass_do_texto_completo(self):
        ass = self.pasta / "l.ass"
        plano = legendas.gerar_ass(falar(FALA), 20.0, ass, render.FONT, "FIAT ARGO 2022")
        conteudo = ass.read_text(encoding="utf-8")
        self.assertGreaterEqual(conteudo.count("Dialogue:"), 2 * len(plano))
        self.assertIn("Lato Black", conteudo)
        r, _ = self._queimar(ass, duracao=3)
        self.assertEqual(r.returncode, 0, r.stderr[:300])


class TestTarjas(unittest.TestCase):
    def test_tres_tarjas_saem_apenas_no_final(self):
        for indice in range(3):
            inicio, fim = animacao_tarjas.saida_final(30.0, indice)
            self.assertGreater(inicio, 29.5)
            self.assertEqual(fim, 30.0)

    def test_escolha_e_estavel_e_pode_ser_forcada(self):
        self.assertEqual(animacao_tarjas.escolher("FIAT ARGO 2022"), animacao_tarjas.escolher("fiat argo 2022"))
        self.assertIn(animacao_tarjas.escolher("QUALQUER"), animacao_tarjas.PREDEFINICOES)
        with unittest.mock.patch.dict("os.environ", {"SOUL_TARJAS": "subida"}):
            self.assertEqual(animacao_tarjas.escolher("X"), "subida")
        self.assertGreater(len({animacao_tarjas.escolher(n) for n in
                                ("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")}), 1)

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg ausente")
    def test_cada_predefinicao_roda_no_ffmpeg_e_aparece_no_meio(self):
        pasta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, pasta, True)
        png = pasta / "t.png"
        render.Image.new("RGBA", (500, 120), (255, 255, 255, 255)).save(png)
        for nome in animacao_tarjas.PREDEFINICOES:
            f = animacao_tarjas.filtros(nome, 1, 500, 223, (0.0, 0.55), (2.4, 2.8))
            fc = ["[0:v]format=yuv420p[base]"]
            entrada = "1:v"
            if f["pre"]:
                fc.append(f"[1:v]{f['pre']}[t]")
                entrada = "t"
            fc.append(f"[base][{entrada}]overlay=x='{f['x']}':y='{f['y']}':eval=frame:shortest=1[v]")
            saida = pasta / f"{nome}.png"
            r = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=4",
                 "-loop", "1", "-framerate", "30", "-t", "4", "-i", str(png),
                 "-filter_complex", ";".join(fc), "-map", "[v]", "-ss", "1.5", "-frames:v", "1", str(saida)],
                capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{nome}: {r.stderr[:300]}")
            # A flutuação mantém a tarja próxima da posição de composição.
            brancos = render.Image.open(saida).convert("L").point(lambda v: 255 if v > 200 else 0).getbbox()
            self.assertIsNotNone(brancos, nome)
            self.assertAlmostEqual(brancos[1], 223, delta=6, msg=nome)


if __name__ == "__main__":
    unittest.main()
