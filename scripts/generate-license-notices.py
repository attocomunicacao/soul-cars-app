"""Gera THIRD_PARTY_NOTICES.md: licenças das dependências do motor Python, modelos e arquivos embutidos.

Uso (com o ambiente do motor instalado por scripts/install-engine.cmd):
    apps/engine/.venv/Scripts/python.exe scripts/generate-license-notices.py
As versões vêm do apps/engine/uv.lock; as licenças, dos metadados instalados. Quando o metadado não
traz uma licença clara, a tabela OVERRIDES abaixo diz qual é (conferida no projeto de origem).
"""

import importlib.metadata as metadata
import re
import sys
import tomllib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "THIRD_PARTY_NOTICES.md"


def norm(nome: str) -> str:
    return re.sub(r"[-_.]+", "-", nome).lower()


# Metadados sem licença clara (campo vazio ou só "BSD License"): licença do projeto de origem.
OVERRIDES = {
    "colorama": "BSD-3-Clause",
    "numba": "BSD-2-Clause",
    "pdfplumber": "MIT",
    "scikit-image": "BSD-3-Clause",
    "scipy": "BSD-3-Clause",
    "tokenizers": "Apache-2.0",
    "tqdm": "MPL-2.0 AND MIT",
    "pypdfium2": "BSD-3-Clause ou Apache-2.0 (mais as licenças das bibliotecas que ele incorpora)",
    "pillow": "MIT-CMU (HPND)",
    "onnxruntime": "MIT",
    "protobuf": "BSD-3-Clause",
    "flatbuffers": "Apache-2.0",
    "pytesseract": "Apache-2.0",
}

# Licenças que exigem cuidado ao redistribuir. Não há nenhuma forte (GPL/AGPL) hoje.
COPYLEFT_FORTE = re.compile(r"\b(A?GPL|SSPL|EUPL|CPAL|OSL)\b|LGPL", re.I)
COPYLEFT_FRACO = re.compile(r"MPL", re.I)


def licenca(nome: str) -> str:
    if nome in OVERRIDES:
        return OVERRIDES[nome]
    try:
        md = metadata.distribution(nome).metadata
    except metadata.PackageNotFoundError:
        return "não instalado neste sistema (pacote de outra plataforma)"
    expressao = md.get("License-Expression")
    if expressao:
        return expressao
    texto = md.get("License") or ""
    if texto and len(texto) < 80 and "\n" not in texto:
        return texto
    classes = [c.split("::")[-1].strip() for c in (md.get_all("Classifier") or []) if c.startswith("License ::")]
    return "; ".join(classes) or "VERIFICAR"


def diretas() -> dict[str, str]:
    pyproject = tomllib.loads((RAIZ / "apps" / "engine" / "pyproject.toml").read_text(encoding="utf-8"))
    achadas = {}
    for grupo, itens in pyproject.get("dependency-groups", {}).items():
        for item in itens:
            achadas.setdefault(norm(re.split(r"[\[<>=!~ ]", item, 1)[0]), grupo)
    return achadas


def pacotes() -> list[tuple[str, str, str, str]]:
    lock = tomllib.loads((RAIZ / "apps" / "engine" / "uv.lock").read_text(encoding="utf-8"))
    diretos = diretas()
    linhas = []
    for p in sorted(lock["package"], key=lambda p: norm(p["name"])):
        nome = norm(p["name"])
        if nome == "soul-engine":
            continue
        origem = f"direta ({diretos[nome]})" if nome in diretos else "indireta"
        linhas.append((p["name"], p["version"], licenca(nome), origem))
    return linhas


MODELOS = """| Modelo | Uso | Licença | Onde conferir |
|---|---|---|---|
| BiRefNet-lite (`birefnet-general-lite`, via rembg) | Recorte do carro (padrão) (`apps/engine/media/background_removal.py`) | MIT (mesmo projeto do BiRefNet) | https://huggingface.co/ZhengPeng7/BiRefNet |
| BiRefNet (`birefnet-general`, via rembg) | Recorte de qualidade, opcional e mais lento (`MODELO_QUALIDADE`) | MIT | https://huggingface.co/ZhengPeng7/BiRefNet |
| ISNet general use (`isnet-general-use`, via rembg) | Recorte rápido, opcional (`MODELO_RAPIDO`) | Apache-2.0 | https://github.com/xuebinqin/DIS |
| CLIP ViT-B/32 em ONNX (`Xenova/clip-vit-base-patch32`) | Ordenar as fotos (`apps/engine/media/vision.py`) | O repositório Xenova **não declara licença**; o modelo original, OpenAI CLIP, é MIT | https://github.com/openai/CLIP/blob/main/LICENSE |
| Whisper large-v3-turbo em CTranslate2 (`mobiuslabsgmbh/faster-whisper-large-v3-turbo`) | Transcrição do vídeo (`apps/engine/video/transcribe.py`) | MIT | https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo |

Os modelos **não ficam no repositório nem no instalador**: são baixados no primeiro uso, para a pasta de dados do usuário."""

EMBUTIDOS = """| Arquivo | Licença | Texto da licença |
|---|---|---|
| `apps/engine/tessdata/por.traineddata` (Tesseract, português) | Apache-2.0 | `apps/engine/tessdata/LICENSE-tesseract.txt` |
| `apps/engine/video/assets/Lato-Black.ttf` (v1.104, sem modificação) | SIL Open Font License 1.1 (© 2010-2011 tyPoland Lukasz Dziedzic; nome reservado "Lato"), conforme o próprio arquivo da fonte | `apps/engine/video/assets/Lato-OFL.txt` (acompanha a fonte no repositório e no instalador) |
| `apps/engine/video/assets/Lora-SemiBoldItalic.ttf` (sem modificação; origem em `Lora-ORIGIN.md`) | SIL Open Font License 1.1 (The Lora Project Authors; nome reservado "Lora") | `apps/engine/video/assets/Lora-OFL.txt` |
| Fontes do editor (Montserrat, Barlow Condensed, Roboto Condensed) em `apps/desktop/src/renderer/public/creative-editor/assets` | SIL Open Font License 1.1 | `*-LICENSE.txt` na mesma pasta |
| `html-to-image` (editor de criativos) | MIT | `apps/desktop/src/renderer/public/creative-editor/assets/html-to-image-LICENSE.txt` |
| `LOGO_SOUL.jpg` e `logo-soul.*` | Marca da SOUL Cars; pertence à loja | — |
| Trilha do vídeo (`TRILHA.flac`) | **Não é distribuída**: fica fora do Git (`.gitignore`) e fora do instalador. Origem e licença não documentadas; cada computador usa a sua trilha (veja `docs/guides/studio-flow.md`) | — |

O ffmpeg e o Tesseract (programas) **não são distribuídos** com o app: o usuário os instala à parte (veja `docs/architecture/python-engine.md`)."""


def main() -> int:
    linhas = pacotes()
    fortes = [l for l in linhas if COPYLEFT_FORTE.search(l[2])]
    fracos = [l for l in linhas if COPYLEFT_FRACO.search(l[2])]
    vazios = [l for l in linhas if l[2] == "VERIFICAR"]
    tabela = "\n".join(f"| {n} | {v} | {lic} | {o} |" for n, v, lic, o in linhas)
    texto = f"""# Avisos de terceiros

Gerado por `scripts/generate-license-notices.py`. **Não edite à mão**: rode o script depois de mudar `apps/engine/pyproject.toml`
ou `apps/engine/uv.lock` (o teste `apps/engine/tests/test_licenses.py` avisa se esta lista ficar desatualizada).

O código do SOUL Cars é proprietário (veja `LICENSE`). Os componentes abaixo continuam sob as licenças próprias,
todas permitindo uso comercial e em software fechado.

## Motor Python: bibliotecas

As bibliotecas **não são redistribuídas** no instalador nem no repositório: o usuário as instala pelo `uv` a partir do
`apps/engine/uv.lock`. Cada uma traz o seu texto de licença no pacote instalado.

- Licenças de copyleft forte (GPL, AGPL, LGPL e semelhantes): **{"nenhuma" if not fortes else ", ".join(l[0] for l in fortes)}**.
- Copyleft fraco (MPL-2.0, por arquivo): {", ".join(l[0] for l in fracos) or "nenhuma"}. São usadas sem modificação, o que não impõe obrigação ao restante do código.

| Pacote | Versão | Licença | Dependência |
|---|---|---|---|
{tabela}

## Modelos de IA (baixados no primeiro uso)

{MODELOS}

## Arquivos incluídos no projeto

{EMBUTIDOS}

## Aplicativo (Node/Electron)

As licenças das dependências do aplicativo estão no `package-lock.json` (campo `license` de cada pacote). O Electron
e o Chromium trazem os seus avisos em `LICENSE.electron.txt` e `LICENSES.chromium.html`, incluídos pelo instalador.
"""
    SAIDA.write_text(texto, encoding="utf-8", newline="\n")
    print(f"{SAIDA.name}: {len(linhas)} pacotes; copyleft forte: {len(fortes)}; sem licença identificada: {len(vazios)}")
    return 1 if fortes or vazios else 0


if __name__ == "__main__":
    sys.exit(main())
