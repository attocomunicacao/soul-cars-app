---
name: ia-ciclo
description: Ciclo rápido para corrigir os poucos pontos em que a IA do Pré-atendimento erra. Use quando o usuário colar uma conversa ou resposta errada da IA, disser que "a IA errou em X", pedir para "otimizar a IA" ou "corrigir rápido", ou quando a auditoria do atendimento mostrar alertas (prometeu consultor sem transferir, preço fora do estoque, repetição…).
---

# /ia-ciclo — do erro real à correção testada, sem gastar a cota do Groq

O modelo já responde bem na maioria dos casos. O objetivo é corrigir **poucos erros, com precisão** e sem regressão. Não rode o corpus inteiro: com ~2,5 mil tokens por resposta, o plano grátis do Groq (~8 mil tokens/min, ~200 mil/dia) dá **~80 respostas por dia**. A tela mostra os tokens reais de cada turno.

## 1. Juntar os erros (escolha a fonte)

- **O usuário colou a conversa:** use só as falas do cliente, trocando nomes, CPF, telefone e placa por dados fictícios (`CPF_TESTE` de `shared/lab-corpus.ts`).
- **Auditoria do app:** Laboratório → **Cenários da auditoria** cria a categoria `auditoria` em `<raizDados>/lab-ia/cenarios-auditoria.json`, já anonimizada e local. Para ver os sinais sem abrir textos, conte `turno.sinais` em `%APPDATA%\soul-cars-app\pre-atendimento-auditoria.jsonl`.
- **Relatório do Laboratório** colado no chat: siga as notas ≤ 3 e as falhas automáticas.

## 2. Classificar cada erro e escolher a camada (da mais barata para a mais cara)

| Erro | Onde corrigir |
|---|---|
| Repetição, CPF em claro, palavra em dobro, texto sujo | `shared/pre-service-guard.ts` |
| Transferência, pergunta do sistema, lista, fecho | `shared/pre-service-pipeline.ts`, `shared/lead-profile.ts` |
| Inventou preço/carro, horário errado | avisos em `shared/pre-service.ts` (`avisoDeEstoque`, `avisoDeHorario`, `avisoDeLink`) |
| Regra de negócio (consultor, visita, crédito, tom) | `REGRAS_DE_ENCAMINHAMENTO` em `shared/pre-service.ts` |
| Jeito de falar da loja | a persona do usuário fica em `pre-atendimento.json`; proponha o texto e deixe o usuário colar na tela (não edite o arquivo do usuário) |
| Erra só às vezes | caso em `tests/ai-evals/tests.yaml` |

Prefira regra determinística (código + teste) a mais texto no prompt: cada linha de prompt custa tokens em **todas** as respostas.

## 3. Teste primeiro

- Cada erro vira cenário **fictício** permanente em `shared/lab-corpus.ts`, com `esperado` (`transfere`, `contem`, `proibido`, `semSinais`). Veja `/ia-corpus`.
- Se for um padrão crítico, acrescente o id em `CONJUNTO_RAPIDO`.
- Para erro determinístico, faça o teste unitário falhar antes da correção.

## 4. Corrigir e validar sem modelo

`npm run lab:ai:offline` → `npm run lint && npm run typecheck && npm test`. Rode `npm run lab:corpus` se mexeu no corpus e `npm run smoke` se tocou IPC.

## 5. Validar com o modelo (o usuário clica no app, Pré-atendimento IA → Laboratório)

1. **Rodar só as falhas** da execução anterior, ou **Rodar erros reais**. Confirme que o erro sumiu.
2. **Conjunto rápido** (~28 cenários): confirme que nada que passava quebrou.
3. Só na rodada final, 2 repetições numa categoria específica, para medir variação.

Se a execução parar com "limite diário do Groq", o resto fica para o dia seguinte. Não troque de modelo no meio da comparação.

## 6. Resumo ao usuário

Diga quais erros sumiram, quantas falhas antes e depois (mesmo conjunto) e o que ficou. Sugira religar o atendimento com aprovação manual antes do envio automático.

## Regras

- O Laboratório nunca escreve no uTalk; só `main/pre-service/utalk-writer.ts` escreve.
- Conversas reais não vão para o git, os testes ou os commits. Os arquivos de `lab-ia/` ficam fora do git.
- Não afirme que um teste passou sem executá-lo. Não cite números de tokens sem olhar a execução.
