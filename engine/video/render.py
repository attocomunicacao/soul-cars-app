"""Monta o vídeo Soul Cars sem Premiere: tarjas + legendas palavra a palavra com glow + trilha + cartão final.

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

from PIL import Image, ImageDraw, ImageFont

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
# Medidas tiradas dos vídeos finalizados no Premiere (1080x1920)
TARJAS = [  # (y_topo, altura, tamanho_fonte, padding_x, fundo, cor_texto, entra_em, entra_ate)
    (223, 135, 75, 40, (255, 255, 255), (0, 0, 0), 0.00, 0.55),
    (336, 99, 73, 31, (1, 1, 1), (255, 255, 255), 0.25, 0.80),
    (435, 171, 112, 31, ORANGE, (255, 255, 255), 0.50, 1.05),
]


def log(msg: str) -> None:
    print(msg, flush=True)


def progresso(pct: float, texto: str) -> None:
    """Linha lida pelo app para mover a barra: PROGRESSO <0-100> <texto>."""
    log(f"PROGRESSO {max(0, min(100, pct)):.0f} {texto}")


def run_ffmpeg(cmd: list, segundos_totais: float, inicio: float, fim: float, texto: str) -> None:
    """Roda o ffmpeg mostrando o avanço real (out_time do -progress) entre inicio% e fim%."""
    completo = [cmd[0], "-progress", "pipe:1", "-nostats", *cmd[1:]]
    proc = subprocess.Popen(completo, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                            encoding="utf-8", errors="replace")
    erros = []
    leitor = threading.Thread(target=lambda: erros.append(proc.stderr.read()), daemon=True)
    leitor.start()
    for linha in proc.stdout:
        chave, _, valor = linha.strip().partition("=")
        if chave == "out_time_us" and valor.isdigit() and segundos_totais > 0:
            fracao = min(1.0, int(valor) / 1_000_000 / segundos_totais)
            progresso(inicio + (fim - inicio) * fracao, texto)
    codigo = proc.wait()
    leitor.join(timeout=5)
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
def tarja_png(text: str, spec, out: Path) -> tuple:
    y, h, size, pad, bg, fg, _, _ = spec
    font = ImageFont.truetype(str(FONT), size)
    l, t, r, b = font.getbbox(text)
    while (r - l) + 2 * pad > W - 40 and size > 30:  # nome longo: reduz a fonte para caber com margem
        size -= 2
        font = ImageFont.truetype(str(FONT), size)
        l, t, r, b = font.getbbox(text)
    tw = r - l
    cap = font.getbbox("H")
    img = Image.new("RGBA", (tw + 2 * pad, h), bg + (255,))
    d = ImageDraw.Draw(img)
    # centraliza verticalmente pela altura das maiúsculas (igual ao Premiere)
    ty = (h - (cap[3] - cap[1])) / 2 - cap[1]
    d.text((pad - l, ty), text, font=font, fill=fg + (255,))
    img.save(out)
    return img.width, y


# ---------------- legendas ----------------
def fix_words(words: list, veiculo: str, correcoes: list) -> list:
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


def ass_time(t: float) -> str:
    t = max(t, 0)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_ass(words: list, video_end: float, out: Path) -> None:
    # LEG_IN: sobe 100 px e aparece em ~200 ms com desaceleração (ease-out)
    x, y, rise, leg_in = W // 2, 1520, 100, 0.20
    size = 90  # medido: mesma altura de letra dos vídeos do Premiere
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: GlowWide,Lato Black,{size},&HB0FFFFFF,&H000000FF,&HB0FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,7,0,5,0,0,0,1
Style: GlowTight,Lato Black,{size},&H40FFFFFF,&H000000FF,&H40FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,2,0,5,0,0,0,1
Style: Leg,Lato Black,{size},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for i, w in enumerate(words):
        start = w["s"]
        nxt = words[i + 1]["s"] if i + 1 < len(words) else w["e"] + 0.4
        # igual ao Premiere: a palavra fica até a próxima começar (pausas longas encerram antes)
        end = min(nxt if nxt - w["e"] < 1.0 else w["e"] + 0.3, video_end)
        if end <= start:
            continue
        txt = w["w"].upper().replace("{", "(").replace("}", ")")
        # entrada em 6 trechos com ease-out cúbico (libass só move em linha reta; trechos curtos = curva suave)
        steps = 6
        seg = min(leg_in, end - start) / steps
        ease = lambda p: 1 - (1 - p) ** 3
        # (estilo, camada, blur, transparência base 0-255)
        layers = [("GlowWide", 0, "\\blur16", 0xB0), ("GlowTight", 1, "\\blur5", 0x40), ("Leg", 2, "", 0)]
        for k in range(steps + 1):
            final = k == steps
            if not final:
                a0, a1 = ease(k / steps), ease((k + 1) / steps)
                s0, s1 = start + k * seg, start + (k + 1) * seg
            else:
                s0, s1 = start + steps * seg, end
            if s1 - s0 < 0.005:
                continue
            for style, layer, extra, base in layers:
                if final:
                    tags = f"\\pos({x},{y})"
                else:
                    y0, y1 = y + rise * (1 - a0), y + rise * (1 - a1)
                    # aparece somando à transparência base do estilo (o glow continua suave no fim)
                    al0 = int(base + (255 - base) * (1 - a0)); al1 = int(base + (255 - base) * (1 - a1))
                    tags = f"\\move({x},{y0:.1f},{x},{y1:.1f})\\alpha&H{al0:02X}&\\t(\\alpha&H{al1:02X}&)"
                lines.append(f"Dialogue: {layer},{ass_time(s0)},{ass_time(s1)},{style},,0,0,0,,{{{tags}{extra}}}{txt}")
    out.write_text(head + "\n".join(lines) + "\n", encoding="utf-8")


def overlay_x_expr(w: int, t_in0: float, t_in1: float, t_out0: float, t_out1: float) -> str:
    cx = (W - w) / 2
    ease_in = f"(1-pow(1-(t-{t_in0})/{t_in1 - t_in0},5))"  # ease-out quíntico: chega devagar, sem tranco
    ease_out = f"pow((t-{t_out0})/{t_out1 - t_out0},3)"
    return (f"if(lt(t,{t_in0}),-{w},if(lt(t,{t_in1}),-{w}+({cx}+{w})*{ease_in},"
            f"if(lt(t,{t_out0}),{cx},if(lt(t,{t_out1}),{cx}-({cx}+{w})*{ease_out},-{w}))))")


# ---------------- principal ----------------
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
    trilha_nomes = ["TRILHA.wav", "TRILHA.flac"]
    trilha = next((p for base in (assets, ENGINE / "assets") for n in trilha_nomes if (p := base / n).exists()), None)
    logo = next((p for p in [assets / "LOGO_SOUL.jpg", ENGINE / "assets/LOGO_SOUL.jpg"] if p.exists()), None)
    model = (root.name.split("_") + ["SAIDA", "SAIDA"])[1]
    out = root / f"VIDEO_{model}.mp4"
    work = root / ".soul_tmp"
    work.mkdir(exist_ok=True)

    progresso(1, "Lendo o vídeo bruto")
    dur = probe_duration(video)
    total = dur + LOGO_SECONDS
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
    cfile = ENGINE / "correcoes.txt"
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
    build_ass(words, dur, ass)
    tarjas = []
    out_start, out_end = dur - 1.1, dur - 0.7
    for i, (text, spec) in enumerate(zip([veiculo, motor, preco], TARJAS)):
        png = work / f"tarja{i}.png"
        w, y = tarja_png(text, spec, png)
        tarjas.append((png, w, y, spec))

    # 3) ffmpeg: vídeo + tarjas + legendas + cartão final + áudio
    log("3/3 Renderizando (HEVC 1080x1920 59,94 fps 50 Mbps)...")
    progresso(40, "Renderizando o vídeo")
    inputs = ["-i", str(video)]
    for png, *_ in tarjas:
        inputs += ["-loop", "1", "-framerate", FPS, "-t", f"{total}", "-i", str(png)]  # 60 fps: movimento suave
    if logo:
        inputs += ["-loop", "1", "-framerate", FPS, "-t", f"{LOGO_SECONDS}", "-i", str(logo)]
    if trilha:
        inputs += ["-i", str(trilha)]
    n_logo = 1 + len(tarjas)
    n_trilha = n_logo + (1 if logo else 0)

    fc = [f"[0:v]scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,format=yuv420p[base]"]
    last = "base"
    for i, (png, w, y, spec) in enumerate(tarjas):
        _, _, _, _, _, _, a, b = spec
        # motor por último na pilha (fica por cima da base da tarja do nome)
        x = overlay_x_expr(w, a, b, out_start + i * 0.06, out_end + i * 0.06)
        fc.append(f"[{last}][{i + 1}:v]overlay=x='{x}':y={y}:eval=frame:shortest=1[v{i}]")
        last = f"v{i}"
    ass_path = str(ass).replace("\\", "/").replace(":", "\\:")
    fonts_dir = str(FONT.parent).replace("\\", "/").replace(":", "\\:")
    fc.append(f"[{last}]subtitles='{ass_path}':fontsdir='{fonts_dir}'[vid]")
    if logo:
        fc.append(f"color=c=0x191919:s={W}x{H}:r={FPS}:d={LOGO_SECONDS}[bg]")
        fc.append(f"[{n_logo}:v]scale={W}:-1,format=rgba[lg]")
        fc.append(f"[bg][lg]overlay=(W-w)/2:(H-h)/2,format=yuv420p,setsar=1[card]")
        fc.append("[vid][card]concat=n=2:v=1:a=0[vout]")
    else:
        fc.append("[vid]null[vout]")
    voice = f"[0:a]volume=3dB,apad=whole_dur={total}[voz]"
    if trilha:
        fc.append(voice)
        fc.append(f"[{n_trilha}:a]atrim=0:{total},volume=-30dB,afade=t=out:st={total - 1.5}:d=1.5[mus]")
        fc.append("[voz][mus]amix=inputs=2:duration=first:normalize=0[aout]")
    else:
        fc.append(voice.replace("[voz]", "[aout]"))

    tmp_out = work / "saida.mp4"
    cmd = ["ffmpeg", "-hide_banner", "-y", *inputs, "-filter_complex", ";".join(fc),
           "-map", "[vout]", "-map", "[aout]", "-t", f"{total}",
           "-c:v", "hevc_qsv", "-b:v", "50M", "-maxrate", "100M", "-bufsize", "100M", "-tag:v", "hvc1",
           "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", str(tmp_out)]
    try:
        run_ffmpeg(cmd, total, 40, 98, "Renderizando o vídeo")
    except RuntimeError:
        log("  (codificador Intel indisponível, usando x265)")
        cmd[cmd.index("hevc_qsv")] = "libx265"
        run_ffmpeg(cmd, total, 40, 98, "Renderizando o vídeo (x265)")

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
