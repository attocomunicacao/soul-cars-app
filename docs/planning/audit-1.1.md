# Auditoria para a 1.1

Registro dos achados da revisão estática feita sobre a 1.0.23. Cada item nasce como **aberto (a confirmar)**: antes de corrigir, leia o trecho e marque como **confirmado**, **descartado** ou **corrigido (PR)**. Gravidade: A = alta, M = média, B = baixa.

## Linha de base (antes das correções)

| Verificação | Resultado |
|---|---|
| `npm run lint` | passou |
| `npm run typecheck` | passou |
| `npm test` (desktop) | 398 passaram, 2 ignorados (50 arquivos) |
| `npm test` (launcher) | 39 passaram (7 arquivos) |
| `npm run test:engine` | 139 passaram, 5 ignorados |
| `npm run smoke` | não executado nesta etapa |

## Fase 1 — Segurança do main

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| S1 | `main/ipc/schemas.ts:214-215` | `config_gravar` aceita `pastaMotor` e `raizDados` com `caminhoQualquer`. `pastaMotor` define o `main.py` e o Python executados; `raizDados` amplia a área permitida. | A | aberto |
| S2 | `main/ipc/schemas.ts:523` | `reveal` aceita qualquer caminho. | M | aberto |
| S3 | `main/ipc/validation.ts:98-102` | `dentroDe` não resolve symlink/junction (falta `realpath`). | M | aberto |
| S4 | `main/ipc/schemas.ts:50` | `open_path` usa lista negra de extensões; faltam `.url`, `.application`, `.msc`, `.gadget`, `.ps1xml`. | M | aberto |
| S5 | `main/ipc/schemas.ts:75-87` | `urlOllama` aceita qualquer host `http(s)`, embora o comentário diga "local ou rede local". Conversas de clientes poderiam ir a host externo. | A | aberto |
| S6 | `main/studio/engine-bridge.ts:84-110` | `uv` baixado de `releases/latest` sem versão nem SHA-256; caminho interpolado no `Expand-Archive` (apóstrofo no nome de usuário quebra). | A | aberto |
| S7 | `main/window/embedded-sites.ts` | Sem `will-navigate` nem handler de permissões nas vistas embutidas; `janela.once("closed")` acumula a cada criação. | M | aberto |
| S8 | `main/ipc/commands.ts:537` | Erro de IPC relançado só com `message`, sem log no main. | B | aberto |
| S9 | `main/inventory/bndv-extraction.ts:228`, `report-pdf.ts` | Confirmar `sandbox:true`; o bloco `webPreferences` seguro se repete. | M | aberto |
| S10 | `main/studio/intake.ts` (`entrada_liberar`) | Até 5000 subpastas vão para `shell.trashItem`; confirmar validação de cada uma contra `ESTOQUE` e `..`. | M | aberto |
| S11 | `main/pre-service/pre-service.ts:182-185` | CPF e data de nascimento sem `safeStorage`: confirmar que o texto nunca é gravado. | M | aberto |

## Fase 2 — Motor Python

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| E1 | `apps/engine/main.py:234` | `json.dumps(response)` fora do `try`: resposta não serializável derruba o loop e o app só vê "O motor foi encerrado". | A | aberto |
| E2 | `apps/engine/main.py:221` | `sys.path.insert` com `rsplit("\\")`/`rsplit("/")`; usar `Path(__file__).parent`. | B | aberto |
| E3 | `apps/engine/main.py:230`, `:147`, `:154` | Sem validação de tipo de `params`; chave ausente vira `KeyError` cru para o usuário. | M | aberto |
| E4 | `engine-bridge.ts:226-229` | Linha JSON inválida é engolida; se for a resposta, a chamada espera 15 min. | M | aberto |
| E5 | `engine-bridge.ts:206` | stderr do motor é descartado; nenhum log `[engine]` chega a lugar algum. | M | aberto |
| E6 | `engine-bridge.ts` (`pendente`) | Estado global: progresso atrasado após timeout pode virar resposta de outra chamada. | M | aberto |
| E7 | `apps/engine/tests/` | Sem teste de `ping`, protocolo de progresso, erro de serialização; sem teste de `photo_organizer`, `vision`, `ficha_completa`, `video/*`. | M | aberto |

## Fase 3 — Launcher e release

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| L1 | `apps/launcher/src/main/download.ts:101` | Sem timeout de inatividade; `sinal` nunca é passado (`installer.ts:148,207`, `self-update.ts:56`). | A | aberto |
| L2 | `download.ts:121,133` | Excesso de bytes só é pego no fim; falta corte antecipado. | B | aberto |
| L3 | `download.ts:100` | `.part` órfão nunca é limpo. | B | aberto |
| L4 | `apps/launcher/src/main/` | Sem checagem de espaço livre antes de baixar e extrair. | M | aberto |
| L5 | `installer.ts:213` | `rmSync(final)` antes de o rename terminar; falha deixa a instalação sem a versão. | A | aberto |
| L6 | `installer.ts:236` | Limpeza de versões antigas engole erro sem registro. | B | aberto |
| L7 | `installer.ts:45-73` | `extrairZip` sem validar caminhos de entrada (zip slip) nem tamanho extraído; mitigado pelo SHA-256. | M | aberto |
| L8 | `shared/manifest.ts:66,107` | Regex `EXECUTAVEL` aceita `..` e nome sem extensão; `https://` sem lista de hosts. | M | aberto |
| L9 | `self-update.ts:279-285` | Reinício montado por string com `cmd /c`, frágil com `%` ou `&` no caminho. | M | aberto |
| L10 | `self-update.ts:253` | `atualizacao ??=` guarda a promessa para sempre; `app.quit()` cancelado impede nova tentativa. | B | aberto |
| L11 | `.github/workflows/release.yml:68-69` | Não roda `lint`, `format:check`, `test:engine`, smoke nem e2e antes de publicar. | A | aberto |
| L12 | `release.yml:42,50` | `inputs.version` interpolado direto em `run`; passar por `env:`. | M | aberto |
| L13 | `release.yml:92-95` | Falta de seção no CHANGELOG só gera warning; release sai com nota genérica. | M | aberto |
| L14 | `ci.yml` | Sem job do `e2e:launcher`; ffmpeg sem versão fixa; Tesseract não instalado; `push` sem filtro duplica execuções em PR. | M | aberto |
| L15 | `eval-ia-groq.yml:25` | `npx -y promptfoo` sem lockfile, com secret no ambiente; Node 24 contra 22 do CI. | B | aberto |
| L16 | `apps/launcher/tests/` | Sem teste de `installer.ts`, `self-update.ts`, `catalog.ts`, `state.ts`, `config.ts`. | M | aberto |

## Fase 4 — Renderer

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| R1 | `renderer/src/pages/vehicle/creatives/Creatives.tsx:121` | `soul:photo` converte `data.slot` com `as Slot` sem validar. | M | aberto |
| R2 | `Creatives.tsx:96` | `JSON.parse(v.ajustes)` sem try/catch. | M | aberto |
| R3 | `renderer/public/creative-editor/layout6.js:158,176` | `targetOrigin` vira `"null"` em `file:`; os outros bridges usam `"*"`. | M | aberto |
| R4 | `pages/inventory/VehicleTable.tsx:75`, `pages/vehicle/instagram/InstagramPublisher.tsx:94` | Erro engolido sem aviso ao usuário. | M | aberto |
| R5 | `app/components.tsx` (`Gaveta`) | Sem `role="dialog"`, `aria-modal` nem focus trap. | M | aberto |
| R6 | `styles/global.css:1517` | `.campo-numerico input:focus-visible` com `outline: none` sem alternativa visível. | B | aberto |
| R7 | `Production`, `ReadyToAdvertise`, `CrlvDocument`, `FileIntake`, `AdPauseAlerts`, `FunnelPage:101`, `MetaAdsPage:103`, `InstagramPublisher:61` | Cleanup de timers não verificado. | B | aberto |

## Fase 5 — Reestruturação moderada

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| X1 | `main/pre-service/pre-service.ts` (1185 linhas) | Mistura painel, laço, loja, persona, respostas, simulação e criptografia. | M | aberto |
| X2 | `PreServicePage.tsx` (1167 linhas, 21 `useState`), `CrmLeadsPage.tsx` (1135 linhas, 10 `useState`) | Componentes grandes; extrair hooks/subcomponentes ou `useReducer`. | M | aberto |
| X3 | `utalk.ts:21,34,38`, `meta.ts:32,67,71`, `pre-service.ts:184,192,301,313-318` | Trecho de `safeStorage` repetido; criar helper único. | B | aberto |
| X4 | `main/ipc/commands.ts:56,208,212,218,220,298,322` | `Args = Record<string, any>` e `as never` anulam a tipagem entre esquema e serviço. | B | aberto |

## Adiado para a 1.2

- Dividir `renderer/src/styles/global.css` (2529 linhas) por página.
- Dividir `main/ipc/commands.ts` e `schemas.ts` por domínio.
- Salto de `typescript` 5.9 → 7 (major).
- Cobertura de código (`coverage` não configurado).
- Assinatura de código do instalador.

## Fase 6 — Documentação

| Id | Onde | Achado | Status |
|---|---|---|---|
| D1 | `docs/development/{vibe-coding-guide,handoff-context,architecture-and-migration}.md` | Citam nomes antigos (`ipc.ts`, `esquema.ts`, `Ficha.tsx`, `criativo/`). | aberto |
| D2 | `docs/architecture/python-engine.md` | Documenta `.venv`; em produção o venv é `userData/engine-venv`. | aberto |
| D3 | `docs/development/validation.md:41` | Seção "Laboratório (1.0.22)" defasada. | aberto |
| D4 | `docs/planning/assessment-2026-10.md`, `usability-audit-2026-11.md` | Datados; revisar contra a 1.0.23. | aberto |
