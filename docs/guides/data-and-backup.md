# Dados e backup

- Raiz de trabalho: configurada em config.json; contém ESTOQUE e dados.
- Banco/preferências: `%APPDATA%\soul-cars-app\soul.db` e config.json.
- Fotos do editor: `%APPDATA%\soul-cars-app\veiculos\<id>\fotos`.
- Backups: `%APPDATA%\soul-cars-app\backups`, sete nomes por dia da semana.
- Sessão BNDV: partição persist:bndv do Electron.
- Instagram: sessão persist:instagram; conta/histórico/pacotes em `%APPDATA%\soul-cars-app\instagram`. Inclua o histórico no backup para preservar a prevenção de duplicatas.

Anúncios registrados ficam na tabela `anuncios` (migração 7) e entram no backup do banco; o lembrete de pausa depende do `dados/bndv_vendas.csv` e do nome da campanha modelo (`config`, chave `campanha_modelo`).

Entrada por pasta sincronizada: a pasta escolhida fica no banco (`config`, chave `entrada_pasta`) e o registro do que foi copiado, pendente ou com aviso fica na tabela `entrada_arquivos` (migração 6). A pasta da nuvem em si não faz parte do backup do app; os arquivos copiados ficam na pasta do veículo no ESTOQUE.

Estoque no Google Drive: em Configurações › Estoque no Google Drive, o ESTOQUE pode apontar para a pasta sincronizada pelo Google Drive para Desktop (`estoquePasta` no `config.json`). Fotos, documentos, DES.md e DOC.md viajam como arquivos da pasta. O `soul.db` continua local em cada computador (SQLite com WAL não pode ser sincronizado por dois PCs), então cada veículo leva um arquivo `.soul-veiculo.json` na própria pasta com os campos editados (valor, km, textos, ajustes dos criativos). Vale o registro mais recente inteiro; o outro computador o aplica ao ler as pastas, e o marcador `sidecar:<pasta>` na tabela `config` evita reaplicar o que já foi visto. Se o Drive estiver desconectado, o app não volta ao disco local: a pasta fica indisponível até o Drive voltar. Cópias de conflito do Drive (`1 (1).jpg`) aparecem como aviso em Produção. Os backups do `soul.db` continuam locais.

`dados/bndv_vendas.csv` é entrada financeira do Estoque.
## Importação antiga

Se o banco novo não existir e `%APPDATA%\com.soulcars.studio\soul.db` existir, o app verifica integridade, cria snapshot SQLite e copia fotos. A origem é aberta somente para leitura. O snapshot inclui registros no WAL; não é uma cópia simples de arquivo aberto. O registro fica no config.json. Um banco novo existente nunca é substituído.

As migrações (cinco históricas, mais a 6 da entrada e a 7 dos anúncios) reconhecem colunas e tabelas já presentes e rodam em transações. Na importação do estoque, veículos cujo caminho mudou são ligados pelo ID BNDV.

O código antigo é preservado. Quando a raiz do Estoque antigo é adotada, **Atualizar BNDV** atualiza INFO.md/INFO.txt, índice e CSVs nessa raiz. Para trabalhar isolado, copie ESTOQUE/dados para outra pasta e escolha essa raiz.

## Recuperação

O app faz quick_check e backup diário com VACUUM INTO. Fotos/configuração não estão no banco: copie também config.json, veiculos, ESTOQUE e dados.

Feche o app antes de restaurar. Copie toda a pasta atual por segurança; restaure o banco como soul.db; guarde WAL/SHM antigos junto com a cópia anterior, sem misturar versões. Reabra e confira. Teste esquemas desconhecidos primeiro numa cópia.

Não versione bancos, CSVs, documentos, fotos, sessão ou chaves. O .gitignore protege locais padrão; revise o conteúdo antes de commitar.

## Dados do Laboratório da IA

`<raizDados>/lab-ia/` guarda execuções, avaliações (`avaliacoes.jsonl`), relatórios e a análise anonimizada do histórico do uTalk. Fica fora do git. O backup automático cobre só o `soul.db`; `pre-atendimento.json`, `pre-atendimento-auditoria.jsonl`, `soul-ia.db` e `lab-ia/` não têm backup automático: copie-os se precisar.
