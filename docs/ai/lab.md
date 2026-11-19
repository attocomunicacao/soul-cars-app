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

O Laboratório **nunca escreve no uTalk**. Ele usa a mesma persona, loja, respostas rápidas, estoque e modelo (Groq ou Ollama) do atendimento real, e roda o mesmo pós-processamento (`shared/pre-service-pipeline.ts`) que o laço do app.

## Anti-duplicação

`shared/pre-service-guard.ts` é aplicado no pipeline, em `aprovar()` e na auditoria:

- remove frase repetida dentro da mesma resposta;
- remove frase (com 5+ palavras) já dita nas últimas 5 respostas da IA, igual ou quase igual (Jaccard ≥ 0,85);
- remove palavra em dobro ("de de"), espaços e pontuação repetidos;
- não reenvia a lista completa de carros se ela foi enviada há pouco;
- detecta CPF em claro na resposta.

No laço, resposta quase igual a uma das últimas é omitida (transferência e envio de fotos nunca são omitidos). `aprovar()` tem trava contra clique duplo e o estado (`vistoAte`, histórico) é gravado a cada chat atendido.

Sinais novos na Auditoria: `quase-repetida`, `frase-duplicada`, `palavra-repetida`, `cpf-em-claro`, `texto-sujo`.

## Usar o Laboratório (no app)

Pré-atendimento IA → aba **Laboratório**.

1. **Sincronizar histórico** (opcional, uma vez): baixa todas as conversas do uTalk para `soul-ia.db` (precisa do token do uTalk, aba 02 · CRM). **Analisar histórico** gera `<raizDados>/lab-ia/analise-historico.md/.json` e cenários novos (categoria `historico`). Textos anonimizados: CPF, datas, telefones, e-mails e links removidos; só aparece o que se repete 3+ vezes.
2. Escolha a **categoria** e as **repetições** (mede variação do modelo) e clique em **Rodar**.
3. Veja cada turno: mensagem do cliente → resposta da IA → alertas automáticos. Em **Avaliar esta resposta** dê nota (1–5), marque o tipo de erro e comente.
4. **Gerar relatório (com notas)** e cole no chat. Use a skill `/ia-lab` para transformar as notas em correções.

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
