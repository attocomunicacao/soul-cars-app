# Motor Python

Electron conversa com engine/main.py por JSON por linha. Bibliotecas pesadas são carregadas quando usadas.

## Git CMD

```bat
winget install --id astral-sh.uv -e
winget install --id UB-Mannheim.TesseractOCR -e
winget install --id Gyan.FFmpeg -e
```

Reabra o terminal. Dentro de soul-cars-app, execute `scripts\instalar-motor.cmd`. `uv sync --all-groups` usa engine/uv.lock e Python 3.12+. Não copie .venv entre computadores.

Em desenvolvimento, o ambiente é engine/.venv. No app instalado, **Instalar / reparar motor Python** cria `%APPDATA%\soul-cars-app\engine-venv`; o código vem nos recursos. Pode selecionar outra pasta engine.

| Função | Dependência |
|---|---|
| CRLV textual | pdfplumber |
| OCR | Pillow, pytesseract, Tesseract; tessdata/por.traineddata acompanha o app |
| Recorte | rembg, ONNX Runtime, SciPy e BiRefNet |
| Fotos | modelo de visão local conforme visao.py |
| Vídeo | FFmpeg/ffprobe, faster-whisper, Pillow; fonte/logo/trilha acompanham o app |
| IA | anthropic, chave local nas configurações ou ANTHROPIC_API_KEY |

Modelos de recorte/visão/transcrição são baixados quando utilizados. Instalar bibliotecas não baixa todos os pesos. Estoque, balanço, ficha manual, DES.md sem IA, publicação, relatórios e editor manual funcionam sem automações Python. CNW e IA exigem rede; IA usa a conta do usuário. Não existe chave no código.
