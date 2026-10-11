# Arquitetura e análise da migração

```text
React → preload window.soul → IPC Electron
                                ├─ Estoque: BNDV, CSV, fichas, balanço e HTML
                                ├─ Studio: SQLite, arquivos e fotos
                                └─ Python: CRLV, OCR, CNW, visão, recorte, IA e vídeo
```

React não acessa Node/disco diretamente. O main valida o remetente IPC e executa comandos de uma tabela fechada. A janela remota do BNDV não recebe preload. Navegação da janela principal é bloqueada. Referência: [segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security).

| Origem | Responsabilidade | Destino |
|---|---|---|
| Estoque app.py/tema.py | Tkinter, estado e aparência | App.tsx/style.css |
| Estoque cdp.py/extracao.py | Chrome CDP, autenticação e GraphQL | main/estoque/extracao.ts: janela Electron, sessão própria e interceptação de cabeçalhos |
| Estoque sync.py | CSV, deduplicação, pastas e fichas | main/estoque/sync.ts |
| Estoque balanco.py/relatorio.py | Patrimônio, margens, gráficos e relatório | main/estoque/balanco.ts e relatorio.ts |
| Studio rotas Svelte/componentes | Painel, lista, ficha, produção, editor, publicação, relatórios e sistema | React App, Ficha, Criativos, Relatorios e Configuracoes |
| Studio lib/db, des, estoque-parse, publicacao, relatorios, xlsx | Regras de negócio, formatos e consultas | renderer/src/lib, reaproveitado com imports locais |
| Studio estoque.svelte.ts | Importação e vigia reativo | lib/importacao.ts e efeitos React |
| Studio desktop.ts, local_server.py e núcleo Rust | Ponte, arquivos, processos, banco | main/ipc.ts, studio/* e preload/index.ts |
| Studio migrações SQL | Esquema histórico | studio/esquema.ts, cinco versões preservadas mais a versão 6 (entrada) |
| Studio static/criativo | Layouts 4/6, sombra, piso, exportação | renderer/public/criativo, iframe local |
| Entrada por pasta sincronizada | Nova no Electron | main/studio/entrada.ts, compartilhado/entrada.ts, Entrada.tsx |
| Studio engine | CRLV, OCR, CNW, fotos, IA e vídeo | engine, preservado em Python |
| PyInstaller/Tauri/servidor local | Execução e empacotamento anteriores | electron-vite/electron-builder e scripts CMD |

A migração interrompida já continha o núcleo main e o editor. A continuação criou a interface React e as ligações de negócio. Corrigiu consignação booleana, decodificação de cabeçalhos, rollback de fotos, transações de banco, mensagens em file://, validação IPC e encerramento do motor.

## Regras preservadas

- ID BNDV identifica pasta/veículo. Mudança de nome não renomeia pastas existentes.
- Pastas órfãs não são apagadas. INFO.md/INFO.txt são espelhos; anotações ficam em outro arquivo.
- Cadastro ativo prevalece sobre duplicata cancelada da mesma placa.
- Consignados não somam custo ao patrimônio. Margem é bruta; acumulados são saldo por diferença.
- DES.md mantém formato anterior, verificado por fixture.
- OCR/modelos continuam em Python. O editor mantém JavaScript/CSS próprios para preservar composição e fontes.

`src/main` contém banco/disco/processos; `src/preload`, a ponte; `src/renderer/src`, React e regras de interface; `src/renderer/public`, recursos/editor; `engine`, automações; `testes`, regressões; `docs`, guias.
