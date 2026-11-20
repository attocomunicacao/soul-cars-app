# Auditoria para a 1.1

Registro dos achados da revisão estática feita sobre a 1.0.23. Cada item nasceu como **aberto (a confirmar)** e foi conferido no código antes de qualquer correção; o status abaixo é o resultado (corrigido com o número do PR, parcial, descartado ou adiado). Gravidade: A = alta, M = média, B = baixa.

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
| S1 | `main/ipc/schemas.ts:214-215` | `config_gravar` aceita `pastaMotor` e `raizDados` com `caminhoQualquer`. `pastaMotor` define o `main.py` e o Python executados; `raizDados` amplia a área permitida. | A | corrigido (#32) |
| S2 | `main/ipc/schemas.ts:523` | `reveal` aceita qualquer caminho. | M | descartado: `reveal` só mostra no Explorer e o `FileIntake` depende dele fora das raízes |
| S3 | `main/ipc/validation.ts:98-102` | `dentroDe` não resolve symlink/junction (falta `realpath`). | M | corrigido (#32) |
| S4 | `main/ipc/schemas.ts:50` | `open_path` usa lista negra de extensões; faltam `.url`, `.application`, `.msc`, `.gadget`, `.ps1xml`. | M | corrigido (#32): lista negra ampliada, sem lista branca |
| S5 | `main/ipc/schemas.ts:75-87` | `urlOllama` aceita qualquer host `http(s)`, embora o comentário diga "local ou rede local". Conversas de clientes poderiam ir a host externo. | A | corrigido (#32) |
| S6 | `main/studio/engine-bridge.ts:84-110` | `uv` baixado de `releases/latest` sem versão nem SHA-256; caminho interpolado no `Expand-Archive` (apóstrofo no nome de usuário quebra). | A | corrigido (#32): versão e SHA-256 fixos |
| S7 | `main/window/embedded-sites.ts` | Sem `will-navigate` nem handler de permissões nas vistas embutidas; `janela.once("closed")` acumula a cada criação. | M | corrigido (#32): só `http(s)` e permissões ao próprio site |
| S8 | `main/ipc/commands.ts:537` | Erro de IPC relançado só com `message`, sem log no main. | B | corrigido (#32) |
| S9 | `main/inventory/bndv-extraction.ts:228`, `report-pdf.ts` | Confirmar `sandbox:true`; o bloco `webPreferences` seguro se repete. | M | corrigido (#32): `sandbox` no BNDV; helper único de `webPreferences` não extraído |
| S10 | `main/studio/intake.ts` (`entrada_liberar`) | Até 5000 subpastas vão para `shell.trashItem`; confirmar validação de cada uma contra `ESTOQUE` e `..`. | M | descartado: já validado por `basename`, `dentro()` e `startsWith` |
| S11 | `main/pre-service/pre-service.ts:182-185` | CPF e data de nascimento sem `safeStorage`: confirmar que o texto nunca é gravado. | M | descartado: sem `safeStorage` grava só "informado" |

## Fase 2 — Motor Python

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| E1 | `apps/engine/main.py:234` | `json.dumps(response)` fora do `try`: resposta não serializável derruba o loop e o app só vê "O motor foi encerrado". | A | corrigido (#33) |
| E2 | `apps/engine/main.py:221` | `sys.path.insert` com `rsplit("\\")`/`rsplit("/")`; usar `Path(__file__).parent`. | B | corrigido (#33) |
| E3 | `apps/engine/main.py:230`, `:147`, `:154` | Sem validação de tipo de `params`; chave ausente vira `KeyError` cru para o usuário. | M | corrigido (#33) |
| E4 | `engine-bridge.ts:226-229` | Linha JSON inválida é engolida; se for a resposta, a chamada espera 15 min. | M | corrigido em parte (#33): `NaN` e log; o timeout de 15 min continua |
| E5 | `engine-bridge.ts:206` | stderr do motor é descartado; nenhum log `[engine]` chega a lugar algum. | M | corrigido (#33) |
| E6 | `engine-bridge.ts` (`pendente`) | Estado global: progresso atrasado após timeout pode virar resposta de outra chamada. | M | corrigido (#33) |
| E7 | `apps/engine/tests/` | Sem teste de `ping`, protocolo de progresso, erro de serialização; sem teste de `photo_organizer`, `vision`, `ficha_completa`, `video/*`. | M | parcial (#33): `test_protocol.py`; faltam `photo_organizer`, `vision` e `video/*` |

## Fase 3 — Launcher e release

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| L1 | `apps/launcher/src/main/download.ts:101` | Sem timeout de inatividade; `sinal` nunca é passado (`installer.ts:148,207`, `self-update.ts:56`). | A | corrigido (#34): timeout de inatividade; cancelar na interface não foi ligado |
| L2 | `download.ts:121,133` | Excesso de bytes só é pego no fim; falta corte antecipado. | B | corrigido (#34) |
| L3 | `download.ts:100` | `.part` órfão nunca é limpo. | B | corrigido (#34) |
| L4 | `apps/launcher/src/main/` | Sem checagem de espaço livre antes de baixar e extrair. | M | corrigido (#34) |
| L5 | `installer.ts:213` | `rmSync(final)` antes de o rename terminar; falha deixa a instalação sem a versão. | A | corrigido (#34) |
| L6 | `installer.ts:236` | Limpeza de versões antigas engole erro sem registro. | B | corrigido (#34) |
| L7 | `installer.ts:45-73` | `extrairZip` sem validar caminhos de entrada (zip slip) nem tamanho extraído; mitigado pelo SHA-256. | M | descartado: o `tar.exe` (bsdtar) recusa `..` por padrão; não testado |
| L8 | `shared/manifest.ts:66,107` | Regex `EXECUTAVEL` aceita `..` e nome sem extensão; `https://` sem lista de hosts. | M | parcial (#34): executável `.`/`..`; hosts do manifesto não restringidos |
| L9 | `self-update.ts:279-285` | Reinício montado por string com `cmd /c`, frágil com `%` ou `&` no caminho. | M | corrigido (#34) |
| L10 | `self-update.ts:253` | `atualizacao ??=` guarda a promessa para sempre; `app.quit()` cancelado impede nova tentativa. | B | adiado (baixo valor) |
| L11 | `.github/workflows/release.yml:68-69` | Não roda `lint`, `format:check`, `test:engine`, smoke nem e2e antes de publicar. | A | corrigido (#34) |
| L12 | `release.yml:42,50` | `inputs.version` interpolado direto em `run`; passar por `env:`. | M | corrigido (#34) |
| L13 | `release.yml:92-95` | Falta de seção no CHANGELOG só gera warning; release sai com nota genérica. | M | corrigido (#34) |
| L14 | `ci.yml` | Sem job do `e2e:launcher`; ffmpeg sem versão fixa; Tesseract não instalado; `push` sem filtro duplica execuções em PR. | M | parcial (#34): job do e2e e `push` só na `main`; ffmpeg e Tesseract não |
| L15 | `eval-ia-groq.yml:25` | `npx -y promptfoo` sem lockfile, com secret no ambiente; Node 24 contra 22 do CI. | B | adiado |
| L16 | `apps/launcher/tests/` | Sem teste de `installer.ts`, `self-update.ts`, `catalog.ts`, `state.ts`, `config.ts`. | M | parcial (#34): `installer` e `update-command`; faltam `catalog`, `state`, `config` |

## Fase 4 — Renderer

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| R1 | `renderer/src/pages/vehicle/creatives/Creatives.tsx:121` | `soul:photo` converte `data.slot` com `as Slot` sem validar. | M | corrigido (#35) |
| R2 | `Creatives.tsx:96` | `JSON.parse(v.ajustes)` sem try/catch. | M | corrigido (#35) |
| R3 | `renderer/public/creative-editor/layout6.js:158,176` | `targetOrigin` vira `"null"` em `file:`; os outros bridges usam `"*"`. | M | descartado: em `file://` o `location.origin` vale "file://" no Electron 44 (testado) |
| R4 | `pages/inventory/VehicleTable.tsx:75`, `pages/vehicle/instagram/InstagramPublisher.tsx:94` | Erro engolido sem aviso ao usuário. | M | descartado: leitura repetida a cada 15 s / erro já exibido |
| R5 | `app/components.tsx` (`Gaveta`) | Sem `role="dialog"`, `aria-modal` nem focus trap. | M | corrigido (#35): foco circular e devolução do foco (a devolução só funcionou depois de um teste com teclado real) |
| R6 | `styles/global.css:1517` | `.campo-numerico input:focus-visible` com `outline: none` sem alternativa visível. | B | descartado: `:focus-within` do contêiner já mostra o foco |
| R7 | `Production`, `ReadyToAdvertise`, `CrlvDocument`, `FileIntake`, `AdPauseAlerts`, `FunnelPage:101`, `MetaAdsPage:103`, `InstagramPublisher:61` | Cleanup de timers não verificado. | B | descartado: os 14 timers têm `clear` no cleanup |

## Fase 5 — Reestruturação moderada

| Id | Onde | Achado | Grav. | Status |
|---|---|---|---|---|
| X1 | `main/pre-service/pre-service.ts` (1185 linhas) | Mistura painel, laço, loja, persona, respostas, simulação e criptografia. | M | corrigido (#36) |
| X2 | `PreServicePage.tsx` (1167 linhas, 21 `useState`), `CrmLeadsPage.tsx` (1135 linhas, 10 `useState`) | Componentes grandes; extrair hooks/subcomponentes ou `useReducer`. | M | corrigido (#38): era só mover; não havia componente de 21 estados |
| X3 | `utalk.ts:21,34,38`, `meta.ts:32,67,71`, `pre-service.ts:184,192,301,313-318` | Trecho de `safeStorage` repetido; criar helper único. | B | corrigido (#37): ficha do lead (formato `enc:`) não unificada |
| X4 | `main/ipc/commands.ts:56,208,212,218,220,298,322` | `Args = Record<string, any>` e `as never` anulam a tipagem entre esquema e serviço. | B | adiado para a 1.2 (conflita com o #32) |

## Adiado para a 1.2

- Dividir `renderer/src/styles/global.css` (2529 linhas) por página.
- Dividir `main/ipc/commands.ts` e `schemas.ts` por domínio.
- Salto de `typescript` 5.9 → 7 (major).
- Cobertura de código (`coverage` não configurado).
- Assinatura de código do instalador.

## Fase 6 — Documentação

| Id | Onde | Achado | Status |
|---|---|---|---|
| D1 | `docs/development/{vibe-coding-guide,handoff-context,architecture-and-migration}.md` | Citam nomes antigos (`ipc.ts`, `esquema.ts`, `Ficha.tsx`, `criativo/`). | adiado |
| D2 | `docs/architecture/python-engine.md` | Documenta `.venv`; em produção o venv é `userData/engine-venv`. | adiado |
| D3 | `docs/development/validation.md:41` | Seção "Laboratório (1.0.22)" defasada. | adiado |
| D4 | `docs/planning/assessment-2026-10.md`, `usability-audit-2026-11.md` | Datados; revisar contra a 1.0.23. | adiado |

## Resultado

PRs: #32 (segurança do main), #33 (motor), #34 (launcher e release), #35 (renderer), #36 (divisão do `pre-service`), #37 (cofre de segredos, empilhado sobre o #36) e #38 (divisão das páginas).

- **Leitura estática erra:** dos achados dos agentes, cerca de um terço não se confirmou ao ler o código ou ao testar (R3, R4, R6, R7, S2, S10, S11, L7 e a premissa do X2). Antes de corrigir, confirme.
- **Achado só com teste real:** a `Gaveta` não devolvia o foco a quem a abriu; o `autoFocus` rodava antes do efeito que guardava o elemento. Só apareceu num teste com Tab e Esc de verdade no Electron.
- **Teste instável:** `lab-history › "dá o mesmo resultado da comparação com todos os grupos"` falhou uma vez e não reproduziu em seis rodadas; provável estouro do limite de 5 s sob carga.
- **Não verificado:** `eval:ai` (precisa de modelo), aprovar rascunho e usar os tokens reais no uTalk, e os passos novos do `release.yml` até o primeiro release.
