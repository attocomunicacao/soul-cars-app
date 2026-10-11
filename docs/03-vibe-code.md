# Alterações com vibe code

| Quero alterar | Arquivo |
|---|---|
| Duas interfaces, lista, balanço | src/renderer/src/App.tsx |
| Visual, medidas e cores | src/renderer/src/style.css |
| Ficha, documento, produção e publicação | src/renderer/src/Ficha.tsx |
| Loja e chave IA | src/renderer/src/Configuracoes.tsx |
| DES.md | renderer/src/lib/des.ts |
| Blocos de anúncio | src/compartilhado/publicacao.ts |
| Relatórios e XLSX | Relatorios.tsx, lib/relatorios.ts, lib/xlsx.ts |
| Importação das pastas | lib/importacao.ts, lib/estoque-parse.ts |
| Artes | renderer/public/criativo/layout4.js, layout6.js e CSS |
| Sombra e piso | criativo/shadow.js, original-floor.js, workbench.js |
| Comunicação com editor | Criativos.tsx, criativo/app-bridge.js e flow-bridge.js |
| Arquivos e comandos | main/ipc.ts, studio/arquivos.ts, lib/desktop.ts |
| Banco | studio/banco.ts, studio/esquema.ts, lib/db.ts |
| Caminhos | main/caminhos.ts |
| BNDV e financeiro | main/estoque/* |
| Lucro mensal e setas do relatório | main/estoque/relatorio.ts |
| Instagram e retomada de publicação | Instagram.tsx, main/studio/instagram.ts, instagram-browser.ts e instagram-plano.ts; veja docs/09-instagram.md |
| Automação | engine/* e main/studio/motor.ts |
| Entrada de arquivos da pasta sincronizada | main/studio/entrada.ts, compartilhado/entrada.ts, Entrada.tsx |

## Receita

1. Explique o comportamento com exemplo antes/depois.
2. Peça a leitura dos documentos 02, 03 e 04 e dos arquivos indicados.
3. Faça uma mudança pequena por vez. Preserve os projetos antigos e vendas.
4. Execute `npm run tipos`, `npm test`, `npm run build`.
5. Para IPC/editor/disco, execute também `npm run smoke`; para Python, `npm run test:engine`.
6. Confira `npm run dev` e `npm run start`: o segundo verifica file://.

Exemplo:

> Leia docs/02-arquitetura-e-migracao.md, 03-vibe-code.md e 04-dados-e-backup.md. Adicione “Observações internas” à ficha do Studio. Preserve DES.md, os veículos existentes e vendas. Crie uma migração nova, atualize tipos/consultas/campo React, rode os testes pertinentes e explique as mudanças.

Nunca edite migração já distribuída; acrescente uma versão. Atualize Veiculo/EDITAVEIS em lib/db.ts. Comando que toca disco pertence ao main e à lista COMANDOS; não adicione Node à janela. Binários trafegam como Uint8Array, cabeçalhos são codificados uma vez e decodificados no IPC. Antes de alterar artes, confira ambos layouts e exportação PNG.

`npm run formatar` formata o código novo; `npm run formatar:check` confere o padrão.
