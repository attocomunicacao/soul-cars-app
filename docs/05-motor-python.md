# Motor Python

Vídeo atual do Studio: [biblioteca contextual de legendas](20-biblioteca-contextual-de-legendas.md), todas brancas em Lato Black; [tarjas alinhadas](21-layout-e-movimento-das-tarjas.md), com largura comum, crescimento contínuo de até 5% e glow animado nas letras do preço; [logo animada no encerramento](22-logo-animada-no-encerramento.md).

Integração: `src/main/studio/motor.ts` executa `engine/video/render.py` a cada geração. O visual aprovado está nesse renderizador, sem depender dos scripts de avaliação em `.tmp`. O atalho local usa o projeto compilado em `out/` e o código Python de `engine/`; o empacotamento inclui os módulos de vídeo e a pasta `motion/` por `extraResources` em `package.json`. Não é necessário reinstalar as bibliotecas Python para essas alterações. O instalador em `dist/` só muda ao executar `npm run empacotar`.

Validação da aplicação em 23/10/2026: `npm run tipos` e `npm run build` passaram. Uma execução isolada do Electron compilado chamou `motor_estado` e `video_gerar` pela ponte real do Studio, com vídeo sintético, áudio e transcrição temporária; gerou 7,5 segundos com o cartão animado, usando o perfil real de produção. A evidência local fica em `.tmp/integracao-video-app.json`. Depois da atualização dos seletores antigos, o smoke geral da interface também passou, incluindo o motor Python, o editor e o pacote de criativos. Evidência em `docs/smoke.json`; ver [validação atual](07-validacao.md). Nenhum dado real da loja é alterado pelos testes.

Motor reutilizável para movimento: [SOUL Motion](18-soul-motion.md), com curvas, keyframes, timelines e adaptadores ASS/FFmpeg compartilhados por legendas e tarjas.

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
| Recorte | rembg, ONNX Runtime, SciPy e BiRefNet-lite (padrão); ISNet (rápido) e BiRefNet completo opcionais |
| Fotos | modelo de visão local conforme visao.py |
| Vídeo | FFmpeg/ffprobe, faster-whisper, Pillow; fonte e logo acompanham o app; a trilha é sua (veja o guia 08) |

Licenças das bibliotecas, dos modelos e dos arquivos embutidos: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) (gerado por `scripts/gerar-avisos-licencas.py`; nenhuma dependência é de copyleft forte). Modelos de recorte/visão/transcrição são baixados quando utilizados. Instalar bibliotecas não baixa todos os pesos. Estoque, balanço, ficha manual, DES.md sem IA, publicação, relatórios e editor manual funcionam sem automações Python. CNW exige rede (consulta pública). O motor não chama nenhum serviço pago e não existe chave no código: os textos de IA saem pelo prompt pronto, colado no chat do usuário.
