---
name: tarefa
description: Orquestrador do Soul Cars. Transforma um pedido livre ("quero filtro por etiqueta no CRM", "testar segurança do Meta", "testar IA") num prompt padronizado e abre um chat novo para ele, no grupo certo da barra lateral. Use quando o usuário chamar /tarefa ou pedir para "criar uma tarefa/chat" para um módulo.
---

# /tarefa — orquestrador

Objetivo: gastar o mínimo de tokens aqui. NÃO leia código nem docs neste chat; só monte o prompt e abra a sessão.

## 1. Identifique o módulo pelo pedido

| Palavras | Pastas (apps/desktop/src) | Ler antes | Grupo da barra lateral |
|---|---|---|---|
| crm, lead, kanban, sdr, utalk | `renderer/src/pages/crm-leads`, `renderer/src/pages/leads` | `docs/crm/` | Soul · CRM |
| meta, ads, campanha, funil | `renderer/src/pages/meta-ads`, `renderer/src/pages/funnel`, `renderer/src/lib/ads-reports.ts` | — | Soul · Meta Ads / Funil |
| ia, pré-atendimento, ollama, groq, whatsapp | `renderer/src/pages/pre-service`, `main/pre-service`, `main/lab`, `shared/pre-service*.ts` | `docs/ai/lab.md`, `tests/ai-evals/` | Soul · Pré-atendimento IA |
| estoque, studio, veículo, fotos, anúncio | `renderer/src/pages/inventory`, `renderer/src/pages/vehicle` | `DESIGN.md` | Soul · Estoque / Studio |
| ci, release, launcher, build, versão | `.github/`, `apps/launcher`, `scripts/release` | `CHANGELOG.md` | Soul · Infra / Release |

Se não der para saber o módulo, pergunte em uma linha. Se envolver dois módulos, use o principal e cite o outro.

## 2. Identifique o tipo

- **feature** (acrescentar, criar, novo) → branch `feat/<modulo>-<slug>`
- **fix** (erro, bug, quebrado, corrigir) → branch `fix/<modulo>-<slug>`
- **segurança** → rodar `/security-review` no módulo; sem branch se nada mudar
- **testar IA** → `npm run lab:ai:offline` (sem modelo) e `npm run eval:ai` (Ollama aberto); para melhorar a partir de notas use `/ia-lab`, para novos cenários `/ia-corpus`. Relatar falhas e propor correção
- **teste** (cobrir com testes) → branch `test/<modulo>-<slug>`

slug: 2–4 palavras, minúsculas, sem acento, com hífen.

## 3. Monte o prompt (este formato, em português)

```
Tarefa: <frase objetiva do que mudar>, no módulo <módulo> (<pastas>).
Leia antes: <docs da tabela> e as regras do AGENTS.md que tocam o assunto. Não varra o resto do repositório.
Branch: crie `<branch>` a partir da `main` atualizada.
Pronto quando: <2–3 critérios verificáveis>.
Validar: npm run lint, npm run typecheck, npm test<, npm run smoke se tocar IPC/preload><, npm run lab:ai:offline e npm run eval:ai se tocar a IA>.
Ao final: commit com mensagem em português, push e PR; atualize o CHANGELOG.md se for para release.
```

## 4. Abra o chat

1. Mostre o prompt ao usuário em um bloco curto.
2. Chame `start_session` com `initiation: "user_asked"`, `context: "fresh"`, `title` = "<Módulo>: <resumo>", `prompt` = o prompt montado, `background` = "Projeto Soul Cars (monorepo Electron + React na raiz do projeto). Regras em AGENTS.md e CLAUDE.md. Tarefa criada pelo orquestrador /tarefa.", e `branch_name` = o slug.
3. Com `list_groups`, ache o grupo da tabela e chame `move_sessions` com o id da nova sessão.
4. Responda em uma linha com o link da sessão. Fim; não continue a tarefa aqui.
