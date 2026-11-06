# Biblioteca contextual de legendas — V7

Contrato atual de 23/10/2026: **todas as legendas brancas, Lato Black, caixa alta e tamanho-base 120**, com glow branco discreto. As escolhas de cor laranja das versões anteriores foram removidas. O tamanho aprovado, as curvas suaves do SOUL Motion, a fala e as três tarjas foram preservados.

## Biblioteca

| Camada | Opções |
|---|---|
| Entradas | 12: blur, subida, deslize, zoom, pop, revelar, cascata, acende, descida, lateral, aproximar e recuar. |
| Saídas | 8: suave, dissolver, subir, descer, esquerda, direita, recuar e aproximar. |
| Composições | 6: linha, duas_linhas, pilha, escada, esquerda e direita. |

Entradas e saídas são escolhidas independentemente dentro das famílias do assunto. A saída não é mais o mesmo deslocamento em todos os trechos. As novas saídas usam a curva e o sistema de opacidade do motor existente; as durações de entrada e saída permanecem as do SOUL Motion.

As composições alteram quebra de linha e alinhamento, não a fonte ou seu peso. Pilha usa até três linhas na zona de leitura; escada desloca suavemente as linhas para lados opostos; esquerda/direita alinham as linhas dentro do mesmo bloco central. Cada palavra fica na posição calculada enquanto o trecho é revelado.

A composição também protege a leitura: conectores como “E”, “DE” e “COM” não viram linhas isoladas na pilha. Blocos curtos como “NA LOJA” podem permanecer na mesma linha, mesmo quando o padrão escolhido admite duas linhas. Essas adaptações preservam o tamanho e a ordem do texto.

## Formação das frases

[frases.py](../../apps/engine/video/phrases.py) separa a transcrição por pontuação e pausas maiores que 0,55 s. Dentro de cada cláusula, escolhe a partição de menor custo, considerando:

- blocos normalmente de até três palavras;
- até quatro quando há número/unidade;
- alvo temporal de 1,7 s, flexível para não quebrar uma expressão natural;
- penalização de palavras isoladas e de conectores deixados no fim do bloco;
- preservação de números com unidades e de locuções conhecidas, como “acabou de chegar”, “laudo cautelar”, “máscara negra” e “retrovisor elétrico”;
- largura medida em Lato Black, priorizando outra quebra antes de reduzir a fonte para caber.

O motor não resume, inventa ou reescreve a fala. Cada palavra mantém seu timestamp e sua ordem. O uso de locuções é uma heurística local em português, não uma análise gramatical completa ou um LLM. O tamanho-base não muda conforme o assunto; o mecanismo anterior de segurança para palavras isoladas excepcionalmente longas continua existindo.

### Expressões numéricas e moeda

Antes das quebras, `expressoes.py` recompõe valores monetários fragmentados pela transcrição: `R` + `$49.900,00`, `R$` + `49.900,00` ou os separadores em tokens individuais viram `R$49.900,00`. O valor passa a ser um único item de texto e animação, usando o início do primeiro fragmento e o fim do último, com pontuação final preservada. A regra exige um símbolo explícito e proximidade temporal; não inventa preços, não converte números por extenso e não junta números independentes sem separadores.

Número e unidade (`62 mil reais`, `150 cv`, `10 %`, `64 mil quilômetros`) ficam no mesmo bloco e na mesma linha. Se a expressão inteira exceder a largura disponível, o compositor reduz o bloco em vez de separar a unidade. Os demais termos conservam seus timestamps individuais.

## Contexto e diversidade

[contexto.py](../../apps/engine/video/speech_context.py) classifica cada bloco curto, em vez de impor o assunto da frase longa inteira. Quando o bloco não tem pista lexical, consulta também os blocos vizinhos da mesma frase. Assim “e também tem” pode continuar uma sequência de equipamentos; um preço distante não transforma toda a apresentação em uma frase sobre preço.

As famílias de abertura, descrição neutra, especificação, equipamento, condição, ano/km, preço e chamada restringem as opções. O ritmo em palavras por segundo também interfere: fala rápida usa composições simples; uma palavra isolada usa linha; quatro palavras não usam pilha. Informações técnicas favorecem alinhamentos laterais, equipamentos permitem escada e chamadas podem usar pilha.

O seletor evita repetir a entrada anterior e tenta evitar a de dois blocos atrás. Também evita a saída anterior e, quando possível, a composição anterior. Uma assinatura fixa de veículo/trecho resolve as variações dentro das opções permitidas: repetir o mesmo render com os mesmos dados não gera uma montagem aleatória diferente.

O plano devolve `animacao`, `saida`, `composicao`, `ritmo`, `assunto`, `assunto_frase` e `criterio`, além das palavras e campos anteriores. Depois de medir o texto, o compositor registra `composicao_efetiva`: uma linha muito larga vira duas linhas antes de tentar reduzir o corpo. O log de plano mostra a composição efetivamente usada.

`destaque` permanece como pista semântica de importância para o planejamento; não altera cor, fonte ou tamanho das letras.

## Integração

- [legendas.py](../../apps/engine/video/captions.py): liga agrupamento, contexto, composição e saída ASS; usa branco em texto/glow.
- [composicao.py](../../apps/engine/video/composition.py): catálogo `PADROES`, medição e posições estáveis, com verificação de largura no tamanho aprovado.
- [motion/presets.py](../../apps/engine/video/motion/presets.py): catálogos `PRESETS` e `SAIDAS`; `gerar(..., saida_nome="subir")` controla a saída sem duplicar curvas.
- [motion/modelo.py](../../apps/engine/video/motion/model.py): continua responsável pelo relógio e pelas fases entrada/repouso/saída.
- [test_legendas.py](../../apps/engine/tests/test_captions.py) e [test_motion.py](../../apps/engine/tests/test_motion.py): preservação de palavras/tempos, locuções, cores, tamanho, margens, diversidade e combinações de entrada/saída.

Não foi adicionado serviço pago, modelo externo ou dependência. A classificação é determinística e roda localmente. As curvas e os parâmetros de suavidade do núcleo não foram substituídos.

## Prévia e verificação

A V7 usa os mesmos 30 segundos e 69 palavras do Fiat Argo, em 1080×1920/60 fps. O plano pode ser inspecionado em `.tmp/previa-carro-real/plano.txt`. O material original em dados-loja é somente lido; os arquivos gerados ficam na pasta de prévia.

Os testes incluem todas as famílias de entrada em três intensidades no FFmpeg, estados finais das oito saídas, diversidade por contexto, ausência de cores diferentes de branco no ASS, layouts dentro da zona útil e tamanhos uniformes. Comparar visualmente com V6 é necessário para avaliar a preferência editorial; os testes numéricos não substituem essa avaliação.
