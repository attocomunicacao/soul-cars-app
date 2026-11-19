# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões em [SemVer](https://semver.org/lang/pt-BR/). Cada seção `## [x.y.z]` vira as notas da versão exibidas no Soul Cars Launcher.

## [1.0.22]

- **Laboratório de testes da IA** (Pré-atendimento IA › aba Laboratório): roda mais de 900 cenários (frases, perguntas e situações de clientes, inclusive conversas de vários turnos) pelo mesmo caminho do atendimento real, com o modelo configurado, e mostra a resposta da IA com alertas automáticos. Você dá nota de 1 a 5, marca o tipo de erro e exporta um relatório com as notas. Nada é enviado ao uTalk
- **Histórico do uTalk**: botão para sincronizar todas as conversas e gerar uma análise anonimizada (perguntas mais frequentes, respostas repetidas, dados pedidos de novo) que vira cenários de teste. Os dados ficam só neste computador
- Pré-atendimento IA: **fim das respostas duplicadas**. Frases repetidas dentro da mesma resposta, frases já ditas nas últimas respostas (iguais ou quase iguais), palavras em dobro, espaços e pontuação repetidos são removidos antes do envio; a lista completa de carros não é reenviada logo em seguida; resposta quase igual às últimas é omitida
- Pré-atendimento IA: aprovar um rascunho não envia duas vezes com clique duplo e o texto editado passa pelo mesmo filtro; o estado do atendimento é gravado a cada conversa (evita resposta repetida se o app fechar no meio)
- Pré-atendimento IA: novos alertas na Auditoria (resposta quase repetida, frase duplicada, palavra repetida, CPF escrito na resposta, texto com espaços/pontuação duplicados) e pedidos como "chama um atendente", "passa pro gerente" e "alguém de verdade" agora passam o lead para a equipe

## [1.0.21]

- Pré-atendimento IA: a IA passa a ler a **quilometragem e o valor do DES.md** da pasta de cada carro (o valor do DES.md vale mais que o do BNDV, que vem zerado em vários carros) e informa o km ao cliente. Carros sem DES.md continuam sem km: nesse caso a IA encaminha para a equipe em vez de prometer
- Pré-atendimento IA: regras fixas de encaminhamento. A IA não calcula parcela, taxa, troca nem desconto e não inventa km ou laudo: o que ela não sabe fica para o consultor confirmar na ligação, e ela nunca promete "vou confirmar" nem oferece simular parcelas
- Pré-atendimento IA: cumprimento sozinho ("oi") é respondido como cumprimento, e a IA não termina toda mensagem oferecendo visita ou ligação. Quem usava a persona padrão antiga recebe a nova automaticamente; personas editadas à mão não mudam
- Pré-atendimento IA: recolocar a etiqueta de gatilho no uTalk num lead que estava com a equipe devolve o lead à IA sozinho (antes só o botão "Devolver à IA" funcionava). Quem pediu para não receber mensagens continua só voltando pelo botão
- Pré-atendimento IA: **ficha do lead**. A IA guarda o que o cliente já contou (carro, região, forma de aquisição, entrada, CPF, nascimento, CNH, troca e melhor horário para a ligação), mesmo depois das últimas 12 mensagens, e não repete perguntas
- **Qualificação antes do SDR**: a IA entende a situação do cliente **uma pergunta por mensagem**: carro de interesse, região, como pretende adquirir (à vista, financiado, cartão ou veículo na troca) e, se for financiar, CPF, data de nascimento, CNH e entrada, um de cada vez (a primeira explica "Consigo fazer uma análise de crédito pra você…"). Depois tenta combinar uma **ligação** (melhor dia e horário). A IA não agenda nem oferece visita: o consultor marca a visita depois da ligação
- Qualificação: **quem faz a pergunta é o sistema**, não o modelo. A IA responde a dúvida do cliente e o app acrescenta a próxima pergunta, sempre na ordem certa. Acabou o loop de CPF e data de nascimento, e a IA não repete o que o cliente já respondeu
- O **carro de interesse** vem antes de qualquer outra pergunta (a IA não pergunta a região antes de saber o carro), e o carro, a região e a troca são lidos da mesma frase ("Yaris, falo da Zona Norte", "tenho um Gol 2015 na troca"; "a entrada é somente o Gol" vale como sem entrada). A IA não repete mais a frase do sistema, e a data de nascimento é mascarada mesmo quando o cliente a manda em mensagem separada do CPF. Se a IA promete que o consultor vai ligar e não há mais o que perguntar, a transferência é feita
- "Quais são todas as opções?" agora mostra **todos** os carros do estoque (a lista vem do sistema, com preço e km), e o estoque do prompt passa a considerar só o que o cliente disse. A IA não promete mais "um consultor vai te ligar agora" no meio das perguntas, não comenta a localização do cliente, o modelo só enxerga a conversa do ciclo atual (sem copiar respostas de atendimentos antigos) e uma resposta idêntica à anterior (cliente que manda a mesma mensagem duas vezes) não é reenviada. A data de nascimento também é lida por extenso ("15 de março de 1990") ou sem barras
- CPF digitado errado é mascarado do mesmo jeito (o Groq e a auditoria não o veem) e a IA pede só para conferir; "nenhum" e "só o carro na troca" valem como entrada. O carro da nota não troca mais por causa de uma palavra parecida ("somente" não vira Sorento). Ao devolver o lead à IA, a ficha começa do zero
- Análise de crédito: a IA explica que é feita pelo **nosso sistema**, com o **score** do cliente, sem falar em bancos nem em histórico. O texto padrão do financiamento da loja também foi atualizado (quem ainda usa o texto antigo recebe o novo)
- Quando o cliente pergunta **"para que meu CPF?"** ou "o que é análise de crédito?", a resposta da IA não é mais apagada: ela explica (nosso sistema, score) e só então repete a pergunta. Dúvidas do cliente não contam como pedido ignorado, então o CPF não é mais pulado sem o cliente recusar; "ok", "sim" e "depois" não valem como região, e a IA confirma com "Anotado!" quando o modelo não responde nada
- **Nota do cliente**: toda vez que a IA transfere, ela cria uma **nota privada** no chat do uTalk (o cliente não vê) com tudo o que coletou, o que faltou e o motivo da transferência; a mesma nota aparece no painel (Visão geral › Ficha do lead). Se o cliente pedir para falar com alguém ou recusar passar os dados, a IA transfere na hora; item perguntado 3 vezes sem o cliente dar nada do assunto é dispensado
- Privacidade: CPF e data de nascimento são mascarados antes de ir ao Groq, ao histórico e à auditoria e ficam só na ficha, **cifrados** no computador. A apresentação da IA ("Aqui é a Sofia…") aparece só na primeira mensagem
- Auditoria: novos alertas (financiamento sem pedir os dados, transferiu antes de coletar, ofereceu agendar visita, ofereceu simular parcelas, perguntou de novo algo já respondido, repetiu a resposta anterior, perguntou a região antes do carro, deixou de pedir um dado sem o cliente recusar); corrigidos dois alertas falsos (valor que o próprio cliente digitou e pergunta "de qual carro são as fotos?")

## [1.0.20]

- Pré-atendimento IA: nova aba **Auditoria** com cada resposta da IA (o que o cliente escreveu, a resposta enviada, a saída bruta do modelo, provedor, tempo, estoque usado e desfecho: enviado, aprovado, descartado ou erro)
- Alertas automáticos: prometeu falar com a equipe sem transferir, preço fora do estoque, quantidade de carros diferente do estoque, pergunta de fechamento repetida, resposta longa, foto pedida sem fotos planejadas
- O registro fica só neste computador (telefone mascarado) e pode ser exportado em JSON

## [1.0.19]

- Pré-atendimento IA: só oferece os veículos em estoque no BNDV que têm fotos na pasta (a mesma regra da vitrine), e o envio de fotos volta a funcionar quando há dois carros do mesmo modelo em estoque
- Pré-atendimento IA: o preço de venda do BNDV volta a aparecer nas respostas

## [1.0.18]

- Pré-atendimento IA: quando o cliente pergunta quais carros estão disponíveis, a IA responde com a lista do estoque
- Pré-atendimento IA: "me encaminha as fotos" (e pedidos parecidos) envia as fotos do carro citado antes na conversa

## [1.0.17]

- Estoque: leitura das pastas mais tolerante a variações de nome de pasta e arquivo (fotos, vídeo e documento), com o DES.md de cada veículo como fonte de marca, modelo, versão, ano e preço
- Vitrine e envio de fotos do Pré-atendimento IA: só aparece o veículo em estoque no BNDV que tem fotos na pasta

## [1.0.16]

- Pré-atendimento IA no visual do app: interruptores nas Configurações, aviso no simulador vazio e dados da loja em duas colunas

## [1.0.15]

- **Pré-atendimento IA** (menu CRM): a IA atende pelo WhatsApp (uTalk) os leads com a etiqueta de gatilho, envia fotos do veículo das pastas do estoque (até 6 por pedido) e passa para a equipe quando o lead quer visitar ou falar com alguém
- Abas Visão geral, Aprovação (rascunhos antes de enviar), Ensinar (simulador; correções viram exemplos), Respostas-rápidas e persona, Loja e Configurações
- Usa o Groq (plano grátis, chave guardada cifrada) com o Ollama local como reserva. Vem **desligado**: ligue e escolha as etiquetas em Configurações do Pré-atendimento

## [1.0.14]

- Venda cancelada no BNDV: o veículo volta ao estoque no app (lista, vitrine, balanço, relatório e ficha da pasta) e a venda sai da receita e da margem. O BNDV continua listando a venda cancelada; o app agora confia no status do veículo ("Disponível estoque")
- O lembrete de pausar o anúncio não aparece mais para carro com venda cancelada

## [1.0.13]

- Meta Ads: quando a Meta bloqueia o acesso à API para o token ("API access blocked"), o app explica o que é e onde resolver, em vez de mostrar a mensagem técnica
- Mensagens de erro dos painéis sem o prefixo técnico do Electron
- Configurações › Conexões: a importação do Soul APP volta a mostrar a lista do que foi trazido, e o botão Testar mostra o resultado do teste

## [1.0.12]

- **Soul APP unificado no Soul Cars**: os painéis do Soul APP agora são páginas do app, no mesmo visual, e o Soul APP não precisa mais ficar aberto
- Menu em grupos: **CRM** (Leads e Atendimento), **Meta Ads** (Campanhas e Gerenciador) e **Funil** (Meta → CRM); os sites do uTalk e do Gerenciador continuam ao lado dos painéis
- **Leads**: Painel (totais, novos hoje, aguardando resposta, taxa de agendamento, leads por carro, funil por status, entrada por dia, desempenho por SDR e carro × status), Kanban por status, lista com CSV, Atividade (novos leads, etiquetas e troca de SDR) e detalhe do lead com WhatsApp; aviso no Windows quando chega lead novo
- **Campanhas (Meta Ads)**: saúde da conta, números comparados com o período anterior, gasto e custo por dia, funil do anúncio, posicionamentos, público por idade e gênero, campanhas com situação (Eficiente, Caro…) e alertas de custo e gasto
- **Funil Meta → CRM**: do anúncio ao agendamento com custo por etapa, diagnóstico, funil por produto e por campanha, leads de cada etapa e regras (papel das etiquetas, produto de cada campanha)
- **Configurações › Conexões**: token do uTalk e do Meta Ads (cifrados, só leitura), teste da conexão e **Importar do Soul APP** (tokens, organização, etiquetas, regras e a última leitura de leads, tudo no computador)

## [1.0.11]

- Launcher 1.0.8: corrige o erro "EPERM: operation not permitted, rename … .extraindo" ao atualizar. O próprio Launcher prendia o arquivo `app.asar` da versão nova e o Windows não deixava terminar a instalação
- Se o antivírus segurar a pasta por alguns segundos, o Launcher espera e tenta de novo em vez de falhar na hora

**Para receber:** no Launcher, clique primeiro em Atualizar Launcher e depois em Atualizar para v1.0.11.

## [1.0.10]

- Quilometragem: quando a ficha não tem km, o app traz a do BNDV (com o aviso "Trazida do BNDV") em vez de mostrar 0; campo vazio aparece como "Não informada"
- Gerar o DES.md sem quilometragem agora avisa antes, em vez de publicar "0 km rodados"
- "Ler documento e preencher ficha" funciona mesmo sem PDF na pasta: pede o arquivo do CRLV, anexa e já preenche a ficha; os botões explicam quando falta vincular a pasta

## [1.0.9]

- **Visual novo**, inspirado no design da Apple: fundo cinza-claro, cartões brancos, tipografia do sistema, botões em pílula e o bronze da marca só nas ações
- Menu lateral mais limpo, com ícones próprios (sem emojis) e sem a numeração "01 ·"
- Estoque: abas Lista · Vitrine · Relatório completo; a linha inteira abre a ficha; selos de fotos, vídeo e documento mais discretos; filtro "Só em estoque"
- Vitrine com foto grande, preço em destaque e ficha técnica resumida
- Ficha: cabeçalho fixo com voltar, etapas e Salvar ficha; trocar de etapa volta ao topo
- Configurações abrem numa janela própria (fecha no X, Esc ou clicando fora), com nomes de campos legíveis
- Publicação sem textos agora explica o que fazer e leva à ficha
- Avisos de erro podem ser fechados; CRM e Meta Ads mostram "Abrindo…" enquanto carregam
- Contraste dos textos secundários dentro do padrão de acessibilidade (WCAG AA)
- Launcher com o mesmo visual, seguindo o tema claro ou escuro do Windows

## [1.0.8]

- Nova aba 03 · Meta Ads no menu lateral: abre o Gerenciador de Anúncios dentro do app, com o login salvo

## [1.0.7]

- Atualizações do app passam a abrir na hora: o Launcher baixa só o código novo (poucos MB) e reaproveita o executável que o Windows já liberou, sem esperar a análise do Smart App Control
- O Launcher só oferece instalador novo quando ele próprio muda
- Se o pacote de código não puder ser usado, o Launcher instala o pacote completo, como antes

## [1.0.6]

- O CRM (Umbler Talk) volta ao menu lateral como 02 · CRM e abre dentro do app
- O menu lateral pode ser recolhido pelo botão « ao lado de SEU ESPAÇO DE TRABALHO: os textos viram ícones (» expande de novo) e a escolha fica guardada

## [1.0.5]

- Quando o Windows (Smart App Control) ainda bloqueia a versão nova, o Launcher abre a versão anterior que já funcionava e avisa
- O Launcher guarda sempre a última versão que abriu, para ter essa reserva mesmo depois de várias atualizações
- Instalação do motor Python não grava mais na pasta do app (usa o uv.lock como está)
- Política de privacidade publicada no site

## [1.0.4]

- O Launcher confirma que o Soul Cars abriu de verdade; se não abrir, explica o motivo em vez de não fazer nada
- Bloqueio do Smart App Control do Windows detectado e explicado, com o botão Como liberar
- O botão mostra ABRINDO… enquanto confere, e o Launcher só fecha depois que o app abriu
- Registro de diagnóstico em %LOCALAPPDATA%\SoulCars\logs\launcher.log

## [1.0.3]

- Menu lateral simplificado: fica só o 01 · Estoque (CRM, Leads e Soul IA, BNDV, Meta ADS e Finanças saem do painel)
- O login do BNDV continua pelo botão Atualizar BNDV, que abre a janela de login quando a sessão expira

## [1.0.2]

- Atualização do Launcher não falha mais com "ENOENT … rename": o botão fica desativado durante o download e pedidos repetidos compartilham um único download
- O instalador do Launcher só começa depois que o Launcher fecha, para conseguir substituir os arquivos
- Downloads mais resistentes ao antivírus (novas tentativas ao renomear o arquivo baixado)

## [1.0.1]

- Notas da versão no Launcher sem asteriscos: negrito e código aparecem formatados
- O manifesto grava as notas como texto simples (também corrige o Launcher 1.0.0 já instalado)

## [1.0.0]

- Novo **Soul Cars Launcher**: instala, atualiza e abre o Soul Cars com um clique
- Atualizações conferidas por SHA-256, instaladas lado a lado (a versão anterior fica guardada)
- O Launcher avisa e se atualiza sozinho quando há versão nova
- Estrutura reorganizada em `apps/launcher`, `apps/desktop` e `apps/engine`, com nomes em inglês
- Interface do estoque dividida em páginas e componentes próprios
- Motor Python organizado por domínio: documentos, ficha técnica, mídia, planilhas e vídeo
- Prints e modo de demonstração gerados com dados 100% fictícios
- Tailwind (não usado) removido; React empacotado no build (instalação menor)
