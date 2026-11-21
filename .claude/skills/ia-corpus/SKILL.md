---
name: ia-corpus
description: Acrescenta e valida cenários (frases, perguntas e situações de clientes) no corpus do Laboratório de testes da IA. Use quando o usuário pedir mais cenários, novas situações, frases de clientes, ou quando um erro da IA precisar virar caso de teste permanente.
---

# /ia-corpus — ampliar o corpus de testes da IA

O corpus fica em `apps/desktop/src/shared/lab-corpus.ts`. Tudo nele é **fictício**.

## Como acrescentar

- **Mensagem única:** na constante `UNICAS`, ache a categoria (ou crie uma) e acrescente a frase em `frases`. O `esperado` da categoria vale para todas (`transfere`, `contem`, `proibido`, `coleta`, `semSinais`).
- **Conversa de vários turnos:** acrescente um objeto em `FLUXOS` (`id` único, `categoria`, `titulo`, `turnos[]`, `esperado`).
- Variações (sem acento, com erro de digitação, com cumprimento, com emoji) são geradas sozinhas para frases simples (`variacoes()`), de forma determinística.

## Regras de dados

- CPF só os de teste: `CPF_TESTE` (529.982.247-25) e `CPF_TESTE_2` (111.444.777-35). CPF inválido só quando o objetivo é testar CPF inválido.
- Sem telefone, e-mail, nome ou placa reais. Estoque do laboratório: `ESTOQUE_LAB` em `main/lab/runner.ts`.
- Frases vindas do histórico real entram só anonimizadas e que se repetem (`history-analysis.ts`); nunca copie conversa real para o código.
- Erro de digitação de propósito só nas variações (ou marque o título). Sem espaço duplo nem palavra repetida por descuido (o teste do corpus pega).

## Passos

1. Edite `lab-corpus.ts`.
2. `npm run lab:corpus` (regenera `docs/ai/lab-cenarios.md`; o teste `lab-lista` falha se ficar desatualizado).
3. `npm run lab:ai:offline` (corpus inteiro sem modelo: qualquer falha é bug do pipeline) e `npm test`.
4. Se o cenário revelou bug, corrija com a skill `/ia-lab`.
