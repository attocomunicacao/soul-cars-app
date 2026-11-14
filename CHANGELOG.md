# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões em [SemVer](https://semver.org/lang/pt-BR/). Cada seção `## [x.y.z]` vira as notas da versão exibidas no Soul Cars Launcher.

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
