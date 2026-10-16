# Soul IA: memória do CRM e padrão de atendimento

A Soul IA é a assistente de IA da loja. Esta primeira etapa **não responde ninguém**: ela guarda as conversas do uTalk, gera a planilha e descreve **como nós respondemos os leads**. Esse retrato é a base do futuro agente de WhatsApp.

## 1. O que existe hoje

Aba **07 · Soul IA** (ela ocupa o número seguinte ao de Finanças, que hoje é 06).

| Botão | O que faz |
|---|---|
| Criar / Atualizar memória | Lê o uTalk (somente leitura) e grava no computador: leads, conversas, mensagens, etiquetas, setor, atendente, canal, anúncio de origem e eventos (troca de etiqueta, transferência). A segunda vez baixa só o que mudou. |
| Gerar planilha e análise | Cria `memoria-soul-ia.xlsx` (pelo motor Python) e arquivos CSV, o padrão de atendimento, os exemplos e um prompt pronto. |
| Abrir pasta | Abre `<pasta de dados da loja>/soul-ia`. |
| Apagar memória | Zera o banco da Soul IA. As conversas continuam no uTalk; os arquivos já gerados não são apagados. |

Usa o **mesmo token** do uTalk cadastrado na aba CRM. Sem token novo, sem chave de API, sem serviço pago.

### Arquivos gerados (`dados-loja/soul-ia/`)

| Arquivo | Conteúdo |
|---|---|
| `memoria-soul-ia.xlsx` | Abas Resumo, Leads (uma linha por conversa), Mensagens, Eventos, Situações e Exemplos. Precisa do grupo `planilha` do motor (openpyxl). Sem ele, só os CSV saem e o app avisa. |
| `resumo.csv`, `leads.csv`, `mensagens.csv`, `eventos.csv`, `situacoes.csv`, `exemplos.csv` | Mesmas abas em CSV (`;`, UTF-8 com BOM; abre direto no Excel). Textos que começam com `=`, `+`, `-` ou `@` recebem apóstrofo para o Excel não executar como fórmula. |
| `padrao-de-atendimento.md` | O retrato: tempo de resposta, tom, aberturas, perguntas, fechamentos, frases repetidas, respostas por assunto, conversas que avançaram × demais, rascunho de regras. |
| `exemplos.jsonl` | Pares "pergunta do lead → nossa resposta" por assunto, **anonimizados**. Base para o agente buscar respostas parecidas. |
| `prompt-refinar-padrao.md` | Prompt pronto para colar no chat do usuário (Claude): recebe o retrato e conversas de amostra anonimizadas e devolve o tom de voz e os roteiros. Segue a regra do app: texto de IA sai por prompt pronto, nunca por API. |

## 2. Como funciona por dentro

- `src/main/soulia/sincronizar.ts`: `GET /v1/chats/` (todas as conversas, mais recentes primeiro) e `GET /v1/chats/{id}/relative-messages/` com `IncludeMetadata=true`, paginando para trás. Conversas com o mesmo `eventAtUTC` da última vez são puladas. Só faz GET (há teste para isso). Respeita o limite da API: 3 conversas ao mesmo tempo.
- `src/main/soulia/memoria.ts`: banco SQLite próprio, `soul-ia.db` na pasta de dados do app, com migrações versionadas (`ia_migracoes`). Separado do `soul.db` para poder ser apagado inteiro.
- `src/main/soulia/analise.ts`: estatística e regras. **Nenhum modelo de IA.** Anonimiza telefone, CPF, e-mail, placa e primeiro nome do lead em tudo que sai como exemplo, padrão ou prompt.
- `src/main/soulia/planilha.ts`: monta as abas; `engine/soulia_planilha.py` grava o `.xlsx`.
- Origem da mensagem: `Contact` → lead; `Member` → vendedor; `External` → celular da loja; `Bot` → robô do uTalk (não conta como resposta nossa). Notas privadas ficam guardadas mas fora de qualquer análise.

### Como a análise decide as coisas (para você poder discordar)

- **Tempo de resposta** = primeira mensagem do lead até a primeira mensagem humana nossa depois dela. Não desconta horário fora do expediente.
- **Assunto da mensagem** (preço, financiamento, troca, visita, fotos, disponibilidade, detalhes, negociação, anúncio) vem de palavras-chave. Pode errar; a lista está em `REGRAS` no `analise.ts`.
- **"Avançou"** = a conversa tem etiqueta com visita, agend, proposta, vend, fechad, negoci, financ ou comprou. É aproximação: depende de como a equipe etiqueta.
- **Respostas típicas** por assunto: priorizam conversas que avançaram, aberturas mais frequentes e tamanho perto da mediana.

## 3. Pesquisa de mercado: como esses agentes são feitos

Pesquisa de outubro de 2026. **Aviso de qualidade:** quase tudo vem de fornecedores de software (marketing); números de desempenho são deles e não foram verificados. As partes úteis são os desenhos, não os resultados prometidos.

**Padrão recorrente**

1. **Fatos e estilo em camadas separadas.** Os fatos (estoque, preço, políticas) vêm de busca em uma base (RAG: dividir documentos em trechos, achar os mais próximos da pergunta, entregá-los ao modelo). O **estilo** vem de exemplos reais das conversas da equipe. Fonte: [Wati/Astra, treinar agentes com conversas de WhatsApp](https://astra-geo.wati.io/blog/how-to-train-ai-agents-whatsapp-conversations); [Aurora Inbox, RAG em chatbots de WhatsApp](https://www.aurorainbox.com/?p=38933).
2. **Começar com exemplos no prompt (few-shot) + busca, não com treino do modelo.** Ajuste fino só se compensar depois, com centenas de pares limpos separados em treino/validação/teste. As fontes de fornecedor não discutem custo nem comparação; esta recomendação é consenso de prática, não resultado medido por nós. Ver também [ChatArchitect, treinar chatbot com histórico de WhatsApp](https://www.chatarchitect.com/news/training-chatbots-using-user-dialogue-history-for-whatsapp-a-comprehensive-guide).
3. **Avaliar com conversas reais:** pegar 30 a 50 mensagens antigas de clientes, pedir a resposta ao agente e comparar com a do melhor vendedor. Factualmente certo mas robótico → mais exemplos e instruções de tom; fato errado → melhorar a fonte de conhecimento. Fonte: [guia de implementação Wati](https://astra-geo.wati.io/blog/implementation-guide/what-platform-lets-me-upload-past-customer-conversations-from-whatsapp-so-my-ai-agent-learns-how-my--48beb5).
4. **Concessionárias: o agente só fala do que existe no estoque.** A cada conversa recebe a lista de veículos (marca, modelo, versão, ano, preço, km, combustível, câmbio, cor, fotos) e consulta o estoque em tempo real. Sem estoque conectado, não afirma que o carro está reservado ou pronto. Fonte: [Dealism, agente para concessionárias](https://dealism.ai/pt/ai-customer-agent-vehicle); [AutoSDR, chatbot de qualificação](https://blog.autosdr.com.br/blog/chatbot-ia-whatsapp-qualificacao-concessionaria).
5. **Limites para crédito e usado:** explicar o processo, mas não aprovar crédito, não prometer taxa nem parcela vinculante, e não dar valor final do carro na troca sem avaliação presencial. Mesma fonte do item anterior.
6. **Passagem para humano (handoff)** por regra clara, levando um resumo da conversa e a temperatura do lead. Fonte: [Virtual Workforce, agentes para o setor automotivo](https://virtualworkforce.ai/pt/agentes-ia-distribuicao-automotiva/).
7. **Referência de mercado (fornecedor):** a Webmotors relata oito vezes mais engajamento nas negociações pelo WhatsApp com respostas instantâneas de um agente ([TI Inside](https://tiinside.com.br/20/01/2026/ia-multiplica-em-oito-vezes-o-engajamento-nas-negociacoes-da-webmotors/)). Número divulgado pela própria empresa.

**O que não achei:** comparação independente entre few-shot e ajuste fino para tom de voz, regras de consentimento (LGPD) para usar conversas de clientes no treino, nem custo real de manutenção.

### Referência interna: a SINDI

O projeto SINDI (`SINDEPRESTEM/SINDI`) usa a mesma ideia: modelo local pequeno (Ollama), "cérebro" em arquivos Markdown (instruções, conectores por área, conhecimento), busca local, **roteamento por regra antes do modelo**, no máximo 2 fontes por resposta, e **verificação da resposta** (preço, número e contato precisam estar nas fontes). A Soul IA aproveita o desenho, trocando a fonte de conhecimento: em vez de documentos do sindicato, o estilo vem das conversas da loja (`exemplos.jsonl`) e os fatos vêm do estoque do app.

## 4. Arquitetura proposta para o agente (próximas etapas)

```
mensagem do lead (uTalk)
  1. proteger por regra: dados sensíveis, reclamação, pedido jurídico → humano
  2. assunto (preço, financiamento, troca, visita…)   ← mesmas REGRAS da análise
  3. fatos: estoque do app (preço, km, ano, fotos, status); nunca da memória do modelo
  4. estilo: 3 a 5 respostas parecidas de exemplos.jsonl (priorizando as que avançaram)
  5. rascunho (modelo local ou prompt pronto) + conferência: valor e disponibilidade precisam bater com o estoque
  6. entrega como SUGESTÃO ao vendedor; só depois de validada, envio automático
```

Ordem sugerida:

1. **Hoje:** memória + planilha + padrão (esta entrega). A equipe lê `padrao-de-atendimento.md`, risca o que não quer repetir.
2. **Revisão humana** do padrão e do `exemplos.jsonl` (corrigir exemplos ruins, marcar os melhores).
3. **Sugestão de resposta** dentro do app (rascunho para o vendedor copiar), usando estoque + exemplos. Escrita só por prompt pronto ou modelo local; sem API paga.
4. **Avaliação** com 30 a 50 mensagens antigas contra a resposta humana.
5. **Só então** pensar em enviar mensagens automaticamente. Isso exige a API de escrita do uTalk, que o app hoje **não** usa de propósito (ver `AGENTS.md`), e uma decisão explícita.

## 5. Cuidados

- **LGPD:** a memória tem nome, telefone e conversa de pessoas. Fica só neste computador (`soul-ia.db`) e na pasta de dados da loja (fora do Git). Os arquivos de exemplos, o padrão e o prompt são anonimizados; **as planilhas `leads` e `mensagens` não são**, porque servem à própria equipe. Não envie essas planilhas a terceiros. Antes de usar conversas para treinar qualquer modelo, confirme a base legal com quem cuida da LGPD na loja.
- **Prompt pronto:** cole só o arquivo `prompt-refinar-padrao.md` (anonimizado). Confira antes de colar.
- **Qualidade dos dados:** áudio, foto e vídeo entram só na contagem (sem texto). A API diz que o campo `ad` (anúncio) e os metadados de etiqueta (`IncludeMetadata`) **precisam ser confirmados com dados reais** (ver `15-crm-dados-e-relatorios.md`). Se eles vierem vazios, as colunas "Anúncio de origem" e a aba Eventos ficam vazias.
- **Primeira sincronização:** pode levar vários minutos (uma chamada por conversa, no mínimo). Dá para cancelar e continuar depois; o que já foi baixado fica.
- **Parâmetros não verificados:** o formato exato do contato (`phoneNumber`) e do atendente (`name`) na lista de conversas foi inferido da especificação; se vier outro campo, nome/telefone aparecem vazios na planilha e o `sincronizar.ts` (`registrarConversa`) é o lugar de ajustar.

## Seção unificada: Leads e Soul IA

A aba **03 · Leads e Soul IA** reúne duas abas internas: **Painel** (visão geral do CRM pelas etiquetas, seguida do desempenho, com gráficos calculados pela memória: conversas por dia, espera pela 1ª resposta, horário, atendente e anúncio de origem) e **Memória (Soul IA)**, à parte por tratar de dados sensíveis (sincronização, planilha e padrão de atendimento). O desempenho usa `soulia_desempenho` (`src/main/soulia/desempenho.ts`), só leitura da memória local, com cache até a memória mudar.
