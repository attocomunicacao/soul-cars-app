# Technology stack

> Inventário das tecnologias, motores e ferramentas do Soul Cars (versão 1.0.0).
> Atualize este arquivo sempre que uma dependência entrar ou sair.

## 1. Visão geral

```text
┌──────────────────────── Soul Cars Launcher (apps/launcher) ────────────────────────┐
│ Electron · instala, atualiza e abre o app a partir das GitHub Releases             │
└──────────────────────────────────────┬─────────────────────────────────────────────┘
                                       │ baixa .zip + verifica SHA-256 + abre o .exe
┌──────────────────────────── Soul Cars Desktop (apps/desktop) ──────────────────────┐
│ Renderer  React 19 + TypeScript (sem Node)                                        │
│    │ window.soul.invocar / ouvir  (preload em sandbox, CommonJS)                  │
│ Main      Electron 44 · IPC com esquema · node:sqlite · disco · janelas embutidas │
│    │ JSON por linha (stdin/stdout)                                                │
│ Engine    Python 3.12 (apps/engine) · OCR · PDF · visão · recorte · vídeo         │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Aplicativo de desktop (TypeScript)

| Camada | Tecnologia | Uso no Soul Cars |
|---|---|---|
| Runtime | **Electron 44** (Chromium + Node 22) | Janela, processos, disco, sessões persistentes do BNDV/Instagram/CRM |
| Build | **electron-vite 4** + **Vite 7** | Três builds: `main`, `preload` (CJS para sandbox) e `renderer` |
| Interface | **React 19** | Páginas Estoque, Ficha/Studio, CRM, Leads, Finanças, Configurações |
| Linguagem | **TypeScript 5** (strict) | Todo o código do main, preload, shared e renderer |
| Estilo | CSS próprio + design tokens (`public/shared/tokens.css`) | Tema claro, componentes e editor de criativos |
| Banco | **SQLite** via `node:sqlite` (embutido no Electron) | `soul.db` (Studio) e banco separado da Soul IA; migrações versionadas |
| Segurança | `contextIsolation`, `sandbox`, IPC com tabela fechada e validação por esquema, `safeStorage` | Tokens do uTalk e do Meta cifrados; janelas remotas sem preload |
| Gráficos | SVG próprio (`renderer/src/app/charts.tsx`) | Barras, colunas, linhas e minigráficos dos painéis, sem biblioteca externa |
| Sites embutidos | `WebContentsView` | uTalk (CRM), BNDV e Meta Ads dentro da janela |
| Empacotamento | **electron-builder 26** (alvo `dir`/zip para o Launcher, NSIS para o Launcher) | Distribuição via GitHub Releases |

## 3. Editor de criativos (JavaScript puro)

| Tecnologia | Uso |
|---|---|
| HTML/CSS/JS sem framework (`renderer/public/creative-editor`) | Layouts 4 e 6, sombra, piso, composição de artes |
| **html-to-image** | Exportação do criativo para PNG |
| Fontes OFL: Barlow, Barlow Condensed, Lato, Montserrat, Roboto Condensed, Lora | Tipografia das artes e do vídeo |

## 4. Motor Python (`apps/engine`)

| Área | Biblioteca / ferramenta | Função |
|---|---|---|
| Ambiente | **uv** + Python 3.12 | Instala o motor sob demanda, grupos de dependência opcionais |
| Protocolo | JSON por linha em stdin/stdout | Um processo aberto, fila de chamadas, eventos de progresso |
| Documentos | **pdfplumber** / pdfminer | Leitura do CRLV-e (PDF com ou sem senha) |
| OCR | **Tesseract** + `pytesseract` + `por.traineddata` | CRLV escaneado e equipamentos a partir de print |
| Imagem | **Pillow**, **NumPy**, **SciPy** | Pré-processamento, máscaras, miniaturas |
| Recorte | **rembg** (U²-Net/ISNet em ONNX) | Remoção de fundo local |
| Visão | **ONNX Runtime** + **CLIP ViT-B/32** | Reconhecer o que cada foto mostra e propor a ordem |
| Fala | **faster-whisper** | Transcrição com tempo por palavra para legendas |
| Vídeo | **FFmpeg** (overlay, ASS, drawtext) | Editor Mágico: tarjas, legendas animadas, trilha, encerramento |
| Motion | Biblioteca própria `video/motion` | Curvas Bézier, keyframes e adaptadores ASS/FFmpeg |
| Planilhas | **openpyxl** | Planilha de finanças e planilha da Soul IA |
| Web | `urllib` + parsers próprios | Ficha técnica no Carros na Web e Ficha Completa |

## 5. Integrações externas

| Serviço | Como | Custo |
|---|---|---|
| BNDV | Janela própria + API GraphQL (token capturado da sessão do usuário) | Gratuito (conta da loja) |
| uTalk (Umbler) | API somente leitura com token pessoal cifrado (painel Leads, Funil, Soul IA) | Gratuito (conta da loja) |
| Meta Ads (Graph API) | Somente leitura (`ads_read`), token cifrado; painel Campanhas e Funil Meta → CRM | Gratuito (conta de anúncios da loja) |
| Instagram | Navegador embutido com retomada e prevenção de duplicatas | Gratuito |
| Meta Ads | Site embutido; o app só prepara textos e arquivos | Gratuito |
| IA de texto | “Prompt pronto” colado no chat do usuário | Nenhuma chave, nenhuma API paga |

## 6. Qualidade e entrega

| Ferramenta | Uso |
|---|---|
| **Vitest** | Testes de regras de negócio (TS) |
| `unittest` (Python) | Testes do motor |
| Smoke em Electron real | `apps/desktop/scripts/smoke*.cjs` |
| **ESLint 10** + typescript-eslint + react-hooks | Zero avisos aceitos |
| **Prettier 3** | Formatação |
| **GitHub Actions** | CI (lint, tipos, testes, build, motor, smoke) e Release (app + launcher) |
| **Dependabot** | npm, uv e Actions |
| **npm workspaces** | Monorepo: `apps/desktop`, `apps/launcher` |
