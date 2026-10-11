"""Transcreve o áudio com tempo por palavra e grava JSON: [{"w": "palavra", "s": início, "e": fim}, ...]"""
import json
import sys
import time

from faster_whisper import WhisperModel

MODEL = "large-v3-turbo"


def main(audio_path: str, out_json: str, duracao: float = 0.0, progresso=None) -> None:
    t0 = time.time()
    model = WhisperModel(MODEL, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        audio_path,
        language="pt",
        word_timestamps=True,
        vad_filter=True,
        initial_prompt="Soul Cars, carros com alma. Motor 1.0, 1.4, 1.6, câmbio manual e automático.",
    )
    words = []
    for seg in segments:
        if progresso and duracao > 0:
            progresso(min(1.0, seg.end / duracao))
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append({"w": text, "s": round(w.start, 3), "e": round(w.end, 3)})
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)
    print(f"{len(words)} palavras em {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
