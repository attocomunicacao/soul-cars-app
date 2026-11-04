# SOUL Cars — contexto técnico para continuidade

**Encerramento V12:** [logo animada](22-logo-animada-no-encerramento.md), em `engine/video/animacao_logo.py`: cartão de cinco segundos, entrada em fade e escala de 94% a 100%, crescimento lento até 103% e fade final. Centro fixo e interpolação subpixel. Mantém tarjas e legendas da V11.

**Tarjas atuais V11:** [contrato de layout e motion](21-layout-e-movimento-das-tarjas.md): as três tarjas usam a largura da maior, com bordas laterais alinhadas e textos centralizados. Não esticar fontes. Centralizar junto a máscara do glow do preço. Preserva crescimento contínuo de 5% e brilho da V10; substitui larguras individuais.

**Tarjas atuais V10:** [contrato de layout e motion](21-layout-e-movimento-das-tarjas.md): crescimento único, contínuo e centralizado de 100% a 105% ao longo da cena, sem retorno ou ciclo de escala. Glow branco animado somente nas letras do preço, além do halo externo sutil. Substitui o ciclo de 6% da V9. Legendas permanecem iguais.

**Tarjas atuais V9:** ver [layout e movimento das tarjas](21-layout-e-movimento-das-tarjas.md). A flutuação da V8 foi rejeitada: usar escala centralizada de 100–106%, ciclo lento de dez segundos e glow sutil, com interpolação subpixel. Padding uniforme de 32 px, largura máxima do corpo de 866 px e limites laterais que incluem halo e zoom.

**Legendas atuais V7:** [biblioteca contextual de frases, entradas, saídas e composições](20-biblioteca-contextual-de-legendas.md). Todas brancas, Lato Black em tamanho-base 120; glow branco. Formação de frases em `frases.py`, contexto por bloco/vizinhança, 12 entradas, 8 saídas e 6 composições. Esse contrato substitui as referências anteriores a destaque laranja e agrupamento por corte simples.

**Expressões numéricas:** `expressoes.py` recompõe moeda fragmentada (`R` + `$49.900,00` → `R$49.900,00`) antes do planejamento. Um valor tem uma única posição/animação, abrangendo o tempo dos fragmentos. `frases.py` e `composicao.py` protegem números com unidades nas quebras de bloco e de linha; detalhes e limites no documento 20.

Visual atual das legendas: [Lato Black uniforme e glow da mesma cor](19-tipografia-e-glow.md). Todas as palavras em caixa alta, com a mesma fonte e tamanho-base 120; destaque apenas pela cor laranja. Blocos de até três palavras, com exceção de até quatro para número/unidade. Sombra preta substituída por glow sutil. Esse contrato V6 prevalece sobre referências anteriores a Georgia, Lora e tamanhos diferentes.

Motion atual: [SOUL Motion — motor interno de animações](18-soul-motion.md), com núcleo numérico, keyframes e adaptadores ASS/FFmpeg em `engine/video/motion/`. Legendas e tarjas usam esse núcleo; destaque laranja agora tem tamanho-base 100. Não usar as curvas antigas da legenda como referência de implementação.

Mudança posterior à revisão inicial: [novo motor de legendas editoriais](17-legendas-editoriais.md), em `engine/video/composicao.py` e `legendas.py`. Para esse módulo, o documento 17 prevalece sobre a descrição e os hashes da leitura inicial.

Referência: código local em 23/10/2026. Este documento descreve a árvore de trabalho, incluindo alterações ainda não commitadas. A revisão foi ampliada com a leitura dos corpos do código autoral, testes, scripts, configurações e fixtures textuais listados no [registro de cobertura](COBERTURA-LEITURA.md). Dependências, binários, modelos, dados reais e payloads gerados ficam fora desse recorte. Leitura não equivale a execução dos testes nem certifica ausência de defeitos.

Leia também [Contratos e detalhes de implementação](DETALHES-IMPLEMENTACAO.md): identidade e persistência, regras de arquivos/fotos, limites IPC, cálculos BNDV/CRM, finanças, editor/3D, vídeo, testes e CI. Para localizar fontes, use o [inventário atualizado](INVENTARIO-CODIGO.md). Os hashes da cobertura permitem identificar mudanças posteriores a esta revisão.

## 1. Produto e limites

Aplicativo desktop privado da Atto Comunicação para a loja SOUL Cars. Reúne estoque e vendas do BNDV, ficha do veículo, leitura de CRLV, produção de mídia, editor de criativos, preparação de anúncios, publicação no Instagram, CRM uTalk e finanças.

O processamento e a persistência são locais, mas BNDV, uTalk, Instagram, Meta, pesquisa de fichas e downloads iniciais de modelos dependem de rede. “Local” não significa que todos os recursos funcionem offline.

Não adicionar API de IA paga ou chave obrigatória. O desenho dos textos de anúncio usa prompt para o chat do usuário, com validação do JSON de volta; porém o componente desse fluxo não está montado na ficha atual. O token opcional do uTalk é a exceção prevista nas instruções: cifrado no computador e usado apenas no main, em consultas de leitura. Soul IA analisa conversas e exporta material; não é um agente ativo de WhatsApp.

Meta Ads: preparação, cópia de textos e registro local de anúncios; não há ativação automática de campanha. Instagram é diferente: existe automação que efetivamente publica carrossel e Reels quando acionada pelo usuário.

## 2. Stack e execução

| Parte | Implementação |
|---|---|
| Desktop | Electron 44; entrada `src/main/index.ts` |
| Interface | React 19 + TypeScript; `src/renderer/src/main.tsx` → `App.tsx` |
| Build | electron-vite/Vite; três builds em `electron.vite.config.ts` |
| Estilos | CSS próprio e plugin Tailwind 4 |
| Banco | `node:sqlite`, `DatabaseSync`; sem ORM |
| Ponte | Preload CommonJS em sandbox; `window.soul` |
| Automação | Python >= 3.12; dependências por grupos em `engine/pyproject.toml`, lock do uv |
| Testes | Vitest em ambiente Node; unittest Python; smokes em Electron |
| Instalador | electron-builder, NSIS Windows x64; `package.json` |

Execute comandos na raiz `soul-cars-app/`, não na pasta acima:

```powershell
npm install
npm run dev
# Para executar o build já produzido:
npm run build
npm start
```

`scripts/iniciar.mjs` verifica timestamps de fontes e saídas, compila se necessário e inicia Electron ocultando terminal. Logs do iniciador ficam em `.tmp/iniciar.log`. `scripts/*.cmd` e `.vbs` dão suporte à instalação e ao atalho.

O motor é opcional para estoque, cadastro e editor básico. Instalação pelo app executa `uv sync --all-groups --project <engine>` com ambiente em `userData/engine-venv` e cache em `userData/uv-cache`. O main também reconhece `.venv` dentro de engine. OCR e vídeo precisam de executáveis externos, como Tesseract e FFmpeg; consulte `05-motor-python.md`.

## 3. Arquitetura e inicialização

```text
React / libs do renderer
  → window.soul.invocar(comando, args, cabeçalhos, bytes)
  → preload: canal soul:invoke
  → main/ipc.ts: remetente + comando permitido + validação
  → módulos main: SQLite / arquivos / sites / subprocessos

main → soul:evento {nome, carga} → window.soul.ouvir(...)

Criativos.tsx ↔ postMessage ↔ iframe local criativo/index.html
main/studio/motor.ts ↔ JSON por linha ↔ engine/main.py
```

`main/index.ts` obtém trava de instância única, inicia diagnóstico e splash, tenta importar banco legado, limpa segredos antigos do modo de IA removido, registra IPC, cria janela e inicia o observador de entrada. A janela principal tem Node desabilitado, contextIsolation e sandbox. No encerramento, para observador, motor, Instagram e vistas remotas; há saída forçada se o encerramento demorar.

`preload/index.ts` expõe `invocar`, `ouvir` e metadados `versoes`. `ouvir` retorna função de desligamento. `renderer/src/lib/desktop.ts` adapta essas operações para o restante da interface.

`ipc.ts` contém a tabela fechada `COMANDOS`; `ipc-esquemas.ts` contém os esquemas; `validacao.ts` implementa validadores. Comando sem esquema, ou esquema sem comando, impede registro. Apenas a janela principal e seu mainFrame podem invocar comandos. Não expor SQL arbitrário nem Node no renderer. Bytes passam como `Uint8Array`; cabeçalhos de caminhos/nomes são codificados no renderer e decodificados uma vez no main.

## 4. Navegação real

`App.tsx` usa estado React, sem roteador de URLs. O estado `studio` é o detalhe de um veículo aberto a partir do estoque, não um item separado do menu.

| Menu/tela | Componentes e comportamento atual |
|---|---|
| 01 · Estoque | `App`, lista, filtro BNDV, `Vitrine`, relatório HTML/PDF e abertura da ficha |
| Ficha do veículo | `Ficha`: Ficha → Produção → Criativos → Pronto para anunciar → Publicação → Instagram |
| 02 · CRM | `Embutida id="crm"`: site uTalk dentro de `WebContentsView` |
| 03 · Leads e Soul IA | `LeadsSouliaIa`: Painel (`VisaoCrm`, métricas e desempenho) e Memória (`SouliaIa`) |
| 04 · BNDV | `Embutida id="bndv"` |
| 05 · Meta ADS | `Embutida id="meta"` |
| 06 · Finanças | `Financas`: planilha mensal vinculada, pagamentos e edição |
| Configurações | Controles em `App` e `Configuracoes` |

`main/embutidas.ts` gerencia vistas com partições persistentes `utalk`, `bndv` e `meta`, sem preload/Node. O BNDV embutido compartilha sessão com a extração. `Embutida.tsx` envia posição e tamanho da área disponível.

Na abertura, `App.carregar()` monta balanço e importa pastas para o Studio. Há releitura da lista a cada 60 s quando não há veículo selecionado nem operação ocupada, e consulta de anexos a cada 15 s na lista. O relatório usa iframe com sandbox, mensagem de altura e fallback de rolagem; o PDF é gerado no main.

## 5. Fluxo BNDV → pastas → banco

1. `estoque_atualizar` impede atualizações simultâneas e emite logs/etapas.
2. `estoque/extracao.ts` abre janela BNDV, captura cabeçalhos de autenticação na sessão persistente e verifica o token. Sessão expirada pode exigir novo login.
3. `bndv-esquema.ts` usa introspecção para descobrir campos extras, como km, ano, cor, câmbio e versão. Diagnóstico fica em `dados/bndv_campos.json`.
4. `graphql.ts` consulta veículos/vendas por páginas, identifica sessão expirada, deduplica e adapta seleções a campos removidos pelo servidor. Extração incompleta é sinalizada, mas os CSVs recebidos são gravados: pastas preservadas não significam que os dados financeiros estejam completos.
5. `extracao.ts` grava `bndv_veiculos.csv` e `bndv_vendas.csv`.
6. `sync.ts` seleciona registros, preserva pasta existente pelo ID BNDV, cria subpastas `CRIATIVO`, `FOTOS`, `VIDEO`, atualiza `INFO.md`/`INFO.txt` e `_INDICE.csv`, registra pastas órfãs sem apagá-las.
7. `renderer/src/lib/importacao.ts` lê pastas via IPC, interpreta INFO/DES, cria ou atualiza veículo no SQLite. Reencontra pelo caminho ou `estoque_id`, usa timestamp em `config` para evitar releituras e compartilha promessa de importação em andamento.

Importação e extração são etapas diferentes: “Reler pastas” não baixa dados novos do BNDV. A lista retornada pela importação filtra pastas ausentes, sem excluir os registros correspondentes do banco. O progresso/ajustes existentes do Studio são preservados pelo patch da importação.

`vitrine.ts` combina dados BNDV, pastas e cadastro do Studio, com miniaturas. `vitrine-dados.ts` concentra associação e ordenação sem Electron.

## 6. Identidades e persistência

Não confundir `veiculos.id` (ID SQLite interno), ID BNDV (`estoque_id` calculado/associado na leitura) e nome/caminho da pasta. Mudança de nome comercial não autoriza renomear pasta.

| Local | Conteúdo |
|---|---|
| `userData/soul.db` | Cadastro, configuração do Studio, anúncios, entrada e relatórios |
| `userData/config.json` | Raiz de dados, pasta do motor, token uTalk cifrado, vínculo financeiro e marcações de pago |
| `userData/veiculos/<id>/fotos` | Slots de imagens do editor |
| `userData/backups` | Backups rotativos de `soul.db`; subpasta de backups financeiros |
| `userData/soul-ia.db` | Memória de leads, conversas, mensagens e eventos |
| `userData/instagram` | Conta, histórico por veículo/conta e pacotes de publicação |
| `<raizDados>/ESTOQUE` | Pastas dos veículos e mídias/documentos |
| `<raizDados>/dados` | CSVs BNDV, balanço, relatório e diagnóstico de campos |
| `<raizDados>/soul-ia` | Exportações CSV/XLSX, exemplos e prompts |

`userData` vem de `app.getPath("userData")`; normalmente é `%APPDATA%/soul-cars-app`. A raiz visível é escolhida em configuração. Sem escolha, `caminhos.ts` procura raízes antigas e, se nenhuma servir, usa **Documentos/SOUL Cars**. Não assumir `dados-loja/` como fallback universal.

O Studio usa WAL e foreign_keys. `studio/esquema.ts` tem sete migrações: veículos, ficha/config, estoque, ajustes, relatórios, entrada, anúncios. Registro em `studio_migracoes`; migrações rodam em transações, tolerando estruturas já existentes do legado. Acrescentar versões, nunca editar versões distribuídas.

`repositorio.ts` contém consultas nomeadas e seleção de campos editáveis. Alteração de campo exige verificar `compartilhado/veiculo.ts` (`EDITAVEIS`), tipos em `lib/db.ts`, SQL, comandos/esquemas e UI. Preço e km são números; não presumir que o preço esteja em centavos: a UI formata diretamente em reais.

Manutenção faz `quick_check` e snapshot com `VACUUM INTO`, alternando sete nomes por dia da semana. Isso não é backup completo de mídias/configuração, de `soul-ia.db` ou de todo o histórico Instagram. Importação do legado preserva origem e não substitui banco novo já existente. Ver `04-dados-e-backup.md` antes de recuperar dados.

## 7. Ficha, documentos e textos

`Ficha.tsx` mantém o veículo em estado, salva campos por `db_veiculo_atualizar` e coordena outras abas. Preço/km são a primeira seção; CRLV e ficha técnica completam dados.

CRLV: arquivo é copiado para `DOC.pdf`, motor lê PDF textual ou renderiza/OCR se necessário, devolve campos e conflitos; a ficha grava `DOC.md` e atualiza cadastro. PDF protegido pode pedir senha. `engine/crlv.py` trata posições, normalização e Markdown; `ocr.py` usa Tesseract e também lê equipamentos em imagens.

Ficha web: `lib/cnw-banco.ts` mantém cache via configuração. `ficha_web.py` tenta Carros na Web e depois Ficha Completa. Equipamentos cuja fonte não distingue série/opcional ficam como sugestão para confirmação. `cnw_texto` permite interpretar texto colado.

`lib/des.ts` gera DES com ficha e blocos de anúncio; `compartilhado/publicacao.ts` extrai blocos copiáveis. Formato é contrato de compatibilidade, com fixture em `testes/fixtures/DES.md`. DES existe no banco e no disco: verificar ambos ao investigar divergência. `descricao()` salva banco e, com pasta vinculada, grava `DES.md`.

`compartilhado/anuncio-ia.ts` monta prompt e valida cinco textos, cinco títulos, destaques permitidos, CTA e WhatsApp. `PromptAnuncio.tsx` contém UI desse fluxo, mas não está importado na ficha atual. Não prometer acesso a esse botão sem verificar a montagem.

## 8. Produção, arquivos e motor

`studio/arquivos.ts` centraliza leitura de pastas, nomes seguros, slots `main/left/center/right/original`, exportações, reconhecimento de arquivos de produção e renomeação de fotos. `lib/arquivos.ts` e `lib/producao.ts` são clientes IPC. Mudanças de convenção de nomes afetam checklist, editor, vídeo e Instagram juntos.

O motor mantém um processo Python aberto. `chamarMotor` serializa requisições numa fila, com timeout de 15 minutos. Protocolo: entrada `{method, params}`, resposta `{result}` ou `{error}`, e mensagens intermediárias `{progress: {pct, texto}}`. UTF-8 explícito nos pipes; diagnóstico não pode poluir stdout. `engine:progresso` chega à UI.

| Módulo Python | Papel |
|---|---|
| `main.py` | Despacho dos métodos e protocolo |
| `crlv.py`, `ocr.py` | Documento, OCR e DOC.md |
| `cnw.py`, `fichacompleta.py`, `ficha_web.py` | Pesquisa, parsing e alternativas de ficha técnica |
| `fundo.py` | rembg; BiRefNet-lite padrão; máscara fecha buracos e mantém maior objeto |
| `visao.py`, `fotos.py` | CLIP ONNX local; sugere ordem, sem renomear automaticamente |
| `planilha.py` | Edições financeiras, totais, datas e gravação protegida |
| `soulia_planilha.py` | Exportação XLSX da memória |

Reconhecimento e recorte podem baixar modelos no primeiro uso. O recorte preserva dimensões da imagem, necessárias ao alinhamento com piso original.

Vídeo é subprocesso separado do protocolo persistente: `motor.gerarVideo()` executa `video/render.py`, transmite `video:log` e permite cancelar a árvore de processos no Windows. Um vídeo por vez; cópia da entrada e geração de vídeo se bloqueiam para reduzir disputa de recursos.

Pipeline atual: FFmpeg extrai áudio → faster-whisper transcreve → correções/contexto organizam palavras → legendas ASS e tarjas animadas → composição vertical 1080×1920, 59,94 fps, HEVC, áudio e cartão final. Tenta Intel QSV e recorre a x265. Confere duração/tamanho antes de substituir saída; usa `.soul_tmp` e a remove ao concluir. `contexto.py`, `legendas.py` e `animacao_tarjas.py` são parte do código local atual.

O FFmpeg é interrompido se ficar 120 segundos sem avanço real em `out_time_us`, mesmo que continue repetindo mensagens de progresso. No Windows, encerra também o executável filho do shim. Um bloqueio no Intel QSV aciona a alternativa x265; um bloqueio nessa alternativa retorna erro ao app.

O render usa três processos sequenciais: cena com tarjas/legendas (40–86%), cartão animado (86–94%) e união por concat demuxer com cópia do vídeo e mixagem de áudio (94–98%). Evita concatenar a cena e a logo dentro do grafo de overlays, que apresentou bloqueios na transição tanto com Intel quanto com software. As duas partes usam o mesmo encoder, FPS, formato de pixel e resolução. A voz recebe silêncio até o fim; a trilha continua durante a logo. A saída final só é substituída após validação.

Há `video/leve.py` e `motor.gerarVideoLeve`, mas **não há comando correspondente na tabela IPC atual**. Não assumir botão/fluxo de versão leve ativo só por haver implementação e testes.

## 9. Editor de criativos

O editor em `renderer/public/criativo` é HTML/JS/CSS independente dentro de iframe, não uma árvore React. `Criativos.tsx` valida origem/remetente das mensagens e faz a ligação com banco, arquivos e motor.

| Arquivo | Responsabilidade |
|---|---|
| `index.html`, `script.js`, `layouts.js` | Estrutura, carregamento, campos, fontes, prévia e exportação |
| `layout4.js/.css` | Composição de layout 4 |
| `layout6.js/.css` | Carrossel, composição, controles e alinhamento |
| `shadow.js` | Sombra e ajustes relacionados |
| `original-floor.js` | Preservação/composição do piso da foto original |
| `app-bridge.js`, `flow-bridge.js` | Integração com o app e fluxo do editor |
| `workbench.*`, demais CSS | Organização dos controles e aparência |
| `assets/` | Fontes, logos e biblioteca de captura/exportação com licenças |

Mensagens centrais: `soul:ready`, `soul:vehicle`, `soul:photos`, `soul:ajustes`, `soul:photo`, `soul:export`, `soul:export-result`, `soul:vitrine-*`, `soul:estudio-renderizar/resultado`, `soul:instagram-export`. Ajustes são JSON no campo `veiculos.ajustes`. Exportar PNG pode mudar status de rascunho para criativos.

O pacote Instagram exporta três carrosséis e a arte de tráfego pago; `Criativos.tsx` acompanha os quatro arquivos para concluir a preparação. Recortes usam fotos 1, 2 e 4. A sombra da Carrossel usa o mesmo gerador 2D (`CarGrounding`) do tráfego pago.

## 10. Anúncios e Instagram

`Anunciar.tsx` + `compartilhado/anuncio.ts`: checklist de documento, fotos numeradas, vídeo final, DES e criativo de tráfego pago. Cartão extrai textos/títulos/descrições, usa prefixo `[VENDA]` e permite registrar anúncio na tabela `anuncios`. O registro não prova que uma campanha está ativa na Meta.

`AvisosAnuncio.tsx` cruza anúncios abertos com última venda BNDV para lembrar pausa. Dados com mais de 24 h podem gerar aviso de desatualização. Marcar pausado é registro local; não altera campanha remotamente.

Instagram: `instagram-plano.ts` exige legendas 1 e 2 do DES, limite de 2.200 caracteres, três carrosséis na ordem **2 → 1 → 3**, capa `-trafego-pago` e exatamente um vídeo `VIDEO_*.mp4` na raiz da pasta do veículo. Nomes usam `slugInstagram`.

`instagram.ts` abre janela com sessão `persist:instagram`, valida conta logada, copia pacote estável, registra assinatura e etapas; `instagram-browser.ts` opera o site. Login/avisos podem exigir intervenção humana. Logs e mudanças de registro chegam por eventos `instagram:*`.

Limite importante da retomada atual: se só carrossel foi confirmado, pode continuar no Reels com o mesmo conjunto; se ambos já estavam publicados, uma nova execução reinicia as duas etapas. Estados interrompidos viram pendentes. O histórico ajuda a retomada, mas não garante publicação exatamente uma vez diante de falha após envio. Não descrever como prevenção absoluta de duplicatas.

## 11. CRM e Soul IA

`utalk.ts` guarda token com `safeStorage`; `config_ler` omite token cifrado da resposta ao renderer. `utalk-api.ts` concentra organização, paginação, consultas e visão geral. `crm-etiquetas.ts` classifica etiquetas/modelos e relaciona demanda ao estoque.

`soulia/sincronizar.ts` lê conversas e baixa mensagens/eventos de conversas alteradas, com limite, cancelamento e progresso. Trabalha com lotes de três, paginação e tratamento de falhas. `memoria.ts` tem esquema/migrações próprios: `ia_leads`, `ia_conversas`, `ia_mensagens`, `ia_eventos`, `ia_sync` e `ia_migracoes`.

`analise.ts` extrai métricas, situações e exemplos; anonimiza textos para saídas específicas e gera padrão/prompt. Isso não significa que o banco e todas as planilhas estejam anonimizados: a memória contém dados pessoais. `desempenho.ts` calcula indicadores, faixas de espera e distribuição temporal. A orquestração em `soulia.ts` mantém cache das métricas até mudar a memória/dia.

Exportação gera CSVs, `padrao-de-atendimento.md`, `exemplos.jsonl`, `prompt-refinar-padrao.md` e tenta `memoria-soul-ia.xlsx` pelo motor. Falha do XLSX não impede CSV/Markdown. Esquecer a memória limpa tabelas do banco separado; não presumir que apaga exportações já gravadas.

## 12. Finanças e balanço são módulos diferentes

**Balanço do estoque:** `estoque/balanco.ts` lê CSVs e `dados/balanco.json`. Cadastro ativo prevalece na deduplicação por placa. Consignados não entram no custo patrimonial. Receita, custo e margem vêm da última venda por veículo; margem é bruta. A porcentagem por veículo usa custo como denominador. Lucros acumulados fecham a equação por diferença, não são apuração independente de lucro líquido. Relatório em `relatorio.ts`, impressão em `relatorio-impressao.ts`, PDF via Electron em `relatorio-pdf.ts`.

**Planilha financeira:** `main/financas.ts` vincula um XLSX externo, envia bytes e mtime para a interface. `lib/xlsx.ts` lê estrutura XLSX, `lib/financas.ts` interpreta meses/contas/totais. Marcações de pago ficam em `config.json`. A interface também edita células e cria mês: `financas_editar` → `planilha_aplicar` → openpyxl. O motor verifica modificação externa, faz backup, grava temporário, confere abertura e substitui arquivo. Portanto a planilha vinculada **pode ser alterada pelo app**; comentários antigos de “somente leitura” não descrevem toda a implementação atual.

## 13. Entrada e código sem acesso direto na UI

`studio/entrada.ts` inicia com o app e consulta configuração do banco. Observa pasta sincronizada em intervalos de 30 s, espera estabilidade de 5 s, associa placas, calcula hashes, copia arquivos e registra estados em `entrada_arquivos`. Há pause/verificação e liberação explícita para lixeira. Não executar esses comandos sobre dados reais como teste.

`Entrada.tsx`, `Relatorios.tsx` e `PromptAnuncio.tsx` existem sem importação na navegação atual. As bibliotecas/testes correspondentes continuam presentes. O observador de entrada pode funcionar com configuração já salva, mesmo sem tela montada. A UI de relatórios Meta/SINDEPRESTEM também não equivale ao relatório completo do estoque, que está ativo.

## 14. Regras de manutenção

- Ler `AGENTS.md` e documentos 02/03/04 antes de alterar negócio.
- Preservar Estoque e Studio, IDs, pastas existentes e órfãs, dados reais e legado.
- Não versionar bancos, CSVs reais, documentos, fotos, sessões, tokens ou caminhos pessoais.
- Migrações distribuídas são imutáveis; criar próxima versão.
- Operação de disco, banco ou processo pertence ao main; renderer usa preload.
- Comando novo exige esquema e cliente; método Python também deve ser permitido no contrato do motor.
- Preservar DOC/DES e verificar fixtures quando mudar formato.
- Limpar listeners/timers e exibir erros de operação.
- Manter nomes/comentários/mensagens em português.
- Antes de editar, conferir `git status` e diff; há trabalho local prévio, inclusive Instagram, editor, estúdio 3D e legendas. Não restaurar arquivos indiscriminadamente.

## 15. Validação por escopo

| Alteração | Comandos relevantes |
|---|---|
| TypeScript e regras | `npm run tipos`, `npm test` |
| Build | `npm run build` |
| Estilo do código | `npm run lint`, `npm run formatar:check` |
| IPC, preload, disco, editor | `npm run smoke` |
| Integração Instagram | `npm run smoke:instagram` |
| Motor | `npm run test:engine` |
| Instalador | `npm run empacotar` |

Não afirmar que passaram sem executar na revisão em questão. Nesta tarefa de documentação não foram executadas suítes nem operações nos serviços externos. Os testes `.mjs` também fazem parte de `npm test`. Alguns testes Python dependem de executáveis, modelos ou fixtures locais; verificar resultados e skips. Mudança apenas de documentação não exige novas suítes conforme AGENTS.md.

## 16. Como retomar com pouco contexto

1. Ler este guia e `AGENTS.md`; conferir árvore/diff atuais.
2. Consultar [inventário](INVENTARIO-CODIGO.md) e abrir o módulo solicitado.
3. Seguir a cadeia completa: componente → lib → IPC/esquema → domínio → banco/disco/Python.
4. Ler testes do mesmo domínio antes de modificar regras.
5. Fazer alteração, executar verificações proporcionais e atualizar o trecho deste guia afetado.

Documentação complementar: [índice](README.md), [visão geral anterior](00-visao-geral-para-ia.md), [arquitetura](02-arquitetura-e-migracao.md), [dados/backup](04-dados-e-backup.md), [motor](05-motor-python.md), [Instagram](09-instagram.md), [CRM](15-crm-dados-e-relatorios.md) e [Soul IA](16-soul-ia.md). Para o contrato uTalk, consultar `13-api-utalk-biblioteca.md` por assunto, sem carregar toda a biblioteca em cada chat.
# Atualização das tarjas (23/10/2026)

Consultar [21-layout-e-movimento-das-tarjas.md](21-layout-e-movimento-das-tarjas.md): padding uniforme de 32 px, largura máxima de 936 px, alturas pelo texto, espaçamento de 8 px e flutuação contínua sincronizada. Mantém as legendas brancas em Lato e as entradas/saídas suaves existentes.

