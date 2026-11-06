"""Monta o vídeo Soul Cars sem Premiere: tarjas + legendas animadas pelo contexto da fala + trilha + cartão final.

Uso: python render.py <pasta_do_veiculo> "<veículo>" "<motor/câmbio>" "<preço>"
"""
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import banner_animation as animacao_tarjas  # noqa: E402
import logo_animation as animacao_logo  # noqa: E402
import captions as legendas  # noqa: E402
import speech_context as contexto  # noqa: E402
import expressions as expressoes  # noqa: E402

ENGINE = Path(__file__).resolve().parent
W, H, FPS = 1080, 1920, "60000/1001"
# A fonte acompanha o app (assets); as instaladas no Windows vêm primeiro por compatibilidade.
FONT = next((p for p in [
    Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Windows/Fonts/Lato-Black.ttf",
    Path("C:/Windows/Fonts/Lato-Black.ttf"),
    ENGINE / "assets/Lato-Black.ttf",
] if p.exists()), None)
if FONT is None:
    raise SystemExit("ERRO: fonte Lato Black não encontrada (assets/Lato-Black.ttf).")
ORANGE = (214, 125, 5)
LOGO_SECONDS = 5.0
PADDING_TARJA = 32
BORDA_GLOW = 16
LARGURA_MAX_TARJA = int((W - 2 * 64) / animacao_tarjas.ESCALA_MAXIMA) - 2 * BORDA_GLOW
ESPACO_TARJAS = 8
# Estilos e tempos originais; altura/padding são recalculados pelo texto.
TARJAS = [  # (y_topo, altura, tamanho_fonte, padding_x, fundo, cor_texto, entra_em, entra_ate)
    (223, 135, 75, 40, (255, 255, 255), (0, 0, 0), 0.00, 0.55),
    (336, 99, 73, 31, (1, 1, 1), (255, 255, 255), 0.25, 0.80),
    (435, 171, 112, 31, ORANGE, (255, 255, 255), 0.50, 1.05),
]


def log(msg: str) -> None:
    print(msg, flush=True)


NOMES_TRILHA = ("TRILHA.wav", "TRILHA.flac", "TRILHA.mp3")


def pasta_trilha_do_app() -> Path | None:
    """Pasta `trilha` dentro dos dados do app: a trilha padrão do usuário (o instalador não leva trilha)."""
    dados = os.environ.get("SOUL_DATA_DIR")
    return Path(dados) / "trilha" if dados else None


def localizar_trilha(assets: Path) -> Path | None:
    """Trilha do vídeo: a da pasta ASSETS do veículo, depois a do app (dados do usuário), depois uma cópia local em engine/assets."""
    pastas = [assets, pasta_trilha_do_app(), ENGINE / "assets"]
    return next((p for base in pastas if base for n in NOMES_TRILHA if (p := base / n).is_file()), None)


def progresso(pct: float, texto: str) -> None:
    """Linha lida pelo app para mover a barra: PROGRESSO <0-100> <texto>."""
    log(f"PROGRESSO {max(0, min(100, pct)):.0f} {texto}")


def run_ffmpeg(cmd: list, segundos_totais: float, inicio: float, fim: float, texto: str,
               limite_sem_avanco: float = 120) -> None:
    """Roda o ffmpeg mostrando o avanço real (out_time do -progress) entre inicio% e fim%."""
    completo = [cmd[0], "-progress", "pipe:1", "-nostats", *cmd[1:]]
    erros = []
    ultimo_avanco = time.monotonic()
    ultimo_tempo = -1
    travou = threading.Event()
    terminou = threading.Event()
    # O `with` fecha stdout/stderr (e espera o processo) mesmo se algo falhar no meio.
    with subprocess.Popen(completo, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                          encoding="utf-8", errors="replace") as proc:
        def vigiar():
            while not terminou.wait(1):
                if time.monotonic() - ultimo_avanco < limite_sem_avanco:
                    continue
                if proc.poll() is not None:
                    return
                travou.set()
                # No Windows, ffmpeg pode ser um shim que abre o executável real.
                try:
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                                       capture_output=True, timeout=15,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
                except (OSError, subprocess.TimeoutExpired):
                    pass
                finally:
                    if proc.poll() is None:
                        proc.kill()
                return

        vigia = threading.Thread(target=vigiar, daemon=True)
        vigia.start()
        leitor = threading.Thread(target=lambda: erros.append(proc.stderr.read()), daemon=True)
        leitor.start()
        try:
            for linha in proc.stdout:
                chave, _, valor = linha.strip().partition("=")
                if chave == "out_time_us" and valor.isdigit() and segundos_totais > 0:
                    tempo = int(valor)
                    if tempo > ultimo_tempo:
                        ultimo_tempo = tempo
                        ultimo_avanco = time.monotonic()
                    fracao = min(1.0, tempo / 1_000_000 / segundos_totais)
                    progresso(inicio + (fim - inicio) * fracao, texto)
            codigo = proc.wait()
        finally:
            terminou.set()
            vigia.join(timeout=20)
            leitor.join(timeout=5)
    if travou.is_set():
        raise RuntimeError(f"FFmpeg sem avanço por {limite_sem_avanco:g} segundos.")
    if codigo != 0:
        detalhe = (erros[0] if erros else "")[-2500:]
        raise RuntimeError(f"Falha ao executar ffmpeg:\n{detalhe}")


def run(cmd: list) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"Falha ao executar {Path(cmd[0]).name}:\n{r.stderr[-2500:]}")


def probe_duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


# ---------------- tarjas ----------------
def tarja_png(text: str, spec, out: Path, glow_out: Path | None = None) -> tuple:
    y, h, size, pad, bg, fg, _, _ = spec
    pad = PADDING_TARJA
    text = " ".join(text.split()) or "—"
    font = ImageFont.truetype(str(FONT), size)
    l, t, r, b = font.getbbox(text)
    while (r - l) + 2 * pad > LARGURA_MAX_TARJA and size > 42:
        size = max(42, size - 2)
        font = ImageFont.truetype(str(FONT), size)
        l, t, r, b = font.getbbox(text)
    # Mesmo nomes excepcionais respeitam o limite, sem comprimir as letras.
    if r - l + 2 * pad > LARGURA_MAX_TARJA:
        while text and font.getbbox(text.rstrip() + "…")[2] - font.getbbox(text.rstrip() + "…")[0] + 2 * pad > LARGURA_MAX_TARJA:
            text = text[:-1]
        text = text.rstrip() + "…"
    # Usa a tinta real dos glifos: acentos e descendentes também ficam centralizados.
    mascara = font.getmask(text)
    tinta = mascara.getbbox()
    l, t, r, b = font.getbbox(text)
    il, it, ir, ib = tinta
    tw, th = ir - il, ib - it
    img = Image.new("RGBA", (tw + 2 * pad, th + 2 * pad), bg + (255,))
    d = ImageDraw.Draw(img)
    d.text((pad - l - il, pad - t - it), text, font=font, fill=fg + (255,))
    img.save(out)
    if glow_out is not None:
        letras = Image.new("L", img.size, 0)
        ImageDraw.Draw(letras).text((pad - l - il, pad - t - it), text, font=font, fill=255)
        brilho = Image.new("RGBA", img.size, (255, 255, 255, 0))
        brilho.putalpha(letras.filter(ImageFilter.GaussianBlur(5)).point(lambda v: round(v * 0.55)))
        brilho.save(glow_out)
    return img.width, y


def uniformizar_larguras(tarjas: list, glow_valor: Path) -> list:
    """Iguala os fundos pela maior tarja, sem esticar texto ou máscara de brilho."""
    largura = max(w for _, w, _, _ in tarjas)
    alinhadas = []
    for i, (png, w, y, spec) in enumerate(tarjas):
        deslocamento = (largura - w) // 2
        with Image.open(png) as original:
            imagem = Image.new("RGBA", (largura, original.height), spec[4] + (255,))
            imagem.alpha_composite(original.convert("RGBA"), (deslocamento, 0))
        imagem.save(png)
        if i == 2:
            with Image.open(glow_valor) as letras:
                brilho = Image.new("RGBA", imagem.size, (255, 255, 255, 0))
                brilho.alpha_composite(letras.convert("RGBA"), (deslocamento, 0))
            brilho.save(glow_valor)
        alinhadas.append((png, largura, y, spec))
    return alinhadas


def fix_words(words: list, veiculo: str, correcoes: list) -> list:
    words = expressoes.normalizar(words)
    # junta pontuação solta ("100" "%")
    merged = []
    for w in words:
        so_pontuacao = re.fullmatch(r"[%.,!?;:]+", w["w"])
        # "1" + ".6" -> "1.6" (o Whisper separa o decimal do motor)
        decimal = (
            merged
            and re.fullmatch(r"[.,]\d+[.,!?;:]*", w["w"])
            and re.fullmatch(r"\d+", merged[-1]["w"])
        )
        if merged and (so_pontuacao or decimal):
            merged[-1]["w"] += w["w"]; merged[-1]["e"] = w["e"]
        else:
            merged.append(dict(w))
    # nome do veículo: palavra parecida (ex.: "Onyx") vira a grafia digitada ("Onix")
    ref = [p for p in re.findall(r"[A-Za-zÀ-ú]+", veiculo) if len(p) >= 3]
    for w in merged:
        core = re.sub(r"[^\wÀ-ú-]", "", w["w"])
        for p in ref:
            if core and strip_accents(core) != strip_accents(p) and levenshtein(strip_accents(core), strip_accents(p)) <= 1 and len(core) >= 4:
                w["w"] = w["w"].replace(core, p)
    # lista de correções "errado => certo" (várias palavras podem virar uma)
    for de, para in correcoes:
        de_w = [re.sub(r"[^\w%]", "", x) for x in strip_accents(de).split()]
        i = 0
        while i + len(de_w) <= len(merged):
            seq = [re.sub(r"[^\w%]", "", strip_accents(x["w"])) for x in merged[i:i + len(de_w)]]
            if seq == de_w:
                m = re.search(r"[.,!?;:]+$", merged[i + len(de_w) - 1]["w"])
                punct = m.group(0) if m else ""
                para_w = para.split()
                if len(para_w) == len(de_w):
                    for k, pw in enumerate(para_w):
                        merged[i + k]["w"] = pw + (punct if k == len(para_w) - 1 else "")
                else:
                    merged[i] = {"w": para + punct, "s": merged[i]["s"], "e": merged[i + len(de_w) - 1]["e"]}
                    del merged[i + 1:i + len(de_w)]
            i += 1
    return merged


def build_ass(words: list, video_end: float, out: Path, veiculo: str = "") -> list:
    """Legendas: o motor de contexto planeja as animações (ver contexto.py e legendas.py)."""
    return legendas.gerar_ass(words, video_end, out, FONT, veiculo)


def preparar_fontes(destino: Path) -> Path:
    """Fonte única do render: Lato Black."""
    destino.mkdir(parents=True, exist_ok=True)
    shutil.copy2(FONT, destino / FONT.name)
    return destino


def localizar_video(root: Path) -> Path:
    # Aceita as duas pastas de mídia verificadas pelo Studio e a pasta do veículo.
    candidatos = [root / "PROJETO", root / "VIDEO", root]
    videos = [p for base in candidatos if base.is_dir() for p in base.iterdir()
              if p.is_file() and p.suffix.lower() in (".mov", ".mp4", ".mkv", ".avi")
              and not p.name.upper().startswith("VIDEO_")]
    if len(videos) != 1:
        raise RuntimeError(f"Esperava 1 vídeo bruto em {root}, PROJETO ou VIDEO; encontrei {len(videos)}")
    return videos[0]


def main(folder: str, veiculo: str, motor: str, preco: str) -> None:
    t0 = time.time()
    root = Path(folder)
    video = localizar_video(root)
    proj = video.parent
    if root.name.upper() in ("PROJETO", "VIDEO"):
        root = root.parent
    assets = proj / "ASSETS"
    # A trilha do app vai em FLAC (mesmo áudio da WAV, arquivo menor); a da pasta ASSETS tem prioridade.
    trilha = localizar_trilha(assets)
    logo = next((p for p in [assets / "soul-logo.jpg", assets / "LOGO_SOUL.jpg", ENGINE / "assets/soul-logo.jpg"] if p.exists()), None)
    model = (root.name.split("_") + ["SAIDA", "SAIDA"])[1]
    out = root / f"VIDEO_{model}.mp4"
    work = root / ".soul_tmp"
    work.mkdir(exist_ok=True)

    progresso(1, "Lendo o vídeo bruto")
    dur = probe_duration(video)
    total = dur + (LOGO_SECONDS if logo else 0)
    log(f"Vídeo {video.name}: {dur:.2f}s -> saída {out.name} ({total:.2f}s)")

    # 1) transcrição (cache por vídeo)
    words_json = work / f"{video.stem}_words.json"
    if not words_json.exists() or words_json.stat().st_mtime < video.stat().st_mtime:
        log("1/3 Transcrevendo (Whisper)...")
        progresso(3, "Extraindo o áudio")
        wav = work / "audio16k.wav"
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
        from transcribe import main as transcribe
        transcribe(str(wav), str(words_json), dur,
                   lambda f: progresso(5 + 30 * f, "Transcrevendo a fala"))
    else:
        log("1/3 Transcrição já existe (cache).")
    progresso(35, "Transcrição pronta")
    words = json.loads(words_json.read_text(encoding="utf-8"))

    correcoes = []
    cfile = ENGINE / "corrections.txt"
    if cfile.exists():
        for line in cfile.read_text(encoding="utf-8").splitlines():
            if "=>" in line and not line.strip().startswith("#"):
                a, b = line.split("=>", 1)
                correcoes.append((a.strip(), b.strip()))
    words = fix_words(words, veiculo, correcoes)
    (work / "legenda_final.txt").write_text(" ".join(w["w"] for w in words), encoding="utf-8")

    # 2) gráficos
    log("2/3 Gerando tarjas e legendas...")
    progresso(37, "Montando tarjas e legendas")
    ass = work / "legendas.ass"
    plano = build_ass(words, dur, ass, veiculo)
    (work / "plano_legendas.txt").write_text(contexto.resumo(plano), encoding="utf-8")
    log(f"Legendas: {len(plano)} frases, animações " + ", ".join(sorted({p['animacao'] for p in plano})))
    tarjas = []
    glow_valor = work / "glow_valor.png"
    proximo_y = TARJAS[0][0]
    for i, (text, spec) in enumerate(zip([veiculo, motor, preco], TARJAS)):
        spec = (proximo_y, *spec[1:])
        png = work / f"tarja{i}.png"
        w, y = tarja_png(text, spec, png, glow_valor if i == 2 else None)
        tarjas.append((png, w, y, spec))
        with Image.open(png) as imagem:
            proximo_y = y + imagem.height + ESPACO_TARJAS
    tarjas = uniformizar_larguras(tarjas, glow_valor)
    for i, (png, w, y, spec) in enumerate(tarjas):
        with Image.open(png) as imagem:
            # Halo suave, separado da imagem medida para preservar o padding real.
            tamanho = (imagem.width + 2 * BORDA_GLOW, imagem.height + 2 * BORDA_GLOW)
            mascara = Image.new("L", tamanho, 0)
            mascara.paste(36, (BORDA_GLOW, BORDA_GLOW, tamanho[0]-BORDA_GLOW, tamanho[1]-BORDA_GLOW))
            halo = Image.new("RGBA", tamanho, ORANGE if i == 2 else (255, 255, 255))
            halo.putalpha(mascara.filter(ImageFilter.GaussianBlur(6)))
            halo.alpha_composite(imagem.convert("RGBA"), (BORDA_GLOW, BORDA_GLOW))
        halo.save(png)
        if i == 2:
            with Image.open(glow_valor) as letras:
                expandido = Image.new("RGBA", tamanho, (255, 255, 255, 0))
                expandido.alpha_composite(letras, (BORDA_GLOW, BORDA_GLOW))
            expandido.save(glow_valor)
        tarjas[i] = (png, w + 2 * BORDA_GLOW, y - BORDA_GLOW, spec)

    # 3) ffmpeg: vídeo + tarjas + legendas + cartão final + áudio
    log("3/3 Renderizando (HEVC 1080x1920 59,94 fps 50 Mbps)...")
    progresso(40, "Renderizando o vídeo")
    inputs = ["-i", str(video)]
    for png, *_ in tarjas:
        inputs += ["-loop", "1", "-framerate", FPS, "-t", f"{dur}", "-i", str(png)]  # 60 fps: movimento suave
    inputs += ["-loop", "1", "-framerate", FPS, "-t", f"{dur}", "-i", str(glow_valor)]
    n_glow = 1 + len(tarjas)

    fc = [f"[0:v]scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,format=yuv420p[base]"]
    # Compõe o conjunto em transparência para escalar as três tarjas como uma peça.
    topo_conjunto = TARJAS[0][0] - 40
    altura_conjunto = proximo_y - TARJAS[0][0] + 80
    fc.append(f"color=c=black:s={W}x{altura_conjunto}:r={FPS}:d={dur},format=rgba,colorchannelmixer=aa=0[conjunto]")
    last = "conjunto"
    fc.append(f"[{n_glow}:v]{animacao_tarjas.filtro_glow_valor()}[brilho_valor]")
    fc.append("[3:v][brilho_valor]overlay=0:0:shortest=1:format=auto[preco_brilho]")
    predefinicao = animacao_tarjas.escolher(veiculo)
    log(f"Animação das tarjas: {predefinicao}")
    for i, (png, w, y, spec) in enumerate(tarjas):
        _, _, _, _, _, _, a, b = spec
        f = animacao_tarjas.filtros(predefinicao, i, w, y - topo_conjunto, (a, b),
                                    animacao_tarjas.saida_final(dur, i))
        entrada = "preco_brilho" if i == 2 else f"{i + 1}:v"
        if f["pre"]:
            fc.append(f"[{entrada}]{f['pre']}[t{i}]")
            entrada = f"t{i}"
        fc.append(f"[{last}][{entrada}]overlay=x='{f['x']}':y='{f['y']}':eval=frame:shortest=1:format=auto[v{i}]")
        last = f"v{i}"
    escala = animacao_tarjas.filtro_escala(TARJAS[-1][-1], animacao_tarjas.saida_final(dur, 0)[0], FPS)
    fc.append(f"[{last}]{escala}[tarjas_animadas]")
    fc.append(f"[base][tarjas_animadas]overlay=x=0:y={topo_conjunto}:shortest=1[com_tarjas]")
    last = "com_tarjas"
    ass_path = str(ass).replace("\\", "/").replace(":", "\\:")
    fonts_dir = str(preparar_fontes(work / "fontes")).replace("\\", "/").replace(":", "\\:")
    fc.append(f"[{last}]subtitles='{ass_path}':fontsdir='{fonts_dir}',trim=duration={dur},setpts=PTS-STARTPTS[vid]")
    # Cena e cartão em processos separados: o concat no grafo de overlays pode
    # bloquear o agendador do FFmpeg na transição, inclusive com encoder por CPU.
    codificador = "hevc_qsv"

    def codificar(entradas, filtros, mapa, segundos, destino, inicio, fim, mensagem):
        nonlocal codificador
        cmd = ["ffmpeg", "-hide_banner", "-y", "-filter_complex_threads", "2", *entradas,
               "-filter_complex", ";".join(filtros), "-map", mapa, "-an", "-t", str(segundos),
               "-c:v", codificador, "-b:v", "50M", "-maxrate", "100M", "-bufsize", "100M",
               "-r", FPS, "-pix_fmt", "yuv420p", "-tag:v", "hvc1", str(destino)]
        try:
            run_ffmpeg(cmd, segundos, inicio, fim, mensagem)
        except RuntimeError as erro:
            if codificador != "hevc_qsv":
                raise
            log(f"  (codificador Intel falhou: {erro}; usando x265)")
            codificador = "libx265"
            cmd[cmd.index("hevc_qsv")] = codificador
            run_ffmpeg(cmd, segundos, inicio, fim, mensagem + " (x265)")

    cena = work / "cena.mp4"
    codificar(inputs, fc, "[vid]", dur, cena, 40, 86, "Renderizando a cena")
    codificador_cena = codificador
    partes = [cena]
    if logo:
        cartao = work / "encerramento.mp4"
        codificar(["-loop", "1", "-framerate", FPS, "-t", str(LOGO_SECONDS), "-i", str(logo)],
                  animacao_logo.filtros(0, LOGO_SECONDS, W, H, FPS), "[card]", LOGO_SECONDS,
                  cartao, 86, 94, "Renderizando a logo final")
        if codificador != codificador_cena:
            # Partes com parâmetros do mesmo encoder tornam o MP4 concatenado
            # compatível também com players que não aceitam mudança de SPS/PPS.
            codificar(inputs, fc, "[vid]", dur, cena, 40, 86, "Refazendo a cena com x265")
        partes.append(cartao)

    # Concat demuxer lê arquivos já fechados, sem grafo de vídeo concorrente.
    lista = work / "partes.txt"
    lista.write_text("".join(f"file '{p.name}'\n" for p in partes), encoding="utf-8")
    entradas = ["-f", "concat", "-safe", "1", "-i", str(lista), "-i", str(video)]
    audio = [f"[1:a]volume=3dB,apad=whole_dur={total}[voz]"]
    if trilha:
        entradas += ["-i", str(trilha)]
        audio += [f"[2:a]atrim=0:{total},volume=-30dB,afade=t=out:st={max(0, total - 1.5)}:d=1.5[mus]",
                  "[voz][mus]amix=inputs=2:duration=first:normalize=0[aout]"]
    else:
        audio[0] = audio[0].replace("[voz]", "[aout]")
    tmp_out = work / "saida.mp4"
    cmd = ["ffmpeg", "-hide_banner", "-y", *entradas, "-filter_complex", ";".join(audio),
           "-map", "0:v:0", "-map", "[aout]", "-t", str(total), "-c:v", "copy", "-tag:v", "hvc1",
           "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", str(tmp_out)]
    run_ffmpeg(cmd, total, 94, 98, "Unindo cena, logo e áudio")

    # Só troca o arquivo final depois de conferir que o vídeo saiu inteiro.
    if not tmp_out.is_file() or tmp_out.stat().st_size < 100_000:
        raise RuntimeError("O vídeo gerado ficou vazio ou muito pequeno.")
    gerado = probe_duration(tmp_out)
    if gerado < total - 1.0:
        raise RuntimeError(f"O vídeo saiu incompleto: {gerado:.1f}s de {total:.1f}s esperados.")
    if out.exists():
        out.unlink()
    tmp_out.replace(out)
    progresso(99, "Conferindo o arquivo final")
    completo = out.is_file() and abs(probe_duration(out) - total) <= 1.0 and out.stat().st_size > 100_000
    if not completo:
        raise RuntimeError("O arquivo final não passou na conferência de duração/tamanho.")
    # Vídeo conferido: a pasta de trabalho .soul_tmp não serve para mais nada.
    shutil.rmtree(work, ignore_errors=True)
    if work.exists():
        log(f"  (não foi possível apagar {work.name}; pode remover à mão)")
    progresso(100, "Vídeo pronto")
    log(f"PRONTO em {time.time() - t0:.0f}s: {out}")


if __name__ == "__main__":
    sys.path.insert(0, str(ENGINE))
    try:
        main(*sys.argv[1:5])
    except Exception as e:  # mensagem limpa para o app
        log(f"ERRO: {e}")
        sys.exit(1)
