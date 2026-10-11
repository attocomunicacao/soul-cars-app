# Primeiro uso

1. Instale Git para Windows e Node.js 22.16+.
2. No Git CMD, entre em `soul-cars-app` e execute `scripts\instalar.cmd`.
3. Execute `npm run dev` ou `scripts\iniciar.cmd`.
4. Confira a raiz dos dados nas Configurações: ela contém ESTOQUE e dados, não é a própria pasta ESTOQUE.
5. Clique em Atualizar BNDV e autentique na janela aberta se necessário. A sessão fica no Electron, separada do Chrome antigo.
6. Confira veículos e balanço. Abra o relatório completo para gráficos e fichas.
7. Abra um veículo no Studio. Revise a ficha, importe CRLV e/ou ficha técnica, salve e gere DES.md.
8. Em Produção, confira documento, fotos, recorte e vídeo. Em Criativos, ajuste os layouts e exporte para CRIATIVO.
9. Em Publicação, copie os blocos para o Gerenciador de Anúncios e marque como publicado.

**Reler pastas** lê dados locais; **Atualizar BNDV** consulta a rede. A lista relê pastas a cada minuto quando nenhuma ficha está aberta nem tarefa está em andamento.

Sem a pasta `dados-loja` dentro do projeto (nem o estoque anterior em `legado/estoque-python`), a raiz padrão é `Documentos\SOUL Cars`. O app pode importar o banco anterior na primeira execução; veja o documento 04.

## Aplicativo instalado

`npm run empacotar` gera instalador Windows x64 em `dist`. Inclui código Python, recursos do vídeo, editor e fontes. Para automações, instale uv e use **Configurações → Instalar / reparar motor Python**: o ambiente é criado nos dados internos do usuário.
