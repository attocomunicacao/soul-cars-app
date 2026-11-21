# Soul Cars — instruções para assistentes (CLAUDE.md = AGENTS.md)

> `CLAUDE.md` e `AGENTS.md` têm **exatamente o mesmo conteúdo**. Ao alterar um, copie para o outro.

App desktop privado da Atto Comunicação para a revenda SOUL Cars: estoque e vendas do BNDV, ficha do veículo (Studio), produção de mídia, criativos, anúncios, CRM uTalk, Meta Ads, Pré-atendimento IA. Tudo roda no Windows da loja; dados ficam no computador do usuário.

## Economia de contexto

- Não varrer o repositório; ir direto aos arquivos do mapa abaixo e aos testes do mesmo domínio.
- Ignorar `node_modules/`, `out/`, `dist/`, `apps/engine/.venv/`, `apps/engine/tessdata/`, `*.lock`, `package-lock.json`, fontes/binários em `public/creative-editor/assets/`.
- Ler `docs/` só quando a tarefa tocar o assunto: visual → `DESIGN.md`; arquitetura → `docs/architecture/`; dados/backup → `docs/guides/data-and-backup.md`; CRM/uTalk → `docs/crm/`; vídeo → `docs/video/`; IA/testes da IA → `docs/ai/lab.md`; releases → `docs/architecture/launcher-and-updates.md`.
- Vários docs (`docs/development/vibe-coding-guide.md`, `docs/development/handoff-context.md`, `docs/architecture/architecture-and-migration.md`) ainda citam nomes antigos em português (`ipc.ts`, `esquema.ts`, `Ficha.tsx`, `criativo/`…). **O mapa deste arquivo prevalece**; confira o caminho real antes de seguir um doc.

## Stack

Monorepo npm workspaces, Node ≥ 22.16, Windows x64.

- **`apps/desktop`** (pacote `soul-cars-app`): Electron 44 + React 19 + TypeScript strict, electron-vite 4 / Vite 7. SQLite por `node:sqlite` (sem ORM, sem módulo nativo). CSS próprio + tokens. Gráficos em SVG próprio (`app/charts.tsx`), sem biblioteca.
- **`apps/launcher`**: Electron + TypeScript puro (sem framework). Instala, atualiza e abre o app a partir das GitHub Releases (`manifest.json` + SHA-256).
- **`apps/engine`**: Python ≥ 3.12 com `uv`, grupos opcionais (`documentos`, `planilha`, `recorte`, `video`). Processo persistente com JSON por linha em stdin/stdout. Tesseract, pdfplumber, rembg, CLIP ONNX, faster-whisper, FFmpeg, openpyxl.
- **`scripts/release`**: `create-manifest.mjs`, `create-patch.mjs`, `runtime-id.mjs` (mesmo algoritmo de `apps/launcher/src/main/runtime.ts`).
- **`website/`**: página pública e política de privacidade (GitHub Pages).

## Arquitetura do desktop

```text
renderer (React, sem Node) → lib/desktop-bridge.ts → window.soul (preload, sandbox, CJS)
  → main/ipc/commands.ts (tabela fechada COMANDOS) + ipc/schemas.ts + ipc/validation.ts
  → módulos do main: SQLite / disco / sites embutidos / subprocessos
main → evento → window.soul.listen(...)        (sempre desligar no cleanup)
Creatives.tsx ↔ postMessage ↔ iframe public/creative-editor/index.html
main/studio/engine-bridge.ts ↔ JSON por linha ↔ apps/engine/main.py
```

- Só a janela principal (mainFrame) invoca comandos. Comando sem esquema (ou esquema sem comando) impede o app de abrir. SQL arbitrário fica bloqueado.
- Binários trafegam como `Uint8Array`; cabeçalhos de caminho/nome são codificados uma vez no renderer e decodificados no main.
- Sites embutidos (uTalk, BNDV, Meta) são `WebContentsView` sem preload, com partições persistentes.
- Navegação é estado React (sem roteador): `renderer/src/app/navigation.ts` define `Pagina`, `MENU` e `PAGINAS_EMBUTIDAS` (só o CRM e o Meta Ads são sites embutidos).

## Mapa: quero alterar → arquivo

Caminhos relativos a `apps/desktop/src/`.

| Assunto | Arquivos |
|---|---|
| Shell, menu, roteamento | `renderer/src/app/App.tsx`, `Sidebar.tsx`, `navigation.ts`, `icons.tsx`, `components.tsx`, `charts.tsx` |
| Visual | `DESIGN.md`, `renderer/public/shared/tokens.css`, `renderer/src/styles/global.css` |
| Estoque (lista, vitrine, relatório) | `renderer/src/pages/inventory/*`, `lib/inventory-import.ts`, `lib/inventory-parse.ts`; main: `inventory/folder-sync.ts`, `showcase*.ts`, `ordering.ts` |
| BNDV (extração, GraphQL) | `main/inventory/bndv-extraction.ts`, `bndv-graphql.ts`, `bndv-schema.ts`, `canceled-sales.ts`, `sales.ts` |
| Balanço e relatório completo | `main/inventory/balance.ts`, `report.ts`, `report-print.ts`, `report-pdf.ts`; `renderer/src/lib/report-frame.ts` |
| Ficha do veículo (Studio) | `renderer/src/pages/vehicle/VehiclePage.tsx` (abas Ficha → Produção → Criativos) |
| CRLV / DOC.md | `pages/vehicle/sheet/CrlvDocument.tsx`; engine `documents/crlv.py`, `ocr.py` |
| Ficha técnica da web | `lib/web-specs-cache.ts`; engine `specs/web_lookup.py`, `carros_na_web.py`, `ficha_completa.py` |
| DES.md e blocos de anúncio | `lib/description-generator.ts`, `shared/des-md.ts`, `shared/publication.ts`, fixture `apps/desktop/tests/fixtures/DES.md` |
| Produção (fotos, recorte, vídeo) | `pages/vehicle/production/*`, `lib/production-status.ts`, `lib/vehicle-files.ts`, `main/studio/files.ts`, `main/studio/models.ts`; engine `media/*`, `video/*` |
| Editor de criativos | `pages/vehicle/creatives/Creatives.tsx`; `renderer/public/creative-editor/` (`layout4.*`, `layout6.*`, `shadow.js`, `original-floor.js`, `workbench.*`, `app-bridge.js`, `flow-bridge.js`) |
| Pronto para anunciar / pausa | `shared/ad-readiness.ts`, `pages/vehicle/ready-to-advertise/*`, `pages/inventory/AdPauseAlerts.tsx`, `shared/ad-ai-prompt.ts` |
| Relatórios Meta Ads (XLSX) | `pages/vehicle/publication/AdsReports.tsx`, `lib/ads-reports.ts`, `lib/xlsx.ts` |
| Entrada por pasta sincronizada | `main/studio/intake.ts`, `shared/intake-rules.ts`, `pages/inventory/FileIntake.tsx` |
| Banco do Studio | `main/studio/database.ts`, `schema.ts` (migrações), `repository.ts` (consultas), `legacy-import.ts`; `renderer/src/lib/database.ts`; `shared/vehicle.ts` (`EDITAVEIS`) |
| IPC | `main/ipc/commands.ts`, `schemas.ts`, `validation.ts`; `preload/index.ts`; `renderer/src/lib/desktop-bridge.ts`, `types.ts` |
| Caminhos, config, diagnóstico | `main/core/paths.ts`, `config-json.ts`, `json-store.ts`, `diagnostics.ts`, `gpu.ts`, `legacy-ai-cleanup.ts`; `main/index.ts`, `main/window/*` |
| Motor Python (ponte) | `main/studio/engine-bridge.ts`, `renderer/src/lib/engine-client.ts`, `apps/engine/main.py` |
| CRM · Leads (Kanban, SDR) | `pages/crm-leads/CrmLeadsPage.tsx`, `shared/crm-leads.ts`, `shared/crm-tags.ts`, `main/crm/leads.ts`, `leads-sync.ts`, `umbler-client.ts`, `utalk-api.ts`, `utalk.ts` |
| Soul IA (memória do histórico; alimenta exemplos reais e o Laboratório) | `pages/settings/SoulAiMemory.tsx` (em Configurações, com "Esquecer"), `main/soul-ai/*` (banco próprio `soul-ia.db`), engine `spreadsheets/soul_ai_sheet.py` |
| Meta Ads (Campanhas) | `pages/meta-ads/MetaAdsPage.tsx`, `shared/meta-ads.ts`, `main/meta/graph-api.ts`, `meta.ts` |
| Funil Meta → CRM | `pages/funnel/FunnelPage.tsx`, `shared/funnel.ts`, `main/funnel/funnel.ts` |
| Pré-atendimento IA | `pages/pre-service/PreServicePage.tsx`, `shared/pre-service.ts`, `shared/pre-service-pipeline.ts` (pós-processamento), `shared/pre-service-guard.ts` (anti-duplicação), `shared/pre-service-audit.ts` + `main/pre-service/audit.ts` (auditoria), `shared/lead-profile.ts`, `main/pre-service/pre-service.ts`, `llm.ts`, `utalk-writer.ts`; evals em `apps/desktop/tests/ai-evals/` |
| Laboratório de testes da IA | `pages/pre-service/lab/LabTab.tsx`, `renderer/src/lib/lab-client.ts`, `main/lab/{runner,lab,history-analysis,audit-scenarios,cli,cli-args}.ts` (`npm run lab:cli`), `shared/lab.ts`, `shared/lab-corpus.ts` (`CONJUNTO_RAPIDO`); lista em `docs/ai/lab-cenarios.md`; skills `/ia-ciclo` (erros pontuais), `/ia-lab` e `/ia-corpus` |
| Configurações e conexões | `pages/settings/*`, `main/crm/soul-app-import.ts` |
| Launcher | `apps/launcher/src/{main,preload,renderer,shared}`; contrato em `shared/api.ts`, manifesto em `shared/manifest.ts` |
| CI / release | `.github/workflows/{ci,release,pages,eval-ia-groq}.yml`, `scripts/release/*`, `CHANGELOG.md` |

Regras puras (sem Electron, testáveis) ficam em `src/shared/` ou em arquivos do main sem import de `electron` (com `fetch` injetado). Testes em `apps/desktop/tests/`, `apps/launcher/tests/`, `apps/engine/tests/`.

## Receitas

- **Novo campo do veículo:** nova migração em `main/studio/schema.ts` → consulta em `repository.ts` → `EDITAVEIS` em `shared/vehicle.ts` → tipo `Veiculo` em `renderer/src/lib/database.ts` → campo React → teste.
- **Novo comando IPC:** função em `main/ipc/commands.ts` + esquema em `ipc/schemas.ts` + cliente nomeado na `lib/` do renderer. Comando que toca disco, banco ou processo pertence ao main; não adicione Node à janela.
- **Novo método do motor:** despacho em `apps/engine/main.py` + chamada por `engine-bridge.ts`/`engine-client.ts` + teste `unittest`. Diagnóstico nunca vai para o stdout.
- **Nova página:** tipo em `Pagina` e item em `MENU` (`navigation.ts`), pasta própria em `renderer/src/pages/<nome>/`, atualizar `tests/navigation.test.ts`.
- **Artes:** conferir os dois layouts (4 e 6) e a exportação PNG.

## Regras

- **Pastas e arquivos com nome em inglês** (padrão americano). Identificadores, comentários, mensagens ao usuário, commits e PRs em português.
- Todo arquivo de código começa com um cabeçalho explicando a responsabilidade dele; funções exportadas têm comentário do que fazem.
- Preserve as duas interfaces principais: Estoque primeiro e Studio segundo.
- O repositório não guarda nenhum arquivo de veículo. Dados reais ficam na raiz de dados escolhida no app (fora do projeto); `dados-loja/` fica dentro da raiz do projeto e continua no `.gitignore`. Nunca versione mídia, documentos, bancos, CSVs, sessões ou dados reais; prints e testes usam dados fictícios.
- Não coloque caminhos pessoais, documentos reais, senhas ou tokens no código.
- Electron main controla disco, banco e processos; renderer usa a ponte preload.
- Migrações de banco distribuídas são imutáveis; acrescente uma nova versão (vale para `soul.db` e `soul-ia.db`).
- Preserve pastas existentes e IDs BNDV: mudança de nome não renomeia pasta. Não apague pastas órfãs. Não confunda `veiculos.id` (SQLite), ID BNDV (`estoque_id`) e caminho da pasta.
- Preserve os formatos DES.md e DOC.md; confira as fixtures quando alterar formatos.
- Consignados não entram no custo patrimonial; margem é bruta.
- Interface deve limpar listeners/timers e mostrar erros de operação ao usuário.
- O app não usa nenhum serviço pago nem exige chave de API. Textos de IA saem pelo prompt pronto, no chat do usuário. Não adicione dependências que cobrem por uso ou peçam chave. Exceções, todas opcionais e gratuitas, guardadas cifradas (`safeStorage`) no `config.json` e nunca devolvidas à interface:
  - token pessoal da API do uTalk (CRM) — só leitura;
  - token do Meta Ads (Graph API, permissão `ads_read`) — só leitura; painéis Leads, Campanhas e Funil;
  - Pré-atendimento IA (desligado por padrão): plano grátis do Groq (`groqChaveCifrada`) ou Ollama local. `main/pre-service/utalk-writer.ts` é o **único** ponto que escreve no uTalk (mensagens, fotos e etiquetas do contato).
- Meta Ads e o registro de anúncios são locais: nada ativa ou pausa campanha remotamente.
- O nome do pacote `apps/desktop` (`soul-cars-app`) define a pasta de dados `%APPDATA%\soul-cars-app`: não renomeie.
- Toda versão publicada ganha uma seção `## [x.y.z]` em `CHANGELOG.md` (vira as notas no Launcher).
- Antes de editar, confira `git status`/diff; não restaure arquivos indiscriminadamente.

## Fluxo

Uma branch por funcionalidade a partir da `main` atualizada (`feat/…`, `fix/…`, `test/…`, `docs/…`) → commit em português → push → PR → CI → merge. Release: `git tag vX.Y.Z && git push origin vX.Y.Z` (o workflow `release.yml` gera app, patch, launcher e `manifest.json`). Para abrir uma tarefa em chat novo, use a skill `/tarefa`.

## Comandos do dia a dia

Rodar da raiz do monorepo:

- `npm run dev` — app desktop em modo desenvolvimento (electron-vite); `npm run dev:launcher` para o launcher.
- Um teste só (Vitest): `npx vitest run apps/desktop/tests/navigation.test.ts` ou `npm test -w apps/desktop -- -t "nome do teste"`.
- Um teste do motor Python: `cd apps/engine && uv run --all-groups python -m unittest tests.test_<nome>`.

## Validação

Antes do commit: `npm run lint && npm run typecheck && npm test` (e `npm run build`; o CI também roda `npm run format:check` — use `npm run format` — e `npm run docs:check`, que confere os links dos `.md` e se o `AGENTS.md` é idêntico a este arquivo; para copiar use `npm run docs:sync`).

| Alteração | Comando extra |
|---|---|
| IPC, preload, editor, disco | `npm run smoke` |
| Motor Python | `npm run test:engine` |
| Pré-atendimento IA | `npm run lab:ai:offline` (sem modelo; `npm run lab:corpus` se mexeu no corpus) e `npm run eval:ai` (Ollama aberto) ou `npm run eval:ai:groq` |
| Launcher | `npm run e2e:launcher` (exige `npm run package:desktop`) |

Mudanças só em documentação não precisam de novas suítes. Não afirme que um teste passou sem executá-lo.
