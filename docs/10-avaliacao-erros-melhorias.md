# Avaliação do projeto: testes, erros, melhorias e pontos fortes

Data: 11/10/2026 · Ambiente: Windows 11 x64, Node 24.x (Electron 44.7.0 / Chromium 152), Python 3.12.10.
Autoria: Atto Comunicação (projeto privado).

## 1. O que foi testado

| # | Teste | Comando | Resultado |
|---|---|---|---|
| 1 | Tipos (main/preload e React) | `npm run tipos` | ✅ Sem erros |
| 2 | Testes unitários e de regra de negócio | `npm test` | ✅ 12 arquivos, **101 passaram**, 2 pulados (dependem de arquivos externos) |
| 3 | Formatação | `npm run formatar:check` | ✅ Tudo no padrão Prettier |
| 4 | Build de produção | `npm run build` | ✅ main, preload e renderer gerados (renderer: 1 chunk de ~796 kB) |
| 5 | Smoke do app (Electron real, dados temporários) | `npm run smoke` | ✅ Preload, SQLite/IPC, relatório interno, painel de fotos, cópia, editor, aba Instagram, pacote, motor Python 3.12.10 e exportação de PNG |
| 6 | Smoke do Instagram (página local simulada) | `npm run smoke:instagram` | ✅ Ordem 2→1→3, duas legendas, capa do Reels, retomada sem duplicatas, histórico após interrupção, lucro de 12 meses com setas, conta conferida, página remota sem Node |
| 7 | Testes do motor Python | `npm run test:engine` | ✅ 36 testes, OK, **5 pulados** (dependem de documentos reais) |
| 8 | Auditoria de dependências | `npm audit` | ⚠️ 8 vulnerabilidades **moderadas**, todas na cadeia de ferramentas do `electron-builder` (não vão no executável) |
| 9 | Inspeção de código (segurança, acoplamentos, dados sensíveis) | leitura de `main/`, `preload/`, `engine/`, `.gitignore` | Achados nas seções 2 e 3 |
| 10 | Conferência do que o Git rastreia | `git ls-files` | ✅ Nenhum banco, CSV, documento, foto ou sessão versionado (147 arquivos) |

### O que **não** foi possível testar (precisa de você)

- Login real no BNDV e atualização com dados reais pela janela do app.
- Publicação real no Instagram (os seletores só foram validados contra uma página simulada).
- Download dos modelos de recorte/visão/transcrição (a IA paga foi removida do app).
- Geração de vídeo com o Editor Mágico em arquivo real da loja e a qualidade visual da versão leve.
- Instalação do `.exe` em outro computador.
- Entrada de arquivos com a pasta real do Google Drive.
- Uso manual clicando em cada tela: a cobertura de interface vem dos smokes automatizados, não de uma sessão manual.

## 2. Erros encontrados

Gravidade: 🔴 alta · 🟠 média · 🟡 baixa.

| ID | Gravidade | Erro | Evidência | Sugestão |
|---|---|---|---|---|
| E1 | 🟠 | **Acentos corrompidos nas mensagens do motor Python.** O Python no Windows usa `cp1252` no stdout/stdin quando é um pipe, e o Electron lê como UTF-8. | `main.py` devolveu o byte `0xE9` (`é` em cp1252) em `"Método desconhecido"`; `motor.ts` não define `PYTHONUTF8`/`PYTHONIOENCODING`. Os logs do teste de vídeo também aparecem com `�`. Caracteres fora do cp1252 podem até gerar erro ao escrever. | Em `src/main/studio/motor.ts`, acrescentar `PYTHONUTF8: "1"` e `PYTHONIOENCODING: "utf-8"` ao `env` do `spawn`, e `sys.stdout.reconfigure(encoding="utf-8")` em `engine/main.py`. ✅ **Corrigido em 11/10/2026** (`motor.ts`, `engine/main.py` e teste `engine/tests/test_utf8.py`). |
| E2 | ✅ | **Chave da IA (Anthropic) guardada em texto simples no SQLite** (`config`, chave `anthropic_api_key`). Qualquer pessoa com acesso ao `soul.db` ou aos backups lê a chave. | `Configuracoes.tsx` → `salvarConfig("anthropic_api_key", …)`. | ✅ **Corrigido em 11/10/2026:** a chave fica em `segredos.json` cifrada com `safeStorage` (DPAPI do Windows); a interface só grava/apaga/pergunta se existe; a migração remove qualquer chave antiga do `soul.db` e dos backups. |
| E3 | ✅ | **(Corrigido)** Versão do app exibida sempre "1.0.0" no instalado. O preload lê `process.env.npm_package_version`, que só existe quando rodado via `npm`. | `src/preload/index.ts`, bloco `versoes.app`. | Expor a versão pelo main (`app.getVersion()`). |
| E4 | ✅ | **(Corrigido)** Aviso `ResourceWarning: unclosed file`** ao gerar a versão leve do vídeo. Os pipes do `ffmpeg` não são fechados explicitamente. | Saída de `npm run test:engine` (`leve.py:84` → `run_ffmpeg`). | ✅ **Corrigido:** `run_ffmpeg` (`video/render.py`) usa `with subprocess.Popen(...)`; teste de regressão em `engine/tests/test_video.py`. |
| E5 | 🟡 | **README tinha caminho pessoal** (`C:\Users\gusta\...`), contra a regra do `AGENTS.md`. | README anterior, linha 10. | ✅ Corrigido neste README. |
| E6 | 🟡 | **Documentação cita uma pasta `vendas`** que não existe neste workspace e manda nunca alterá-la. Pode confundir quem chega novo. | `README`, `AGENTS.md`, docs 04 e 06. | ✅ Corrigido: menções removidas/trocadas em `AGENTS.md` e docs 04 e 06. |
| E7 | 🟡 | **Pastas vazias** `src/renderer/src/componentes`, `estoque` e `studio` (restos da migração; o Git não as rastreia). | Listagem de diretórios. | ✅ Removidas na reorganização. |
| E8 | ✅ | **Licença incoerente:** o repositório é privado, mas `LICENSE` é MIT ("SOUL CARS") e o `package.json` declara `MIT`. A autoria é da Atto Comunicação. | `LICENSE`, `package.json`. | ✅ **Corrigido:** `LICENSE` agora é "Todos os direitos reservados — Atto Comunicação" e o `package.json` declara `UNLICENSED`. |
| E9 | 🟡 | **Fragilidade de caminho:** o app adotava a raiz de dados procurando `../soul-cars-estoque` ao lado do código. Mover a pasta quebrava o app em silêncio. | `src/main/caminhos.ts`, `raizDados()`. | ✅ Tratado na reorganização (agora procura `dados-loja/` primeiro). |

Riscos de segurança observados (sem exploração conhecida):

- ✅ **Corrigido em 11/10/2026:** a janela principal agora roda com `sandbox: true` (o preload é gerado em CommonJS, `out/preload/index.cjs`, e a versão do app chega pelo main).
- ✅ **Corrigido em 11/10/2026:** todo comando do IPC tem esquema (`src/main/ipc-esquemas.ts` + `validacao.ts`). Campos extras são descartados, tipos errados viram erro, caminhos de pasta só valem dentro da pasta de dados/dados internos, o motor só aceita os métodos conhecidos, `open_path` recusa executáveis, o SQL da interface não pode usar `ATTACH`/`load_extension` nem gravar `VACUUM INTO` fora dos backups, e o comando `salvar_texto` (gravava em qualquer caminho, sem uso) foi removido. O SQL livre da interface (`sql_select`/`sql_execute`) também foi removido: o banco agora só responde a 16 comandos `db_*` nomeados (`studio/repositorio.ts`), com esquema, lista fechada de colunas e chaves de configuração validadas, e o backup diário é feito pelo main.
- A sessão de login do BNDV e do Instagram fica em partições persistentes; quem acessa o `%APPDATA%` do Windows da loja acessa as sessões.

## 3. Pontos que podem ser melhores

### Qualidade e automação
1. ✅ **(Feito)** **CI mais completo.** Hoje o `ci.yml` roda tipos, testes, build e formatação. Falta `npm run test:engine`, `npm run smoke` e `npm audit` (o smoke exige janela; dá para rodar no runner Windows).
2. ✅ **(Feito)** **Linter.** Não há ESLint; só Prettier e TypeScript. Regras como `no-floating-promises` e `react-hooks/exhaustive-deps` pegariam bugs de efeitos e listeners.
3. **Testes de interface.** Nenhum componente React tem teste; só `lib/`, `compartilhado/` e os smokes. Um `@testing-library/react` nas telas Entrada, Anunciar e Ficha cobriria regressões de fluxo.
4. **Testes pulados.** 2 (Vitest) + 5 (Python) dependem de arquivos reais. Criar fixtures sintéticas (PDF de CRLV fictício) permitiria rodá-los no CI.
5. ✅ **(Feito, Dependabot)** **Dependabot/Renovate** e a atualização do `electron-builder` quando sair a correção da cadeia vulnerável.

### Desempenho e empacotamento
6. **Bundle único de ~796 kB.** Carregar sob demanda (`React.lazy`) as telas Instagram, Relatórios e o gerador XLSX.
7. **Instalador com motor sem `.venv`:** o usuário precisa instalar uv, Tesseract e FFmpeg. Um assistente "verificar requisitos" nas Configurações (com os `winget` prontos) reduziria o atrito.
8. **Atualização automática** (`electron-updater` com release privada) e versão exibida corretamente (E3).

### Experiência de uso
9. **Primeiro uso guiado.** Um passo a passo dentro do app (raiz de dados → Atualizar BNDV → primeiro veículo) em vez de só em documentos.
10. **Estado de saúde visível.** Uma tela "Diagnóstico" (motor Python, Tesseract, FFmpeg, última atualização do BNDV, espaço em disco, último backup).
11. **Aviso de dados antigos** do BNDV já existe para anúncios; estender para o balanço.
12. **Observabilidade.** Log em arquivo rotativo no `%APPDATA%` e botão "Copiar relatório de erro" para facilitar suporte.

### Manutenção do código
13. **Arquivos grandes:** `studio/entrada.ts` (642 linhas), `estoque/relatorio.ts` (629), `lib/relatorios.ts` (534), `studio/arquivos.ts` (511), `Ficha.tsx` (472). Dividir por responsabilidade.
14. **Tabela IPC única** (`ipc.ts`, ~380 linhas) pode ser dividida por domínio (estoque, studio, instagram, entrada) mantendo o registro central.
15. **Editor de criativos em JS/CSS puros** (`public/criativo`) fica fora do TypeScript e dos testes. Documentar o contrato da ponte (`app-bridge.js`, `flow-bridge.js`) e cobrir com um teste de exportação.
16. **Instagram por automação de tela** é frágil por natureza. Manter o plano B da API oficial (conta profissional) documentado e isolar todos os seletores em um arquivo só (já estão em `instagram-browser.ts`).

### Dados e backup
17. **Backup além do banco:** hoje há 7 cópias diárias do SQLite, mas fotos do editor, `config.json`, ESTOQUE e histórico do Instagram dependem de cópia manual. Um comando "Exportar backup completo" ajudaria.
18. **Backup externo** da raiz de dados (`dados-loja/`): ela não está no Git e é o ativo mais valioso da loja.

## 4. Pontos positivos

- **Arquitetura segura e clara:** renderer sem Node, ponte mínima (`invocar`/`ouvir`), IPC com validação de remetente e tabela fechada de comandos, janelas remotas sem preload, navegação bloqueada, instância única do app.
- **Boa cobertura de regra de negócio:** 101 testes Vitest + 36 do motor, incluindo regressão de formato (`DES.md` contra fixture) e OCR de equipamentos (40/40 itens exatos).
- **Smoke em Electron real** com dados temporários: o que muitos projetos não têm. Cobre IPC, banco, editor e exportação de PNG reais.
- **Dados protegidos:** migrações imutáveis e transacionais, verificação de integridade e backup diário com `VACUUM INTO`, importação do banco legado sem alterar a origem, IDs BNDV e pastas existentes preservados, nunca apaga pastas órfãs.
- **Cópia, não movimentação:** a entrada de arquivos nunca move, apaga ou sobrescreve; confere por hash antes de liberar espaço e envia para a Lixeira.
- **Segurança operacional do anúncio:** nenhuma ação publica ou ativa campanha sozinha; retomada do Instagram sem duplicar; histórico de envios.
- **Funciona sem pagar nada por padrão:** OCR, recorte, visão e transcrição locais; IA é opcional, por conta do usuário, e sem chave no código.
- **Documentação excelente para o porte:** 9 guias técnicos, planejamento com decisões e prompts, `AGENTS.md` com as regras de negócio, tudo em português.
- **Higiene de repositório:** `.gitignore` cobre bancos, CSVs, sessões, `.venv`, `out/`, `dist/`; lockfiles para Node e Python; CI em Windows.
- **Código legível:** nomes, comentários e mensagens em português, módulos com cabeçalhos explicando responsabilidade, formatação padronizada.

## 5. Avaliação geral

| Critério | Nota (0–10) | Comentário |
|---|---|---|
| Funcionalidade | 8,5 | Cobre o fluxo inteiro do estoque ao anúncio; partes dependem de serviços externos sem validação real |
| Qualidade do código | 8 | Organizado e legível; alguns arquivos grandes e sem ESLint |
| Testes | 8 | Muito bons na regra de negócio e smoke; sem testes de componentes e com testes pulados |
| Segurança | 9 | Chave de IA, sandbox e IPC foram resolvidos (o recurso pago foi removido); resta só o `npm audit` moderado do empacotador |
| Documentação | 9 | Completa e atualizada |
| Manutenibilidade | 8 | Estrutura clara; divisão de módulos grandes e CI mais completo ajudariam |
| Prontidão para uso | 7,5 | Precisa de validação real (BNDV, Instagram, instalador) antes de depender dele |

**Veredito:** projeto maduro para uso interno, sem erros bloqueantes encontrados. Prioridade sugerida: **E1** (acentos do motor), **E2** (chave da IA), depois as validações reais listadas na seção 1.

## 6. Reorganização feita em 11/10/2026

Antes, "Soul Cars" tinha três pastas soltas: `soul-cars-app` (o projeto), `soul-cars-estoque` (app Python antigo **com os dados reais da loja**, 200 pastas de veículos e a sessão do Chrome) e `soul-cars-studio` (app Tauri/Svelte antigo). Agora:

```text
Soul Cars/
└── soul-cars-app/        ← repositório (privado) da Atto Comunicação
    ├── src/ engine/ docs/ scripts/ testes/ resources/ …   (versionado)
    ├── dados-loja/        ESTOQUE/ e dados/ reais da loja   (local, ignorado pelo Git)
    └── legado/
        ├── estoque-python/   app antigo (com .git próprio e .chrome-perfil)  (local, ignorado)
        └── studio-tauri/     app antigo (com .git próprio)                    (local, ignorado)
```

- Foram só **renomeações de pasta** no mesmo disco: nada foi copiado nem apagado. As 200 pastas de veículos estão em `dados-loja/ESTOQUE`.
- `%APPDATA%\soul-cars-app\config.json`: `raizDados` agora aponta para `soul-cars-app\dados-loja`.
- O banco `soul.db` **não foi alterado**. Os veículos guardam o caminho antigo da pasta, mas o app liga cada pasta ao veículo pelo ID BNDV e regrava o caminho na próxima leitura do Estoque (a lógica está em `lib/importacao.ts`; não foi exercitada com a interface aberta, por isso **confira a lista de veículos no primeiro uso**).
- `src/main/caminhos.ts` passou a procurar `dados-loja` (e `legado/estoque-python`) antes do caminho antigo.
- `.gitignore` ignora `/dados-loja/` e `/legado/`; os dois projetos antigos mantêm seus próprios repositórios Git locais (ficam fora do GitHub).
- O executável antigo `legado/estoque-python/SOUL Cars Estoque.exe` procura `ESTOQUE/` e `dados/` ao lado dele, que agora estão em `dados-loja`. Use-o só como referência.

## 7. CI e ESLint (11/10/2026)

- **ESLint** (`eslint.config.js`, `npm run lint`): regras recomendadas do ESLint e do typescript-eslint, mais `no-floating-promises`, `no-misused-promises` e `await-thenable` (com tipos) e as regras de hooks do React. A primeira passada achou 29 problemas, todos tratados: promessas sem `void`/`catch` (`index.ts`, `Criativos.tsx`), erro relançado sem `cause` (`ipc.ts`), atribuições mortas (`vendas.ts`, `entrada.ts`), BOM invisível numa expressão regular (`sync.ts`), importação sem uso, e uma expressão regular dentro de um texto do smoke que escapava o ponto de forma errada. Os 2 avisos `exhaustive-deps` restantes também foram corrigidos (`Criativos.tsx`: o ouvinte de mensagens do editor é registrado uma vez e chama sempre a versão mais recente do tratador, que agora enxerga o veículo atual, inclusive `ajustes`; `Producao.tsx`: a chave das fotos virou uma variável). O lint roda com `--max-warnings 0`. O editor em `src/renderer/public` não é verificado.
- **Dependência do motor:** o `ocr.py` importa `numpy`, mas o grupo `documentos` não o declarava (só funcionava porque o grupo `recorte` o trazia). Foi declarado e o `uv.lock` atualizado; assim os testes rodam só com `documentos` e `textos`, como no CI.
- **CI** (`.github/workflows/ci.yml`): jobs `app`, `motor` e `smoke` (veja o manual do desenvolvedor, seção 8). **Ainda não rodou no GitHub**: os mesmos comandos foram executados localmente (lint, tipos, formatação, 125 testes Vitest, build, `npm audit --audit-level=high`, 39 testes Python com os dois grupos e os dois smokes), mas o ambiente do runner (FFmpeg pelo Chocolatey, Electron sem tela dedicada) só será confirmado na primeira execução.

## 8. Licenças das dependências do motor (11/10/2026)

Auditoria das 64 dependências do `engine/uv.lock` (metadados instalados), dos modelos baixados em tempo de uso e dos arquivos embutidos:

- **Dependências Python:** todas permissivas (MIT, BSD, Apache-2.0, PSF, MIT-CMU). **Nenhuma de copyleft forte** (GPL/AGPL/LGPL). Duas com MPL-2.0 por arquivo (`certifi`, `tqdm`), usadas sem modificação, o que não impõe nada ao código da loja. Elas não são redistribuídas: cada computador as instala pelo `uv`.
- **Modelos:** BiRefNet (MIT), ISNet (Apache-2.0), Whisper large-v3-turbo (MIT) e CLIP. O repositório Xenova do CLIP **não declara licença**; o modelo original, OpenAI CLIP, é MIT. Os modelos não vão no repositório nem no instalador.
- **Problemas encontrados e corrigidos:**
  1. `Lato-Black.ttf` (SIL OFL 1.1) era distribuída **sem o texto da licença**, que a OFL exige. Adicionado `engine/video/assets/Lato-OFL.txt`.
  2. O `engine/pyproject.toml` não declarava licença nem autor. Agora: `LicenseRef-Proprietary`, Atto Comunicação.
  3. Não havia lista de avisos de terceiros. Criado `THIRD_PARTY_NOTICES.md` (gerado por `scripts/gerar-avisos-licencas.py`), incluído no instalador e conferido pelo teste `engine/tests/test_licencas.py` (sem copyleft forte, sem licença não identificada, lista em dia com o `uv.lock`).
- **Instalador:** o `electron-builder --dir` confirmou `THIRD_PARTY_NOTICES.md` em `resources/`, o `Lato-OFL.txt` dentro do `engine/` e os avisos do Electron/Chromium (`LICENSE.electron.txt`, `LICENSES.chromium.html`).
- **Trilha (resolvido em 11/10/2026):** a `TRILHA.flac` não tem metadado de autor nem licença e a origem não é conhecida, então deixou de ser redistribuída: saiu do Git (`git rm --cached` + `.gitignore`) e do instalador (filtro em `package.json`). O arquivo continua na máquina e foi copiado para `%APPDATA%/soul-cars-app/trilha/`, de onde o vídeo passa a ler a trilha padrão (`render.py › localizar_trilha`; também aceita `PROJETO/ASSETS` do carro). **Atenção:** a trilha ainda existe no histórico local do Git (commit inicial); se for subir para o GitHub, avise para limpar o histórico antes. Confirmar de onde veio a música continua sendo sua responsabilidade para uso em anúncios.
- **Lato (resolvido):** `Lato-OFL.txt` acompanha a fonte (repositório e instalador); copyright e nome reservado conferidos no próprio arquivo da fonte; a fonte é usada sem modificação.

## 9. Remoção da API da Anthropic (11/10/2026)

Decisão do projeto: **o app não tem nenhuma aplicação paga**. Foi removido tudo o que dependia da API da Anthropic:

- `engine/ia.py`, seu teste e o método `gerar_textos` do motor; o grupo `textos` (pacote `anthropic` e dependências) saiu do `pyproject.toml` e do `uv.lock` (de 64 para 52 pacotes; `THIRD_PARTY_NOTICES.md` regenerado) e do CI.
- Toda a infraestrutura de segredos (`segredos.ts`, cofre do Windows, comandos `segredo_*`), que existia só para a chave. As seções 2 (E2) e 8 do histórico acima descrevem o que havia antes.
- Na interface: o campo de chave, o modo API em Configurações e o botão "Gerar textos com IA (API paga)" na Ficha. **Fica o prompt pronto** (Ficha › Textos pelo chat), que não chama serviço nenhum.
- Na abertura, `main/limpeza-ia.ts` apaga qualquer chave guardada por versões anteriores (tabela `config` do banco e dos backups, e o `segredos.json`). No seu computador não havia chave guardada.
- Os dados antigos `des_ia` (textos do prompt pronto) continuam sendo usados; nenhuma migração de banco foi alterada.

## 10. Erro "O BNDV respondeu HTTP 400" ao atualizar (relato do usuário, 11/10/2026)

- **Causa provável (não confirmada com a API real):** o BNDV passou a recusar a consulta com HTTP 400. O app só tinha plano B quando a API devolvia 200 com `errors`; num 400 ele parava na hora e escondia o corpo da resposta, que diz o motivo.
- **Correção:** `estoque/graphql.ts` lê o corpo mesmo em 400; se o motivo for um campo que não existe mais, tira só aquele campo (pela posição que o servidor informa), avisa no log e segue; se não der para ligar o erro a um campo, refaz só com os campos essenciais; e, se mesmo assim falhar, a mensagem agora traz o status e o texto da API. Nunca poda o campo que identifica o registro. 12 testes novos, com um `fetch` de mentira, cobrem os cenários.
- **O que falta:** clicar de novo em **Atualizar BNDV** e ver a mensagem. Se o problema for o login/token (e não um campo), a mensagem nova vai dizer isso.

## 11. Botões do Estoque e acentos quebrados (11/10/2026)

- **Novos botões** no Estoque: **Entrar no BNDV** (`estoque/bndv-janela.ts`, comando `bndv_abrir`; janela única, sessão `persist:bndv`, sem Node, sandbox; o smoke confere) e **Abrir pasta do estoque** (usa `open_path` na pasta `ESTOQUE`, já limitado à pasta de dados).
- **"?" no lugar de acentos** (ex.: "Autom�tico", "El�trica", "Dire��o"): eram dados gravados **antes** da correção de codificação do motor (E1). Só o Jeep Renegade GAG1H55 tinha isso (`DOC.md`, `DES.md` e os campos câmbio, direção, segurança, conforto e infotenimento). Conferi que o motor já devolve os acentos certos (`DOC.md` regenerado do PDF: 0 caracteres quebrados). Os dados antigos foram consertados por vocabulário (só troca quando a palavra bate com uma palavra conhecida; nada ficou sem correspondência), com cópia de segurança em `Soul Cars/backup-antes-acentos`. Nenhum outro veículo, arquivo ou campo do banco tinha o problema.
- **Segunda barra de rolagem no Relatório completo** (o iframe tinha altura fixa e rolava por dentro, além da página): agora a página do relatório avisa a própria altura (`lib/relatorio-frame.ts`, por `postMessage`, com `ResizeObserver` para quando os gráficos mudam) e o iframe cresce até ela; só a página do app rola. O iframe continua em sandbox sem acesso ao app, e o app só aceita a mensagem vinda dele. O smoke confere que a altura foi ajustada.

## 12. Abertura sem terminal e tela de carregamento (11/10/2026)

- **Atalho sem terminal:** o `SOUL Cars.lnk` agora executa `wscript.exe //B scripts/iniciar-oculto.vbs`, que roda `iniciar.cmd` oculto → `scripts/iniciar.mjs`: compila (`electron-vite build`) só se algo em `src/`, `package.json` ou a configuração for mais novo que `out/`, e abre o Electron em segundo plano (versão compilada, mais rápida que o modo dev). Falhas viram um aviso e vão para `.tmp/iniciar.log`. Conferido: ao abrir pelo atalho, a única janela visível é a do app. O modo antigo (terminal, recarga automática) ficou em `scripts/iniciar-dev.cmd`.
- **Tela de carregamento** (`src/main/splash.ts`): janela sem moldura, fundo escuro com a marca, um feixe dourado que percorre a borda da marca sem parar e a palavra "Carregando" com três pontos pulsando; aparece antes do banco e da interface e fica no mínimo 1,2 s (não pisca). É HTML local em sandbox, sem Node. Os smokes desligam a tela (`SOUL_SEM_SPLASH=1`). Segunda abertura com o app já aberto não mostra nada (instância única).
- **Limite:** depois de mudar o código, a primeira abertura tem alguns segundos sem nada na tela (a compilação roda antes do app existir). Nas demais, a tela de carregamento aparece em cerca de um segundo.
- **Animação da tela de carregamento (ajuste):** a primeira versão tinha um fio que não aparecia em computadores com "efeitos de animação" desligados no Windows, porque a regra "reduzir movimento" a desativava. Como a animação é o próprio indicador de carregamento, ela agora sempre roda (lenta e discreta), e o feixe em volta da marca é bem mais visível. Conferido por três capturas da janela em instantes diferentes.
