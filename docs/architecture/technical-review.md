# Technical review and roadmap

> Crítica técnica do Soul Cars 1.0.0 (05/11/2026) e recomendações, organizadas pelos
> trilhos do [roadmap.sh](https://roadmap.sh/) (Frontend, Backend, DevOps, QA, Software
> Architect, Python, AI Engineer). Cada item tem prioridade: **P1** agora, **P2** próximo
> ciclo, **P3** quando houver demanda.

## 1. O que está bom (manter)

1. **Electron com segurança de verdade** — `contextIsolation`, `sandbox`, preload mínimo,
   tabela fechada de comandos e validação de argumentos por esquema. Janelas remotas sem
   preload. Isso está acima da média de apps Electron.
2. **Local-first e custo zero** — nada de API paga, dados na máquina da loja, IA via
   “prompt pronto”. É um diferencial comercial e de privacidade (LGPD).
3. **Motor Python isolado por protocolo** — JSON por linha, processo persistente,
   dependências pesadas carregadas só quando usadas e instaladas sob demanda com `uv`.
4. **`node:sqlite`** — sem módulo nativo para compilar; migrações versionadas e imutáveis.
5. **Testes em três níveis** — unidade (Vitest/unittest), fixtures de formato e smoke em
   Electron real. CI no Windows, igual à máquina da loja.

## 2. Pontos fracos encontrados

| # | Problema | Impacto | Prioridade |
|---|---|---|---|
| 1 | **Tailwind 4 instalado e não usado** (nenhum `@import "tailwindcss"`; 1.066 linhas de CSS próprio) | Dependência morta, build mais lento, confusão para quem chega | P1 (removido nesta versão) |
| 2 | **`App.tsx` com 640 linhas**: navegação, estoque, relatório, configurações e polling no mesmo componente | Difícil testar e evoluir; re-render geral a cada estado | P1 (dividido nesta versão) |
| 3 | **Roteamento por `useState`** (`pagina`, `aba`, `selecionado`) | Sem histórico/voltar, sem deep-link, estado espalhado | P2 |
| 4 | **Polling** (60 s estoque, 15 s anexos) em vez de eventos do disco | CPU/disco à toa; latência de até 60 s | P2 |
| 5 | **IPC sem tipos ponta a ponta**: `invoke<T>("nome")` com string livre e genérico manual | Erro de nome/forma só aparece em execução | P1 |
| 6 | **Validação IPC caseira** (`validacao.ts` + `ipc-esquemas.ts`) | Reinventa Zod/Valibot; sem inferência de tipos | P2 |
| 7 | **Arquivos grandes**: `analise.ts` (900), `relatorio.ts` (630), `Ficha.tsx` (630), `entrada.ts` (640) | Alto acoplamento, revisão difícil | P2 |
| 8 | **Distribuição sem atualização**: instalador NSIS manual a cada versão | Equipe fica em versões antigas | P1 (Launcher nesta versão) |
| 9 | **Instalador sem assinatura** (SmartScreen) | Atrito e risco de confiança | P2 |
| 10 | **Integrações frágeis por scraping** (BNDV via cabeçalho capturado, Instagram por seletores, Carros na Web/Ficha Completa por HTML) | Quebram quando o site muda | P2 (monitorar) |
| 11 | **Identificadores em português e nomes de arquivo misturados** | Barreira para colaboradores e ferramentas | P1 nomes de arquivo (feito); P3 identificadores |
| 12 | **Sem telemetria de erro** (só `app.log` local) | Bugs da loja só chegam por relato | P3 (opt-in, local) |
| 13 | **Motor Python exige Tesseract e FFmpeg instalados à parte** | Passos manuais na instalação | P2 |
| 14 | **Sem i18n** | Bloqueia vender para fora do Brasil | P3 |

## 3. Recomendações por trilho do roadmap.sh

### Frontend (React)
- **P1** Separar páginas em `pages/<area>/` e o shell em `app/` (feito).
- **P2** Adotar **TanStack Router** (ou React Router 7 em modo data) com rotas tipadas:
  `/inventory`, `/vehicle/:id/production`, `/crm`, `/finance`.
- **P2** **TanStack Query** para dados vindos do IPC: cache, revalidação e estados de
  carregamento/erro padronizados, substituindo `useEffect` + `setInterval`.
- **P2** Biblioteca de componentes acessível (**Radix UI** / **shadcn/ui**) sobre os tokens
  existentes; retirar o CSS global gradualmente (CSS Modules ou Tailwind *de fato*).
- **P3** Virtualização de listas (TanStack Virtual) quando o estoque passar de ~500 itens.

### Backend (processo main)
- **P1** IPC tipado: um único `contracts.ts` com `{ nome: { input, output } }` que gera o
  tipo de `invoke` no renderer e a validação no main.
- **P2** Trocar a validação caseira por **Zod 4** ou **Valibot** (gratuitos, sem chave).
- **P2** Trocar polling por `fs.watch`/**chokidar** + eventos `estoque:mudou` para o renderer.
- **P2** Considerar **Drizzle ORM** (modo SQLite) para consultas tipadas, mantendo as
  migrações SQL imutáveis atuais.
- **P3** Mover tarefas longas (relatório, análise da Soul IA) para `utilityProcess`.

### Python / Engine
- **P1** Pacotes por domínio (`documents`, `specs`, `media`, `spreadsheets`, `video`) (feito).
- **P2** **Ruff** (lint + format) e **mypy/pyright** no CI do motor.
- **P2** Empacotar Tesseract/FFmpeg como downloads opcionais do próprio Launcher.
- **P3** Avaliar **PaddleOCR**/**RapidOCR** (ONNX) para CRLV escaneado, mais preciso que Tesseract.

### DevOps / Distribuição
- **P1** **Launcher** que instala, atualiza e abre o app a partir das GitHub Releases, com
  manifesto `latest.json` e verificação SHA-256 (feito).
- **P1** Release automatizada por tag (`v*`) gerando app (zip) + launcher (NSIS) (feito).
- **P2** Assinatura de código (certificado OV/EV ou **Azure Trusted Signing**) para
  eliminar o aviso do SmartScreen.
- **P2** Canais `stable`/`beta` no manifesto do Launcher.
- **P3** Delta updates (blockmap) para baixar só o que mudou.
- **P3** Reescrever o Launcher em **Tauri** (Rust + WebView2): o instalador cairia de ~110 MB
  (Electron) para ~10 MB, como o ArtCraft Launcher. A lógica atual (manifesto, SHA-256,
  instalação lado a lado) é pequena e portável.

### QA
- **P1** Manter os smokes em Electron real no CI.
- **P2** **Playwright for Electron** para testes de interface com screenshots
  (substitui os scripts de smoke feitos à mão e gera os prints do README).
- **P2** Cobertura (`vitest --coverage`) com meta mínima para `shared/` e `main/`.

### Software Architect
- **P1** Monorepo com **npm workspaces**: `apps/launcher`, `apps/desktop`, `apps/engine` (feito).
- **P2** Extrair `apps/desktop/src/shared` para `packages/domain` quando o Launcher ou
  um futuro app web precisar das mesmas regras.
- **P3** ADRs (Architecture Decision Records) em `docs/adr/`.

### AI Engineer (sem custo)
- **P2** Modelo local opcional via **Ollama** (Llama/Qwen) para gerar textos do anúncio sem
  sair da máquina — continua sem chave e sem cobrança.
- **P3** Busca semântica nas conversas da Soul IA com embeddings locais (ONNX) +
  `sqlite-vec`.

## 4. Novas implementações sugeridas (produto)

| Ideia | Valor | Esforço |
|---|---|---|
| **Painel de saúde do estoque** (dias parado, alerta de giro) | Decisão de preço mais rápida | Baixo |
| **Agenda de publicações** (Instagram/Meta) | Constância de postagem | Médio |
| **Precificação assistida** (FIPE + histórico de vendas próprio) | Margem | Médio |
| **Modo demonstração** com dados fictícios | Vendas do produto, treino da equipe | Baixo (base criada nos prints) |
| **Multi-loja** (perfis) | Vender o Soul Cars para outras revendas | Alto |
| **App móvel de captura** (fotos/vídeo direto para a pasta de entrada) | Elimina o Drive como intermediário | Alto |

## 5. O que foi feito nesta versão

- Monorepo `apps/launcher`, `apps/desktop`, `apps/engine`, com nomes de pastas e arquivos em inglês.
- Shell do React dividido (`app/`, `pages/<area>/`), cabeçalhos de documentação em cada módulo.
- Launcher no estilo “hub” (inspirado no ArtCraft Launcher): catálogo de apps, versão
  instalada x disponível, notas da versão, instalar/atualizar/abrir, verificação SHA-256.
- Release por tag gerando o app em `.zip` + `latest.json` e o instalador do Launcher.
- Tailwind (não usado) removido; site de apresentação em `website/`.
