# Laboratório de testes da IA (Pré-atendimento)

Sistema para aperfeiçoar a IA com dados: cenários de clientes → execução pelo caminho real do atendimento → alertas automáticos → avaliação humana → relatório → ajuste.

## Visão geral

```text
corpus (lab-corpus.ts) ─┐
histórico do uTalk ─────┼→ runner.ts → [ficha → prompt → modelo → posProcessar → guarda → avaliarTurno]
(anonimizado)           ┘                         │
                                                  ├→ tela Laboratório (nota, etiquetas, comentário)
                                                  └→ <raizDados>/lab-ia/ (execuções, avaliações, relatórios)
```

O Laboratório **nunca escreve no uTalk**. Ele usa a mesma persona, loja, respostas rápidas, estoque, exemplos (os ensinados e, com "usar histórico do CRM" ligado, os exemplos reais da equipe) e modelo (Groq ou Ollama) do atendimento real, e roda o mesmo pós-processamento (`shared/pre-service-pipeline.ts`) que o laço do app. A única diferença: no Laboratório a **reserva Ollama fica desligada**, para uma execução não misturar dois modelos. Cada turno mostra quem respondeu, os tokens gastos, quantos exemplos reais entraram e o tempo.

## Anti-duplicação

`shared/pre-service-guard.ts` é aplicado no pipeline, em `aprovar()` e na auditoria:

- remove frase repetida dentro da mesma resposta;
- remove frase (com 5+ palavras) já dita nas últimas 5 respostas da IA, igual ou quase igual (Jaccard ≥ 0,85);
- remove palavra em dobro ("de de"), espaços e pontuação repetidos;
- não reenvia a lista completa de carros se ela foi enviada há pouco;
- detecta CPF em claro na resposta.

No laço, resposta quase igual a uma das últimas é omitida (transferência e envio de fotos nunca são omitidos). `aprovar()` tem trava contra clique duplo e o estado (`vistoAte`, histórico) é gravado a cada chat atendido.

Sinais novos na Auditoria: `quase-repetida`, `frase-duplicada`, `palavra-repetida`, `cpf-em-claro`, `texto-sujo`.

## Ciclo rápido (recomendado)

O modelo acerta a maior parte; o trabalho é corrigir poucos erros sem regressão. Com ~2,5 mil tokens por resposta, o plano grátis do Groq (~8 mil tokens/min e ~200 mil/dia; confira no painel do Groq) dá **~80 respostas por dia**. O corpus inteiro (~1.000 cenários) não cabe num dia: rode pouco e certeiro.

1. **Cenários da auditoria**: transforma os turnos do atendimento real que tiveram alerta em cenários (categoria `auditoria`, anonimizados, em `<raizDados>/lab-ia/cenarios-auditoria.json`). **Rodar erros reais** roda só esses.
2. Corrija (skill `/ia-ciclo`).
3. **Rodar só as falhas**: repete só os cenários da execução aberta com falha automática ou nota até 3.
4. **Conjunto rápido** (`CONJUNTO_RAPIDO` em `shared/lab-corpus.ts`, ~28 cenários): confere que nada que passava quebrou.

A tela estima chamadas e tokens antes de rodar. Se o Groq avisar limite por minuto, o Laboratório espera 20 s e tenta de novo (até 3 vezes); no limite diário, a execução para e guarda o que já rodou ("interrompida").

## Usar o Laboratório (no app)

Pré-atendimento IA → aba **Laboratório**.

1. **Sincronizar histórico** (opcional, uma vez): baixa todas as conversas do uTalk para `soul-ia.db` (precisa do token do uTalk, aba 02 · CRM). **Analisar histórico** gera `<raizDados>/lab-ia/analise-historico.md/.json` e cenários novos (categoria `historico`). Textos anonimizados: CPF, datas, telefones, e-mails e links removidos; só aparece o que se repete 3+ vezes.
2. Escolha a **categoria** e as **repetições** (mede variação do modelo) e clique em **Rodar**.
3. Veja cada turno: mensagem do cliente → resposta da IA → alertas automáticos. Em **Avaliar esta resposta** dê nota (1–5), marque o tipo de erro e comente.
4. **Gerar relatório (com notas)** e cole no chat. Use a skill `/ia-ciclo` (erros pontuais) ou `/ia-lab` (relatório completo) para transformar as notas em correções.

## Cenários

- Lista completa: [`lab-cenarios.md`](lab-cenarios.md) (gerada; não editar à mão).
- Fonte: `apps/desktop/src/shared/lab-corpus.ts`. Atualizar a lista: `npm run lab:corpus`.
- Como acrescentar: skill `/ia-corpus`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run lab:ai:offline` | Corpus inteiro sem modelo (respostas roteirizadas): falha = bug do pipeline. Roda também no CI via `npm test` |
| `npm run lab:corpus` | Regenera `docs/ai/lab-cenarios.md` |
| `npm run eval:ai` / `eval:ai:groq` | Evals do modelo (promptfoo fixado em `0.125.1`, devDependency) |

## Dados e privacidade

`<raizDados>/lab-ia/` (execuções, `avaliacoes.jsonl`, relatórios, análise do histórico) fica fora do git (`lab-ia/` no `.gitignore`). Não copie conversas reais para testes, prompts ou commits.
