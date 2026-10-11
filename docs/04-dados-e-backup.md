# Dados e backup

- Raiz de trabalho: configurada em config.json; contém ESTOQUE e dados.
- Banco/preferências: `%APPDATA%\soul-cars-app\soul.db` e config.json.
- Fotos do editor: `%APPDATA%\soul-cars-app\veiculos\<id>\fotos`.
- Backups: `%APPDATA%\soul-cars-app\backups`, sete nomes por dia da semana.
- Sessão BNDV: partição persist:bndv do Electron.
- Instagram: sessão persist:instagram; conta/histórico/pacotes em `%APPDATA%\soul-cars-app\instagram`. Inclua o histórico no backup para preservar a prevenção de duplicatas.

Anúncios registrados ficam na tabela `anuncios` (migração 7) e entram no backup do banco; o lembrete de pausa depende do `dados/bndv_vendas.csv` e do nome da campanha modelo (`config`, chave `campanha_modelo`).

Entrada por pasta sincronizada: a pasta escolhida fica no banco (`config`, chave `entrada_pasta`) e o registro do que foi copiado, pendente ou com aviso fica na tabela `entrada_arquivos` (migração 6). A pasta da nuvem em si não faz parte do backup do app; os arquivos copiados ficam na pasta do veículo no ESTOQUE.

`dados/bndv_vendas.csv` é entrada financeira do Estoque. Não é a pasta `vendas` do workspace, que permanece fora da migração.

## Importação antiga

Se o banco novo não existir e `%APPDATA%\com.soulcars.studio\soul.db` existir, o app verifica integridade, cria snapshot SQLite e copia fotos. A origem é aberta somente para leitura. O snapshot inclui registros no WAL; não é uma cópia simples de arquivo aberto. O registro fica no config.json. Um banco novo existente nunca é substituído.

As migrações (cinco históricas, mais a 6 da entrada e a 7 dos anúncios) reconhecem colunas e tabelas já presentes e rodam em transações. Na importação do estoque, veículos cujo caminho mudou são ligados pelo ID BNDV.

O código antigo é preservado. Quando a raiz do Estoque antigo é adotada, **Atualizar BNDV** atualiza INFO.md/INFO.txt, índice e CSVs nessa raiz. Para trabalhar isolado, copie ESTOQUE/dados para outra pasta e escolha essa raiz.

## Recuperação

O app faz quick_check e backup diário com VACUUM INTO. Fotos/configuração não estão no banco: copie também config.json, veiculos, ESTOQUE e dados.

Feche o app antes de restaurar. Copie toda a pasta atual por segurança; restaure o banco como soul.db; guarde WAL/SHM antigos junto com a cópia anterior, sem misturar versões. Reabra e confira. Teste esquemas desconhecidos primeiro numa cópia.

Não versione bancos, CSVs, documentos, fotos, sessão ou chaves. O .gitignore protege locais padrão; revise o conteúdo antes de commitar.
