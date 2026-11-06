# Instruções para alterações

Leia docs/architecture/technology-stack.md, docs/architecture/architecture-and-migration.md, docs/development/vibe-coding-guide.md e docs/guides/data-and-backup.md antes de alterar regras de negócio.

## Estrutura (monorepo, npm workspaces)

- `apps/launcher` — Soul Cars Launcher (Electron): catálogo, instalar/atualizar/abrir, auto-atualização.
- `apps/desktop` — o app Soul Cars (Electron + React). `src/main` (disco, banco, processos), `src/preload` (ponte), `src/shared` (regras puras), `src/renderer/src/{app,pages,lib}` (interface; uma pasta por página).
- `apps/engine` — motor Python por domínio: `documents`, `specs`, `media`, `spreadsheets`, `video`.
- `scripts/release` — geração do `manifest.json` das releases.

## Regras

- **Pastas e arquivos com nome em inglês** (padrão americano). Identificadores, comentários e mensagens ao usuário seguem em português.
- Todo arquivo de código começa com um cabeçalho de documentação explicando a responsabilidade dele; funções exportadas têm comentário do que fazem.
- Preserve as duas interfaces principais: Estoque primeiro e Studio segundo.
- O repositório não guarda nenhum arquivo de veículo. Dados reais da loja ficam na raiz de dados escolhida no app (fora do projeto); `dados-loja/` e `legado/` continuam no `.gitignore` por segurança. Nunca versione mídia, documentos ou dados reais de veículos; prints e testes usam dados fictícios.
- Não coloque caminhos pessoais, documentos reais, senhas ou tokens no código.
- Electron main controla disco, banco e processos; renderer usa a ponte preload.
- Migrações de banco distribuídas são imutáveis; acrescente uma nova versão.
- Preserve pastas existentes e IDs BNDV. Não apague pastas órfãs.
- Preserve os formatos DES.md e DOC.md; confira fixtures quando alterar formatos.
- Consignados não entram no custo patrimonial; margem é bruta.
- Interface deve limpar listeners/timers e mostrar erros de operação ao usuário.
- O app não usa nenhum serviço pago nem exige chave de API. Textos de IA saem pelo prompt pronto, no chat do usuário. Não adicione dependências que cobrem por uso ou peçam chave. Única exceção: o token pessoal da API do uTalk (CRM), opcional, guardado cifrado no `config.json` e nunca devolvido à interface; a API é só leitura.
- O nome do pacote `apps/desktop` (`soul-cars-app`) define a pasta de dados `%APPDATA%\soul-cars-app`: não renomeie.
- Toda versão publicada ganha uma seção em `CHANGELOG.md` (vira as notas no Launcher).

## Validação

`npm run lint`, `npm run typecheck`, `npm test` e `npm run build` sempre. Para IPC, preload, editor ou arquivos: `npm run smoke`. Para Python: `npm run test:engine`. Para o Launcher: `npm run e2e:launcher` (exige `npm run package:desktop`). Mudanças só em documentação não precisam de novas suítes.
