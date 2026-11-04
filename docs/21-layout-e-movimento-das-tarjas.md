# Tarjas: margens, limites e movimento contínuo

Atualização de 23/10/2026. Complementa os documentos 18 e 20.

## Revisão V11: largura única e centralização (contrato atual)

As três tarjas usam a largura da maior delas, calculada depois da adaptação de fontes e nomes extensos. Nome, informações e valor ficam com as mesmas bordas laterais, centralizados no vídeo. `uniformizar_larguras` expande somente o fundo das tarjas menores e centraliza a imagem original, sem esticar ou aumentar letras. Diferenças de paridade entre larguras inteiras podem produzir meio pixel de diferença no centro da tinta.

A máscara do glow do preço recebe exatamente o mesmo deslocamento horizontal do texto. Depois da uniformização, aplica-se o halo externo e monta-se o conjunto. Mantêm-se o limite lateral, os 32 px de margem vertical, o intervalo de 8 px, o crescimento contínuo de até 5% e o glow animado da V10. As margens horizontais das tarjas menores aumentam simetricamente para acompanhar a maior; não são mais necessariamente de 32 px.

O teste de layout verifica textos com diferentes larguras, inclusive quando informações ou preço ultrapassam o nome: fundos iguais, centro da tinta e máscara do glow alinhados. Avaliação atual: `.tmp/avaliacao-argo-completo/ARGO_COMPLETO_V11_TARJAS_ALINHADAS.mp4`.

O grafo de composição usa dois workers de filtro (`-filter_complex_threads 2`) para limitar a concorrência das camadas transparentes durante a renderização.

## Revisão V10: crescimento contínuo e glow no preço (preservados na V11)

Substitui o ciclo da V9: o conjunto cresce uma única vez de 100% a 105%, da última entrada até o início da saída final. A interpolação cúbica monotônica suaviza os extremos; a escala não volta a 100% nem repete ciclos. Mantém centro fixo, interpolação subpixel e os espaçamentos proporcionais. A largura máxima do corpo, calculada com reserva para halo e zoom, agora é 874 px.

Além do halo externo discreto existente, as letras do preço recebem glow branco animado: máscara da própria tipografia, blur de 5 px, alfa máximo de 55%, modulada suavemente entre 25% e 100% dessa intensidade num ciclo de cinco segundos. O texto original continua opaco e intacto. O filtro altera apenas o alfa da camada de brilho; o fundo laranja não pulsa. A máscara acompanha exatamente entrada, saída e escala da tarja do valor. Não é aplicada às demais tarjas nem às legendas.

`tarja_png(..., glow_out=...)` exporta a máscara com as mesmas medidas, redução de fonte e reticências do preço. Ela entra no FFmpeg antes do logo/trilha; os índices desses inputs consideram a camada extra. Os testes verificam monotonicidade, teto de 5%, escala real de 500 para 525 px, centro fixo, transparência, variação do glow nos pixels e o fechamento completo com cartão final.

Avaliação atual: `.tmp/avaliacao-argo-completo/ARGO_COMPLETO_V10_ZOOM_CONTINUO.mp4`, preservando V8 e V9 e o vídeo bruto original.

## Histórico V9: escala e glow (substituído pela V10)

O usuário rejeitou a flutuação lateral/vertical da V8. Durante a permanência, o conjunto inteiro agora aumenta de 100% a 106% e retorna, num ciclo de dez segundos. O centro permanece fixo. A curva cossenoidal desacelera nos extremos; o envelope cúbico conecta o ciclo às entradas e saídas existentes. O movimento não altera a filmagem nem as legendas.

A escala é aplicada ao conjunto em canvas transparente fixo, usando `perspective` do FFmpeg com interpolação cúbica subpixel. Evita o salto de um pixel causado por redimensionar largura/altura inteiras a cada quadro. As margens, espaços e fontes das três tarjas escalam juntos. Há uma borda transparente de 16 px com halo desfocado de raio 6 px e alfa máximo 36/255; branco nas duas primeiras tarjas, laranja na de preço. O glow é constante e discreto, sem piscar.

O limite do corpo da tarja passa a 866 px: reserva 64 px laterais mesmo considerando o halo e o pico de escala. O padding interno segue em 32 px, o espaço entre blocos em 8 px e os nomes longos continuam reduzindo a fonte até 42 px antes das reticências.

A avaliação completa atual é `.tmp/avaliacao-argo-completo/ARGO_COMPLETO_V9_ESCALA_GLOW.mp4`. As versões anteriores são preservadas. Os testes verificam os limites da escala e, no FFmpeg real, a ampliação de 6%, centro fixo e preservação de transparência.

A cena composta é limitada explicitamente à duração do bruto antes do `concat`, com relógio reiniciado. Isso garante o fechamento do fluxo de camadas transparentes e a passagem ao cartão final. O teste de regressão gera um bruto sintético com áudio, executa o grafo real e confere os sete segundos finais (cena de dois segundos mais cartão de cinco).

Referências consultadas: [Material Design — duração e easing](https://m1.material.io/motion/duration-easing.html), [Adobe — Glow e efeitos de estilização](https://helpx.adobe.com/after-effects/desktop/apply-effects-and-animation-presets/list-of-effects/stylize-effects.html) e [FFmpeg — implementação de perspective](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_perspective.c). Os valores de 6%, dez segundos e intensidade do halo são decisões visuais deste projeto, não prescrições dessas fontes.

## Histórico V8 (superado pela revisão acima)

O renderizador mantém nome, informações e preço nas três tarjas. O topo do conjunto começa em 223 px. Cada imagem é medida pela tinta efetiva dos glifos, incluindo acentos e descendentes: as quatro margens internas têm 32 px. A altura acompanha o texto; o próximo bloco começa 8 px abaixo do anterior, sem sobreposição. As dimensões históricas em `TARJAS` não definem mais a altura final; a lista continua fornecendo fonte, cores e tempos de entrada.

A largura máxima é 936 px num vídeo de 1080 px. A fonte diminui apenas quando necessário, até 42 px; nomes excepcionais recebem reticências se ainda ultrapassarem o limite. As letras não são esticadas. Os 64 px mínimos de segurança lateral já consideram os 8 px de deslocamento durante a permanência. A entrada e a saída continuam atravessando as bordas intencionalmente.

`animacao_tarjas.flutuacao` gera um ciclo senoidal de 6,5 segundos, com amplitude horizontal de 8 px e vertical de 4 px. As três tarjas recebem o mesmo relógio e envelope, movimentando o conjunto sem alterar espaçamentos. O envelope cúbico acelera suavemente depois da última entrada e retorna a zero antes da primeira saída. As curvas existentes de entrada e saída são preservadas. A saída permanece nos últimos 420 ms da cena, com escalonamento; o cartão final continua separado.

Implementação: `engine/video/render.py` mede e posiciona as tarjas; `engine/video/animacao_tarjas.py` compõe o ciclo com as curvas do Soul Motion. Não há novas dependências. As legendas continuam brancas, Lato Black, tamanho-base 120 e com a biblioteca contextual anterior.

`engine/tests/test_tarjas_layout.py` verifica margens pelos pixels das imagens, acentos, preço, nomes muito extensos, área segura e continuidade/limites do ciclo. `test_legendas.py` exercita os quatro presets no FFmpeg real.

A avaliação completa fica em `.tmp/avaliacao-argo-completo/ARGO_COMPLETO_V8_TARJAS.mp4`, com 53,97 segundos, fala, trilha e cartão final. Usa o grafo real do motor com compressão H.264 para avaliação. A V7 permanece disponível. O bruto do estoque não é alterado.
