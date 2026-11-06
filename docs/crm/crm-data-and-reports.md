# CRM: dados disponíveis, dashboards e relatórios

Cruza o que o uTalk entrega pela API (ver `13-api-utalk-biblioteca.md`) com os indicadores do mercado (ver `14-crm-pesquisa-de-mercado.md`). Tudo aqui é **somente leitura**.

## 1. O que a API entrega (e o que não entrega)

**Entrega**

| Dado | De onde vem | Uso |
|---|---|---|
| Contatos (leads), com etiquetas, canais, `createdAtUTC`, `lastActiveUTC`, campos personalizados | `GET /v1/contacts/` | Volume de leads, leads por etiqueta, leads novos por dia, leads parados |
| Conversas, com `open`, `waiting`, `waitingSinceUTC`, `totalUnread`, `closedAtUTC`, setor, atendente, etiquetas, `firstContactMessage`, `firstMemberReplyMessage`, `lastMessage` | `GET /v1/chats/` | Conversas abertas, aguardando resposta, tempo de primeira resposta, carga por vendedor |
| Filtros de conversa: tipo (`Open`/`Waiting`/`Closed`), quem mandou a última mensagem (`Contact`/`Member`), período de criação, setor, atendente, canal, etiqueta | parâmetros de `GET /v1/chats/` | "Leads esperando resposta nossa" = última mensagem do contato |
| Totais sem baixar a lista | `Behavior=CountOnly` (campo `page.totalItems`) | Contagens rápidas e baratas |
| Mensagens, com `ad` (dados do anúncio de origem), `source`, `messageState` | `GET /v1/chats/{chatId}/relative-messages/` (por conversa) e `GET /v1/messages/{id}/` | Origem do lead vinda de anúncio (a conferir com dados reais), leitura da mensagem |
| Avaliações dadas pelo contato | `GET /v1/contact-ratings/` | Satisfação |
| Campos personalizados e agregação (`Count/Sum/Average/Min/Max`) | `GET /v1/contacts/custom-field-aggregation/` (marcada como não estável) | Somas e médias de campos, por exemplo valor de interesse |
| Etiquetas, setores, canais, atendentes | `/v1/tags/`, `/v1/sectors/`, `/v1/channels/`, `/v1/members/` | Dimensões para agrupar |
| Notas e tarefas do contato | `/v1/contacts/{id}/notes/`, `/v1/organization-tasks/` | Follow-up pendente |
| Avisos em tempo real | Webhooks: `NewChat`, `Message`, `ChatTagChanged`, `ChatClosed`, `MemberTransfer`, `ChatSectorChanged` | Histórico próprio (ver seção 5) |

**Não entrega**

- **Funil/negócios (pipeline, etapas, valor da venda):** não encontrei rotas de pipeline na especificação. O funil teria que ser feito com **etiquetas** (ex.: `NOVO`, `PROPOSTA`, `VISITA`, `VENDIDO`).
- **Histórico de mudanças de etiqueta por data:** a conversa traz as etiquetas atuais; o evento `TagsChanged` aparece como mensagem de metadados do chat, mas isso precisa ser confirmado com dados reais. Sem histórico confiável, "quantos leads entraram na etapa X na semana" só se mede guardando fotos periódicas (seção 5).
- **Custo de anúncio:** vem do Meta Ads, não do uTalk.
- **Venda fechada:** o CRM não sabe; está no estoque do app (status do veículo / vendas).

## 2. Como definir "lead quente" com o que temos

Sem padrão de mercado (ver doc 14), proponho uma regra **transparente e ajustável**, calculada no nosso app a partir de dados da API. Pontuação de 0 a 100, com decaimento.

**Opção A, mais simples e imediata:** usar **etiquetas de temperatura** que o vendedor já aplica (`QUENTE`, `MORNO`, `FRIO`). Contar com `Tags.Values`. Zero risco de erro de regra, mas depende de disciplina.

**Opção B, automática (sugestão para uma segunda etapa):**

| Sinal | Origem do dado | Pontos (inicial, ajustável) |
|---|---|---|
| Lead respondeu nas últimas 24 h | `lastActiveUTC` / última mensagem do contato | +30 |
| Respondeu nos últimos 3 dias | idem | +15 |
| Conversa aberta e aguardando **nossa** resposta | `waiting` / `LastMessage=Contact` | +20 (precisa de ação) |
| Tem etiqueta de veículo específico (ex.: `FIESTA 2016`) | etiquetas | +15 |
| Etiqueta de intenção (`VISITA`, `PROPOSTA`, `FINANCIAMENTO`) | etiquetas | +25 |
| Mensagens do lead na conversa (engajamento) | contagem de mensagens | +10 |
| Sem resposta do lead há 7 dias | `lastActiveUTC` | −20 |
| Sem resposta do lead há 15 dias | idem | −40 |

Faixas iniciais: **quente** ≥ 60, **morno** 30 a 59, **frio** < 30. Revisar todo mês contra as vendas reais (como as fontes recomendam). **Os pesos são chute inicial nosso**, não vêm de pesquisa.

## 3. Catálogo de indicadores possíveis

Marcado por viabilidade: **A** = dá para fazer só com a API; **B** = precisa de histórico próprio ou convenção de etiquetas; **C** = precisa de outro sistema.

| Indicador | Como calcular | Viab. |
|---|---|---|
| Total de leads ativos | `contacts` com `CountOnly` | A |
| Leads novos (hoje / 7 / 30 dias) | `contacts` ordenado por criação, ou chats com `DateStartCreatedAtUTC` | A |
| Leads por etiqueta (modelo/ano) | `contacts` com `Tags.Values` e `CountOnly` (já implementado) | A |
| Conversas abertas, aguardando, fechadas | `chats` com `Type` e `CountOnly` | A |
| **Leads aguardando nossa resposta** e há quanto tempo | `chats` com `LastMessage=Contact`, ordenado por `WaitingSince` | A |
| Tempo até a primeira resposta | `firstMemberReplyMessage` menos `firstContactMessage` (datas) | A (a confirmar nos dados reais) |
| Leads por vendedor e carga | `chats` com `Members.Values` | A |
| Leads por canal/número | `chats` com `Channels.Values` | A |
| Leads por setor | `chats` com `Sectors.Values` | A |
| Taxa de resposta do lead | conversas com mensagem do contato após a nossa / total | A (exige ler as mensagens de cada conversa, uma chamada por conversa) |
| Leads parados (sem atividade há N dias) | `lastActiveUTC` | A |
| Leads quentes / mornos / frios | seção 2 | A (opção A) ou B (opção B) |
| Funil por etapa | etiquetas de etapa | B |
| Conversão entre etapas e ciclo de vendas | histórico de etapa por data | B |
| Origem do lead (Meta Ads, portal, orgânico) | campo `ad` da mensagem ou etiqueta de origem | B |
| Interesse por modelo versus estoque | etiquetas de modelo contra o estoque do app | A + estoque do app |
| Demanda sem estoque ("procuram HB20, não temos") | etiquetas sem veículo correspondente em estoque | A + estoque do app |
| Custo por lead e custo por venda | gasto do Meta Ads / leads / vendas | C |
| Taxa de conversão final (lead → venda) | vendas do app / leads | A + estoque do app (vincular lead à venda é manual) |
| Satisfação | `contact-ratings` | A |

## 4. Visão geral do CRM (dashboard proposto)

Tela única, no topo da aba CRM, em três faixas (primeira entrega, tudo com dados **A**):

1. **Cartões:** leads ativos · novos nos últimos 7 dias · conversas abertas · **aguardando nossa resposta** (em destaque, com tempo do mais antigo) · leads quentes · leads parados há mais de 7 dias.
2. **Atenção agora:** lista dos leads quentes e dos que esperam resposta, mais antigos primeiro (nome, etiqueta do carro, quanto tempo esperando, vendedor). Clique abre a conversa no uTalk.
3. **Demanda:** leads por etiqueta (já existe), cruzado com o estoque: coluna "em estoque agora" para ver demanda sem carro e carro sem demanda.

Depois (segunda entrega): funil por etapas (etiquetas), tempo de primeira resposta por vendedor, tendência semanal de leads novos.

## 5. Histórico próprio (para o que a API não guarda)

Para indicadores **B**, o app pode gravar uma foto diária (contagens por etiqueta, quentes, aguardando) no banco local (SQLite). Com poucas semanas dá para ver tendência e conversão entre etapas. Alternativa: receber **webhooks** do uTalk, mas isso exige um endereço público para o uTalk chamar, o que o app de desktop não tem; por isso a foto diária por consulta é a opção sem custo e sem servidor.

## 6. Relatórios sugeridos (.md/PDF do app)

| Relatório | Frequência | Conteúdo |
|---|---|---|
| Resumo semanal de leads | Semanal | Leads novos, por etiqueta, por canal, quentes, perdidos por demora, comparação com a semana anterior |
| Atendimento | Semanal | Tempo de primeira resposta, leads sem resposta, carga por vendedor |
| Demanda × estoque | Quinzenal | Modelos mais procurados, sem carro em estoque, carros parados sem leads |
| Funil | Mensal | Etapas, conversão entre etapas, ciclo de vendas (depende de histórico) |
| Origem e custo | Mensal | Leads por origem, CPL e custo por venda (junta Meta Ads e vendas) |

## 7. Cuidados

- **Limite de uso:** 100 requisições a cada 5 segundos nas rotas de chats e contatos. Usar `CountOnly` e `Take` alto; evitar baixar todas as conversas.
- **Rotas não estáveis:** algumas (ex.: agregação) avisam que podem mudar. Isolar em um único módulo e tratar erro.
- **Privacidade (LGPD):** nome e telefone de leads são dados pessoais. Mostrar só na tela do usuário; não gravar em logs, não enviar para fora, não colocar em arquivos versionados.
- **Token:** continua local, cifrado, sem retorno à interface (já implementado).
- **Testar com dados reais** os pontos marcados "a confirmar" (tempo de primeira resposta, campo `ad`, histórico de etiqueta) antes de prometer o indicador.
