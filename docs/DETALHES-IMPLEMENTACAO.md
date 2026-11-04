# Contratos e detalhes de implementação

Complemento do [contexto principal](CONTEXTO-PARA-OUTRO-CHAT.md), baseado na leitura do código local em 23/10/2026, inclusive testes e scripts. Consulte o [registro de cobertura](COBERTURA-LEITURA.md) para o recorte e as versões dos arquivos. Os comportamentos abaixo descrevem a implementação; não são garantias de execução nem propostas de mudança.

## Persistência, identidade e atualização

- O ID interno do Studio e o ID externo do estoque são conceitos diferentes. `estoque_id` é derivado do prefixo numérico seguido de `_` no nome da pasta, por `comIdEstoque`; não é coluna persistida do Studio. Até uma pasta manual com esse formato produz esse valor. Não renomear pastas para ordenar a interface.
- O repositório aplica uma lista de campos editáveis; ID e datas de criação não entram no patch. Valores nulos/ausentes de campos enviados podem virar SQL NULL. A normalização da placa na criação não deve ser presumida em toda atualização. A ordenação do repositório por atualização e a ordenação visual pelo ID externo têm finalidades diferentes.
- Os helpers SQL convertem parâmetros `$1` em argumentos posicionais, inclusive quando repetidos. Resultados de `DatabaseSync` são copiados para objetos comuns antes do IPC. Não substituir isso sem verificar serialização e parâmetros duplicados.
- Configurações do Studio em SQLite, configuração principal em JSON, conta do Instagram em JSON e preferências locais do editor são persistências separadas. Na configuração do Studio, salvar `null` remove a chave.
- As sete migrações do Studio são históricas e imutáveis. A memória Soul IA usa outro banco e seu próprio esquema. Anúncios guardam informações do veículo para comparação posterior; não pressupor uma relação SQL com exclusão em cascata.
- Migração legada faz cópia consistente do SQLite, incluindo WAL pelo mecanismo de backup, e só instala o banco preparado ao final. Um banco novo já existente impede repetir a importação inicial. Arquivos e banco não formam uma transação única.
- A manutenção de backup roda na inicialização. Os sete destinos por dia da semana são reaproveitados; isso não é um serviço que executa continuamente com o app fechado.

Fontes: `src/main/studio/{repositorio,banco,esquema,legado}.ts`, `src/main/config-json.ts`, `src/main/soulia/memoria.ts`.

## Pastas, fotos e prontidão da produção

`listarEstoque` reconhece pastas com INFO.md, DES.md, PDF na raiz ou fotos. Sua marca de alteração considera arquivos da raiz e fotos, em segundos; não acompanha recursivamente todas as alterações de criativos e vídeos. A importação usa esse cache, lê INFO e depois DES e pode reaplicar valores antigos do DES. Caminhos desaparecidos não significam exclusão automática do cadastro.

As pastas FOTO/FOTOS são reconhecidas sem distinguir maiúsculas. A listagem de fotos usa ordem numérica natural e separa derivados `_sem_fundo`. A renumeração move primeiro para nomes temporários, inclui o recorte correspondente, verifica colisões e tenta desfazer os movimentos em caso de falha. Uploads usam arquivo temporário e renomeação; metadados `.nome` ajudam a preservar a origem.

| Etapa | Regra efetiva e limite |
|---|---|
| Importação padrão do editor | Original/esquerda/principal usam foto 1; centro usa 6; direita usa 7; principal prefere `1_sem_fundo`. O bridge atual restaura original e principal. |
| Carrossel | Seleção própria das fotos 1/2/4; não confundir com o helper antigo `distribuirFotos`. |
| Reabrir editor | A importação padrão ocorre de novo e pode substituir uma seleção manual anterior de imagem principal. Ajustes são restaurados depois das fotos. |
| Documento pronto | A verificação reconhece qualquer PDF da raiz; não comprova extração correta do CRLV. |
| Recorte pronto | A verificação por nome/extensão não comprova transparência. O carregador do carrossel verifica pixels/transparência. |
| Vídeo bruto encontrado | A busca de status acha o primeiro candidato em VIDEO, PROJETO ou raiz. O render procura em PROJETO, VIDEO e raiz e exige exatamente um candidato. |
| Vídeo final | Arquivo da raiz com padrão `VIDEO_*.mp4`; o leve usa `ANUNCIO*.mp4`, excluindo parcial. Existência não certifica conteúdo. |
| Registro de anúncio | O checklist orienta o usuário; o registro local não exige que todos os itens estejam aprovados. |

A criação manual prepara CRIATIVO/FOTOS/PROJETO e copia arquivos diretos de PROJETO da pasta anterior escolhida por ordenação textual. A cópia não filtra exclusivamente templates. A sincronização BNDV também prepara VIDEO. Salvar campos da ficha atualiza o banco; não equivale a reescrever todos os documentos. Salvar a descrição é uma operação específica sobre DES.md.

Fontes: `src/main/studio/arquivos.ts`, `entrada.ts`, `src/renderer/src/lib/importacao.ts`, `Criativos.tsx`, `Ficha.tsx`.

## IPC, arquivos e motor

O preload expõe invocação, escuta de eventos e informações de versão. O main valida a janela emissora e seu frame principal. A relação de canais e formatos está em `ipc-esquemas.ts`; a execução em `ipc.ts`. Métodos Python permitidos têm lista fechada, mas o parâmetro genérico de `engine_call` não possui um esquema completo por método. A rota dedicada de render 3D tem validação adicional, repetida no Python.

As verificações de caminho usam resolução textual e prefixos, não uma resolução completa de links simbólicos. Há verificações com sensibilidade a maiúsculas diferente entre helpers. Não interpretar essas rotinas como uma garantia universal sobre qualquer caminho do Windows. `open_url` aceita HTTP/HTTPS; abrir arquivo restringe raízes e extensões executáveis; revelar arquivo e diálogos têm contratos próprios.

Limites relevantes: corpo de upload de 200 MiB; imagem do editor de 30 MiB e 50 MP; OCR de 20 MP; remoção de fundo de 50 MP. Validação estrutural de campos do veículo não equivale a validação semântica completa de todos os números, datas e estados.

O processo Python persistente usa JSON por linha e uma fila serial, sem identificadores independentes de requisição. Ignora linhas que não são JSON; timeout encerra o processo. Vídeo usa processo separado, texto de progresso e cancelamento da árvore de processos no Windows. Ao adicionar operação, revisar implementação Python, allowlist, IPC, preload, tipos, interface e testes.

O diagnóstico que indica bibliotecas disponíveis parte da presença do executável Python; isso não prova que cada import e modelo esteja instalado. Logs do aplicativo têm tamanho limitado; falha de GPU pode reiniciar o Chromium com `--sem-gpu`, sem definir por isso o encoder do FFmpeg.

## BNDV, balanço e relatórios

A extração GraphQL pagina de 20 em 20, da página 0 à 200, até uma página vazia. Timeout por requisição: 60 segundos. O adaptador tenta remover campos opcionais incompatíveis até seu limite de tentativas; campos essenciais não podem ser descartados. Falha nos extras pode resultar em dados básicos sem os atributos adicionais. `bndv_campos.json` auxilia o diagnóstico do esquema recebido.

Os CSVs são substituídos pela extração atual; não são um histórico incremental. Pastas preservadas não recuperam registros omitidos no CSV. A captura de autenticação pode limpar dados da sessão para forçar login; fecha a janela temporária e remove a interceptação ao terminar. Não confundir essa sessão com a do Instagram.

No balanço, a deduplicação prefere cadastro ativo e depois menor ID para a mesma placa; cadastros inativos são ignorados. A última venda é escolhida por data e ID. Consignados não somam custo próprio, mas podem somar receita. Portanto receita menos custo não representa comissão líquida ou lucro contábil completo. A margem percentual de uma unidade usa custo como denominador; a razão mensal do relatório usa receita. Gráficos com margem válida podem trabalhar com menos veículos que o contador de vendas.

O balanço patrimonial tem uma conta automática de custo do estoque; as demais são lançadas em `balanco.json`. Lucros acumulados são obtidos por diferença entre ativo, passivo e patrimônio lançado. `confere` reflete essa equação construída e não valida os lançamentos nem apura o lucro real. Esse módulo existe mesmo sem uma tela ativa correspondente.

Há dois conjuntos distintos de relatórios: estoque/vendas BNDV e planilhas Meta Ads para WhatsApp. O segundo detecta o tipo predominante de resultado: conversas de veículos ou visualizações de página do SINDEPRESTEM. No relatório de veículos, custo por conversa até R$ 5 é baixo, até R$ 8 moderado; a exibição monetária trunca valores, enquanto a classificação usa o valor calculado. Agrupa campanhas após retirar prefixo/sufixo entre colchetes, preserva a ordem anterior e avisa sobre números repetidos. No formato diário, carros ativos são os presentes no último dia; dias anunciados contam do primeiro gasto até esse dia, não apenas dias com entrega.

Alcance somado entre dias/conjuntos pode duplicar pessoas. Uma linha geral da planilha é preferida à soma quando reconhecida. HTML de relatório de estoque é autônomo, com dados e gráficos incorporados; exportação PDF usa janela temporária e impressão do Electron. Isso é diferente do texto para copiar ao WhatsApp.

## CRM uTalk e memória Soul IA

O cliente consulta a primeira organização ativa, ou a primeira disponível. Requisições têm timeout de 30 segundos; rede/5xx podem ser repetidos, mas 429 gera erro explícito. Etiquetas são paginadas; contagens paralelas têm concorrência limitada. Somar etiquetas pode contar o mesmo contato mais de uma vez: demanda por modelo não é quantidade garantida de leads distintos. A correspondência de modelo é textual, não uma classificação por IA.

A visão remota do CRM e a análise da memória local têm atualizações diferentes. Recarregar uma não significa sincronizar a outra. A sincronização local percorre conversas e baixa mensagens com três trabalhadores, paginação retroativa e limites por conversa. Interromper solicita cancelamento entre etapas; não aborta imediatamente toda requisição em voo. Falhas parciais podem coexistir com atualização de `ultima_sincronizacao`; o timestamp não prova completude.

Mensagens e eventos são deduplicados pelo ID. Mensagens já inseridas não são atualizadas para refletir todas as edições/exclusões remotas. Mensagens privadas ficam na memória, mas são excluídas da análise e das exportações de atendimento. Áudio conta como mídia; não há transcrição automática dessas conversas.

| Métrica/saída | Interpretação correta |
|---|---|
| Sem resposta | Conversa com mensagem do lead e sem resposta humana encontrada; não é necessariamente a fila atual após a última mensagem. |
| Primeira resposta | Primeiro humano após o primeiro lead; tempo corrido, sem descontar noite/fim de semana. |
| Resposta até 5 minutos | Percentual entre conversas respondidas; não usar o denominador de todas as conversas. |
| Histórico de desempenho | Linha diária de 30 dias; outras estatísticas podem considerar toda a memória. |
| Etiquetas positivas | Heurística por palavras como visita, proposta, negociação e venda; não comprova conversão causada pelo atendimento. |
| Horários | Partes da análise usam UTC−3 fixo; não presumir a mesma regra em todas as datas do app. |

Memória e exportações completas contêm informações pessoais. A anonimização dos exemplos remove padrões comuns e primeiro nome, mas não garante eliminação de todos os identificadores em texto livre. CSV protege prefixos de fórmula; o exportador XLSX limpa caracteres de controle, sem aplicar exatamente a mesma proteção. Esquecer memória executa exclusões, não apagamento seguro do arquivo SQLite, e não remove cópias exportadas. Exportação gera CSV e tenta XLSX; o JSON intermediário é removido ao final. As métricas usam cache por contagens, sincronização e dia; isso não é uma revisão individual de cada linha.

## Finanças e planilhas

O leitor XLSX local implementa um subconjunto de ZIP/XML: shared strings, inline strings, números, booleanos e valores armazenados de fórmulas. Não calcula fórmulas, não é suporte genérico a XLS e não implementa todos os calendários/recursos do Excel.

A identificação de contas começa em VENCIMENTO na coluna B e termina em TOTAL na coluna C. Vencimento, destinatário e valor ficam em B/C/D; demais dados de pagamento em E–H. O ID persistido de pagamento combina aba, data, destinatário e ocorrência, sem depender da linha física. Alterar data/nome ou a ordem de duplicatas pode mudar a associação do pagamento. Essa chave não é a chave PIX.

Totais são recalculados pelos valores numéricos das contas. A interface determina valores variáveis por prefixos e bloco; o backend restringe edição à coluna de valor dentro de uma conta, mas não reaplica toda a lista de prefixos da interface. Escritas são enfileiradas pelo renderer; falhas provocam atualização da tela.

Criar mês copia a última aba interpretada na ordem do arquivo, não necessariamente a mais recente por calendário. Mantém valores fixos, limpa variáveis, ajusta vencimentos para dias 5/20, copia estilos/tabelas com novos identificadores e rejeita nome de mês já existente. A virada de ano não torna nomes iguais em abas diferentes automaticamente possíveis. Fórmulas são escritas para o Excel recalcular; não há cálculo completo no motor.

O Python mantém até dez backups por nome-base, grava temporário na mesma pasta e substitui o arquivo. A verificação de mtime aceita uma tolerância e não equivale a bloqueio exclusivo do Excel. As operações expostas são edição de célula e criação de mês; funções auxiliares de otimização não significam uma função ativa de inclusão/exclusão livre de linhas.

## Editor de criativos e 3D

O editor é HTML/JS/CSS público, carregado em iframe, com estado no DOM e funções globais. Não é uma árvore React. A ordem de scripts e estilos do `criativo/index.html` faz parte da implementação: master, layouts e estúdio compartilham funções; folhas posteriores sobrescrevem anteriores. Elementos escondidos continuam sendo usados como estado. Mudanças de IDs, listeners e ordem precisam considerar todos os bridges.

`app-bridge.js` recebe dados, fotos e ajustes do pai; `flow-bridge.js` sincroniza preparação/exportação. Autosave de ajustes usa debounce de 700 ms e chaves de controles; texto comercial vem do veículo, não de uma cópia arbitrária de todo o DOM. O tema integrado é definido pelo shell; o editor avulso também usa preferências locais.

Exportação aguarda imagens, fontes e renderizações pendentes, verifica dimensões e usa html-to-image. Retrato usa 1080×1920; carrossel, 1080×1350; escala alta padrão gera 2160×3840 e 2160×2700. No navegador há ZIP sem compressão; integrado, o bridge intercepta o download e envia bytes para o main. Solicitar os exports não significa receber confirmação da gravação de todos: o pai acompanha os nomes esperados dos quatro arquivos.

Foto principal e fotos dos slides têm verificações próprias de transparência, recorte e resolução. Fotos opcionais e transforms dos apoios não devem ser confundidos com arquivos novos persistidos na pasta. O chão original combina máscaras e pintura; a sombra artificial usa pontos de contato. São operações 2D sobre a fotografia.

O 3D produz cenário, sombra, luz e molde em quatro passes; não cria outro veículo por IA. Usa geometria aproximada por tipo, semente determinística, cache LRU e render de prévia/final com custos diferentes. O cliente serializa trabalho, descarta resposta obsoleta e tem timeout de 180 segundos; a fila do motor possui outro limite. Preview é reduzido, com debounce, e render final acompanha a escala de exportação. Não confundir o cenário 3D com os ajustes manuais de sombra/chão.

Fontes locais incorporadas em scripts base64 mantêm exportação sem buscar as fontes remotas indicadas nos arquivos `*-source.css`. `html-to-image.js` é biblioteca vendorizada. Esses payloads e binários não são código autoral revisado linha a linha.

## Vídeo e legendas

Atualização posterior à leitura inicial: a composição de legendas foi alterada. O contrato atual está em [Legendas editoriais do vídeo](17-legendas-editoriais.md): até seis palavras em duas linhas, corpo branco em maiúsculas, entrada por palavra e destaque serifado opcional. Nome, informações e valor permanecem nas tarjas até o fechamento da cena do veículo. O inventário/hash da leitura inicial representa a versão anterior desses arquivos.

Whisper `large-v3-turbo` roda em CPU/int8, com português, VAD e timestamps por palavra; o primeiro uso pode baixar o modelo. Correções lexicais usam dados do veículo e `correcoes.txt`. Frases, grupos e escolha visual são heurísticos e determinísticos, com limites de pausa, largura e quantidade de palavras; não dependem de uma API de linguagem.

As famílias de animação das legendas incluem blur, subida, revelar, deslize, acende, cascata, pop e zoom; contexto e intensidade variam por trecho. Tarjas são um módulo separado, com deslize, alternada, subida e descida. Variáveis de ambiente de tarjas são opções técnicas, não campos da interface.

O render exige um único bruto e busca ASSETS perto dele, com fallback para recursos do aplicativo. Não presumir que toda distribuição contenha trilha. A saída usa `VIDEO_` e uma parte do nome da pasta, que pode ser a marca. Voz ganha volume; trilha fica reduzida; fechamento acrescenta duração ao vídeo. O final usa HEVC/QSV com fallback libx265 e áudio AAC; versão leve usa H.264. Arquivos parciais só substituem o destino depois das verificações.

O cache de transcrição em `.soul_tmp` depende do mtime do bruto e é removido após sucesso. Progresso/ETA são estimativas extraídas do texto do processo, não medidas de qualidade. Presença do final não garante que a versão leve também tenha sido produzida.

## Testes, CI e limites da verificação

| Camada | Cobertura existente e limites |
|---|---|
| Vitest | Validação IPC, repositórios, migração, arquivos, importação, BNDV, anúncios, Instagram, CRM, relatórios, planilhas e helpers. Muitos serviços usam respostas simuladas; não comprova compatibilidade atual de serviços externos. |
| unittest Python | Documentos, OCR, equipamentos, planilhas, vídeo leve, legendas, 3D, licenças e UTF-8. Há testes condicionados a FFmpeg, Tesseract, dependências e fixtures externas. Skip não é aprovação daquele fluxo. |
| Smoke Electron | Usa build em `out`, dados temporários e motor local. Exercita app/editor/exportação e render 3D, inclusive dimensões de imagem; não é teste de toda a operação real da loja. |
| Smoke Instagram | Intercepta Instagram com HTML fixture para testar publicação, conta divergente, retomada parcial e falta de confirmação. Não publica em conta real nem garante seletores atuais do site. |
| CI Windows | Node 22; lint, tipos, formatação, testes, build e audit de alta severidade. Motor instala grupo documentos e FFmpeg; smokes são outro job. Dependabot verifica npm, uv e Actions. |

O smoke principal pode abrir a página remota do BNDV; não classificar toda a suíte como estritamente offline. Ele não realiza uma extração autenticada real completa. Saídas `docs/smoke*.json` são artefatos locais, não evidência de sucesso nesta revisão.

TS do main e renderer têm configurações separadas. JS/CSS públicos do editor e Python não recebem a mesma análise de tipos/lint do React. Avisos de hooks podem falhar no lint por `--max-warnings=0`. Não executar formatação ampla para uma alteração localizada sem revisar o diff.

Nesta atualização foram verificadas a documentação, as referências locais e a correspondência do inventário com os arquivos. Não foram executadas suítes funcionais, chamadas externas, instalação, publicação ou alteração dos dados da loja. Ler um teste permite explicar sua intenção; não permite afirmar que passou.

## Como continuar em outro chat

1. Ler AGENTS.md, contexto principal, este complemento e a documentação específica da tarefa.
2. Conferir `git status` e as versões dos arquivos no registro de cobertura; há mudanças locais anteriores à documentação.
3. Abrir os módulos envolvidos pelo inventário. Conferir o comportamento ativo no App/IPC, distinguindo helper existente de fluxo acessível ao usuário.
4. Preservar dados, convenções de pasta, IDs e migrações; fazer a alteração mínima e validar no nível correspondente.
5. Atualizar estes documentos quando mudar contrato, persistência, navegação, exportação ou dependência externa. O inventário e os hashes são fotografias desta revisão, não atualização automática.
