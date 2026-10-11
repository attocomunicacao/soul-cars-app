# Avisos de terceiros

Gerado por `scripts/gerar-avisos-licencas.py`. **Não edite à mão**: rode o script depois de mudar `engine/pyproject.toml`
ou `engine/uv.lock` (o teste `engine/tests/test_licencas.py` avisa se esta lista ficar desatualizada).

O código do SOUL Cars é proprietário (veja `LICENSE`). Os componentes abaixo continuam sob as licenças próprias,
todas permitindo uso comercial e em software fechado.

## Motor Python: bibliotecas

As bibliotecas **não são redistribuídas** no instalador nem no repositório: o usuário as instala pelo `uv` a partir do
`engine/uv.lock`. Cada uma traz o seu texto de licença no pacote instalado.

- Licenças de copyleft forte (GPL, AGPL, LGPL e semelhantes): **nenhuma**.
- Copyleft fraco (MPL-2.0, por arquivo): certifi, tqdm. São usadas sem modificação, o que não impõe obrigação ao restante do código.

| Pacote | Versão | Licença | Dependência |
|---|---|---|---|
| annotated-types | 0.8.0 | MIT | indireta |
| anthropic | 1.5.0 | MIT | direta (textos) |
| anyio | 4.15.1 | MIT | indireta |
| attrs | 26.1.0 | MIT | indireta |
| av | 18.1.0 | BSD-3-Clause | indireta |
| certifi | 2026.7.22 | MPL-2.0 | indireta |
| cffi | 2.1.1 | MIT-0 | indireta |
| charset-normalizer | 3.5.1 | MIT | indireta |
| click | 8.5.0 | BSD-3-Clause | indireta |
| colorama | 0.4.6 | BSD-3-Clause | indireta |
| cryptography | 50.0.1 | Apache-2.0 OR BSD-3-Clause | indireta |
| ctranslate2 | 4.8.2 | MIT | indireta |
| docstring-parser | 0.18.0 | MIT | indireta |
| faster-whisper | 1.2.1 | MIT | direta (video) |
| filelock | 3.32.6 | MIT | indireta |
| flatbuffers | 25.12.19 | Apache-2.0 | indireta |
| fsspec | 2026.7.0 | BSD-3-Clause | indireta |
| h11 | 0.16.0 | MIT | indireta |
| hf-xet | 1.6.0 | Apache-2.0 | indireta |
| httpcore | 1.0.9 | BSD-3-Clause | indireta |
| httpcore2 | 2.12.0 | BSD-3-Clause | indireta |
| httpx | 0.28.1 | BSD-3-Clause | indireta |
| httpx2 | 2.12.0 | BSD-3-Clause | indireta |
| httpx2-jsfetch | 1.0 | não instalado neste sistema (pacote de outra plataforma) | indireta |
| huggingface-hub | 1.31.0 | Apache-2.0 | indireta |
| idna | 3.19 | BSD-3-Clause | indireta |
| imageio | 2.37.4 | BSD-2-Clause | indireta |
| jiter | 0.17.0 | MIT | indireta |
| jsonschema | 4.26.0 | MIT | indireta |
| jsonschema-specifications | 2025.9.1 | MIT | indireta |
| lazy-loader | 0.5 | BSD-3-Clause | indireta |
| llvmlite | 0.49.0 | BSD-2-Clause AND Apache-2.0 WITH LLVM-exception | indireta |
| networkx | 3.6.1 | BSD-3-Clause | indireta |
| numba | 0.67.0 | BSD-2-Clause | indireta |
| numpy | 2.5.3 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | direta (documentos) |
| onnxruntime | 1.30.0 | MIT | indireta |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause | indireta |
| pdfminer-six | 20260107 | MIT | indireta |
| pdfplumber | 0.11.10 | MIT | direta (documentos) |
| pillow | 12.3.0 | MIT-CMU (HPND) | direta (documentos) |
| platformdirs | 4.11.8 | MIT | indireta |
| pooch | 1.9.0 | BSD-3-Clause | indireta |
| protobuf | 7.36.1 | BSD-3-Clause | indireta |
| pycparser | 3.0 | BSD-3-Clause | indireta |
| pydantic | 2.13.5 | MIT | indireta |
| pydantic-core | 2.46.5 | MIT | indireta |
| pymatting | 1.1.16 | MIT | indireta |
| pypdfium2 | 5.13.0 | BSD-3-Clause ou Apache-2.0 (mais as licenças das bibliotecas que ele incorpora) | indireta |
| pytesseract | 0.3.13 | Apache-2.0 | direta (documentos) |
| pyyaml | 6.0.3 | MIT | indireta |
| referencing | 0.37.0 | MIT | indireta |
| rembg | 2.0.84 | MIT | direta (recorte) |
| requests | 2.34.2 | Apache-2.0 | indireta |
| rpds-py | 2026.6.3 | MIT | indireta |
| scikit-image | 0.26.0 | BSD-3-Clause | indireta |
| scipy | 1.18.1 | BSD-3-Clause | indireta |
| sniffio | 1.3.1 | MIT OR Apache-2.0 | indireta |
| tifffile | 2026.9.9 | BSD-3-Clause | indireta |
| tokenizers | 0.23.2 | Apache-2.0 | indireta |
| tqdm | 4.70.1 | MPL-2.0 AND MIT | indireta |
| truststore | 0.10.4 | MIT | indireta |
| typing-extensions | 4.16.0 | PSF-2.0 | indireta |
| typing-inspection | 0.4.4 | MIT | indireta |
| urllib3 | 2.7.0 | MIT | indireta |

## Modelos de IA (baixados no primeiro uso)

| Modelo | Uso | Licença | Onde conferir |
|---|---|---|---|
| BiRefNet (`birefnet-general`, via rembg) | Recorte do carro (`engine/fundo.py`) | MIT | https://huggingface.co/ZhengPeng7/BiRefNet |
| ISNet general use (`isnet-general-use`, via rembg) | Recorte rápido (alternativa) | Apache-2.0 | https://github.com/xuebinqin/DIS |
| CLIP ViT-B/32 em ONNX (`Xenova/clip-vit-base-patch32`) | Ordenar as fotos (`engine/visao.py`) | O repositório Xenova **não declara licença**; o modelo original, OpenAI CLIP, é MIT | https://github.com/openai/CLIP/blob/main/LICENSE |
| Whisper large-v3-turbo em CTranslate2 (`mobiuslabsgmbh/faster-whisper-large-v3-turbo`) | Transcrição do vídeo (`engine/video/transcribe.py`) | MIT | https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo |

Os modelos **não ficam no repositório nem no instalador**: são baixados no primeiro uso, para a pasta de dados do usuário.

## Arquivos incluídos no projeto

| Arquivo | Licença | Texto da licença |
|---|---|---|
| `engine/tessdata/por.traineddata` (Tesseract, português) | Apache-2.0 | `engine/tessdata/LICENSE-tesseract.txt` |
| `engine/video/assets/Lato-Black.ttf` | SIL Open Font License 1.1 (© tyPoland Lukasz Dziedzic; nome reservado "Lato") | `engine/video/assets/Lato-OFL.txt` |
| Fontes do editor (Montserrat, Barlow Condensed, Roboto Condensed) em `src/renderer/public/criativo/assets` | SIL Open Font License 1.1 | `*-LICENSE.txt` na mesma pasta |
| `html-to-image` (editor de criativos) | MIT | `src/renderer/public/criativo/assets/html-to-image-LICENSE.txt` |
| `engine/video/assets/TRILHA.flac` e logos (`LOGO_SOUL.jpg`, `logo-soul.*`) | **Sem licença registrada no projeto.** Marca e trilha pertencem aos titulares; confirmar os direitos antes de qualquer distribuição pública | — |

O ffmpeg e o Tesseract (programas) **não são distribuídos** com o app: o usuário os instala à parte (veja `docs/05-motor-python.md`).

## Aplicativo (Node/Electron)

As licenças das dependências do aplicativo estão no `package-lock.json` (campo `license` de cada pacote). O Electron
e o Chromium trazem os seus avisos em `LICENSE.electron.txt` e `LICENSES.chromium.html`, incluídos pelo instalador.
