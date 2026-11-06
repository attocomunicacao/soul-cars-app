# Validação da migração

## Atualização de 23/10/2026: seletores do smoke

O smoke foi adaptado à navegação atual: confirma a página Estoque pelo botão selecionado e pelo conteúdo da lista, sem depender do antigo `h1`; usa o botão “Voltar aos dados” do editor em vez da aba Instagram removida. A exportação dos quatro PNGs continua obrigatória e o plano é conferido pelo IPC real `instagram_plano`. A ficha sintética salva o ano antes da exportação para que cadastro e nomes dos arquivos usem a mesma identificação. O resultado agora inclui `png3D`, permitindo executar as verificações de resolução e de ausência do molde na imagem. Um sucesso remove o diagnóstico antigo de erro.

Validação repetida: TypeScript sem erros; Vitest com 214 testes aprovados e 2 ignorados; smoke geral aprovado no Electron real; smoke específico do Instagram aprovado em página local simulada; build main/preload/React concluído. As operações de disco e Electron foram executadas fora das restrições do sandbox, somente com fixtures e diretórios temporários. O aviso `Comando não disponível: sql_execute` é esperado no smoke: ele verifica que SQL arbitrário permanece bloqueado.

Evidências locais: `docs/smoke.json` e `docs/smoke-instagram.json`. As verificações históricas abaixo registram o estado de 09/10/2026.

## Verificação histórica

Verificações realizadas em 09/10/2026, Windows x64:

| Verificação | Resultado |
|---|---|
| TypeScript main/preload e React | Sem erros |
| Vitest | 34 testes passaram; 2 pulados por dependerem de arquivos externos |
| Python unittest | 29 casos, OK; 5 pulados por dependerem de documentos externos |
| Regressão DES.md | Mesmo formato da fixture anterior |
| OCR de equipamentos | 40/40 itens exatos na fixture |
| Núcleo novo | CSV com BOM/aspas, cadastro ativo, consignação, proteção de caminhos, troca de fotos e banco |
| Importação do banco legado | Snapshot inclui registros no WAL, mantém IDs/fotos e não altera origem nem substitui banco novo |
| Electron real | Preload, SQLite/IPC, Estoque inicial, relatório interno, painel/renomeação de fotos, confirmação de cópia, ficha no editor e exportação de PNG real com foto sintética |
| Fluxo de produção | Detecção de PDF com nome livre, prioridade DOC.pdf, anexo sem alterar origem e detecção de vídeo em PROJETO/VIDEO/raiz excluindo o vídeo final |
| Lucro por mês | Últimos 12 meses, meses sem vendas preenchidos com zero e navegação pelas setas testada no Electron |
| Instagram offline | Ordem 2 → 1 → 3, duas legendas, capa do Reels, conferência da conta, retomada sem duplicatas e histórico após interrupção |
| Editor e Instagram | Exportação real dos quatro PNGs com fotos sintéticas e abertura da nova etapa no Studio |
| Build | main, preload e React gerados por electron-vite |
| Instalação de dependências | Script executado pelo Git CMD; bibliotecas Python instaladas por uv |
| Distribuição | Instalador NSIS Windows x64; engine e recursos incluídos, sem .venv |

O smoke usa somente estoque/banco temporários. Não faz login no BNDV, não chama IA paga nem gera mídia com documentos reais. Os modelos de recorte, visão e transcrição serão baixados no primeiro uso das funções. A validação com credenciais reais do BNDV deve ser feita pelo usuário na janela de login.

O smoke do Instagram usa uma página local simulada e não acessa uma conta real. O fluxo com a interface atual do Instagram deve ser validado após o primeiro login do usuário; mudanças nas telas podem exigir ajustes dos seletores. A janela remota foi verificada sem acesso a Node ou à ponte do app.

A auditoria npm identificou problemas nas versões herdadas; Electron foi atualizado para 44.7.0 e Vitest para 5.0.3. Permanecem avisos moderados transitivos na ferramenta electron-builder (cadeia @electron/get/global-agent/roarr/sprintf-js). O npm audit fix não ofereceu correção compatível efetiva dessa cadeia; não foi aplicado override incompatível. Essas ferramentas não são incluídas como dependências Node do executável.

Para repetir, veja os comandos no README. Evidências de smoke e logs de instalação são geradas localmente e ignoradas pelo Git. O instalador foi gerado; a instalação sobre outros computadores não foi testada nesta sessão.
