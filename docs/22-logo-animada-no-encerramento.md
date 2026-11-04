# Logo animada no encerramento — V12

O cartão final conserva os cinco segundos e a arte original da Soul Cars. `engine/video/animacao_logo.py` monta o grafo do encerramento; `render.py` usa esse grafo antes de concatenar a cena do veículo e o cartão.

A logo entra em fade de 600 ms e amplia suavemente de 94% a 100% nos primeiros 950 ms. Em seguida cresce lentamente até 103%, mantendo o centro fixo e sem oscilar. Nos últimos 450 ms, desaparece para o mesmo fundo escuro `#191919`. Não há rotação, deslocamento lateral ou repetição do movimento.

As curvas são cúbicas com velocidade nula nos extremos. O redimensionamento é calculado por quadro em canvas fixo, com `perspective` e interpolação cúbica subpixel do FFmpeg. Isso preserva o aspecto e evita saltos de um pixel. A imagem de origem, inclusive logos alternativas em `ASSETS/LOGO_SOUL.jpg`, permanece intacta. O relógio começa em zero no cartão; o áudio mantém o fluxo anterior e seu fade final.

O teste `engine/tests/test_animacao_logo.py` renderiza cinco quadros reais de uma marca sintética e verifica fade de entrada/saída, crescimento limitado e centro fixo. O teste de render completo em `test_tarjas_layout.py` continua verificando a duração total da cena com áudio e cartão.

Avaliação completa: `.tmp/avaliacao-argo-completo/ARGO_COMPLETO_V12_LOGO_ANIMADA.mp4`. Preserva as tarjas de largura uniforme da V11, crescimento contínuo de até 5%, glow animado no preço e as legendas existentes. Versões anteriores e bruto do estoque são preservados.
