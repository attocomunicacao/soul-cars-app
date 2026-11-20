---
name: ia-lab
description: Melhora a IA do Pré-atendimento a partir do Laboratório de testes. Use quando o usuário colar um relatório do Laboratório (notas, alertas, respostas ruins), pedir para "melhorar a IA", corrigir repetição/duplicação de texto, ou rodar e interpretar os testes automáticos da IA (lab:ai:offline, eval:ai).
---

# /ia-lab — do relatório de avaliações ao ajuste da IA

Objetivo: transformar notas e alertas do Laboratório em correções pequenas, testadas e sem regressão. Não leia o repositório inteiro. Para erros pontuais (uma conversa colada, alertas da auditoria), use o ciclo curto de `/ia-ciclo`. O plano grátis do Groq dá ~80 respostas por dia: valide com **Rodar só as falhas** e o **Conjunto rápido**, não com o corpus inteiro.

## Onde está cada peça

| Peça | Arquivo |
|---|---|
| Pós-processamento (texto final, transferência, pergunta do sistema) | `apps/desktop/src/shared/pre-service-pipeline.ts` |
| Guarda anti-duplicação, CPF em claro, palavra em dobro | `apps/desktop/src/shared/pre-service-guard.ts` |
| Sinais de auditoria | `apps/desktop/src/shared/pre-service-audit.ts` (`avaliarTurno`, `ROTULO_SINAL`) |
| Ficha, perguntas, CPF, datas, pedido de humano | `apps/desktop/src/shared/lead-profile.ts` |
| Prompt, persona, estoque, fotos | `apps/desktop/src/shared/pre-service.ts` |
| Executor do Laboratório (multi-turno, com estado) | `apps/desktop/src/main/lab/runner.ts` |
| Corpus de cenários | `apps/desktop/src/shared/lab-corpus.ts` (lista em `docs/ai/lab-cenarios.md`) |
| Análise do histórico do uTalk (anonimizada) | `apps/desktop/src/main/lab/history-analysis.ts` |
| Erros reais da auditoria → cenários (anonimizados) | `apps/desktop/src/main/lab/audit-scenarios.ts` |
| Conjunto rápido | `CONJUNTO_RAPIDO` em `apps/desktop/src/shared/lab-corpus.ts` |
| Tela | `renderer/src/pages/pre-service/lab/LabTab.tsx` |

## Passos

1. **Classifique cada nota baixa** pela etiqueta: `repeticao`, `pergunta-repetida`, `digitacao`, `contexto`, `dado-inventado`, `tom`, `longa-demais`, `nao-respondeu`, `regra-de-negocio`.
2. **Decida onde corrigir** (da camada mais barata para a mais cara):
   - erro determinístico (repetição, CPF, pergunta de novo, transferência) → corrigir em `pre-service-guard.ts`/`pre-service-pipeline.ts`/`lead-profile.ts`;
   - o modelo erra a regra de negócio → ajustar `PERSONA_PADRAO`/`REGRAS_DE_ENCAMINHAMENTO` em `shared/pre-service.ts` (lembre de `PERSONAS_ANTERIORES` para migrar quem usa a padrão);
   - o modelo só erra às vezes → caso novo em `tests/ai-evals/tests.yaml`.
3. **Escreva primeiro o teste que falha**: cenário em `lab-corpus.ts` (com `esperado`) e/ou teste em `tests/pre-service-guard.test.ts`. Depois a correção.
4. Rode `npm run lab:corpus` se mexeu no corpus (atualiza `docs/ai/lab-cenarios.md`).
5. Valide: `npm run lab:ai:offline`, `npm run lint && npm run typecheck && npm test`, e `npm run smoke` se tocou IPC. Use `npm run eval:ai` (Ollama) ou `eval:ai:groq` se mexeu no prompt.
6. Resuma ao usuário: o que mudou, quais notas isso resolve e quais ficaram para outra rodada.

## Regras

- O Laboratório nunca escreve no uTalk. Só `main/pre-service/utalk-writer.ts` escreve.
- Dados reais (histórico, CPF, telefone) não vão para o git, testes nem prompts. Cenários vindos do histórico só entram anonimizados (`anonimizar`) e com ocorrência mínima.
- Não afirme que um teste passou sem executá-lo.
