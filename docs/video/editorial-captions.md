# Legendas editoriais do vídeo

Tipografia atual: [Lato Black + Lora SemiBold Italic, com glow branco/laranja](typography-and-glow.md). Destaque em tamanho-base 84, corpo em 90, sem sombra preta. Referências abaixo à tipografia anterior são históricas.

Evolução atual: [SOUL Motion](soul-motion.md). As curvas e os tempos agora pertencem ao motor interno `engine/video/motion/`, usado por legendas e tarjas. O destaque laranja foi reduzido de 126 para 100; corpo branco permanece em 90.

Atualização de 23/10/2026, inspirada no vídeo de referência fornecido pelo usuário: texto branco em negrito, contraste com serifado itálico laranja, composição compacta em duas linhas e revelação acompanhando a fala. Não reproduz os elementos gráficos, cortes de câmera ou conteúdo do vídeo de referência.

## Comportamento

- Blocos com até seis palavras, procurando limitar a duração a 2,4 segundos; pontuação e pausas continuam delimitando os grupos. Unidades como mil/reais podem estender o tempo do bloco dentro do limite de palavras. A última palavra isolada é rebalanceada quando não há pausa/pontuação impedindo a junção.
- Palavras aparecem pelo timestamp do Whisper, com antecipação máxima de 20 ms, e permanecem até a saída do bloco. Não se revela a frase inteira antes de ser falada. Tempos de fala e ordem das palavras são preservados.
- Texto branco em MAIÚSCULAS; o destaque laranja mantém a caixa da transcrição. Caracteres que poderiam introduzir comandos ASS são neutralizados.
- A geometria é calculada para o bloco completo; as palavras não mudam de lugar a cada nova entrada. Até duas linhas, cortes contíguos e redução proporcional para textos extensos. Medidas da fonte são convertidas de Pillow para ASS para evitar folgas artificiais. Espaço de composição de 24 px entre palavras, entrelinhas de 96 px e reserva lateral de 4 px por palavra em 1080p; a redução proporcional também afeta esses espaços.
- Corpo Lato Black branco, destaque laranja SOUL. O destaque usa Georgia Bold Italic quando essa fonte existe no Windows. Sem ela, usa a Lato empacotada, sem download nem dependência adicional. A fonte do Windows só é copiada para a pasta de trabalho do render local; não foi adicionada ao instalador.
- Entradas suaves de 380–480 ms conforme preset e destaque, com deslocamento reduzido. Em trechos curtos, o motion comprime entrada e saída e preserva 20% do tempo para repouso antes de desaparecer.
- Sombra desfocada em camada independente e sem contorno. O bloco continua na região de y=1400 da composição 1080×1920.

As famílias semânticas do motor de contexto continuam decidindo destaque/intensidade/direção. Os oito nomes de animação agora são presets próprios do SOUL Motion; o ritmo vem dos timestamps, sem temporizadores de palavras reiniciados pelos segmentos da animação. A mesma entrada de dados continua produzindo a mesma composição.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| [composicao.py](../../apps/engine/video/composition.py) | Fonte editorial opcional, texto literal, medidas, quebra em duas linhas, escala e posições. |
| [legendas.py](../../apps/engine/video/captions.py) | Grupos, curvas, tempos por palavra, sombras e serialização ASS. |
| [contexto.py](../../apps/engine/video/speech_context.py) | Classificação local da fala e plano de destaque/animações; lógica preservada. |
| [render.py](../../apps/engine/video/render.py) | Integração com o vídeo e preparação das fontes usadas pelo FFmpeg. |
| [test_legendas.py](../../apps/engine/tests/test_captions.py) | Geometria, fallback, texto literal, relógios, durações curtas e render ASS real. |

As três tarjas — nome, informações e valor — permanecem durante a cena do veículo. Sua saída começa apenas nos últimos 420 ms, com pequeno intervalo entre elas, e termina no fechamento da cena, antes do cartão final. As animações de entrada das legendas e tarjas foram preservadas nesta revisão de espaçamento. Trilha, codificação e cartão final mantêm seu fluxo anterior. A mudança afeta vídeos renderizados novamente; não reedita arquivos finais existentes. Não usa serviços de IA pagos.

## Verificação

Os testes específicos exercitam as oito famílias de animação nas três intensidades com FFmpeg/libass, além de verificar ordem, margens, texto extenso, fallback de fonte, ausência de fala e sincronização individual. A prévia tipográfica local usa transcrição e tempos simulados: demonstra o estilo, mas não mede a precisão do Whisper em um vídeo real de veículo.

Para validar o motor completo, executar `npm run test:engine`. Caso o cache do uv esteja indisponível, a descoberta unittest pode ser executada com o Python do ambiente já instalado, registrando que não houve sincronização das dependências.
