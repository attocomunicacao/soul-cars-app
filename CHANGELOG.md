# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões em [SemVer](https://semver.org/lang/pt-BR/). Cada seção `## [x.y.z]` vira as notas da versão exibidas no Soul Cars Launcher.

## [Unreleased]

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
