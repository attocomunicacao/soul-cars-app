# Tipografia e glow das legendas

**Atualização V7:** [biblioteca contextual de legendas](contextual-caption-library.md). Todas as palavras agora são brancas, com glow branco. Lato Black e tamanho-base 120 foram mantidos; destaque laranja e diferenças de cor foram removidos. As referências a cores e versões anteriores abaixo são históricas.

**Contrato atual V6:** Lato Black em todas as palavras, tamanho-base 120, sem itálico, peso e caixa alta uniformes. Destaques continuam laranja; a diferença tipográfica entre branco e laranja foi removida. O glow acompanha a cor de cada palavra. Frases curtas, motion e três tarjas são preservados. As seções de pesquisa e escolha de Lora abaixo registram a etapa anterior V4/V5; não descrevem a seleção ativa do render V6.

Contrato atual de 23/10/2026. Substitui a escolha anterior de Georgia e a sombra preta nas legendas. O [SOUL Motion](soul-motion.md), o ritmo da fala e as três tarjas continuam ativos. Revisão V5: fontes ampliadas e blocos mais curtos.

## Pesquisa e escolha

O [guia de pares tipográficos do Google Fonts](https://github.com/google/fonts/blob/main/cc-by-sa/knowledge/modules/choosing_type/lessons/pairing_typefaces_based_on_their_construction_using_the_font_matrix/content.md) propõe avaliar construção, contraste, serifa, proporções e peso em uso. Não há uma regra que torne um par automaticamente correto.

Escolha de composição para este projeto:

- **[Lato Black](https://fonts.google.com/specimen/Lato)** no texto principal branco, em maiúsculas. Mantém a fonte já aprovada e dá uma base visual firme para leitura rápida. A [descrição oficial](https://raw.githubusercontent.com/google/fonts/main/ofl/lato/DESCRIPTION.en_us.html) destaca suas proporções clássicas e detalhes semiarredondados.
- **[Lora SemiBold Italic](https://fonts.google.com/specimen/Lora)** no destaque laranja. A [descrição oficial](https://raw.githubusercontent.com/google/fonts/main/ofl/lora/DESCRIPTION.en_us.html) caracteriza Lora como serifada contemporânea, com raízes caligráficas, contraste moderado e otimização para tela. O itálico real e o peso 600 criam a diferença de desenho; o destaque não precisa ser maior para se diferenciar.

Essa combinação é uma decisão de design do SOUL, não uma recomendação específica de par publicada pelo Google. Os nomes consultados e os arquivos originais pertencem ao catálogo/projeto de origem; não foram geradas fontes modificadas.

## Composição atual

Tamanho-base único: 120, tanto no branco quanto no laranja. Na execução, o bloco pode ser reduzido proporcionalmente para caber na largura útil; a mesma escala é aplicada a todas as palavras, preservando a igualdade de tamanho. Esse número não é a altura visível dos glifos.

Blocos usam até três palavras e duração-alvo de 1,55 s, permitindo até quatro palavras para preservar números/unidades. Por exemplo, “Por apenas 62 mil reais” vira “POR APENAS” e “62 MIL REAIS”, preservando os timestamps. Pontuação encerra o bloco; uma conjunção/preposição no final pode estender o alvo temporal para completar a expressão. Palavras isoladas são rebalanceadas quando não há pontuação, pausa ou unidade impedindo a junção.

A composição mede a largura real de Lato Black, converte as métricas de Pillow para ASS, preserva a ordem da leitura e mantém no máximo duas linhas. Branco e laranja em caixa alta. Espaçamento compacto e posição fixa durante a revelação continuam funcionando.

O render atual prepara somente Lato Black. Lora não é mais selecionada nem copiada para novos diretórios de fontes de renderização. O recurso original e sua licença permanecem no repositório como parte da etapa anterior.

Origem, commit, hash e licença estão em [Lora-ORIGEM.md](../../apps/engine/video/assets/Lora-ORIGIN.md). A licença SIL OFL original acompanha o recurso e consta do gerador de avisos de terceiros; o instalador inclui os arquivos pelo glob de recursos do engine.

## Glow sutil da mesma cor

- Sem sombra preta ou contorno nas legendas.
- Uma camada `Glow` atrás da camada `Leg`, com a mesma fonte, tamanho, posição, escala, tempos e cor de cada palavra.
- Branco recebe glow branco; laranja recebe glow laranja. A cor é aplicada pelo compositor da legenda, não pelo núcleo numérico de motion.
- Opacidade máxima do glow: 16%; blur-base: 5 px na resolução ASS 1080×1920. A opacidade acompanha entrada e saída do texto; o blur animado é somado ao blur-base.
- Sem deslocamento da camada de brilho e sem múltiplos halos. O texto principal continua legível e definido acima dela.

O adaptador ASS mantém suporte opcional a sombra para outros usos, mas a legenda utiliza apenas glow. Pedir sombra e glow na mesma camada gera erro, evitando uma mistura acidental dos efeitos.

## Verificação

Testes verificam fonte e tamanho iguais para todas as palavras, ausência de itálico, glow com tempos/posição/cor iguais aos do texto e ausência de estilo de sombra preta no ASS gerado. Os testes com FFmpeg/libass continuam queimando as oito famílias de motion nas três intensidades.

A prévia V6 usa os mesmos 30 segundos, áudio e transcrição do Fiat Argo, em 1080×1920/60 fps. Os arquivos originais da loja permanecem intactos.
