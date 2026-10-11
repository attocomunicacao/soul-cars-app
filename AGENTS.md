# Instruções para alterações

Leia docs/02-arquitetura-e-migracao.md, docs/03-vibe-code.md e docs/04-dados-e-backup.md antes de alterar regras de negócio.

- Preserve as duas interfaces principais: Estoque primeiro e Studio segundo.
- Não modifique `legado/` (projetos anteriores, só para consulta) nem `dados-loja/` (dados reais da loja): ambos são locais e ficam fora do Git.
- Não coloque caminhos pessoais, documentos reais, senhas ou tokens no código.
- Electron main controla disco, banco e processos; renderer usa a ponte preload.
- Migrações de banco distribuídas são imutáveis; acrescente uma nova versão.
- Preserve pastas existentes e IDs BNDV. Não apague pastas órfãs.
- Preserve DES.md e DOC.md; confira fixtures quando alterar formatos.
- Consignados não entram no custo patrimonial; margem é bruta.
- Interface deve limpar listeners/timers e mostrar erros de operação ao usuário.
- O app não usa nenhum serviço pago nem exige chave de API (a integração com a Anthropic foi removida). Textos de IA saem pelo prompt pronto, no chat do usuário. Não adicione dependências que cobrem por uso ou peçam chave.
- Use nomes/comentários/mensagens em português e código formatado.

Valide tipos, testes e build conforme o alcance. Para IPC, preload, editor ou arquivos, rode smoke; para Python, rode test:engine. Mudanças somente em documentação não precisam de novas suítes.
