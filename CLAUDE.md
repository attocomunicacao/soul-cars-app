# CLAUDE.md

Regras completas em `AGENTS.md` (leia-o). Os documentos de `docs/` só devem ser lidos quando a tarefa tocar o assunto:
- visual → `DESIGN.md`
- arquitetura/migração → `docs/architecture/`
- dados/backup → `docs/guides/data-and-backup.md`

## Economia de contexto
- Não varrer o repositório inteiro; ir direto aos arquivos citados.
- Ignorar `node_modules/`, `out/`, `dist/`, `apps/engine/tessdata/`, `*.lock`, `package-lock.json`.
- Protótipos antigos ficam em `../_legado/` (fora do git): não ler nem portar sem pedido explícito.

## Fluxo
Uma branch por funcionalidade (`feat/…`, `fix/…`) a partir da `main` → PR → CI → merge.
Antes do commit: `npm run lint && npm run typecheck && npm test`.
