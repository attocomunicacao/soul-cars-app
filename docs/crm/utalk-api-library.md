# Biblioteca da API do uTalk (Umbler Talk)

> Gerada a partir da especificação oficial OpenAPI (`Umbler.UTalk.Api` vv1), em https://app-utalk.umbler.com/api/docs/v1/docs.json, no dia 2026-10-16.
> **198 rotas, 274 operações, 951 modelos.** Os resumos das operações são os do próprio uTalk (em inglês); a organização e os comentários são nossos.
> Uso no app: **somente leitura** (`GET`). As operações de escrita (`POST/PUT/PATCH/DELETE`) ficam listadas só para consulta.

## 1. Conceitos gerais

| Item | Valor |
|---|---|
| Endereço base | `https://app-utalk.umbler.com/api` |
| Autenticação | Cabeçalho `Authorization: Bearer <token>`. O token é gerado em account.umbler.com/profile. |
| Organização | Quase toda rota pede `organizationId` (na query). Descobre-se com `GET /v1/members/me/` (campo `organizations`). |
| Formato | JSON. Datas em UTC (ISO 8601). IDs são textos (ex.: `AB_12-xyzEXAMPLE`). |
| Limite de uso | Varia por rota. Ex.: `/v1/chats/` aceita até 100 requisições por janela de 5 segundos. Respeite o `429`. |
| Paginação | `Skip` (quantos pular) e `Take` (quantos trazer; há um `maxTake` por rota). `Behavior`: `GetSliceOnly` (padrão), `CountAllAndGetSlice`, `CountOnly` (só o total, em `page.totalItems`) e `CountByGroup`. Respostas paginadas: `{ page: { totalItems, skipped, took, maxTake, countsByGroup }, items: [] }`. |
| Filtro por etiqueta | `Tags.Rule` = `Any`, `None`, `ContainsAny`, `NoneOrContainsAny`, `NotNullNorEmpty`, `ContainsAll`, `Excludes`; `Tags.Values` = lista de IDs de etiqueta. |
| Erros comuns | `401/403` token inválido ou sem permissão; `429` limite excedido. |

Legenda: `*` = obrigatório. Nos corpos e respostas, o texto mostra os campos principais; o modelo completo está na especificação.

## 2. Índice por grupo

| Grupo | Operações | Para que serve |
|---|---|---|
| ActivityLogs | 1 | Registro de atividades da organização (auditoria). |
| AiAgents | 26 | Agentes de IA (respondem conversas): configuração, base de conhecimento, snapshots. |
| AiAssistant | 2 | Assistente de IA para sugestões dentro do chat. |
| Bots | 16 | Bots/chatbots de atendimento automático. |
| BulkSendSession | 5 | Envio em massa (sessões de disparo). |
| Channels | 11 | Canais (números de WhatsApp, Instagram etc.) conectados. |
| ChatTags | 4 | Etiquetas aplicadas a uma conversa. |
| Chats | 22 | Conversas (chats): listar, abrir, transferir, fechar, mover de setor. |
| ContactRatings | 4 | Avaliações (nota) dadas pelos contatos. |
| ContactTags | 4 | Etiquetas aplicadas a um contato. |
| Contacts | 25 | Contatos/leads: cadastro, campos personalizados, notas, bloqueio. |
| CustomFieldDefinitions | 6 | Definição dos campos personalizados dos contatos. |
| FlowMessages | 1 | Mensagens de fluxos. |
| Flows | 12 | Fluxos de automação. |
| KnowledgeBases | 17 | Bases de conhecimento usadas pelos agentes de IA. |
| Members | 8 | Membros (atendentes) e o perfil do usuário do token. |
| Messages | 16 | Mensagens enviadas e recebidas. |
| OrganizationBotShortcut | 4 | Atalhos de bot da organização. |
| OrganizationFiles | 6 | Arquivos da organização. |
| OrganizationGroup | 5 | Grupos da organização. |
| OrganizationInvites | 5 | Convites de novos membros. |
| OrganizationPreferences | 1 | Preferências da organização. |
| OrganizationTasks | 7 | Tarefas/lembretes da organização. |
| Organizations | 7 | Organizações (a conta da loja) e dados gerais. |
| Permissions | 4 | Permissões de membros. |
| QuickAnswers | 7 | Respostas rápidas. |
| ScheduledMessages | 5 | Mensagens agendadas. |
| Sectors | 8 | Setores (filas) de atendimento. |
| Stickers | 5 | Figurinhas. |
| Tags | 7 | Etiquetas: cadastro, cor, grupos e ordem. |
| TemplateCategories | 1 | Categorias de modelos de mensagem. |
| TemplateMessages | 2 | Envio de modelos (templates) de WhatsApp. |
| Templates | 7 | Modelos (templates) de mensagem aprovados. |
| UserNotifications | 5 | Notificações do usuário. |
| Variables | 4 | Variáveis usadas em mensagens. |
| Webhooks | 4 | Webhooks: o uTalk avisa o seu sistema quando algo acontece. |

## 3. Rotas

### Grupo ActivityLogs

Registro de atividades da organização (auditoria).

#### `GET /v1/activity-logs/` (leitura)

Returns a paginated list of the most recent events in the selected organization. Note that if you have a permission below admin, you can only query your own events. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `ReferenceId` | query | string |  |
| `UTalkUserId` | query | string |  |
| `StartDateUTC` | query | string(date-time) |  |
| `EndDateUTC` | query | string(date-time) |  |
| `ActivityLogType` | query | ActivityLogType |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfActivityLogModel` — `page`: PaginationInfo; `items`: ActivityLogModel[]

### Grupo AiAgents

Agentes de IA (respondem conversas): configuração, base de conhecimento, snapshots.

#### `POST /v1/ai-agents/` (escrita)

Creates a new AI agent. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateAIAgentModel` — `displayName`: string; `signature`: string?; `organizationId`: string; `organizationName`: string; `organizationWebsite`: string?; `communicationStyle`: CommunicationStyles; `chatbotType`: BotTypes; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `intents`: CreateAiIntentModel[]; `mcpTools`: CreateAiMcpToolModel \| CreateAsaasMcpTool \| CreateExternalApiMcpTool \| CreateGenericMcpTool \| CreateGoogleCalendarMcpTool \| CreateGoogleSheetsMcpTool \| CreatePipedriveMcpTool \| CreateShopifyMcpTool[]; `manualActions`: CreateAgentManualActionModel[]; `stages`: CreateAiStageModel[]; `organizationIndustry`: string; `botLLM`: AiLLMs; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voiceId`: string; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel

**Resposta:** `FullAITalkAgentModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `signature`: string?; `status`: AIStatuses; `chatbotType`: BotTypes; `botLLM`: AiLLMs; `isAIAssistantAgent`: boolean; `communicationStyle`: CommunicationStyles; `organizationName`: string?; `organizationWebsite`: string?; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `organizationIndustry`: string?; `organizationPrimaryProduct`: string?; `intents`: AiIntentModel[]; `stages`: AiStageModel[]; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voice`: AgentVoiceModel; `workloads`: AIAgentWorkloadModel[]; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel; `mcpTools`: AiMcpToolModel \| AsaasMcpToolModel \| ExternalApiMcpToolModel \| GenericMcpToolModel \| GoogleCalendarMcpToolModel \| GoogleSheetsMcpToolModel \| PipedriveMcpToolModel \| ShopifyMcpToolModel[]; `managedBotId`: string?; `manualActions`: AgentManualActionModel[]; `allowed_kb_ids`: string[]; `knowledge_bases`: KnowledgeBaseModel[]; `recommendedPrompt`: string?; `llmModel`: string?; `warnings`: string[]

#### `GET /v1/ai-agents/{id}/` (leitura)

Gets the details of an AI agent. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Resposta:** `FullAITalkAgentModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `signature`: string?; `status`: AIStatuses; `chatbotType`: BotTypes; `botLLM`: AiLLMs; `isAIAssistantAgent`: boolean; `communicationStyle`: CommunicationStyles; `organizationName`: string?; `organizationWebsite`: string?; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `organizationIndustry`: string?; `organizationPrimaryProduct`: string?; `intents`: AiIntentModel[]; `stages`: AiStageModel[]; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voice`: AgentVoiceModel; `workloads`: AIAgentWorkloadModel[]; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel; `mcpTools`: AiMcpToolModel \| AsaasMcpToolModel \| ExternalApiMcpToolModel \| GenericMcpToolModel \| GoogleCalendarMcpToolModel \| GoogleSheetsMcpToolModel \| PipedriveMcpToolModel \| ShopifyMcpToolModel[]; `managedBotId`: string?; `manualActions`: AgentManualActionModel[]; `allowed_kb_ids`: string[]; `knowledge_bases`: KnowledgeBaseModel[]; `recommendedPrompt`: string?; `llmModel`: string?; `warnings`: string[]

#### `PUT /v1/ai-agents/{id}/` (escrita)

Updates an AI agent. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Corpo:** `UpdateAIAgentModel` — `displayName`: string; `signature`: string?; `communicationStyle`: CommunicationStyles; `chatbotType`: BotTypes; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `intents`: CreateAiIntentModel[]; `stages`: CreateAiStageModel[]; `organizationIndustry`: string; `organizationName`: string; `organizationWebsite`: string?; `status`: AIStatuses; `botLLM`: AiLLMs; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voiceId`: string; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `allowedKbIds`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel; `mcpTools`: CreateAiMcpToolModel \| CreateAsaasMcpTool \| CreateExternalApiMcpTool \| CreateGenericMcpTool \| CreateGoogleCalendarMcpTool \| CreateGoogleSheetsMcpTool \| CreatePipedriveMcpTool \| CreateShopifyMcpTool[]; `manualActions`: CreateAgentManualActionModel[]

**Resposta:** `FullAITalkAgentModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `signature`: string?; `status`: AIStatuses; `chatbotType`: BotTypes; `botLLM`: AiLLMs; `isAIAssistantAgent`: boolean; `communicationStyle`: CommunicationStyles; `organizationName`: string?; `organizationWebsite`: string?; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `organizationIndustry`: string?; `organizationPrimaryProduct`: string?; `intents`: AiIntentModel[]; `stages`: AiStageModel[]; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voice`: AgentVoiceModel; `workloads`: AIAgentWorkloadModel[]; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel; `mcpTools`: AiMcpToolModel \| AsaasMcpToolModel \| ExternalApiMcpToolModel \| GenericMcpToolModel \| GoogleCalendarMcpToolModel \| GoogleSheetsMcpToolModel \| PipedriveMcpToolModel \| ShopifyMcpToolModel[]; `managedBotId`: string?; `manualActions`: AgentManualActionModel[]; `allowed_kb_ids`: string[]; `knowledge_bases`: KnowledgeBaseModel[]; `recommendedPrompt`: string?; `llmModel`: string?; `warnings`: string[]

#### `DELETE /v1/ai-agents/{id}/` (escrita)

Deletes an AI agent. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Resposta:** `FullAITalkAgentModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `signature`: string?; `status`: AIStatuses; `chatbotType`: BotTypes; `botLLM`: AiLLMs; `isAIAssistantAgent`: boolean; `communicationStyle`: CommunicationStyles; `organizationName`: string?; `organizationWebsite`: string?; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `organizationIndustry`: string?; `organizationPrimaryProduct`: string?; `intents`: AiIntentModel[]; `stages`: AiStageModel[]; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voice`: AgentVoiceModel; `workloads`: AIAgentWorkloadModel[]; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel; `mcpTools`: AiMcpToolModel \| AsaasMcpToolModel \| ExternalApiMcpToolModel \| GenericMcpToolModel \| GoogleCalendarMcpToolModel \| GoogleSheetsMcpToolModel \| PipedriveMcpToolModel \| ShopifyMcpToolModel[]; `managedBotId`: string?; `manualActions`: AgentManualActionModel[]; `allowed_kb_ids`: string[]; `knowledge_bases`: KnowledgeBaseModel[]; `recommendedPrompt`: string?; `llmModel`: string?; `warnings`: string[]

#### `PUT /v1/ai-agents/{id}/profile-picture/` (escrita)

Allows to update the profile picture of an AI agent. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Corpo:** `object` — `image`*: string(binary)

**Resposta:** `string(uri)`

#### `GET /v1/ai-agents/{id}/snapshots/` (leitura)

Lists the saved versions of an AI agent, most recent first. Does not include the agent payload. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfAIAgentSnapshotModel` — `page`: PaginationInfo; `items`: AIAgentSnapshotModel[]

#### `GET /v1/ai-agents/snapshot/{snapshotId}/` (leitura)

Returns a saved version with its full agent payload, so the editor can load it as a pending change. Applying it is the regular update, which the user triggers by saving. The payload is sanitized against today's data: the status is kept as it is now, since the update state machine only allows specific transitions, and knowledge bases and custom fields that no longer exist are dropped so the save is not rejected. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `snapshotId`* | path | string |  |

**Resposta:** `AIAgentSnapshotModel` — `id`*: string; `agentId`: string; `title`: string?; `createdBy`: string?; `createdAtUTC`: string(date-time); `isCurrent`: boolean; `changes`: string[]; `agent`: FullAITalkAgentModel

#### `PUT /v1/ai-agents/snapshot/{snapshotId}/` (escrita)

Renames a saved version of an AI agent. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `snapshotId`* | path | string |  |

**Corpo:** `UpdateAIAgentSnapshotModel` — `title`: string

**Resposta:** `AIAgentSnapshotModel` — `id`*: string; `agentId`: string; `title`: string?; `createdBy`: string?; `createdAtUTC`: string(date-time); `isCurrent`: boolean; `changes`: string[]; `agent`: FullAITalkAgentModel

#### `POST /v1/ai-agents/{id}/ingest/` (escrita)

Commits the changes made to the training data of an AI agent. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Resposta:** sem corpo.

#### `POST /v1/ai-agents/knowledge-bases/{kbId}/ingest-kb/` (escrita)

Commits the changes made to a specific knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Resposta:** sem corpo.

#### `POST /v1/ai-agents/knowledge-bases/` (escrita)

Creates a new knowledge base for the organization — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `CreateKnowledgeBaseRequestModel` — `name`: string

**Resposta:** `KnowledgeBaseModel` — `id`: string; `name`: string; `organizationId`: string; `createdAt`: string(date-time); `status`: KnowledgeBaseStatuses; `isIngest`: boolean

#### `GET /v1/ai-agents/knowledge-bases/` (leitura)

Gets a list of knowledge bases for the organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `KnowledgeBaseModel[]`

#### `GET /v1/ai-agents/voices/` (leitura)

Gets a list of available voices to be used in an agent — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Resposta:** `AgentVoiceModel[]`

#### `GET /v1/ai-agents/pre-trained-sectors/` (leitura)

Gets a list of pre-trained sectors and their agent function templates — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Resposta:** `AgentPreTrainedSectorModel[]`

#### `PUT /v1/ai-agents/clone-knowledge-base/` (escrita)

Accepts two agent Ids and clones the knowledge base from one to the other. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `CloneKnowledgeBaseModel` — `fromAgentId`: string; `toAgentId`: string

**Resposta:** sem corpo.

#### `POST /v1/ai-agents/{id}/import-qas-from-chats/` (escrita)

POST Ai-Agents — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |

**Corpo:** `CreateQAsFromChatsModel` — `organizationId`: string

**Resposta:** `FullAITalkAgentModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `signature`: string?; `status`: AIStatuses; `chatbotType`: BotTypes; `botLLM`: AiLLMs; `isAIAssistantAgent`: boolean; `communicationStyle`: CommunicationStyles; `organizationName`: string?; `organizationWebsite`: string?; `generalPrompt`: string?; `autoGeneratedPrompt`: string?; `selectedFunctionKey`: string?; `organizationIndustry`: string?; `organizationPrimaryProduct`: string?; `intents`: AiIntentModel[]; `stages`: AiStageModel[]; `maxResponses`: integer(int32); `maxCharacterByResponses`: integer(int32); `replyAfterTransfer`: boolean; `inactivityWindowToReply`: integer(int32); `replyInAudio`: ReplyInAudio; `agentIdentityStyle`: AgentIdentityOption; `conversationPace`: ConversationPaceOption; `communicationTone`: CommunicationToneOption; `emojiUsage`: EmojiUsageOption; `voice`: AgentVoiceModel; `workloads`: AIAgentWorkloadModel[]; `aiBotLocale`: AILocale; `llmTemperature`: number(float); `allowedCustomFields`: string[]; `invalidMessageIntent`: AiIntentModel; `maxResponsesIntent`: AiIntentModel; `mcpTools`: AiMcpToolModel \| AsaasMcpToolModel \| ExternalApiMcpToolModel \| GenericMcpToolModel \| GoogleCalendarMcpToolModel \| GoogleSheetsMcpToolModel \| PipedriveMcpToolModel \| ShopifyMcpToolModel[]; `managedBotId`: string?; `manualActions`: AgentManualActionModel[]; `allowed_kb_ids`: string[]; `knowledge_bases`: KnowledgeBaseModel[]; `recommendedPrompt`: string?; `llmModel`: string?; `warnings`: string[]

#### `GET /v1/ai-agents/{id}/qa/` (leitura)

Gets the Q&As of an AI agent. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string |  |
| `kbId` | query | string | Optional knowledge base ID to filter results |

**Resposta:** `PaginationOfAIAgentQAModel` — `page`: PaginationInfo; `items`: AIAgentQAModel[]

#### `POST /v1/ai-agents/{id}/qa/` (escrita)

Creates a Q&A for an AI agent. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Corpo:** `CreateAIAgentQAModel` — `title`: string; `content`: string; `kbId`: string?

**Resposta:** `AIAgentQAModel` — `id`*: string; `title`*: string; `content`*: string; `source`: AIAgentQASource

#### `DELETE /v1/ai-agents/{id}/qa/{qaId}/` (escrita)

Deletes a Q&A for an AI agent. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |
| `qaId`* | path | string |  |
| `kbId` | query | string |  |

**Resposta:** `AIAgentQAModel` — `id`*: string; `title`*: string; `content`*: string; `source`: AIAgentQASource

#### `POST /v1/ai-agents/{id}/qa/file/` (escrita)

Creates Q&As for an AI agent from a file. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Corpo:** `object` — `File`*: string(binary)

**Resposta:** `AIAgentQAModel[]`

#### `GET /v1/ai-agents/{id}/website-crawlers/` (leitura)

Gets website crawler registrations of an AI agent training data. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string |  |
| `kbId` | query | string | Optional knowledge base ID to filter results |

**Resposta:** `PaginationOfWebsiteCrawlerModel` — `page`: PaginationInfo; `items`: WebsiteCrawlerModel[]

#### `POST /v1/ai-agents/{id}/website-crawlers/` (escrita)

Creates a website crawler registration for an AI agent training data. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |

**Corpo:** `CreateAIAgentWebsiteCrawlerModel` — `url`: string(uri); `recursive`: boolean; `kbId`: string?

**Resposta:** `WebsiteCrawlerModel` — `id`*: string; `url`*: string(uri); `recursive`: boolean; `pagesCount`: integer(int32)

#### `DELETE /v1/ai-agents/{id}/website-crawlers/{crawlerId}/` (escrita)

Deletes a website crawler registration from an AI agent training data. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |
| `crawlerId`* | path | string |  |
| `kbId` | query | string |  |

**Resposta:** `WebsiteCrawlerModel` — `id`*: string; `url`*: string(uri); `recursive`: boolean; `pagesCount`: integer(int32)

#### `POST /v1/ai-agents/{id}/documents/` (escrita)

Adds a new document to an AI agent training data. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the agent |

**Corpo:** `object` — `OrganizationId`*: string; `Document`*: string(binary); `KbId`: string

**Resposta:** `AIAgentDocumentModel[]`

#### `GET /v1/ai-agents/{id}/documents/` (leitura)

Gets the documents of an AI agent training data. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string |  |
| `kbId` | query | string | Optional knowledge base ID to filter results |

**Resposta:** `PaginationOfAIAgentDocumentModel` — `page`: PaginationInfo; `items`: AIAgentDocumentModel[]

#### `DELETE /v1/ai-agents/{id}/documents/{documentId}/` (escrita)

Deletes a document from an AI agent training data. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the agent |
| `documentId`* | path | string |  |
| `kbId` | query | string |  |

**Resposta:** `AIAgentDocumentModel` — `id`*: string; `fileName`*: string; `content`: string?

### Grupo AiAssistant

Assistente de IA para sugestões dentro do chat.

#### `POST /v1/ai-assistant/improve-text/` (escrita)

Rewrites a message drafted by an attendant, improving grammar, clarity and tone without changing its meaning. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `ImproveTextModel` — `organizationId`: string; `text`: string

**Resposta:** `string`

#### `POST /v1/ai-assistant/reply-suggestions/` (escrita)

Suggests three different directions for the next message an attendant can send in a chat. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `ReplySuggestionsModel` — `organizationId`: string; `chatId`: string

**Resposta:** `ReplySuggestionModel[]`

### Grupo Bots

Bots/chatbots de atendimento automático.

#### `GET /v1/bots/` (leitura)

Gets a paginated list of all the bots of all types of one organization. Optionally filtering by a single channel — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `channelId` | query | string |  |
| `OrderBy` | query | BotProperty |  |
| `Order` | query | Order |  |
| `query` | query | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `groupIds` | query | string[] |  |

**Resposta:** `PaginationOfBotBaseModel` — `page`: PaginationInfo; `items`: BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel[]

#### `GET /v1/bots/{id}/` (leitura)

Gets a single bot of any type — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `BotBaseWrapperModel` — `bot`: BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel

#### `DELETE /v1/bots/{id}/` (escrita)

Deletes a bot of any type then returns it — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `BotBaseWrapperModel` — `bot`: BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel

#### `PUT /v1/bots/{id}/` (escrita)

PUT Bots — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdateBotModel` — `active`: boolean

**Resposta:** `BotBaseWrapperModel` — `bot`: BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel

#### `GET /v1/bots/{id}/bindings/` (leitura)

Returns all places where a bot is referenced/bound. When a trigger name is given, returns only the references to that manual start block — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |
| `triggerName` | query | string |  |

**Resposta:** `BotBindingsModel` — `bindings`: BotBindingEntry[]; `hasBindings`: boolean

#### `PUT /v1/bots/reorder/` (escrita)

PUT Bots — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `ReorderModel` — `toMoveId`: string; `anchorId`: string; `position`: MoveRelativeToAnchor

**Resposta:** `BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `lastSnapshotId`: string?; `channels`: ChannelReferenceIdModel[]; `title`: string; `order`: number(float); `final`: boolean; `active`: boolean; `groupIds`: string[]; `updatedAtUTC`: string(date-time)?; `executionsCount`: integer(int32)?; `executionsDateUTC`: string(date-time)?; `snapshotTitle`: string?

#### `GET /v1/bots/snapshot/{snapshotId}/` (leitura)

Gets a specific bot snapshot by its ID — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `snapshotId`* | path | string |  |

**Resposta:** `BotSnapshotModel` — `bot`*: BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel; `id`*: string; `botId`: string; `botTitle`: string; `executionsCount`: integer(int32)?; `title`: string?; `changes`: SnapshotChangeModel[]; `changesCount`: integer(int32); `createdBy`: string?; `createdAt`: string(date-time)?; `updatedBy`: string?; `updatedAt`: string(date-time)?

#### `PUT /v1/bots/snapshot/{snapshotId}/` (escrita)

Update snapshot title. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `snapshotId`* | path | string |  |

**Corpo:** `UpdateBotSnapshotModel` — `title`: string

**Resposta:** `BotSnapshotModel` — `bot`*: BotBaseModel \| FlowchartBotModel \| GreetingBotModel \| SectorForwardingBotModel \| TaggingBotModel; `id`*: string; `botId`: string; `botTitle`: string; `executionsCount`: integer(int32)?; `title`: string?; `changes`: SnapshotChangeModel[]; `changesCount`: integer(int32); `createdBy`: string?; `createdAt`: string(date-time)?; `updatedBy`: string?; `updatedAt`: string(date-time)?

#### `GET /v1/bots/snapshots/` (leitura)

Lists bot snapshots by bot id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `botId`* | query | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfBotSnapshotModel` — `page`: PaginationInfo; `items`: BotSnapshotModel[]

#### `GET /v1/bots/flowchart/` (leitura)

Gets a paginated list of all the chatbots of type flowchart — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfFlowchartBotModel` — `page`: PaginationInfo; `items`: FlowchartBotModel[]

#### `POST /v1/bots/flowchart/` (escrita)

POST Bots — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateFlowchartBotModel` — `_t`: string; `channelIds`: string[]; `trigger`: BotTrigger; `organizationId`: string; `title`: string; `order`: number(float); `final`: boolean; `groupIds`: string[]; `snapshotTitle`: string?; `steps`: CreateFlowchartBotStepModel \| CreateBlockContactActionModel \| CreateChangeChatPrivateStateActionModel \| CreateFlowchartBotChatStartedEventModel \| CreateCloseChatActionModel \| CreateCommentBlockModel \| CreateConditionalActionModel \| CreateTemplateMessageStepModel \| CreateDayOfTheWeekStepModel \| CreateDeleteContactActionModel \| CreateFlowMessageStepModel \| CreateFlowchartBotManualStartedEventModel \| CreateMemberTransferActionModel \| CreateNotifyMemberActionModel \| CreateOptionsStepModel \| CreatePipelineItemActionModel \| CreateRandomizerActionModel \| CreateFeedbackRatingStepModel \| CreateScoreRatingStepModel \| CreateRegexStepModel \| CreateSectorTransferActionModel \| CreateSendMessageActionModel \| CreateChatVisibilityActionModel \| CreateSetCustomFieldActionModel \| CreateSetInactivityActionModel \| CreateSetWaitingFlowActionModel \| CreateSetWaitingStateActionModel \| CreateFlowchartActionModel \| CreateFlowchartBotEventModel \| CreateInteractiveStepModel \| CreateStartManualEntryActionModel \| CreateSummarizeChatActionModel \| CreateTagActionModel \| CreateSendTeamMessageActionModel \| CreateTimeOfDayStepModel \| CreateOneShotCronActionModel \| CreateWaitingActionModel \| CreateAsaasActionModel \| CreatePipedriveActionModel \| CreateWebhookActionModel[]

**Resposta:** `FlowchartBotModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `lastSnapshotId`: string?; `channels`: ChannelReferenceIdModel[]; `title`: string; `order`: number(float); `final`: boolean; `active`: boolean; `groupIds`: string[]; `updatedAtUTC`: string(date-time)?; `executionsCount`: integer(int32)?; `executionsDateUTC`: string(date-time)?; `snapshotTitle`: string?; `triggers`: BotEvent[]; `manualTriggers`: string[]; `steps`: FlowchartBotStepModel \| BlockContactActionModel \| ChangeChatPrivateStateActionModel \| FlowchartBotChatStartedEventModel \| CloseChatActionModel \| CommentBlockModel \| ConditionalActionModel \| DayOfTheWeekStepModel \| DeleteContactActionModel \| FlowMessageStepModel \| FlowchartBotManualStartedEventModel \| MemberTransferActionModel \| NotifyMemberActionModel \| OptionsStepModel \| PipelineItemActionModel \| RandomizerActionModel \| FeedbackRatingStepModel \| ScoreRatingStepModel \| RegexStepModel \| SectorTransferActionModel \| SendMessageActionModel \| SetChatVisibilityActionModel \| SetCustomFieldActionModel \| SetInactivityActionModel \| SetWaitingFlowActionModel \| SetWaitingStateActionModel \| FlowchartActionModel \| FlowchartBotEventModel \| InteractiveStepModel \| StartManualEntryActionModel \| SummarizeChatActionModel \| TagActionModel \| SendTeamMessageActionModel \| TemplateMessageStepModel \| TimeOfDayStepModel \| OneShotCronActionModel \| WaitingActionModel \| AsaasActionModel \| PipedriveActionModel \| WebhookActionModel[]

#### `GET /v1/bots/flowchart/botinstances/` (leitura)

Gets a paginated list of all the chatbots of type flowchart — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `botId` | query | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `startUTC` | query | string(date-time) |  |
| `endUTC` | query | string(date-time) |  |

**Resposta:** `PaginationOfFlowchartBotInstanceModel` — `page`: PaginationInfo; `items`: FlowchartBotInstanceModel[]

#### `GET /v1/bots/flowchart/{botId}/botinstances/{botInstanceId}/` (leitura)

Gets a paginated list of all the chatbots of type flowchart — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `botId`* | path | string |  |
| `botInstanceId`* | path | string |  |

**Resposta:** `FlowchartBotInstanceModel` — `id`: string; `bot`*: FlowchartBotModel; `botSnapshotId`: string?; `botId`: string; `organizationId`: string; `botTitle`: string; `botQuestions`*: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel[]; `data`*: map<objeto>; `chat`*: ChatIdReferenceModel; `status`: BotStatus; `createdAtUTC`: string(date-time); `navigationPath`: BotNavigationStepModel[]

#### `GET /v1/bots/flowchart/{botId}/botinstances/botsnapshots/{botSnapshotId}/` (leitura)

GET Bots — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `botId`* | path | string |  |
| `botSnapshotId`* | path | string |  |

**Resposta:** `FlowchartBotInstanceModel` — `id`: string; `bot`*: FlowchartBotModel; `botSnapshotId`: string?; `botId`: string; `organizationId`: string; `botTitle`: string; `botQuestions`*: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel[]; `data`*: map<objeto>; `chat`*: ChatIdReferenceModel; `status`: BotStatus; `createdAtUTC`: string(date-time); `navigationPath`: BotNavigationStepModel[]

#### `GET /v1/bots/flowchart/manual-starts/` (leitura)

Gets a paginated list of all the manual start steps — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string | Filter by bot title or trigger name |
| `hidden` | query | boolean | Filter by hidden status. When null, returns all |

**Resposta:** `PaginationOfFlowchartManualStartStep` — `page`: PaginationInfo; `items`: FlowchartManualStartStep[]

#### `PUT /v1/bots/flowchart/{id}/` (escrita)

PUT Bots — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `EditFlowchartBotModel` — `_t`: string; `channelIds`: string[]; `trigger`: BotTrigger; `title`: string?; `order`: number(float)?; `final`: boolean?; `active`: boolean; `groupIds`: string[]; `snapshotTitle`: string?; `steps`: CreateFlowchartBotStepModel \| CreateBlockContactActionModel \| CreateChangeChatPrivateStateActionModel \| CreateFlowchartBotChatStartedEventModel \| CreateCloseChatActionModel \| CreateCommentBlockModel \| CreateConditionalActionModel \| CreateTemplateMessageStepModel \| CreateDayOfTheWeekStepModel \| CreateDeleteContactActionModel \| CreateFlowMessageStepModel \| CreateFlowchartBotManualStartedEventModel \| CreateMemberTransferActionModel \| CreateNotifyMemberActionModel \| CreateOptionsStepModel \| CreatePipelineItemActionModel \| CreateRandomizerActionModel \| CreateFeedbackRatingStepModel \| CreateScoreRatingStepModel \| CreateRegexStepModel \| CreateSectorTransferActionModel \| CreateSendMessageActionModel \| CreateChatVisibilityActionModel \| CreateSetCustomFieldActionModel \| CreateSetInactivityActionModel \| CreateSetWaitingFlowActionModel \| CreateSetWaitingStateActionModel \| CreateFlowchartActionModel \| CreateFlowchartBotEventModel \| CreateInteractiveStepModel \| CreateStartManualEntryActionModel \| CreateSummarizeChatActionModel \| CreateTagActionModel \| CreateSendTeamMessageActionModel \| CreateTimeOfDayStepModel \| CreateOneShotCronActionModel \| CreateWaitingActionModel \| CreateAsaasActionModel \| CreatePipedriveActionModel \| CreateWebhookActionModel[]; `updateManualStartReferences`: boolean

**Resposta:** `FlowchartBotModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `lastSnapshotId`: string?; `channels`: ChannelReferenceIdModel[]; `title`: string; `order`: number(float); `final`: boolean; `active`: boolean; `groupIds`: string[]; `updatedAtUTC`: string(date-time)?; `executionsCount`: integer(int32)?; `executionsDateUTC`: string(date-time)?; `snapshotTitle`: string?; `triggers`: BotEvent[]; `manualTriggers`: string[]; `steps`: FlowchartBotStepModel \| BlockContactActionModel \| ChangeChatPrivateStateActionModel \| FlowchartBotChatStartedEventModel \| CloseChatActionModel \| CommentBlockModel \| ConditionalActionModel \| DayOfTheWeekStepModel \| DeleteContactActionModel \| FlowMessageStepModel \| FlowchartBotManualStartedEventModel \| MemberTransferActionModel \| NotifyMemberActionModel \| OptionsStepModel \| PipelineItemActionModel \| RandomizerActionModel \| FeedbackRatingStepModel \| ScoreRatingStepModel \| RegexStepModel \| SectorTransferActionModel \| SendMessageActionModel \| SetChatVisibilityActionModel \| SetCustomFieldActionModel \| SetInactivityActionModel \| SetWaitingFlowActionModel \| SetWaitingStateActionModel \| FlowchartActionModel \| FlowchartBotEventModel \| InteractiveStepModel \| StartManualEntryActionModel \| SummarizeChatActionModel \| TagActionModel \| SendTeamMessageActionModel \| TemplateMessageStepModel \| TimeOfDayStepModel \| OneShotCronActionModel \| WaitingActionModel \| AsaasActionModel \| PipedriveActionModel \| WebhookActionModel[]

### Grupo BulkSendSession

Envio em massa (sessões de disparo).

#### `POST /v1/bulk-send-session/` (escrita)

POST Bulk-Send-Session — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateBulkSendSessionModel` — `organizationId`: string; `channelId`: string; `title`: string; `expectedMessages`: integer(int32); `botId`: string?; `triggerName`: string?; `templateId`: string?

**Resposta:** `BasicBulkSendSessionModel \| BulkSendSessionModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `initiatedBy`: UTalkUserIdReferenceModel; `type`: BulkSendType; `messagesSent`: integer(int32); `totalScheduled`: integer(int32)?; `channel`: ChannelReferenceIdModel

#### `GET /v1/bulk-send-session/` (leitura)

GET Bulk-Send-Session — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `OrderBy` | query | BulkSendProperty |  |
| `Order` | query | Order |  |
| `Type.Rule` | query | FilterRules |  |
| `Type.Values` | query | BulkSendType[] |  |
| `queryString` | query | string |  |

**Resposta:** `PaginationOfBasicBulkSendSessionModel` — `page`: PaginationInfo; `items`: BasicBulkSendSessionModel \| BulkSendSessionModel[]

#### `GET /v1/bulk-send-session/{id}/` (leitura)

GET Bulk-Send-Session — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `BulkSendSessionModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `initiatedBy`: UTalkUserIdReferenceModel; `type`: BulkSendType; `messagesSent`: integer(int32); `totalScheduled`: integer(int32)?; `channel`: ChannelReferenceIdModel; `bot`: BulkSendBotInstanceReferenceModel; `template`: SimpleTemplateModel; `fileId`: string?; `totalFailed`: integer(int32); `totalRead`: integer(int32); `totalProcessing`: integer(int32); `totalSent`: integer(int32); `messageStates`: StateCountOfMessageStates[]; `scheduleStates`: StateCountOfScheduledMessageStatus[]; `botStatuses`: StateCountOfBotStatus[]; `botStopReasons`: StateCountOfBotStopReason[]

#### `GET /v1/bulk-send-session/{id}/scheduled/` (leitura)

GET Bulk-Send-Session — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `Order` | query | Order |  |
| `QueryString` | query | string | Filters by contact name or phone number (case-insensitive partial match). |
| `Status.Rule` | query | FilterRules |  |
| `Status.Values` | query | ScheduledMessageStatus[] |  |
| `MessageState.Rule` | query | FilterRules |  |
| `MessageState.Values` | query | MessageStates[] |  |
| `BotStatus.Rule` | query | FilterRules |  |
| `BotStatus.Values` | query | BotStatus[] |  |
| `BotStopReason.Rule` | query | FilterRules |  |
| `BotStopReason.Values` | query | BotStopReason[] |  |
| `id`* | path | string |  |

**Resposta:** `PaginationOfBulkSendScheduleModel` — `page`: PaginationInfo; `items`: BulkSendScheduleModel[]

#### `GET /v1/bulk-send-session/{id}/messages-sent/` (leitura)

GET Bulk-Send-Session — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `order` | query | Order |  |
| `id`* | path | string |  |
| `queryString` | query | string |  |

**Resposta:** `PaginationOfBulkSendMessageModel` — `page`: PaginationInfo; `items`: BulkSendMessageModel[]

### Grupo Channels

Canais (números de WhatsApp, Instagram etc.) conectados.

#### `GET /v1/channels/{id}/` (leitura)

Get more information of a channel — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel |

**Resposta:** `ChannelBaseModel \| BrokerWhatsappChannelModel \| CloudAPIWhatsappChannelModel \| ExternalChannelBaseModel \| GupshupInstagramChannelModel \| GupshupWhatsappChannelModel \| InstagramChannelBaseModel \| InternalChannelBaseModel \| MembersChannelModel \| PhoneNumberChannelBaseModel \| UsernameChannelBaseModel \| WebsiteWidgetChannelModel \| WelcomerChannelModel \| WhatsappChannelBaseModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?

#### `PUT /v1/channels/{id}/` (escrita)

This route allows editing some information of an existing channel. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel to edit |

**Corpo:** `UpdateChannelModel` — `displayName`: string?; `about`: string?; `description`: string?; `businessWebsites`: string[]; `address`: EditAddressModel \| CountryRequiredEditAddressModel \| RequiredEditAddressModel; `businessType`: BusinessType; `pictureDataUrl`: string?; `defaultSectorId`: string?; `groupIds`: string[]; `callBehavior`: UpdateCallBehaviorModel; `iceBreakers`: string[]

**Resposta:** `ChannelBaseModel \| BrokerWhatsappChannelModel \| CloudAPIWhatsappChannelModel \| ExternalChannelBaseModel \| GupshupInstagramChannelModel \| GupshupWhatsappChannelModel \| InstagramChannelBaseModel \| InternalChannelBaseModel \| MembersChannelModel \| PhoneNumberChannelBaseModel \| UsernameChannelBaseModel \| WebsiteWidgetChannelModel \| WelcomerChannelModel \| WhatsappChannelBaseModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?

#### `DELETE /v1/channels/{id}/` (escrita)

Attempts to delete an existing Channel. Note that not all combinations of channel types and states can be deleted by this action. If yours is such case, please contact support — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel |
| `reason` | query | string | Reason for deleting the channel |

**Resposta:** `ChannelBaseModel \| BrokerWhatsappChannelModel \| CloudAPIWhatsappChannelModel \| ExternalChannelBaseModel \| GupshupInstagramChannelModel \| GupshupWhatsappChannelModel \| InstagramChannelBaseModel \| InternalChannelBaseModel \| MembersChannelModel \| PhoneNumberChannelBaseModel \| UsernameChannelBaseModel \| WebsiteWidgetChannelModel \| WelcomerChannelModel \| WhatsappChannelBaseModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?

#### `GET /v1/channels/` (leitura)

Get basic information on all channels of the organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `OrganizationChannelReferenceBaseModel \| OrganizationBrokerWhatsappChannelReferenceModel \| OrganizationCloudAPIWhatsappChannelReferenceModel \| OrganizationExternalChannelReferenceBaseModel \| OrganizationGupshupInstagramChannelReferenceModel \| OrganizationGupshupWhatsappChannelReferenceModel \| OrganizationInstagramChannelReferenceBaseModel \| OrganizationInternalChannelReferenceBaseModel \| OrganizationMembersChannelReferenceModel \| OrganizationPhoneNumberChannelReferenceBaseModel \| OrganizationUsernameChannelReferenceBaseModel \| OrganizationWebsiteWidgetChannelReferenceModel \| OrganizationWelcomerChannelReferenceModel \| OrganizationWhatsappChannelReferenceBaseModel[]`

#### `POST /v1/channels/starter/` (escrita)

Creates a new Starter channel. This one can be used right away after created, you just need to retrieve its synchronization QRCode with the "QRCode" action and scan it. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateStarterChannelModel` — `displayName`: string; `organizationId`: string

**Resposta:** `BrokerWhatsappChannelModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?; `phoneNumber`: string?; `callBehavior`: CallBehaviorModel; `channelType`: ChannelFilter; `lastSyncDate`: string(date-time); `autoSync`: boolean; `groupIds`: string[]

#### `POST /v1/channels/waba/` (escrita)

Creates a request for a Business channel. Do note that these cannot be created automatically, you will need to reach out to support with the created Id and follow their instructions to activate the channel. For this reason, and the lack of context for each necessary information, it is recommended that you create the channel using our existing form — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateWabaChannelModel` — `channelDisplayName`: string; `phoneNumber`: string?; `about`: string?; `pictureDataUrl`: string?; `description`: string?; `businessWebsites`: string[]; `address`: EditAddressModel \| CountryRequiredEditAddressModel \| RequiredEditAddressModel; `businessType`: BusinessType; `organizationId`: string; `wabaStatus`: PhoneNumberWabaStatus; `defaultSectorId`: string?

**Resposta:** `GupshupWhatsappChannelModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?; `phoneNumber`: string?; `callBehavior`: CallBehaviorModel; `channelType`: ChannelFilter; `about`: string?; `description`: string?; `businessWebsites`: string[]; `contactEmailAddress`: string?; `contactName`: string?; `contactPhoneNumber`: string?; `address`: AddressModel; `businessType`: string?; `wabaEvents`: WABAEventModel[]; `wabaState`: WABAState; `host`: string?; `isCoex`: boolean; `groupIds`: string[]; `completedSteps`: GupshupChannelSteps[]; `embedLink`: GupshupEmbedLinkModel; `iceBreakers`: string[]; `businessUsername`: string?

#### `POST /v1/channels/{id}/groups/` (escrita)

Adds one or more group IDs to the channel — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel to edit |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `ChannelBaseModel \| BrokerWhatsappChannelModel \| CloudAPIWhatsappChannelModel \| ExternalChannelBaseModel \| GupshupInstagramChannelModel \| GupshupWhatsappChannelModel \| InstagramChannelBaseModel \| InternalChannelBaseModel \| MembersChannelModel \| PhoneNumberChannelBaseModel \| UsernameChannelBaseModel \| WebsiteWidgetChannelModel \| WelcomerChannelModel \| WhatsappChannelBaseModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?

#### `GET /v1/channels/{id}/business-username/suggestions/` (leitura)

Gets business username suggestions. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel |

**Resposta:** `string[]`

#### `GET /v1/channels/{id}/business-username/` (leitura)

Fetches the current business username, if it differs from the stored value, updates it. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel |

**Resposta:** `GupshupWhatsappChannelModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string; `pictureUrl`: string(uri)?; `defaultSector`: SectorReferenceModel; `defaultBusinessHour`: BusinessHourReferenceModel; `state`: ChannelState; `organization`: OrganizationReferenceIdModel; `deleteReason`: string?; `phoneNumber`: string?; `callBehavior`: CallBehaviorModel; `channelType`: ChannelFilter; `about`: string?; `description`: string?; `businessWebsites`: string[]; `contactEmailAddress`: string?; `contactName`: string?; `contactPhoneNumber`: string?; `address`: AddressModel; `businessType`: string?; `wabaEvents`: WABAEventModel[]; `wabaState`: WABAState; `host`: string?; `isCoex`: boolean; `groupIds`: string[]; `completedSteps`: GupshupChannelSteps[]; `embedLink`: GupshupEmbedLinkModel; `iceBreakers`: string[]; `businessUsername`: string?

#### `PUT /v1/channels/{id}/business-username/` (escrita)

Sets or changes the business username. To handle errors codes check https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids#adopt-or-change-a-business-username — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel |

**Corpo:** `UpdateBusinessUsernameModel` — `businessUsername`: string; `transferAction`: BusinessUsernameTransferAction

**Resposta:** sem corpo.

#### `DELETE /v1/channels/{id}/business-username/` (escrita)

Deletes the business username. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel |

**Resposta:** sem corpo.

### Grupo ChatTags

Etiquetas aplicadas a uma conversa.

#### `POST /v1/chats/{id}/tags/` (escrita)

Adds a tag to an existing chat. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |

**Corpo:** `AttachTagModel` — `tagId`: string; `organizationId`: string

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `DELETE /v1/chats/{id}/tags/{tagId}/` (escrita)

Removes a tag of an existing chat. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |
| `tagId`* | path | string |  |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `POST /v1/chats/{id}/tags/list/` (escrita)

Add a list of tags to a chat. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |

**Corpo:** `AttachTagsModel` — `tagIds`: string[]; `organizationId`: string

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `DELETE /v1/chats/{id}/tags/list/` (escrita)

Delete a list of tags to a chat. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `AttachTagsModel` — `tagIds`: string[]; `organizationId`: string

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

### Grupo Chats

Conversas (chats): listar, abrir, transferir, fechar, mover de setor.

#### `GET /v1/chats/` (leitura)

Gets basic info of all chats — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Sectors.Rule` | query | FilterRules |  |
| `Sectors.Values` | query | string[] |  |
| `PhoneNumbers` | query | string[] |  |
| `Searchtext` | query | string |  |
| `RelativeStartFromEventUTC` | query | string(date-time) |  |
| `RelativeTakeDirection` | query | TakeDirection |  |
| `Type` | query | FilterTypes |  |
| `ChatState` | query | ChatState | padrão Open |
| `ContactTypes` | query | ContactType[] |  |
| `LastMessage` | query | LastMessage | padrão All |
| `Order` | query | Order | padrão Desc |
| `ChatOrderBy` | query | ChatOrderBy | padrão LastMessage |
| `DateStartCreatedAtUTC` | query | string(date-time) |  |
| `DateEndCreatedAtUTC` | query | string(date-time) |  |
| `IncludePinneds` | query | boolean | padrão true |
| `Visibility` | query | ChatVisibility[] |  |
| `Messages` | query | ReadState | padrão All |
| `Participants.Rule` | query | FilterRules |  |
| `Participants.Values` | query | string[] |  |
| `Tags.Rule` | query | FilterRules |  |
| `Tags.Values` | query | string[] |  |
| `Members.Rule` | query | FilterRules |  |
| `Members.Values` | query | string[] |  |
| `Channels.Rule` | query | FilterRules |  |
| `Channels.Values` | query | string[] |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfBasicChatModel` — `page`: PaginationInfo; `items`: BasicChatModel \| ChatModel[]

#### `POST /v1/chats/` (escrita)

Creates a new chat for a contact in a channel. If there's already a chat open with this contact and this channel, it will be returned and nothing will be created — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `CreateChatModel` — `contactId`: string; `channelId`: string; `organizationId`: string; `transferredFromChatId`: string?; `transferReason`: string?

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `GET /v1/chats/pinned/` (leitura)

f Gets all pinned chats — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `PinnedChatsModel` — `chats`*: BasicChatModel \| ChatModel[]

#### `GET /v1/chats/{id}/` (leitura)

Gets all the details of a single chat — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the chat to get |
| `includeMessages` | query | integer(int32) | padrão 0; How many messages to include in the LatestMessages array |
| `includeMetadata` | query | boolean | padrão false; When true, the LatestMessages array also includes timeline metadata entries (transfers, tag changes, etc.). Defaults to false so integrations that expect only messages keep their existing response shape. |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `PUT /v1/chats/{id}/` (escrita)

Allows updating bunch of options and states of a chat, like closing, marking as private, assigning it to another member and/or sector etc. — Rate limit: Up to 250 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the chat to update |

**Corpo:** `UpdateChatModel` — `open`: boolean?; `sectorId`: string?; `memberId`: string?; `private`: boolean?; `mute`: boolean?; `waiting`: boolean?; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `visibility`: ChatVisibility; `favorites`: string[]; `transferReason`: string?

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `DELETE /v1/chats/{id}/` (escrita)

DELETE Chats — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `BasicChatModel \| ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]

#### `GET /v1/chats/{chatId}/relative-messages/` (leitura)

Gets messages from anywhere in a chat based in the desired start date — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `chatId`* | path | string | Id of the chat to search the messages in |
| `FromEventUTC`* | query | string(date-time) | Starting point to get the messages |
| `Take`* | query | integer(int32) | padrão 50; How many messages to take after or before the specified date |
| `Direction`* | query | TakeDirection | padrão TakeBefore; In which direction to get the messages from the start date |
| `IncludeMetadata` | query | boolean | padrão false; When true, also returns timeline metadata entries (transfers, tag changes, etc.) interleaved with the messages. Defaults to false so integrations that expect only messages keep their existing response shape. |

**Resposta:** `RelativeMessagesResponseModel` — `hasMessagesBeforeAllowedOrganizationPlan`: boolean; `messages`*: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `GET /v1/chats/dm/{id}/` (leitura)

Get or Create a new dm chat. It can be used between organization members. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `GET /v1/chats/ai-assistant/` (leitura)

Gets or creates the current user's AIAssistant panel chat: a DM with the organization's AIAssistant AI agent, or with the AI agent given by agentId. Provisions the organization's AIAssistant agent on the first call without agentId. Idempotent. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `agentId` | query | string |  |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `POST /v1/chats/internal/` (escrita)

Creates a new internal chat for contacts of type `ContactType.MemberGroup`. If the contact does not exist, a new contact is created and a new internal chat is established. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateMembersChatModel` — `organizationId`: string; `contactName`: string

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `POST /v1/chats/internal/contact-id/` (escrita)

Creates a new internal chat for an existing contact of type `ContactType.MemberGroup` identified by `ContactId`/>. If the user does not have administrative permissions, returns the most recent closed chat for the contact. Otherwise, creates a new internal chat for the contact. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateMembersChatByContactIdModel` — `organizationId`: string; `contactId`: string

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `POST /v1/chats/private-group/` (escrita)

POST Chats — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreatePrivateMemberGroupModel` — `organizationId`: string; `contactName`: string; `members`: string[]

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `POST /v1/chats/ai-conversation/` (escrita)

POST Chats — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateAIConversationModel` — `organizationId`: string; `contactName`: string; `aiAgentId`: string

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `PUT /v1/chats/{id}/private-group/members/` (escrita)

PUT Chats — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdatePrivateGroupMembersModel` — `members`: string[]

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `GET /v1/chats/sandbox/{targetId}/` (leitura)

Gets the current member's open sandbox chat for a target (a chatbot), creating one if none is open. Visible only to the member. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `targetId`* | path | string |  |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `PUT /v1/chats/{id}/read/` (escrita)

If the contact type is Umbler.UTalk.Core.Domain.ContactType.DirectMessage or Umbler.UTalk.Core.Domain.ContactType.Group, marks the desired chat as having its last message with an Read state. Chat must have at least one message for it to work. If the contact type is Umbler.UTalk.Core.Domain.ContactType.MemberDirectMessage or Umbler.UTalk.Core.Domain.ContactType.MemberGroup, it resets the unread counter for the current member and notifies them. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the chat to mark as Read |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `PUT /v1/chats/{id}/unread/` (escrita)

Marks the chat as unread. - For DirectMessage and Group, marks the desired chat as having its last message with an Unread state. Chat must have at least one message for it to work. - For MemberDirectMessage or MemberGroup, sets the member's unread count to 1 if it's currently zero. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the chat to mark as unread |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `POST /v1/chats/start-bot/` (escrita)

POST Chats — Rate limit: Up to 120 requests in a 1 minute window

**Corpo:** `ChatbotModel` — `chatId`: string?; `toPhone`: string?; `fromPhone`: string?; `botId`: string; `triggerName`: string; `organizationId`: string; `bulkSession`: string?; `contactName`: string?; `initialData`: map<string>; `parallel`: boolean?

**Resposta:** `BasicChatModel \| ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]

#### `GET /v1/chats/{id}/credit-conversation/` (leitura)

Get all messages conversation window from this chat. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the Conversation |

**Resposta:** `CreditConversationModel[]`

#### `PUT /v1/chats/{id}/pin/` (escrita)

Pin a message to the top of the list. This is individual. The pinned conversations can only be seen by you. Max of 3 pinned messages. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the Conversation |
| `pin` | query | boolean | If true, pin chat; if false, unpin |

**Resposta:** `ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

#### `GET /v1/chats/basic-info/` (leitura)

GET Chats — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `StartDate` | query | string(date-time) |  |
| `EndDate` | query | string(date-time) |  |
| `ClosedStartDate` | query | string(date-time) |  |
| `ClosedEndDate` | query | string(date-time) |  |
| `ChannelId` | query | string |  |
| `ChatState` | query | ChatState |  |
| `Searchtext` | query | string |  |
| `ChatOrderBy` | query | ChatOrderBy | padrão CreatedAtUTC |
| `Order` | query | Order | padrão Desc |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfBasicChatModel` — `page`: PaginationInfo; `items`: BasicChatModel \| ChatModel[]

#### `GET /v1/chats/{id}/favorite-messages/` (leitura)

Gets all the favorite messages of a single chat — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the current chat |

**Resposta:** `MessageModel \| SentMessageModel[]`

### Grupo ContactRatings

Avaliações (nota) dadas pelos contatos.

#### `GET /v1/contact-ratings/` (leitura)

Paginated list of all ratings in the organization. Filterable by repository and date range. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `startUTC` | query | string(date-time) |  |
| `endUTC` | query | string(date-time) |  |
| `onlyRepositories` | query | string[] | Filter by repository names. All possibilities can be obtained by the GET repositories route in this group |
| `OrderBy` | query | ContactRatingProperty |  |
| `Order` | query | Order |  |
| `channelId` | query | string | The identifier of the channel used to filter the contact ratings. |
| `botId` | query | string | The unique identifier of the bot. |

**Resposta:** `PaginationOfContactRatingsModel` — `page`: PaginationInfo; `items`: ContactRatingsModel[]

#### `GET /v1/contact-ratings/simplified/` (leitura)

Non-paginated, simplified list of all ratings in the organization. Filterable by repository and date range. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `startUTC` | query | string(date-time) |  |
| `endUTC` | query | string(date-time) |  |
| `onlyRepositories` | query | string[] | Filter by repository names. All possibilities can be obtained by the GET repositories route in this group |
| `channelId` | query | string | The identifier of the channel used to filter the contact ratings. |
| `botId` | query | string | The unique identifier of the bot. |

**Resposta:** `ContactRatingSimplifiedModel[]`

#### `GET /v1/contact-ratings/repositories/` (leitura)

Gets all unique repository names that have ratings. Useful to know what can be used as a filter for the routes that list the ratings. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `string[]`

#### `GET /v1/contact-ratings/by-chat/{chatId}/` (leitura)

Gets all the ratings given to a specific chat — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `chatId`* | path | string | The chat id |

**Resposta:** `ContactRatingsModel[]`

### Grupo ContactTags

Etiquetas aplicadas a um contato.

#### `POST /v1/contacts/{id}/tags/` (escrita)

Adds a tag to a contact. The list of tags can later be retrieved using the contact's GET action. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the Contact to update |

**Corpo:** `AttachTagModel` — `tagId`: string; `organizationId`: string

**Resposta:** `SimpleContactModel \| ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?

#### `DELETE /v1/contacts/{id}/tags/` (escrita)

Removes a tag from a contact. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact |
| `tagId` | query | string | The Id of the tag |

**Resposta:** `SimpleContactModel \| ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?

#### `POST /v1/contacts/{id}/tags/list/` (escrita)

Add a list of tags to a contact. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |

**Corpo:** `AttachTagsModel` — `tagIds`: string[]; `organizationId`: string

**Resposta:** `SimpleContactModel \| ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?

#### `DELETE /v1/contacts/{id}/tags/list/` (escrita)

Delete a list of tags to a contact. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `AttachTagsModel` — `tagIds`: string[]; `organizationId`: string

**Resposta:** `SimpleContactModel \| ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?

### Grupo Contacts

Contatos/leads: cadastro, campos personalizados, notas, bloqueio.

#### `GET /v1/contacts/{id}/chats/` (leitura)

Gets a paginated list of current and past chats that belong to the selected contact — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact to get the chats from |
| `ChatState` | query | ChatState | padrão All |
| `RelativeStartFromEventUTC` | query | string(date-time) |  |
| `RelativeTakeDirection` | query | TakeDirection |  |
| `Tags.Rule` | query | FilterRules |  |
| `Tags.Values` | query | string[] |  |
| `Members.Rule` | query | FilterRules |  |
| `Members.Values` | query | string[] |  |
| `Channels.Rule` | query | FilterRules |  |
| `Channels.Values` | query | string[] |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfBasicChatModel` — `page`: PaginationInfo; `items`: BasicChatModel \| ChatModel[]

#### `GET /v1/contacts/` (leitura)

Gets a paginated list of all contacts in the organization, with optional filters — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `QueryString` | query | string |  |
| `Tags.Rule` | query | FilterRules |  |
| `Tags.Values` | query | string[] |  |
| `State` | query | ContactState |  |
| `OrderBy` | query | ContactProperty |  |
| `Order` | query | Order |  |
| `RelativeCursor` | query | string |  |
| `RelativeTakeDirection` | query | TakeDirection |  |
| `includeGroups` | query | boolean |  |
| `includeCustomFields` | query | string[] |  |
| `CustomFields` | query | FilterContactCustomFieldGroupModel[] |  |

**Resposta:** `PaginationOfSimpleContactModel` — `page`: PaginationInfo; `items`: SimpleContactModel \| ContactModel[]

#### `POST /v1/contacts/` (escrita)

Creates a new contact in the selected organization. — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateContactModel` — `name`: string?; `phoneNumber`: string; `organizationId`: string; `address`: EditAddressModel \| CountryRequiredEditAddressModel \| RequiredEditAddressModel; `landline`: string?; `gender`: string?; `email`: string(email)?; `profilePictureUrl`: string?; `source`: string?; `customFields`: CreateContactCustomFieldModel \| CreateContactCNPJCustomFieldModel \| CreateContactCPFCustomFieldModel \| CreateContactContactReferenceCustomFieldModel \| CreateContactCurrencyCustomFieldModel \| CreateContactDateCustomFieldModel \| CreateContactDecimalCustomFieldModel \| CreateContactLinkCustomFieldModel \| CreateContactLogicCustomFieldModel \| CreateContactMemberCustomFieldModel \| CreateContactMultiOptionsCustomFieldModel \| CreateContactNumberCustomFieldModel \| CreateContactTextCustomFieldModel \| CreateContactListFileCustomFieldModel \| CreateContactListContactReferenceCustomFieldModel \| CreateContactListMemberCustomFieldModel \| CreateContactDictionaryCustomFieldModel \| CreateContactListStringCustomFieldModel[]; `tagIds`: string[]; `channelIds`: string[]; `skipProfilePictureFetch`: boolean

**Resposta:** `ContactSaveModel` — `contact`*: ContactModel; `alreadyExisted`: boolean

#### `GET /v1/contacts/member-groups/` (leitura)

Gets a paginated list of contacts whose `ContactType` is Umbler.UTalk.Core.Domain.ContactType.MemberGroup, applying optional filters such as search query and tags. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `QueryString` | query | string |  |
| `Tags.Rule` | query | FilterRules |  |
| `Tags.Values` | query | string[] |  |
| `OrderBy` | query | MemberGroupContactsProperty |  |
| `Order` | query | Order |  |

**Resposta:** `PaginationOfSimpleContactModel` — `page`: PaginationInfo; `items`: SimpleContactModel \| ContactModel[]

#### `GET /v1/contacts/{id}/` (leitura)

Gets all details of a single contact — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact |

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `PUT /v1/contacts/{id}/` (escrita)

Allows to update some information associated to an existing contact — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact to update |

**Corpo:** `UpdateContactModel` — `name`: string?; `address`: EditAddressModel \| CountryRequiredEditAddressModel \| RequiredEditAddressModel; `landline`: string?; `gender`: string?; `email`: string?; `profilePictureUrl`: string?; `customFields`: CreateContactCustomFieldModel \| CreateContactCNPJCustomFieldModel \| CreateContactCPFCustomFieldModel \| CreateContactContactReferenceCustomFieldModel \| CreateContactCurrencyCustomFieldModel \| CreateContactDateCustomFieldModel \| CreateContactDecimalCustomFieldModel \| CreateContactLinkCustomFieldModel \| CreateContactLogicCustomFieldModel \| CreateContactMemberCustomFieldModel \| CreateContactMultiOptionsCustomFieldModel \| CreateContactNumberCustomFieldModel \| CreateContactTextCustomFieldModel \| CreateContactListFileCustomFieldModel \| CreateContactListContactReferenceCustomFieldModel \| CreateContactListMemberCustomFieldModel \| CreateContactDictionaryCustomFieldModel \| CreateContactListStringCustomFieldModel[]; `tagIds`: string[]; `channelIds`: string[]

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `DELETE /v1/contacts/{id}/` (escrita)

Deletes a contact. You have the option of either closing their open chats or deleting all of them. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the contact to delete |
| `chatAction`* | query | DeleteContactChatAction | padrão Close; What to do with this contact's chats |

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `GET /v1/contacts/{id}/profile/` (leitura)

Gets the most basic information about the contact — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `SimpleContactModel \| ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?

#### `GET /v1/contacts/phone/` (leitura)

Gets a contact by its phone number — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `phoneNumber`* | query | string | The phone number to search |

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `PUT /v1/contacts/{id}/blocked/` (escrita)

Updates the blocked status of a contact. A blocked contact cannot send messages to your organization — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the user to block or unblock |
| `isBlocked`* | query | boolean | Sets the desired block state |

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `GET /v1/contacts/{id}/notes/` (leitura)

Get all notes from a contact. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the contact to add the note to |

**Resposta:** `NoteModel[]`

#### `POST /v1/contacts/{id}/notes/` (escrita)

Allows adding a note to an existing contact that can be retrieved later in the full GET method. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The id of the contact to add the note to |

**Corpo:** `CreateNoteModel` — `content`: string; `organizationId`: string; `elements`: string?; `mentions`: MessageMentionModel[]

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `DELETE /v1/contacts/{id}/notes/{noteId}/` (escrita)

Deletes a note attached to a contact by its Id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact that contains the note |
| `noteId`* | path | string | The Id of the note to delete |

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `PUT /v1/contacts/{id}/notes/{noteId}/pin/` (escrita)

Pins or unpins a specific note for a given contact. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact. |
| `noteId`* | path | string | The Id of the note to pin or unpin. |
| `pin` | query | boolean | If true, the note will be pinned; if false, it will be unpinned. |

**Resposta:** `ContactModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

#### `GET /v1/contacts/{id}/note/{noteId}/` (leitura)

Returns a note by its ID for the given contact. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The ID of the contact. |
| `noteId`* | path | string | The ID of the note. |

**Resposta:** `NoteModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `content`: string; `pinned`: boolean; `createdBy`: string; `elements`: string?; `mentions`: MessageMentionModel[]

#### `GET /v1/contacts/{id}/custom-fields/` (leitura)

Get all custom fields from a contact. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact to get all the custom fields |

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]`

#### `POST /v1/contacts/{id}/custom-fields/` (escrita)

Allows adding a custom field to an existing contact that can be retrieved later in the full GET method. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the contact to add the custom field to |

**Corpo:** `CreateContactCustomFieldModel \| CreateContactCNPJCustomFieldModel \| CreateContactCPFCustomFieldModel \| CreateContactContactReferenceCustomFieldModel \| CreateContactCurrencyCustomFieldModel \| CreateContactDateCustomFieldModel \| CreateContactDecimalCustomFieldModel \| CreateContactLinkCustomFieldModel \| CreateContactLogicCustomFieldModel \| CreateContactMemberCustomFieldModel \| CreateContactMultiOptionsCustomFieldModel \| CreateContactNumberCustomFieldModel \| CreateContactTextCustomFieldModel \| CreateContactListFileCustomFieldModel \| CreateContactListContactReferenceCustomFieldModel \| CreateContactListMemberCustomFieldModel \| CreateContactDictionaryCustomFieldModel \| CreateContactListStringCustomFieldModel` — `_t`: string; `customFieldDefinitionId`: string; `organizationId`: string

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel` — `_t`: string; `id`: string; `customFieldDefinitionId`: string

#### `PUT /v1/contacts/{id}/custom-fields/` (escrita)

Adds the custom field to the contact, or replaces the current value when the definition is already filled. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `CreateContactCustomFieldModel \| CreateContactCNPJCustomFieldModel \| CreateContactCPFCustomFieldModel \| CreateContactContactReferenceCustomFieldModel \| CreateContactCurrencyCustomFieldModel \| CreateContactDateCustomFieldModel \| CreateContactDecimalCustomFieldModel \| CreateContactLinkCustomFieldModel \| CreateContactLogicCustomFieldModel \| CreateContactMemberCustomFieldModel \| CreateContactMultiOptionsCustomFieldModel \| CreateContactNumberCustomFieldModel \| CreateContactTextCustomFieldModel \| CreateContactListFileCustomFieldModel \| CreateContactListContactReferenceCustomFieldModel \| CreateContactListMemberCustomFieldModel \| CreateContactDictionaryCustomFieldModel \| CreateContactListStringCustomFieldModel` — `_t`: string; `customFieldDefinitionId`: string; `organizationId`: string

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel` — `_t`: string; `id`: string; `customFieldDefinitionId`: string

#### `GET /v1/contacts/{id}/custom-fields/{customFieldId}/` (leitura)

Get a custom field from a contact by Id. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact |
| `customFieldId`* | path | string | The Id of the custom field or custom field definition to get |

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel` — `_t`: string; `id`: string; `customFieldDefinitionId`: string

#### `PUT /v1/contacts/{id}/custom-fields/{customFieldId}/` (escrita)

Allows editing a custom field to an existing contact that can be retrieved later in the full GET method. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact to edit the custom field to |
| `customFieldId`* | path | string | The Id of the custom field or custom field definition to edit |

**Corpo:** `EditContactCustomFieldModel \| EditContactCNPJCustomFieldModel \| EditContactCPFCustomFieldModel \| EditContactContactReferenceCustomFieldModel \| EditContactCurrencyCustomFieldModel \| EditContactDateCustomFieldModel \| EditContactDecimalCustomFieldModel \| EditContactLinkCustomFieldModel \| EditContactLogicCustomFieldModel \| EditContactMemberCustomFieldModel \| EditContactMultiOptionsCustomFieldModel \| EditContactNumberCustomFieldModel \| EditContactTextCustomFieldModel \| EditContactListFileCustomFieldModel \| EditContactListContactReferenceCustomFieldModel \| EditContactListMemberCustomFieldModel \| EditContactDictionaryCustomFieldModel \| EditContactListStringCustomFieldModel` — `_t`: string; `organizationId`: string

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel` — `_t`: string; `id`: string; `customFieldDefinitionId`: string

#### `DELETE /v1/contacts/{id}/custom-fields/{customFieldId}/` (escrita)

Deletes a custom field to a contact by its Id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the contact that contains the custom field |
| `customFieldId`* | path | string | The Id of the custom field or custom field definition to delete |

**Resposta:** sem corpo.

#### `POST /v1/contacts/{id}/custom-fields/simplified/` (escrita)

Allows adding or editing a simplified custom field to an existing contact that can be retrieved later in the full GET method. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The unique identifier of the contact associated with the custom field. |

**Corpo:** `SimplifiedCustomFieldModel` — `name`: string; `value`: string; `organizationId`: string

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel` — `_t`: string; `id`: string; `customFieldDefinitionId`: string

#### `POST /v1/contacts/{id}/custom-fields/simplified/batch/` (escrita)

Allows adding or editing a batch of simplified custom fields to an existing contact that can be retrieved later in the full GET method. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The unique identifier of the contact associated with the custom fields. |

**Corpo:** `BatchSimplifiedCustomFieldModel` — `customFields`: BatchSimplifiedCustomFieldItemModel[]; `organizationId`: string

**Resposta:** `ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]`

#### `GET /v1/contacts/custom-field-aggregation/` (leitura)

GET Contacts — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `QueryString` | query | string |  |
| `Tags.Rule` | query | FilterRules |  |
| `Tags.Values` | query | string[] |  |
| `State` | query | ContactState |  |
| `CustomFieldDefinitionId` | query | string |  |
| `AggregationType` | query | AggregationType |  |
| `CustomFields` | query | FilterContactCustomFieldGroupModel[] |  |

**Resposta:** `CustomFieldAggregationModel \| DateCustomFieldAggregationModel \| DecimalCustomFieldAggregationModel \| NumberCustomFieldAggregationModel` — `_t`: string; `contactCount`: integer(int32)

#### `GET /v1/contacts/check-whatsapp/` (leitura)

Checks if a phone number exists on WhatsApp using the organization's live Starter channels with load balancing. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `phone`* | query | string | Phone number to check (e.g. 5511999999999) |

**Resposta:** `NumberExistsModel` — `exists`: boolean; `whatsappId`: string?; `profilePicUrl`: string?

### Grupo CustomFieldDefinitions

Definição dos campos personalizados dos contatos.

#### `GET /v1/custom-field-definitions/` (leitura)

Get all custom field definitions from a organization. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `CustomFieldDefinitionModel \| CNPJCustomFieldDefinitionModel \| CPFCustomFieldDefinitionModel \| ContactReferenceCustomFieldDefinitionModel \| CurrencyCustomFieldDefinitionModel \| DateCustomFieldDefinitionModel \| DecimalCustomFieldDefinitionModel \| LinkCustomFieldDefinitionModel \| ListContactReferenceCustomFieldDefinitionModel \| ListFileCustomFieldDefinitionModel \| ListMemberCustomFieldDefinitionModel \| LogicCustomFieldDefinitionModel \| MemberCustomFieldDefinitionModel \| MultiOptionsCustomFieldDefinitionModel \| NumberCustomFieldDefinitionModel \| DictionaryCustomFieldDefinitionModel \| ListStringCustomFieldDefinitionModel \| TextCustomFieldDefinitionModel[]`

#### `POST /v1/custom-field-definitions/` (escrita)

Allows adding a custom field definition to an existing organization that can be retrieved later in the full GET method. — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateCustomFieldDefinitionModel \| CreateCurrencyCustomFieldDefinitionModel \| CreateDecimalCustomFieldDefinitionModel \| CreateListContactReferenceCustomFieldDefinitionModel \| CreateListFileCustomFieldDefinitionModel \| CreateListMemberCustomFieldDefinitionModel \| CreateMultiOptionsCustomFieldDefinitionModel \| CreateDictionaryCustomFieldDefinitionModel \| CreateListStringCustomFieldDefinitionModel \| CreateCNPJCustomFieldDefinitionModel \| CreateCPFCustomFieldDefinitionModel \| CreateContactReferenceCustomFieldDefinitionModel \| CreateDateCustomFieldDefinitionModel \| CreateLinkCustomFieldDefinitionModel \| CreateLogicCustomFieldDefinitionModel \| CreateMemberCustomFieldDefinitionModel \| CreateNumberCustomFieldDefinitionModel \| CreateTextCustomFieldDefinitionModel` — `_t`: string; `name`: string; `description`: string?; `organizationId`: string

**Resposta:** `CustomFieldDefinitionModel \| CNPJCustomFieldDefinitionModel \| CPFCustomFieldDefinitionModel \| ContactReferenceCustomFieldDefinitionModel \| CurrencyCustomFieldDefinitionModel \| DateCustomFieldDefinitionModel \| DecimalCustomFieldDefinitionModel \| LinkCustomFieldDefinitionModel \| ListContactReferenceCustomFieldDefinitionModel \| ListFileCustomFieldDefinitionModel \| ListMemberCustomFieldDefinitionModel \| LogicCustomFieldDefinitionModel \| MemberCustomFieldDefinitionModel \| MultiOptionsCustomFieldDefinitionModel \| NumberCustomFieldDefinitionModel \| DictionaryCustomFieldDefinitionModel \| ListStringCustomFieldDefinitionModel \| TextCustomFieldDefinitionModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `description`: string?

#### `GET /v1/custom-field-definitions/{id}/` (leitura)

Get a custom field definition from a organization by Id. The Id of the custom field definition to get — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `CustomFieldDefinitionModel \| CNPJCustomFieldDefinitionModel \| CPFCustomFieldDefinitionModel \| ContactReferenceCustomFieldDefinitionModel \| CurrencyCustomFieldDefinitionModel \| DateCustomFieldDefinitionModel \| DecimalCustomFieldDefinitionModel \| LinkCustomFieldDefinitionModel \| ListContactReferenceCustomFieldDefinitionModel \| ListFileCustomFieldDefinitionModel \| ListMemberCustomFieldDefinitionModel \| LogicCustomFieldDefinitionModel \| MemberCustomFieldDefinitionModel \| MultiOptionsCustomFieldDefinitionModel \| NumberCustomFieldDefinitionModel \| DictionaryCustomFieldDefinitionModel \| ListStringCustomFieldDefinitionModel \| TextCustomFieldDefinitionModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `description`: string?

#### `PUT /v1/custom-field-definitions/{id}/` (escrita)

Allows editing a custom field definition to an existing organization that can be retrieved later in the full GET method. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the custom field definition to edit |

**Corpo:** `EditCustomFieldDefinitionModel` — `name`: string; `description`: string?; `options`: UpdateMultiOptionsCustomFieldOptionModel[]; `attributes`: UpdateCustomFieldAttributeModel[]; `allowedMembers`: string[]; `organizationId`: string

**Resposta:** `CustomFieldDefinitionModel \| CNPJCustomFieldDefinitionModel \| CPFCustomFieldDefinitionModel \| ContactReferenceCustomFieldDefinitionModel \| CurrencyCustomFieldDefinitionModel \| DateCustomFieldDefinitionModel \| DecimalCustomFieldDefinitionModel \| LinkCustomFieldDefinitionModel \| ListContactReferenceCustomFieldDefinitionModel \| ListFileCustomFieldDefinitionModel \| ListMemberCustomFieldDefinitionModel \| LogicCustomFieldDefinitionModel \| MemberCustomFieldDefinitionModel \| MultiOptionsCustomFieldDefinitionModel \| NumberCustomFieldDefinitionModel \| DictionaryCustomFieldDefinitionModel \| ListStringCustomFieldDefinitionModel \| TextCustomFieldDefinitionModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `description`: string?

#### `DELETE /v1/custom-field-definitions/{id}/` (escrita)

Deletes a custom field definition to a organization by its Id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the organization custom field definition to delete |

**Resposta:** sem corpo.

#### `POST /v1/custom-field-definitions/files/` (escrita)

Uploads a file, limited to 100MB, to be referenced by a file list custom field value — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `object` — `file`*: string(binary)

**Resposta:** `CustomFieldFileModel` — `url`*: string(uri); `contentType`: string?; `originalName`: string?; `originalSizeBytes`: integer(int64)?

### Grupo FlowMessages

Mensagens de fluxos.

#### `POST /v1/flow-messages/` (escrita)

Sends a published WhatsApp Flow to an existing chat. — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateFlowMessageModel` — `organizationId`: string; `chatId`: string; `flowId`: string; `body`: string; `cta`: string; `skipReassign`: boolean

**Resposta:** `SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?; `contactId`: string

### Grupo Flows

Fluxos de automação.

#### `GET /v1/flows/` (leitura)

Lists the WhatsApp Flows of the organization. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `SimpleFlowModel[]`

#### `POST /v1/flows/` (escrita)

Creates a WhatsApp Flow as a local draft. Channels and provider sync only happen at publish time. — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `CreateFlowModel` — `organizationId`: string; `name`: string; `category`: FlowCategory; `screens`: FlowScreenModel[]

**Resposta:** `FlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `publishedAtUTC`: string(date-time)?; `channels`: FlowChannelLinkModel[]; `screens`: FlowScreenModel[]; `groupIds`: string[]

#### `PUT /v1/flows/` (escrita)

Updates a draft WhatsApp Flow. Published flows are immutable. Drafts are local only, so no provider call is made. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `UpdateFlowModel` — `flowId`: string; `name`: string; `category`: FlowCategory; `screens`: FlowScreenModel[]

**Resposta:** `FlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `publishedAtUTC`: string(date-time)?; `channels`: FlowChannelLinkModel[]; `screens`: FlowScreenModel[]; `groupIds`: string[]

#### `GET /v1/flows/{id}/` (leitura)

Gets a WhatsApp Flow by its id. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `FlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `publishedAtUTC`: string(date-time)?; `channels`: FlowChannelLinkModel[]; `screens`: FlowScreenModel[]; `groupIds`: string[]

#### `DELETE /v1/flows/{id}/` (escrita)

Deletes a WhatsApp Flow. A draft only exists locally, so it is simply removed. A published flow is retired on every channel first (the provider cannot delete a published flow, only deprecate it) and the local record is only removed once every channel confirms, so it never disappears while still sendable somewhere. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `FlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `publishedAtUTC`: string(date-time)?; `channels`: FlowChannelLinkModel[]; `screens`: FlowScreenModel[]; `groupIds`: string[]

#### `PUT /v1/flows/{id}/send-defaults/` (escrita)

Replaces the default message and button text suggested when the WhatsApp Flow is sent, at any status. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdateFlowSendDefaultsModel` — `defaultMessage`: string?; `defaultCta`: string?

**Resposta:** `SimpleFlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `channels`: FlowChannelLinkModel[]; `defaultMessage`: string?; `defaultCta`: string?; `updatedAtUTC`: string(date-time)?; `screenCount`: integer(int32); `questionCount`: integer(int32); `groupIds`: string[]

#### `POST /v1/flows/{id}/publish/` (escrita)

Publishes a draft WhatsApp Flow on the selected Gupshup channels at once. For each channel the flow is created remotely and published; channels that fail keep their error. Publishing is partial (not all-or-nothing). — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |

**Corpo:** `PublishFlowModel` — `organizationId`: string; `flowId`: string; `channelIds`: string[]; `category`: FlowCategory

**Resposta:** `FlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `publishedAtUTC`: string(date-time)?; `channels`: FlowChannelLinkModel[]; `screens`: FlowScreenModel[]; `groupIds`: string[]

#### `GET /v1/flows/publish-requirements/{channelId}/` (leitura)

Lists the conditions Meta weighs before accepting a WhatsApp Flow on the channel. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `channelId`* | path | string |  |

**Resposta:** `FlowPublishRequirementModel[]`

#### `GET /v1/flows/{id}/dependent-templates/` (leitura)

Lists the templates whose flow button opens this form and that are still sendable. Discontinuing the form kills every one of them, so the confirmation asks for it before committing. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `FlowDependentTemplateModel[]`

#### `POST /v1/flows/{id}/deprecate/` (escrita)

Retires a published WhatsApp Flow on every channel it was created on. The provider cannot delete a published flow, only deprecate it, so this is the way a live flow stops being sendable without losing its history. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `FlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `publishedAtUTC`: string(date-time)?; `channels`: FlowChannelLinkModel[]; `screens`: FlowScreenModel[]; `groupIds`: string[]

#### `POST /v1/flows/{id}/groups/` (escrita)

Adds one or more group IDs to the WhatsApp Flow. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `SimpleFlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `channels`: FlowChannelLinkModel[]; `defaultMessage`: string?; `defaultCta`: string?; `updatedAtUTC`: string(date-time)?; `screenCount`: integer(int32); `questionCount`: integer(int32); `groupIds`: string[]

#### `PUT /v1/flows/{id}/groups/` (escrita)

Replaces the group IDs of the WhatsApp Flow, so a flow can also leave a group. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `ReplaceGroupsModel` — `groupIds`: string[]

**Resposta:** `SimpleFlowModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `category`: FlowCategory; `status`: FlowStatus; `channels`: FlowChannelLinkModel[]; `defaultMessage`: string?; `defaultCta`: string?; `updatedAtUTC`: string(date-time)?; `screenCount`: integer(int32); `questionCount`: integer(int32); `groupIds`: string[]

### Grupo KnowledgeBases

Bases de conhecimento usadas pelos agentes de IA.

#### `GET /v1/knowledge-bases/` (leitura)

Gets all knowledge bases for the organization. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `KnowledgeBaseModel[]`

#### `POST /v1/knowledge-bases/` (escrita)

Creates a new knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `CreateKnowledgeBaseRequestModel` — `name`: string

**Resposta:** `KnowledgeBaseModel` — `id`: string; `name`: string; `organizationId`: string; `createdAt`: string(date-time); `status`: KnowledgeBaseStatuses; `isIngest`: boolean

#### `PUT /v1/knowledge-bases/{kbId}/name/` (escrita)

Updates the name of a knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Corpo:** `UpdateKnowledgeBaseNameRequestModel` — `name`: string

**Resposta:** `KnowledgeBaseModel` — `id`: string; `name`: string; `organizationId`: string; `createdAt`: string(date-time); `status`: KnowledgeBaseStatuses; `isIngest`: boolean

#### `GET /v1/knowledge-bases/{kbId}/agents/` (leitura)

Gets the agents that use a specific knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Resposta:** `KnowledgeBaseAgentModel[]`

#### `DELETE /v1/knowledge-bases/{kbId}/` (escrita)

Deletes a knowledge base, its content and its vectors. Blocked while any agent uses it. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Resposta:** sem corpo.

#### `POST /v1/knowledge-bases/{kbId}/ingest/` (escrita)

Triggers ingestion for a knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Resposta:** `IngestStatus`

#### `POST /v1/knowledge-bases/{kbId}/import-qas-from-chats/` (escrita)

Triggers Q&A generation from closed chats for a knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Resposta:** sem corpo.

#### `POST /v1/knowledge-bases/{kbId}/qa/file/` (escrita)

Creates Q&As for a knowledge base from a file. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Corpo:** `object` — `File`*: string(binary)

**Resposta:** `AIAgentQAModel[]`

#### `GET /v1/knowledge-bases/{kbId}/qa/` (leitura)

Gets Q&As for a knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string |  |

**Resposta:** `PaginationOfAIAgentQAModel` — `page`: PaginationInfo; `items`: AIAgentQAModel[]

#### `POST /v1/knowledge-bases/{kbId}/qa/` (escrita)

Creates a Q&A for a knowledge base. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Corpo:** `CreateAIAgentQAModel` — `title`: string; `content`: string; `kbId`: string?

**Resposta:** `AIAgentQAModel` — `id`*: string; `title`*: string; `content`*: string; `source`: AIAgentQASource

#### `DELETE /v1/knowledge-bases/{kbId}/qa/{qaId}/` (escrita)

Deletes a Q&A from a knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |
| `qaId`* | path | string |  |

**Resposta:** `AIAgentQAModel` — `id`*: string; `title`*: string; `content`*: string; `source`: AIAgentQASource

#### `GET /v1/knowledge-bases/{kbId}/website-crawlers/` (leitura)

Gets website crawlers for a knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string |  |

**Resposta:** `PaginationOfWebsiteCrawlerModel` — `page`: PaginationInfo; `items`: WebsiteCrawlerModel[]

#### `POST /v1/knowledge-bases/{kbId}/website-crawlers/` (escrita)

Creates a website crawler for a knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Corpo:** `CreateAIAgentWebsiteCrawlerModel` — `url`: string(uri); `recursive`: boolean; `kbId`: string?

**Resposta:** `WebsiteCrawlerModel` — `id`*: string; `url`*: string(uri); `recursive`: boolean; `pagesCount`: integer(int32)

#### `DELETE /v1/knowledge-bases/{kbId}/website-crawlers/{crawlerId}/` (escrita)

Deletes a website crawler from a knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |
| `crawlerId`* | path | string |  |

**Resposta:** `WebsiteCrawlerModel` — `id`*: string; `url`*: string(uri); `recursive`: boolean; `pagesCount`: integer(int32)

#### `GET /v1/knowledge-bases/{kbId}/documents/` (leitura)

Gets documents for a knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `query` | query | string |  |

**Resposta:** `PaginationOfAIAgentDocumentModel` — `page`: PaginationInfo; `items`: AIAgentDocumentModel[]

#### `POST /v1/knowledge-bases/{kbId}/documents/` (escrita)

Adds a document to a knowledge base. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |

**Corpo:** `object` — `Document`*: string(binary)

**Resposta:** `AIAgentDocumentModel[]`

#### `DELETE /v1/knowledge-bases/{kbId}/documents/{documentId}/` (escrita)

Deletes a document from a knowledge base. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `kbId`* | path | string |  |
| `documentId`* | path | string |  |

**Resposta:** `AIAgentDocumentModel` — `id`*: string; `fileName`*: string; `content`: string?

### Grupo Members

Membros (atendentes) e o perfil do usuário do token.

#### `GET /v1/members/me/` (leitura)

This action returns all the information about you, the logged in user. It also includes the list of organizations you're a part of. — Rate limit: Up to 100 requests in a 5 seconds window

**Resposta:** `OrganizationAgentModel \| AIOrganizationAgentModel \| HumanOrganizationAgentModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string?; `signature`: string?; `profilePictureUrl`: string(uri)?; `organizations`: OrganizationReferenceModel \| OrganizationReferenceForAITalkAgentModel \| OrganizationReferenceForHumanAgentModel[]

#### `PUT /v1/members/me/` (escrita)

Updates information about yourself that are not specific to an organization. — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `UpdateOrganizationMemberModel` — `name`: string?; `signature`: string?; `cellphone`: string?; `messageEndChat`: string?

**Resposta:** `OrganizationAgentModel \| AIOrganizationAgentModel \| HumanOrganizationAgentModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `displayName`: string?; `signature`: string?; `profilePictureUrl`: string(uri)?; `organizations`: OrganizationReferenceModel \| OrganizationReferenceForAITalkAgentModel \| OrganizationReferenceForHumanAgentModel[]

#### `GET /v1/members/me/status/` (leitura)

Lists your own status in every organization you're active in that has member status enabled. A status with a due date reads as available once it's past. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Resposta:** `OrganizationMemberStatusModel[]`

#### `PUT /v1/members/me/status/` (escrita)

Updates your own status in the current organization and in any other organizations given. Organizations you're not active in or without member status enabled are ignored. A status with a due date reads as available once it's past. — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `UpdateMemberStatusModel` — `availability`: MemberAvailability; `message`: string?; `emoji`: string?; `untilUTC`: string(date-time)?; `organizationIds`: string[]

**Resposta:** `MemberStatusUpdatedModel` — `id`*: string; `status`*: MemberStatusModel

#### `PUT /v1/members/me/profilepicture/` (escrita)

Allows to update your own profile picture — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `object` — `image`*: string(binary)

**Resposta:** `string(uri)`

#### `GET /v1/members/online/` (leitura)

Lists all members that are online. A member is considered online when they have at least one app instance running with the specified organization selected — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `OrganizationAgentReferenceModel \| OrganizationAIAgentReferenceModel \| OrganizationHumanAgentReferenceModel[]`

#### `PUT /v1/members/{id}/activation-status/` (escrita)

Allows to update the activation status (active, disabled) of a user in an organization. If you're an Admin in the selected organization, or hold the AgentsCrud permission, you can enable or disable any user in that organization. Otherwise, you're only allowed to disable yourself. When deactivating someone, it is possible to choose whether or not to close all conversations with this attendant, and to transfer their open conversations to another member of the organization. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the user to update the activation status |

**Corpo:** `UpdateOrganizationMemberStatusModel` — `active`: boolean; `closeChats`: boolean; `removeMemberOnChatsOpen`: boolean; `transferChatsToMemberId`: string?

**Resposta:** `OrganizationMemberActivationStatusModel` — `id`: string; `active`: boolean; `organizationId`: string

#### `POST /v1/members/{id}/groups/` (escrita)

Sets the groups a member belongs to within the organization. Replaces the current groups of the member. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the member to set the groups |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `OrganizationAgentReferenceModel \| OrganizationAIAgentReferenceModel \| OrganizationHumanAgentReferenceModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `active`: boolean; `billable`: boolean; `accessExpiresAtUTC`: string(date-time)?; `lastBotTransferenceUTC`: string(date-time)?; `groupIds`: string[]

### Grupo Messages

Mensagens enviadas e recebidas.

#### `GET /v1/messages/{id}/` (leitura)

Gets all the information about a single message — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the message |

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `DELETE /v1/messages/{id}/` (escrita)

Attempts to delete a message. Depending on the type of channel and the desired "deleteForEveryone" behavior, these things might happen: 1. The message needs to be deleted only in out database and is deleted immediately within this action. (Business channel, delete for me). 2. The message cannot be deleted because the remote locations where the message should also be deleted no longer accept to be deleted because of time restraints (Starter channel, delete for everyone). 3. The remote location where the message should also be deleted does not allow messages to deleted at all (Business channel, delete for everyone). 4. The message can be deleted in the remote location, but the only thing the action does is request it. Deletion from our database only happens when we receive a confirmation that the message was actually deleted (Starter channel, delete for me or everyone). — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The message to delete |
| `deleteForEveryone`* | query | boolean | Attempts to delete for everyone in the chat if true. Attempts to delete just for ourselves when false. |

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `PUT /v1/messages/{id}/` (escrita)

Edits a message that was previously sent. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the message to edit |

**Corpo:** `EditMessageModel` — `newMessage`: string

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `GET /v1/messages/{id}/states/` (leitura)

Gets a list of all the states a message had at every point in time — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the message |

**Resposta:** `MessageStatesModel` — `states`*: MessageStateModel[]

#### `POST /v1/messages/` (escrita)

Post a message to a chat — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateMessageModel` — `tempId`: string?; `file`: string(binary)?; `files`: string(binary)[]; `prefix`: string?; `message`: string?; `chatId`*: string; `isPrivate`: boolean; `previousMessageId`: string?; `stickUrl`: string(uri)?; `replyToMessageId`: string?; `organizationId`*: string; `skipReassign`: boolean; `automated`: boolean; `fileId`: string?; `contacts`: ChatContactModel[]; `location`: CreateLocationModel; `elements`: string?; `mentions`: MessageMentionModel[]; `metadata`: map<string>

**Resposta:** `SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?; `contactId`: string

#### `POST /v1/messages/reactions/` (escrita)

POST Messages — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `ReactionModel` — `organizationId`: string; `messageId`: string; `emoji`: string?

**Resposta:** `ReactionModel` — `organizationId`*: string; `messageId`*: string; `emoji`: string?

#### `POST /v1/messages/{id}/forward/` (escrita)

Forwards a message into another chat — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the message to be forwarded |

**Corpo:** `ForwardMessageModel` — `chatId`: string; `organizationId`: string; `skipReassign`: boolean

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `POST /v1/messages/forwardbulk/` (escrita)

Forwards multiple messages into multiple chats at once — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `ForwardBulkMessageModel` — `chatId`: string; `organizationId`: string; `messageIds`: string[]; `destinationChatIds`: string[]; `skipReassign`: boolean

**Resposta:** sem corpo.

#### `POST /v1/messages/{id}/transcribe/` (escrita)

POST Messages — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `POST /v1/messages/simplified/` (escrita)

Simplified version of the regular POST action. Does not require to create the contact and open the chat beforehand. But it is not only simplified, it's also somewhat more limited. If you require a functionality this action does not provide, the main action must be used instead. — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateMessageSimplifiedModel` — `toPhone`*: string; `fromPhone`*: string; `organizationId`*: string; `message`: string?; `file`: string(binary)?; `skipReassign`: boolean; `contactName`: string?

**Resposta:** `SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?; `contactId`: string

#### `PUT /v1/messages/{id}/resend/` (escrita)

PUT Messages — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `PUT /v1/messages/{id}/flow-answer-files/{mediaId}/` (escrita)

PUT Messages — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |
| `mediaId`* | path | string |  |

**Resposta:** `FlowAnswerFileModel` — `field`*: string; `mediaId`*: string; `fileName`: string?; `mimeType`: string?; `url`: string(uri)?; `isPhoto`: boolean; `autoDownloadPending`: boolean

#### `PUT /v1/messages/{id}/redownload-media/` (escrita)

PUT Messages — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** sem corpo.

#### `PUT /v1/messages/{id}/mark-favorite-message/` (escrita)

Set message as favorite. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | chat id |
| `messageId` | query | string | The message to edit |

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `PUT /v1/messages/{id}/unmark-favorite-message/` (escrita)

Set message as NOT favorite. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | chat id |
| `messageId` | query | string | The message to edit |

**Resposta:** `MessageModel \| SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

#### `PUT /v1/messages/{id}/clear-favorite-messages/` (escrita)

Limpar a lista de mensagens favoritas. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | chat id |

**Corpo:** `string[]`

**Resposta:** `BasicChatModel \| ChatModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]

### Grupo OrganizationBotShortcut

Atalhos de bot da organização.

#### `POST /v1/bot-shortcuts/` (escrita)

Adds a new bot shortcut for the specified organization. Requires Admin permission and the "BotShortcutsEnabled" feature to be enabled. — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `CreateBotShortcutModel` — `icon`: string; `actionTitle`: string; `bot`: ManualStartPath; `allowEditOnBotSend`: boolean; `organizationId`: string

**Resposta:** `BotShortcutModel` — `_t`: string; `id`: string; `icon`: string; `actionTitle`: string; `bot`: ManualStartPath; `order`: integer(int32); `allowEditOnBotSend`: boolean

#### `PUT /v1/bot-shortcuts/{id}/` (escrita)

Updates an existing bot shortcut with the specified identifier. Requires Admin permission and the "BotShortcutsEnabled" feature to be enabled. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdateBotShortcutModel` — `icon`: string; `actionTitle`: string; `bot`: ManualStartPath; `allowEditOnBotSend`: boolean

**Resposta:** `BotShortcutModel` — `_t`: string; `id`: string; `icon`: string; `actionTitle`: string; `bot`: ManualStartPath; `order`: integer(int32); `allowEditOnBotSend`: boolean

#### `DELETE /v1/bot-shortcuts/{id}/` (escrita)

Deletes an existing bot shortcut with the specified identifier. Requires Admin permission and the "BotShortcutsEnabled" feature to be enabled. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** sem corpo.

#### `PUT /v1/bot-shortcuts/{id}/reorder/` (escrita)

Reorders an existing bot shortcut with the specified identifier. Requires Admin permission and the "BotShortcutsEnabled" feature to be enabled. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdateBotShortcutOrderModel` — `order`: integer(int32)

**Resposta:** `BotShortcutModel` — `_t`: string; `id`: string; `icon`: string; `actionTitle`: string; `bot`: ManualStartPath; `order`: integer(int32); `allowEditOnBotSend`: boolean

### Grupo OrganizationFiles

Arquivos da organização.

#### `GET /v1/organization-files/` (leitura)

Gets a paginated list of all the OrganizationFiles saved previously — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `SearchText` | query | string |  |
| `FileTypes.Rule` | query | FilterRules |  |
| `FileTypes.Values` | query | FileTypes[] |  |
| `Ids` | query | string[] |  |
| `Order` | query | Order |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfOrganizationFileModel` — `page`: PaginationInfo; `items`: OrganizationFileModel[]

#### `POST /v1/organization-files/` (escrita)

POST Organization-Files — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `object` — `File`: string(binary); `Thumbnail`: string; `OrganizationId`*: string

**Resposta:** `OrganizationFileModel` — `id`: string; `organization`*: OrganizationReferenceIdModel; `url`: string(uri)?; `contentType`: string?; `originalName`: string?; `originalSizeBytes`: integer(int64)?; `data`: string(byte)?; `fileType`: FileTypes; `useCount`: integer(int32); `botIds`: string[]; `createdAtUTC`: string(date-time); `thumbnail`: string?; `deletedAtUTC`: string(date-time)?; `organizationMember`: AgentReferenceIdModel; `visibility`: FileVisibility

#### `GET /v1/organization-files/{id}/` (leitura)

Gets a OrganizationFile saved previously — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `OrganizationFileModel` — `id`: string; `organization`*: OrganizationReferenceIdModel; `url`: string(uri)?; `contentType`: string?; `originalName`: string?; `originalSizeBytes`: integer(int64)?; `data`: string(byte)?; `fileType`: FileTypes; `useCount`: integer(int32); `botIds`: string[]; `createdAtUTC`: string(date-time); `thumbnail`: string?; `deletedAtUTC`: string(date-time)?; `organizationMember`: AgentReferenceIdModel; `visibility`: FileVisibility

#### `DELETE /v1/organization-files/{id}/` (escrita)

DELETE Organization-Files — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** sem corpo.

#### `POST /v1/organization-files/from-message/{messageId}/` (escrita)

POST Organization-Files — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `messageId`* | path | string |  |

**Resposta:** `OrganizationFileModel` — `id`: string; `organization`*: OrganizationReferenceIdModel; `url`: string(uri)?; `contentType`: string?; `originalName`: string?; `originalSizeBytes`: integer(int64)?; `data`: string(byte)?; `fileType`: FileTypes; `useCount`: integer(int32); `botIds`: string[]; `createdAtUTC`: string(date-time); `thumbnail`: string?; `deletedAtUTC`: string(date-time)?; `organizationMember`: AgentReferenceIdModel; `visibility`: FileVisibility

#### `PUT /v1/organization-files/{id}/visibility/` (escrita)

PUT Organization-Files — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |
| `visibility`* | query | FileVisibility |  |

**Resposta:** `OrganizationFileModel` — `id`: string; `organization`*: OrganizationReferenceIdModel; `url`: string(uri)?; `contentType`: string?; `originalName`: string?; `originalSizeBytes`: integer(int64)?; `data`: string(byte)?; `fileType`: FileTypes; `useCount`: integer(int32); `botIds`: string[]; `createdAtUTC`: string(date-time); `thumbnail`: string?; `deletedAtUTC`: string(date-time)?; `organizationMember`: AgentReferenceIdModel; `visibility`: FileVisibility

### Grupo OrganizationGroup

Grupos da organização.

#### `POST /v1/groups/` (escrita)

Adds a new group to the specified organization. Requires at least Admin permission and the "GroupsEnabled" feature to be enabled. — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `CreateGroupModel` — `name`: string; `organizationId`: string

**Resposta:** `GroupModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `order`: integer(int32)

#### `PUT /v1/groups/{id}/` (escrita)

Updates an existing group within the organization. Requires at least Admin permission and the "GroupsEnabled" feature to be enabled. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdateGroupModel` — `name`: string

**Resposta:** `GroupModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `order`: integer(int32)

#### `DELETE /v1/groups/{id}/` (escrita)

Deletes an existing group from the organization. Requires at least Admin permission and the "GroupsEnabled" feature to be enabled. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** sem corpo.

#### `GET /v1/groups/{id}/items/` (leitura)

Lists every object of the organization that belongs to the group, with who grouped it and when. Requires at least Admin permission and the "GroupsEnabled" feature to be enabled. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `OrderBy` | query | GroupItemProperty |  |
| `Order` | query | Order |  |
| `queryString` | query | string |  |
| `types` | query | GroupItemType[] |  |

**Resposta:** `PaginationOfGroupItemModel` — `page`: PaginationInfo; `items`: GroupItemModel[]

#### `PUT /v1/groups/{id}/reorder/` (escrita)

Updates the order of a group within the organization, adjusting its position based on the specified order. Requires at least Admin permission and the "GroupsEnabled" feature to be enabled. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `UpdateGroupOrderModel` — `order`: integer(int32)

**Resposta:** `GroupModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `order`: integer(int32)

### Grupo OrganizationInvites

Convites de novos membros.

#### `GET /v1/organization-invites/` (leitura)

Gets a list of invitations that were sent by the selected organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `OrganizationInviteModel[]`

#### `POST /v1/organization-invites/` (escrita)

Creates a new invitation and sends it to the destined e-mail address — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `SendOrganizationInviteModel` — `organizationId`: string; `email`: string; `permissions`: Permissions[]; `allowedSector`: MemberAllowedSectorModel; `allowedChannel`: MemberAllowedChannelModel; `allowedChannelSession`: MemberAllowedChannelSessionModel; `allowedContactsBoard`: MemberAllowedContactsBoardModel; `allowedPipeline`: MemberAllowedPipelineModel; `allowReport`: boolean; `allowedTemplate`: boolean; `allowedContact`: MemberContactsAccess; `allowedQuickAnswer`: CrudPermission[]; `permissionActions`: PermissionAction[]

**Resposta:** `OrganizationInviteModel` — `email`*: string; `billable`: boolean; `allowedSector`*: MemberAllowedSectorModel; `allowedChannel`*: MemberAllowedChannelModel; `allowedChannelSession`*: MemberAllowedChannelSessionModel; `allowedContactsBoard`*: MemberAllowedContactsBoardModel; `allowedPipeline`*: MemberAllowedPipelineModel; `allowReport`: boolean; `allowedTemplate`: boolean; `allowedContact`: MemberContactsAccess; `allowedQuickAnswer`*: CrudPermission[]; `permissions`: Permissions[]; `validUntilUTC`: string(date-time)?; `permissionActions`: PermissionAction[]

#### `GET /v1/organization-invites/{email}/` (leitura)

Gets additional information about a single pending invitation of the supplied e-mail address — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `email`* | path | string | The e-mail to search an invite with |

**Resposta:** `OrganizationInviteModel` — `email`*: string; `billable`: boolean; `allowedSector`*: MemberAllowedSectorModel; `allowedChannel`*: MemberAllowedChannelModel; `allowedChannelSession`*: MemberAllowedChannelSessionModel; `allowedContactsBoard`*: MemberAllowedContactsBoardModel; `allowedPipeline`*: MemberAllowedPipelineModel; `allowReport`: boolean; `allowedTemplate`: boolean; `allowedContact`: MemberContactsAccess; `allowedQuickAnswer`*: CrudPermission[]; `permissions`: Permissions[]; `validUntilUTC`: string(date-time)?; `permissionActions`: PermissionAction[]

#### `DELETE /v1/organization-invites/{email}/` (escrita)

Cancels an invitation — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `email`* | path | string | The invited e-mail address to cancel |

**Resposta:** `OrganizationInviteModel` — `email`*: string; `billable`: boolean; `allowedSector`*: MemberAllowedSectorModel; `allowedChannel`*: MemberAllowedChannelModel; `allowedChannelSession`*: MemberAllowedChannelSessionModel; `allowedContactsBoard`*: MemberAllowedContactsBoardModel; `allowedPipeline`*: MemberAllowedPipelineModel; `allowReport`: boolean; `allowedTemplate`: boolean; `allowedContact`: MemberContactsAccess; `allowedQuickAnswer`*: CrudPermission[]; `permissions`: Permissions[]; `validUntilUTC`: string(date-time)?; `permissionActions`: PermissionAction[]

#### `PUT /v1/organization-invites/{email}/resend/` (escrita)

Resets the invitation. Generates a new link and sends it again to the destined email address. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `email`* | path | string | The invitation to resend |

**Resposta:** `OrganizationInviteModel` — `email`*: string; `billable`: boolean; `allowedSector`*: MemberAllowedSectorModel; `allowedChannel`*: MemberAllowedChannelModel; `allowedChannelSession`*: MemberAllowedChannelSessionModel; `allowedContactsBoard`*: MemberAllowedContactsBoardModel; `allowedPipeline`*: MemberAllowedPipelineModel; `allowReport`: boolean; `allowedTemplate`: boolean; `allowedContact`: MemberContactsAccess; `allowedQuickAnswer`*: CrudPermission[]; `permissions`: Permissions[]; `validUntilUTC`: string(date-time)?; `permissionActions`: PermissionAction[]

### Grupo OrganizationPreferences

Preferências da organização.

#### `PUT /v1/organizations/{organizationId}/preferences/` (escrita)

Allows to update organization-level preferences — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | path | string |  |

**Corpo:** `UpdateOrganizationPreferencesModel` — `transferBehavior`: UpdateTransferBehaviorModel; `closeChatBehavior`: UpdateCloseChatBehaviorModel; `reassignBehavior`: UpdateReassignBehaviorModel; `blockSignatureBehavior`: BlockSignatureBehaviorModel; `chatbotRunningBehavior`: ChatbotRunningBehaviorModel; `inactivityFlowBehavior`: UpdateInactivityFlowBehaviorModel; `waitingFlowBehavior`: UpdateWaitingFlowBehaviorModel; `adminViewingBehavior`: AdminViewingBehaviorModel; `contactPhonePrivacyBehavior`: ContactPhonePrivacyBehaviorModel

**Resposta:** `OrganizationPreferencesDetailsModel` — `closeChatBehavior`*: CloseChatBehaviorModel; `reassignBehavior`*: ReassignBehaviorModel

### Grupo OrganizationTasks

Tarefas/lembretes da organização.

#### `GET /v1/organization-tasks/` (leitura)

Lists the organization's tasks by due date (undated ones count as the farthest date), creation date or completion date — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `AssignedMemberIds.Rule` | query | FilterRules |  |
| `AssignedMemberIds.Values` | query | string[] |  |
| `Completed` | query | boolean |  |
| `LinkedTo` | query | string |  |
| `LinkKinds.Rule` | query | FilterRules |  |
| `LinkKinds.Values` | query | OrganizationTaskLinkKind[] |  |
| `OrderBy` | query | OrganizationTaskOrderBy |  |
| `Order` | query | Order |  |
| `Search` | query | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfOrganizationTaskModel` — `page`: PaginationInfo; `items`: OrganizationTaskModel[]

#### `POST /v1/organization-tasks/` (escrita)

POST Organization-Tasks — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

**Corpo:** `CreateOrganizationTaskModel` — `_t`: string; `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMemberIds`: string[]; `links`: OrganizationTaskLinkInputModel[]; `organizationId`: string

**Resposta:** `OrganizationTaskModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

#### `GET /v1/organization-tasks/{id}/` (leitura)

GET Organization-Tasks — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `OrganizationTaskModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

#### `PUT /v1/organization-tasks/{id}/` (escrita)

PUT Organization-Tasks — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Corpo:** `SaveOrganizationTaskModel \| CreateOrganizationTaskModel` — `_t`: string; `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMemberIds`: string[]; `links`: OrganizationTaskLinkInputModel[]

**Resposta:** `OrganizationTaskModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

#### `DELETE /v1/organization-tasks/{id}/` (escrita)

Deletes a task. Allowed for its creator and for administrators — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `OrganizationTaskModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

#### `PUT /v1/organization-tasks/{id}/complete/` (escrita)

PUT Organization-Tasks — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `OrganizationTaskModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

#### `PUT /v1/organization-tasks/{id}/reopen/` (escrita)

PUT Organization-Tasks — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string |  |

**Resposta:** `OrganizationTaskModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

### Grupo Organizations

Organizações (a conta da loja) e dados gerais.

#### `GET /v1/organizations/{id}/` (leitura)

Gets information about an organization you're a part of that are essential for other actions — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the organization |

**Resposta:** `SimpleOrganizationModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `reassignBehavior`: ReassignBehaviorModel; `blockSignatureBehavior`: BlockSignatureBehaviorModel; `chatbotRunningBehavior`: ChatbotRunningBehaviorModel; `adminViewingBehavior`: AdminViewingBehaviorModel; `contactPhonePrivacyBehavior`: ContactPhonePrivacyBehaviorModel; `closeChatBehavior`: CloseChatBehaviorModel; `inactivityFlowBehavior`: InactivityFlowBehaviorModel; `waitingFlowBehavior`: WaitingFlowBehaviorModel; `transferBehavior`: TransferBehaviorModel; `botShortcuts`: BotShortcutModel[]; `groups`: GroupModel[]; `iconUrl`: string(uri)?; `maxMembers`: integer(int32); `hasSentFirstMessage`: boolean; `maxDaysMessageHistoric`: integer(int32)?; `exceedingCredits`: integer(int32); `contractStatus`: ContractStatus; `contractPlan`: ContractPlan; `contractIdentifier`: string; `freeUntilUTC`: string(date-time); `hasImplementation`: boolean; `origin`: OrganizationOrigin; `chats`: map<integer(int32)>; `pendingInvites`: integer(int32); `adminInvites`: OrganizationAdminInviteModel[]; `organizationMembers`: OrganizationAgentReferenceModel \| OrganizationAIAgentReferenceModel \| OrganizationHumanAgentReferenceModel[]; `channels`: OrganizationChannelReferenceBaseModel \| OrganizationBrokerWhatsappChannelReferenceModel \| OrganizationCloudAPIWhatsappChannelReferenceModel \| OrganizationExternalChannelReferenceBaseModel \| OrganizationGupshupInstagramChannelReferenceModel \| OrganizationGupshupWhatsappChannelReferenceModel \| OrganizationInstagramChannelReferenceBaseModel \| OrganizationInternalChannelReferenceBaseModel \| OrganizationMembersChannelReferenceModel \| OrganizationPhoneNumberChannelReferenceBaseModel \| OrganizationUsernameChannelReferenceBaseModel \| OrganizationWebsiteWidgetChannelReferenceModel \| OrganizationWelcomerChannelReferenceModel \| OrganizationWhatsappChannelReferenceBaseModel[]; `sectors`: SectorReferenceModel[]; `flags`: OrganizationFlagModel[]; `defaultBusinessHour`: BusinessHourReferenceModel; `organizationFields`: OrganizationFieldReferenceModel; `llmDetails`: AILLMDetailsModel[]; `hasContractPendence`: boolean; `features`: UTalkFeatures

#### `PUT /v1/organizations/{id}/` (escrita)

Updates information about an organization — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the organization |

**Corpo:** `UpdateOrganizationModel` — `name`: string?; `financeEmail`: string(email)?; `financeWhatsapp`: string?; `cnpj`: string?; `socialReason`: string?; `phone`: string(tel)?; `cep`: string?; `road`: string?; `neighbourhood`: string?; `city`: string?; `number`: string?; `complement`: string?; `state`: string?; `iconUrl`: string(uri)?

**Resposta:** `OrganizationDetailsModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `financeEmail`: string?; `financeWhatsapp`: string?; `cnpj`: string?; `socialReason`: string?; `phone`: string?; `cep`: string?; `road`: string?; `neighbourhood`: string?; `city`: string?; `number`: string?; `complement`: string?; `state`: string?; `iconUrl`: string(uri)?

#### `DELETE /v1/organizations/{id}/` (escrita)

Deletes an organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the organization |
| `reason` | query | string | Reason for deleting the channel |

**Resposta:** `SimpleOrganizationModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `reassignBehavior`: ReassignBehaviorModel; `blockSignatureBehavior`: BlockSignatureBehaviorModel; `chatbotRunningBehavior`: ChatbotRunningBehaviorModel; `adminViewingBehavior`: AdminViewingBehaviorModel; `contactPhonePrivacyBehavior`: ContactPhonePrivacyBehaviorModel; `closeChatBehavior`: CloseChatBehaviorModel; `inactivityFlowBehavior`: InactivityFlowBehaviorModel; `waitingFlowBehavior`: WaitingFlowBehaviorModel; `transferBehavior`: TransferBehaviorModel; `botShortcuts`: BotShortcutModel[]; `groups`: GroupModel[]; `iconUrl`: string(uri)?; `maxMembers`: integer(int32); `hasSentFirstMessage`: boolean; `maxDaysMessageHistoric`: integer(int32)?; `exceedingCredits`: integer(int32); `contractStatus`: ContractStatus; `contractPlan`: ContractPlan; `contractIdentifier`: string; `freeUntilUTC`: string(date-time); `hasImplementation`: boolean; `origin`: OrganizationOrigin; `chats`: map<integer(int32)>; `pendingInvites`: integer(int32); `adminInvites`: OrganizationAdminInviteModel[]; `organizationMembers`: OrganizationAgentReferenceModel \| OrganizationAIAgentReferenceModel \| OrganizationHumanAgentReferenceModel[]; `channels`: OrganizationChannelReferenceBaseModel \| OrganizationBrokerWhatsappChannelReferenceModel \| OrganizationCloudAPIWhatsappChannelReferenceModel \| OrganizationExternalChannelReferenceBaseModel \| OrganizationGupshupInstagramChannelReferenceModel \| OrganizationGupshupWhatsappChannelReferenceModel \| OrganizationInstagramChannelReferenceBaseModel \| OrganizationInternalChannelReferenceBaseModel \| OrganizationMembersChannelReferenceModel \| OrganizationPhoneNumberChannelReferenceBaseModel \| OrganizationUsernameChannelReferenceBaseModel \| OrganizationWebsiteWidgetChannelReferenceModel \| OrganizationWelcomerChannelReferenceModel \| OrganizationWhatsappChannelReferenceBaseModel[]; `sectors`: SectorReferenceModel[]; `flags`: OrganizationFlagModel[]; `defaultBusinessHour`: BusinessHourReferenceModel; `organizationFields`: OrganizationFieldReferenceModel; `llmDetails`: AILLMDetailsModel[]; `hasContractPendence`: boolean; `features`: UTalkFeatures

#### `PUT /v1/organizations/{id}/member/{memberId}/` (escrita)

Updates information of a member that is specific to an organization — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |
| `memberId`* | path | string |  |

**Corpo:** `UpdateMemberDetailsInOrganizationModel` — `reassignOptions`: ReassignOptions

**Resposta:** `OrganizationAgentReferenceModel \| OrganizationAIAgentReferenceModel \| OrganizationHumanAgentReferenceModel` — `_t`: string; `id`: string; `displayName`: string?; `profilePictureUrl`: string(uri)?; `active`: boolean; `billable`: boolean; `accessExpiresAtUTC`: string(date-time)?; `lastBotTransferenceUTC`: string(date-time)?; `groupIds`: string[]

#### `GET /v1/organizations/{id}/details/` (leitura)

Gets profile information about an organization you're a part of — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the organization |

**Resposta:** `OrganizationDetailsModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `financeEmail`: string?; `financeWhatsapp`: string?; `cnpj`: string?; `socialReason`: string?; `phone`: string?; `cep`: string?; `road`: string?; `neighbourhood`: string?; `city`: string?; `number`: string?; `complement`: string?; `state`: string?; `iconUrl`: string(uri)?

#### `GET /v1/organizations/{id}/credits/` (leitura)

Gets information about the organization current conversation windows limits — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the organization |

**Resposta:** `CreditModel` — `remainingCredits`: integer(int64); `organization`: CreditOrganizationModel; `packages`: CreditPackageModel[]

#### `PUT /v1/organizations/{id}/picture/` (escrita)

Update the picture of an organization — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string | The Id of the organization |

**Corpo:** `object` — `image`*: string(binary)

**Resposta:** `OrganizationDetailsModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `financeEmail`: string?; `financeWhatsapp`: string?; `cnpj`: string?; `socialReason`: string?; `phone`: string?; `cep`: string?; `road`: string?; `neighbourhood`: string?; `city`: string?; `number`: string?; `complement`: string?; `state`: string?; `iconUrl`: string(uri)?

### Grupo Permissions

Permissões de membros.

#### `PUT /v1/permissions/` (escrita)

Update permissions of an existing member — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `UpdatePermissionOrganizationMemberModel` — `memberId`: string; `permissions`: Permissions[]; `allowedSector`: MemberAllowedSectorModel; `allowedChannel`: MemberAllowedChannelModel; `allowedChannelSession`: MemberAllowedChannelSessionModel; `allowedContactsBoard`: MemberAllowedContactsBoardModel; `allowedPipeline`: MemberAllowedPipelineModel; `allowedQuickAnswers`: CrudPermission[]; `allowReports`: boolean?; `allowedTemplates`: boolean?; `allowedContacts`: MemberContactsAccess; `contactPhoneVisibility`: MemberContactPhoneVisibility; `privateChatsBehavior`: PrivateChatsBehavior; `sendTemplatesBehavior`: SendTemplatesBehavior; `chatsVisibility`: ChatsVisibilityScope; `pipelineItemsAccess`: PipelineItemsAccess; `permissionActions`: PermissionAction[]

**Resposta:** `PermissionOrganizationMemberModel` — `id`*: string; `permissions`: Permissions[]; `allowedSector`*: MemberAllowedSectorModel; `allowedChannel`*: MemberAllowedChannelModel; `allowedChannelSession`*: MemberAllowedChannelSessionModel; `allowedContactsBoard`*: MemberAllowedContactsBoardModel; `allowedPipeline`*: MemberAllowedPipelineModel; `allowReport`*: boolean; `allowedTemplate`*: boolean; `allowedContact`*: MemberContactsAccess; `contactPhoneVisibility`: MemberContactPhoneVisibility; `privateChatsBehavior`: PrivateChatsBehavior; `sendTemplatesBehavior`: SendTemplatesBehavior; `chatsVisibility`: ChatsVisibilityScope; `pipelineItemsAccess`: PipelineItemsAccess; `allowQuickAnswer`*: CrudPermission[]; `permissionActions`: PermissionAction[]

#### `PUT /v1/permissions/bulk-actions/` (escrita)

Adds or removes specific action permissions of several members at once, leaving every other permission untouched. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `BulkPermissionActionsModel` — `memberIds`: string[]; `operation`: BulkPermissionOperation; `permissionActions`: PermissionAction[]; `includeTemplates`: boolean

**Resposta:** `PermissionOrganizationMemberModel[]`

#### `PUT /v1/permissions/bulk-reset/` (escrita)

Replaces the whole permission configuration (role, reassign and permissions) of several members at once. — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `BulkResetPermissionsModel` — `memberIds`: string[]; `permissions`: Permissions; `reassign`: ReassignOptions; `useDefaultConfig`: boolean; `allowedSector`: MemberAllowedSectorModel; `allowedChannel`: MemberAllowedChannelModel; `allowedChannelSession`: MemberAllowedChannelSessionModel; `allowedContactsBoard`: MemberAllowedContactsBoardModel; `allowedPipeline`: MemberAllowedPipelineModel; `allowedQuickAnswers`: CrudPermission[]; `allowReports`: boolean?; `allowedTemplates`: boolean?; `allowedContacts`: MemberContactsAccess; `contactPhoneVisibility`: MemberContactPhoneVisibility; `privateChatsBehavior`: PrivateChatsBehavior; `sendTemplatesBehavior`: SendTemplatesBehavior; `chatsVisibility`: ChatsVisibilityScope; `pipelineItemsAccess`: PipelineItemsAccess; `permissionActions`: PermissionAction[]

**Resposta:** `PermissionOrganizationMemberModel[]`

#### `GET /v1/permissions/organization-member/` (leitura)

Gets the current permissions of an existing member — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `memberId`* | query | string | The Id of the member |

**Resposta:** `UserPermissionsModel` — `permissions`: Permissions[]; `allowedSector`*: MemberAllowedSectorModel; `allowedChannel`*: MemberAllowedChannelModel; `allowedChannelSession`*: MemberAllowedChannelSessionModel; `allowedContactsBoard`*: MemberAllowedContactsBoardModel; `allowedPipeline`*: MemberAllowedPipelineModel; `allowReport`*: boolean; `allowedTemplate`*: boolean; `allowedContact`*: MemberContactsAccess; `contactPhoneVisibility`: MemberContactPhoneVisibility; `privateChatsBehavior`: PrivateChatsBehavior; `sendTemplatesBehavior`: SendTemplatesBehavior; `chatsVisibility`: ChatsVisibilityScope; `pipelineItemsAccess`: PipelineItemsAccess; `allowQuickAnswer`: CrudPermission[]; `permissionActions`: PermissionAction[]

### Grupo QuickAnswers

Respostas rápidas.

#### `GET /v1/quick-answers/` (leitura)

Gets a paginated list of all quick answers in the organization. With some filtering options — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `queryString` | query | string |  |
| `viewFrom` | query | ViewQuickAnswersFrom |  |
| `OrderBy` | query | QuickAnswersProperty |  |
| `Order` | query | Order |  |
| `groupIds` | query | string[] |  |

**Resposta:** `PaginationOfSimpleQuickAnswerModel` — `page`: PaginationInfo; `items`: SimpleQuickAnswerModel[]

#### `POST /v1/quick-answers/` (escrita)

Create a new quick answer for yourself or the organization — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `CreateQuickAnswerModel` — `organizationId`: string; `name`: string; `visibility`: QuickAnswerVisibility; `content`: string; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

**Resposta:** `QuickAnswerModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `content`: string; `organizationMember`: QuickAnswerAgentReferenceModel; `createdBy`: QuickAnswerAgentReferenceModel; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

#### `GET /v1/quick-answers/{id}/` (leitura)

Gets additional information about a single quick answer — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The quick answer Id |

**Resposta:** `QuickAnswerModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `content`: string; `organizationMember`: QuickAnswerAgentReferenceModel; `createdBy`: QuickAnswerAgentReferenceModel; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

#### `PUT /v1/quick-answers/{id}/` (escrita)

Updates an existing quick answer — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the quick answer |

**Corpo:** `UpdateQuickAnswerModel` — `name`: string; `visibility`: QuickAnswerVisibility; `content`: string; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

**Resposta:** `QuickAnswerModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `content`: string; `organizationMember`: QuickAnswerAgentReferenceModel; `createdBy`: QuickAnswerAgentReferenceModel; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

#### `DELETE /v1/quick-answers/{id}/` (escrita)

Deletes an existing quick answer — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the quick answer |

**Resposta:** `QuickAnswerModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `content`: string; `organizationMember`: QuickAnswerAgentReferenceModel; `createdBy`: QuickAnswerAgentReferenceModel; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

#### `POST /v1/quick-answers/render/` (escrita)

Renders the variables in a quick answer content against a chat, resolving contact fields, custom fields and organization variables. Unresolved variables render as empty text. — Rate limit: Up to 50 requests in a 5 seconds window

**Corpo:** `RenderQuickAnswerModel` — `organizationId`: string; `chatId`: string; `content`: string

**Resposta:** `string`

#### `POST /v1/quick-answers/{id}/groups/` (escrita)

Adds one or more group IDs to the quick answer — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the quick answer |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `QuickAnswerModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `content`: string; `organizationMember`: QuickAnswerAgentReferenceModel; `createdBy`: QuickAnswerAgentReferenceModel; `groupIds`: string[]; `variables`: QuickAnswerVariableModel[]; `attachment`: QuickAnswerAttachmentModel

### Grupo ScheduledMessages

Mensagens agendadas.

#### `GET /v1/scheduled-messages/{id}/` (leitura)

Gets additional information about a single scheduled message — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The scheduled message Id |

**Resposta:** `ScheduledMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `status`: ScheduledMessageStatus; `templateId`: string?; `templateLabel`: string?; `bot`: ScheduledMessageBotReferenceModel; `params`: string[]; `message`: string?; `dateSendAtUtc`: string(date-time); `contact`: ScheduledMessageContactReferenceModel; `channel`: ScheduledMessageChannelReferenceModel; `messageReference`: MessageReferenceModel \| MessageForwardedReferenceModel; `organizationMember`: AgentReferenceIdModel; `cancelUpon`: CancelScheduledMessageUpon[]; `prefix`: string?; `initialData`: map<string>; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `bulkSession`: string?; `fileId`: string?; `cancelReason`: ScheduledMessageCanceledReason; `canceledAtUTC`: string(date-time)?; `isPrivate`: boolean

#### `PUT /v1/scheduled-messages/{id}/` (escrita)

Updates the details of an existing scheduled message — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The scheduled message to update |

**Corpo:** `UpdateScheduledMessageModel` — `dateSendAtUTC`: string(date-time)?; `message`: string?; `templateId`: string?; `fileId`: string?; `templateLabel`: string?; `botId`: string?; `botTriggerName`: string?; `botName`: string?; `params`: string[]; `prefix`: string?; `cancelUpon`: CancelScheduledMessageUpon[]; `initialData`: map<string>; `postbackTexts`: CreateTemplatePostbackTextsModel[]

**Resposta:** `ScheduledMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `status`: ScheduledMessageStatus; `templateId`: string?; `templateLabel`: string?; `bot`: ScheduledMessageBotReferenceModel; `params`: string[]; `message`: string?; `dateSendAtUtc`: string(date-time); `contact`: ScheduledMessageContactReferenceModel; `channel`: ScheduledMessageChannelReferenceModel; `messageReference`: MessageReferenceModel \| MessageForwardedReferenceModel; `organizationMember`: AgentReferenceIdModel; `cancelUpon`: CancelScheduledMessageUpon[]; `prefix`: string?; `initialData`: map<string>; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `bulkSession`: string?; `fileId`: string?; `cancelReason`: ScheduledMessageCanceledReason; `canceledAtUTC`: string(date-time)?; `isPrivate`: boolean

#### `DELETE /v1/scheduled-messages/{id}/` (escrita)

Cancels an existing scheduled message — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the scheduled message to cancel |

**Resposta:** `boolean`

#### `GET /v1/scheduled-messages/` (leitura)

Gets a paginated list of scheduled messages meant to a single contact — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `contactId`* | query | string | The contact to retrieve the scheduled messages from |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfScheduledMessageModel` — `page`: PaginationInfo; `items`: ScheduledMessageModel[]

#### `POST /v1/scheduled-messages/` (escrita)

Creates a new scheduled message — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateScheduledMessageModel` — `dateSendAtUTC`: string(date-time)?; `message`: string?; `organizationId`: string; `channelId`: string?; `contactId`: string?; `toPhone`: string?; `toBusinessUserId`: string?; `fromPhone`: string?; `templateId`: string?; `templateLabel`: string?; `botId`: string?; `botTriggerName`: string?; `prefix`: string?; `params`: string[]; `cancelUpon`: CancelScheduledMessageUpon[]; `initialData`: map<string>; `contactName`: string?; `bulkSession`: string?; `fileId`: string?; `isPrivate`: boolean; `postbackTexts`: CreateTemplatePostbackTextsModel[]

**Resposta:** `ScheduledMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `status`: ScheduledMessageStatus; `templateId`: string?; `templateLabel`: string?; `bot`: ScheduledMessageBotReferenceModel; `params`: string[]; `message`: string?; `dateSendAtUtc`: string(date-time); `contact`: ScheduledMessageContactReferenceModel; `channel`: ScheduledMessageChannelReferenceModel; `messageReference`: MessageReferenceModel \| MessageForwardedReferenceModel; `organizationMember`: AgentReferenceIdModel; `cancelUpon`: CancelScheduledMessageUpon[]; `prefix`: string?; `initialData`: map<string>; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `bulkSession`: string?; `fileId`: string?; `cancelReason`: ScheduledMessageCanceledReason; `canceledAtUTC`: string(date-time)?; `isPrivate`: boolean

### Grupo Sectors

Setores (filas) de atendimento.

#### `GET /v1/sectors/` (leitura)

Gets all the sectors of the selected organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `SectorReferenceModel[]`

#### `POST /v1/sectors/` (escrita)

Creates a new sector in the organization — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateSectorModel` — `name`: string; `organizationId`: string; `groupIds`: string[]

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

#### `GET /v1/sectors/{id}/` (leitura)

Gets more details of a single sector — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the sector |

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

#### `PUT /v1/sectors/{id}/` (escrita)

Updates the details of an existing sector — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the sector |

**Corpo:** `UpdateSectorModel` — `name`: string?; `isNewDefault`: boolean; `groupIds`: string[]

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

#### `DELETE /v1/sectors/{id}/` (escrita)

Delete an existing sector, moving its chats to another sector first — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the sector |
| `moveChatsToSector`* | query | string | The sector the chats in the current sector must be move to |

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

#### `PUT /v1/sectors/reorder/` (escrita)

PUT Sectors — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `ReorderModel` — `toMoveId`: string; `anchorId`: string; `position`: MoveRelativeToAnchor

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

#### `PUT /v1/sectors/{id}/order/` (escrita)

Updates the ordering of a sector — Rate limit: Up to 10 requests in a 15 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the sector |

**Corpo:** `UpdateSectorOrderModel` — `order`: integer(int32)

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

#### `POST /v1/sectors/{id}/groups/` (escrita)

Adds one or more group IDs to the sector — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the sector |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `SectorModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

### Grupo Stickers

Figurinhas.

#### `GET /v1/stickers/` (leitura)

Gets a paginated list of all the stickers the organization saved previously — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `search` | query | string | Case insensitive text matched against the sticker's description. Stickers without a description never match |

**Resposta:** `PaginationOfStickerModel` — `page`: PaginationInfo; `items`: StickerModel[]

#### `POST /v1/stickers/` (escrita)

Add a sticker to the organization's sticker repository. Saving an url that is already saved returns the existing sticker instead of duplicating it — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateStickerModel` — `url`: string(uri); `description`: string?; `organizationId`: string

**Resposta:** `StickerModel` — `id`: string; `url`*: string(uri); `description`: string?

#### `GET /v1/stickers/existing/` (leitura)

Attempts to find a previously saved sticker by its image's URL — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `stickUrl`* | query | string(uri) |  |

**Resposta:** `StickerModel[]`

#### `PUT /v1/stickers/{id}/` (escrita)

Describe what a saved sticker shows. The description is what the sticker search matches against, and a blank one clears it — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The sticker to describe |

**Corpo:** `DescribeStickerModel` — `description`: string?; `organizationId`: string

**Resposta:** `StickerModel` — `id`: string; `url`*: string(uri); `description`: string?

#### `DELETE /v1/stickers/{id}/` (escrita)

Remove a sticker from the organization's sticker repository — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The sticker to remove |

**Resposta:** `StickerModel` — `id`: string; `url`*: string(uri); `description`: string?

### Grupo Tags

Etiquetas: cadastro, cor, grupos e ordem.

#### `GET /v1/tags/{id}/` (leitura)

Gets additional information about a tag by its Id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the tag |

**Resposta:** `TagModel` — `_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

#### `PUT /v1/tags/{id}/` (escrita)

Updates an existing tag — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the tag |

**Corpo:** `UpdateTagModel` — `name`: string?; `emoji`: string?; `color`: TagColor; `description`: string?; `groupIds`: string[]

**Resposta:** `TagModel` — `_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

#### `DELETE /v1/tags/{id}/` (escrita)

Deletes a tag from the organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the tag |

**Resposta:** `TagModel` — `_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

#### `GET /v1/tags/` (leitura)

Gets a paginated list of tags created in the organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `OrderBy` | query | TagProperty |  |
| `Order` | query | Order |  |
| `queryString` | query | string |  |
| `groupIds` | query | string[] |  |

**Resposta:** `PaginationOfTagModel` — `page`: PaginationInfo; `items`: TagModel[]

#### `POST /v1/tags/` (escrita)

Creates a new tag in the organization — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateTagModel` — `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `organizationId`: string; `groupIds`: string[]

**Resposta:** `TagModel` — `_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

#### `PUT /v1/tags/reorder/` (escrita)

PUT Tags — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `ReorderModel` — `toMoveId`: string; `anchorId`: string; `position`: MoveRelativeToAnchor

**Resposta:** `TagModel` — `_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

#### `POST /v1/tags/{id}/groups/` (escrita)

Adds one or more group IDs to the tag — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the channel to edit |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `TagModel` — `_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

### Grupo TemplateCategories

Categorias de modelos de mensagem.

#### `GET /v1/template-categories/` (leitura)

Lists all categories a template can be created with. Note that some are marked as deprecated, those are shown for compatibility reasons only. They're not allowed to be used anymore. — Rate limit: Up to 100 requests in a 5 seconds window

**Resposta:** `TemplateCategoryModel[]`

### Grupo TemplateMessages

Envio de modelos (templates) de WhatsApp.

#### `POST /v1/template-messages/` (escrita)

Sends a template message to an existing chat — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateTemplateMessageModel` — `templateId`*: string; `chatId`*: string; `params`: string[]; `organizationId`*: string; `skipReassign`: boolean; `bulkSession`: string?; `fileId`: string?; `carousel`: CreateTemplateMessageCarouselModel[]; `postbackTexts`: CreateTemplatePostbackTextsModel[]

**Resposta:** `SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?; `contactId`: string

#### `POST /v1/template-messages/simplified/` (escrita)

POST Template-Messages — Rate limit: Up to 250 requests in a 5 seconds window

**Corpo:** `CreateTemplateMessageSimplifiedModel` — `toPhone`*: string; `fromPhone`*: string; `templateId`*: string; `params`: string[]; `organizationId`*: string; `skipReassign`: boolean; `bulkSession`: string?; `file`: string(binary)?; `fileId`: string?; `contactName`: string?; `carousel`: CreateTemplateMessageCarouselModel[]

**Resposta:** `SentMessageModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?; `contactId`: string

### Grupo Templates

Modelos (templates) de mensagem aprovados.

#### `GET /v1/templates/` (leitura)

Gets a paginated list of all the message templates from an organization. Optionally filtering by a single channel within the organization and/or their statuses. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `channelId` | query | string |  |
| `status` | query | string |  |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |
| `queryString` | query | string |  |
| `OrderBy` | query | TemplateProperty |  |
| `Order` | query | Order |  |
| `groupIds` | query | string[] |  |
| `ids` | query | string[] |  |

**Resposta:** `PaginationOfSimpleTemplateModel` — `page`: PaginationInfo; `items`: SimpleTemplateModel[]

#### `POST /v1/templates/` (escrita)

Creates and submits a new template for Meta's approval — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateTemplateModel` — `organizationId`: string; `channelIds`: string[]; `channelId`: string?; `label`: string; `category`: string?; `templateType`: TemplateType; `header`: TemplateHeaderCreateModel; `content`: string; `footer`: string?; `variables`: TemplateExampleCreateModel[]; `buttons`: CreateTemplateButtonModel[]; `mediaId`: string?; `groupIds`: string[]; `carousel`: CreateTemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

**Resposta:** `TemplateModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `channelId`: string; `channels`: TemplateChannelLinkModel[]; `label`: string; `category`: string; `templateType`: string; `header`: TemplateHeaderModel; `content`: string; `footer`: string?; `example`: string?; `buttons`: TemplateButtonModel \| MessageButtonModel[]; `variables`: TemplateExampleModel[]; `status`: string; `approvedAtUTC`: string(date-time)?; `templateId`: string; `rejectErrorReason`: FriendlyRejectReason; `groupIds`: string[]; `carousel`: TemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

#### `PUT /v1/templates/` (escrita)

Updates template. You can only update information that is not dependent on Gupshup. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Corpo:** `UpdateTemplateModel` — `templateId`: string; `label`: string; `groupIds`: string[]

**Resposta:** `TemplateModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `channelId`: string; `channels`: TemplateChannelLinkModel[]; `label`: string; `category`: string; `templateType`: string; `header`: TemplateHeaderModel; `content`: string; `footer`: string?; `example`: string?; `buttons`: TemplateButtonModel \| MessageButtonModel[]; `variables`: TemplateExampleModel[]; `status`: string; `approvedAtUTC`: string(date-time)?; `templateId`: string; `rejectErrorReason`: FriendlyRejectReason; `groupIds`: string[]; `carousel`: TemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

#### `GET /v1/templates/{id}/` (leitura)

Gets additional information about a template by its Id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the template |

**Resposta:** `TemplateModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `channelId`: string; `channels`: TemplateChannelLinkModel[]; `label`: string; `category`: string; `templateType`: string; `header`: TemplateHeaderModel; `content`: string; `footer`: string?; `example`: string?; `buttons`: TemplateButtonModel \| MessageButtonModel[]; `variables`: TemplateExampleModel[]; `status`: string; `approvedAtUTC`: string(date-time)?; `templateId`: string; `rejectErrorReason`: FriendlyRejectReason; `groupIds`: string[]; `carousel`: TemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

#### `DELETE /v1/templates/{id}/` (escrita)

Deletes an existing template. Note that it's also deleted in your meta account — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the template |
| `channelIds` | query | string[] | Channels to delete the template from. When null or empty, deletes from every linked channel. |

**Resposta:** `TemplateModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `channelId`: string; `channels`: TemplateChannelLinkModel[]; `label`: string; `category`: string; `templateType`: string; `header`: TemplateHeaderModel; `content`: string; `footer`: string?; `example`: string?; `buttons`: TemplateButtonModel \| MessageButtonModel[]; `variables`: TemplateExampleModel[]; `status`: string; `approvedAtUTC`: string(date-time)?; `templateId`: string; `rejectErrorReason`: FriendlyRejectReason; `groupIds`: string[]; `carousel`: TemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

#### `POST /v1/templates/{id}/channels/` (escrita)

Creates an existing template in additional official channels (partial creation, same rules as creation). — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `id`* | path | string |  |

**Corpo:** `AddTemplateChannelsModel` — `organizationId`: string; `channelIds`: string[]; `mediaId`: string?; `carouselMediaIds`: string[]

**Resposta:** `TemplateModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `channelId`: string; `channels`: TemplateChannelLinkModel[]; `label`: string; `category`: string; `templateType`: string; `header`: TemplateHeaderModel; `content`: string; `footer`: string?; `example`: string?; `buttons`: TemplateButtonModel \| MessageButtonModel[]; `variables`: TemplateExampleModel[]; `status`: string; `approvedAtUTC`: string(date-time)?; `templateId`: string; `rejectErrorReason`: FriendlyRejectReason; `groupIds`: string[]; `carousel`: TemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

#### `POST /v1/templates/{id}/groups/` (escrita)

Adds one or more group IDs to the template — Rate limit: Up to 50 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the template |

**Corpo:** `AttachGroupModel` — `groupIds`: string[]

**Resposta:** `TemplateModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `channelId`: string; `channels`: TemplateChannelLinkModel[]; `label`: string; `category`: string; `templateType`: string; `header`: TemplateHeaderModel; `content`: string; `footer`: string?; `example`: string?; `buttons`: TemplateButtonModel \| MessageButtonModel[]; `variables`: TemplateExampleModel[]; `status`: string; `approvedAtUTC`: string(date-time)?; `templateId`: string; `rejectErrorReason`: FriendlyRejectReason; `groupIds`: string[]; `carousel`: TemplateCarouselModel[]; `addSecurityRecommendation`: boolean; `codeExpirationMinutes`: integer(int32)?; `messageValiditySeconds`: integer(int32)?

### Grupo UserNotifications

Notificações do usuário.

#### `GET /v1/user-notifications/` (leitura)

Returns a paginated list of unread notifications for the current user, excluding those related to marketing campaigns and user mentions. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfUserNotificationModel` — `page`: PaginationInfo; `items`: UserNotificationModel[]

#### `GET /v1/user-notifications/mention/` (leitura)

Returns a paginated list of unread notifications for the current user, including only notifications related to user mentions. — Rate limit: Up to 100 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `Skip` | query | integer(int32) | padrão 0; How many items to skip before start taking ones to return |
| `Take` | query | integer(int32) | padrão 50; The amount of items to get after the specified offset. Can be more than there are items available, but not more than this route's limit of items per page. |
| `Behavior` | query | PaginationBehavior | padrão GetSliceOnly; How the query should execute |

**Resposta:** `PaginationOfUserNotificationModel` — `page`: PaginationInfo; `items`: UserNotificationModel[]

#### `PUT /v1/user-notifications/{id}/` (escrita)

Marks a notification as read — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the notification |

**Resposta:** `UserNotificationModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `activityLogModel`: ActivityLogSimpleModel

#### `PUT /v1/user-notifications/all/` (escrita)

Marks all unread notifications as read, excluding mention notifications. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `UserNotificationModel[]`

#### `PUT /v1/user-notifications/all-mentions/` (escrita)

Marks all unread mention notifications as read for the current user. — Rate limit: Up to 50 requests in a 5 seconds window. **Atenção:** Warning! This endpoint is not marked as stable. It's either incomplete or intended to be used only by the Umbler Talk frontend. You can still use it if you want, but be aware that it's not supported and may break at any time without notice.

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `UserNotificationModel[]`

### Grupo Variables

Variáveis usadas em mensagens.

#### `GET /v1/variables/` (leitura)

Get all variables from a organization. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |

**Resposta:** `VariableModel \| EncryptedVariableModel \| PlainTextVariableModel[]`

#### `POST /v1/variables/` (escrita)

Allows adding a variable to an existing organization that can be retrieved later in the full GET method. — Rate limit: Up to 10 requests in a 15 seconds window

**Corpo:** `CreateVariableModel \| CreateEncryptedVariableModel \| CreatePlainTextVariableModel` — `_t`: string; `organizationId`: string; `name`: string?; `description`: string?

**Resposta:** `VariableModel \| EncryptedVariableModel \| PlainTextVariableModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `description`: string?

#### `PUT /v1/variables/{id}/` (escrita)

Allows editing a variable to an existing organization that can be retrieved later in the full GET method. — Rate limit: Up to 10 requests in a 15 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the variable to edit |

**Corpo:** `EditVariableModel` — `organizationId`: string; `name`: string?; `value`: string?; `description`: string?

**Resposta:** `VariableModel \| EncryptedVariableModel \| PlainTextVariableModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `description`: string?

#### `DELETE /v1/variables/{id}/` (escrita)

Deletes a variable to a organization by its Id — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the organization variable to delete |

**Resposta:** sem corpo.

### Grupo Webhooks

Webhooks: o uTalk avisa o seu sistema quando algo acontece.

#### `GET /v1/webhooks/` (leitura)

Gets a list of webhooks registered in the desired organization — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `channelId` | query | string | Optionally you can pass a channel Id to retrieve only webhooks registered in it |
| `query` | query | string | Optionally, you can pass a query string to filter webhooks' names |

**Resposta:** `WebhookModel[]`

#### `GET /v1/webhooks/{id}/` (leitura)

Gets all available information of a single webhook — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The Id of the registered webhook |

**Resposta:** `WebhookModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `url`: string; `failuresToday`: integer(int32); `failuresByReasonToday`: WebhookDailyFailuresModel; `paused`: boolean; `pausedDueToFailures`: boolean; `forChannels`: string[]; `events`: EventWebhookType[]

#### `DELETE /v1/webhooks/{id}/` (escrita)

Deletes a webhook registration. After successfully deleted, it may take a few seconds for the desired URL start to stop receiving events. — Rate limit: Up to 100 requests in a 5 seconds window

| Parâmetro | Onde | Tipo | Observação |
|---|---|---|---|
| `organizationId`* | query | string | The Id of the organization. A list of all your organizations can be retrieved using the GET /v1/members/me route. A valid id can look like this: YiwUPDF2zFWaRG01 |
| `id`* | path | string | The id of the webhook registration to disable and delete |

**Resposta:** `WebhookModel` — `_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `url`: string; `failuresToday`: integer(int32); `failuresByReasonToday`: WebhookDailyFailuresModel; `paused`: boolean; `pausedDueToFailures`: boolean; `forChannels`: string[]; `events`: EventWebhookType[]

#### `GET /v1/webhooks/ranges/` (leitura)

Lists all IP ranges we can send Webhooks from — Rate limit: Up to 100 requests in a 5 seconds window

**Resposta:** `SourceRanges` — `lastUpdatedUTC`*: string(date-time); `ranges`*: SourceRange[]

## 4. Enumerações

- **AIAgentQASource**: `Manual`, `AIGenerated`
- **AILocale**: `EN_US`, `FR_FR`, `PT_PT`, `PT_BR`, `ES_ES`, `ES_MX`, `ES_PE`, `ES_AR`, `ES_CL`, `ES_CO`
- **AIStatuses**: `Draft`, `Testing`, `Staging`, `Published`, `Suspended`, `Updated`, `Deprecated`, `Deleted`
- **AgentIdentityOption**: `Human`, `AIAssistant`
- **AggregationType**: `None`, `Count`, `Sum`, `Average`, `Min`, `Max`
- **AiLLMs**: `Expert`, `Standard`, `Custom`
- **AllowedNodeTypes**: `All`, `BasicOnly`, `Essentials`
- **AsaasMcpOperation**: `SearchCustomer`, `GetCustomer`, `SearchPayments`, `GetPayment`, `GetPaymentIdentificationField`, `GetPaymentPixQrCode`, `GetSubscription`, `GetSubscriptionPayments`
- **AuthSource**: `Unknown`, `OIDC`, `PAT`, `Other`, `Unauthenticated`
- **AutomationFlowResults**: `BotStarted`, `ChatClosed`, `CannotCloseMemberChat`, `Disabled`, `BotNotFound`, `TriggerNotFound`, `VariablesMissing`
- **AutomationFlows**: `Waiting`, `Inactivity`, `StageAutomation`
- **BillingEventType**: `Template`, `AI`, `Message`
- **BlockSignatureBehaviors**: `AlwaysShowSignature`, `MemberDecides`, `NeverShowSignature`
- **BotBindingType**: `FlowchartReference`, `CloseChatBehavior`, `WaitingFlowBehavior`, `ReassignBehavior`, `InactivityFlowBehavior`, `Channel`, `BotShortcut`, `WidgetButton`, `AIAgentIntent`, `CallBehavior`, `ScheduledMessage`, `BulkSendSession`
- **BotEvent**: `ChatCreatedByContact`, `ContactMessage`, `ChatCreated`, `MemberMessage`, `Manual`, `Waiting`, `DeliveryConfirmation`
- **BotProperty**: `Order`, `Title`, `CreatedAtUTC`, `Active`, `UpdatedAtUTC`, `ExecutionsCount`
- **BotStatus**: `Waiting`, `Running`, `Complete`
- **BotStopReason**: `ReachedFlowEnd`, `MemberTookOver`, `ChatClosed`, `OtherBotTookOver`, `BotFeatureDisabled`, `ContractPendency`, `InconsistencyFound`, `ManuallyRequested`, `BotExpired`, `FatalError`, `BotNotFound`, `LoopInterrupted`
- **BotTrigger**: `ChatCreated`, `Manual`
- **BotTypes**: `Support`, `Sales`, `Qualification`, `SupportV2`
- **BulkPermissionOperation**: `Add`, `Remove`
- **BulkSendProperty**: `Title`, `InitiatedBy`, `CreatedAtUTC`, `MessagesSent`, `Channel`
- **BulkSendType**: `Template`, `Bot`
- **BusinessType**: `AUTO`, `BEAUTY`, `EDU`, `ENTERTAIN`, `FINANCE`, `GOVT`, `HOTEL`, `GROCERY`, `NONPROFIT`, `EVENT_PLAN`, `RESTAURANT`, `HEALTH`, `PROF_SERVICES`, `RETAIL`, `APPAREL`, `TRAVEL`, `OTHER`
- **BusinessUsernameTransferAction**: `None`, `ForceTransfer`
- **CallBehaviors**: `Ignore`, `ExecuteBot`, `SendMessage`
- **CancelScheduledMessageUpon**: `CustomerMessage`, `OrganizationMemberMessage`, `ClosedChat`
- **ChannelConditionalType**: `ChannelId`, `BusinessHour`
- **ChannelFilter**: `WhatsappApi`, `WhatsappBroker`, `Welcomer`, `Instagram`, `Members`, `WebsiteWidget`, `WhatsappCloudApi`
- **ChannelState**: `WaitingAppCreation`, `WaitingToGoLive`, `Probation`, `Live`, `Offline`, `Deleted`, `WaitingFirstSync`, `Disabled`
- **ChannelTransferDirections**: `Outgoing`, `Incoming`
- **ChatModificationCause**: `ChannelDeleted`, `ContactDeleted`, `ContactBlocked`, `MemberDeactivated`, `AIAgentDeleted`, `TagDeleted`, `SectorDeleted`
- **ChatOrderBy**: `CreatedAtUTC`, `LastMessage`, `WaitingSince`, `ClosedAtUTC`
- **ChatState**: `Open`, `Closed`, `All`
- **ChatVisibility**: `Show`, `Hide`, `HideUntilNextMessage`
- **ChatbotRunningBehaviors**: `ConfirmStopChatbot`, `JustStopChatbot`, `KeepChatbotRunning`
- **ChatsVisibilityScope**: `Organization`, `SharedGroups`
- **CloseChatActionSetClosedByAs**: `NoOne`, `ChatOwner`
- **CloseChatBehaviors**: `MemberDecides`, `JustClose`, `SendMessage`, `ExecuteBot`
- **ClusterState**: `Available`, `Unavailable`, `Deactivated`
- **CommunicationStyles**: `Regular`, `Formal`, `Informal`
- **CommunicationToneOption**: `Formal`, `Professional`, `Casual`, `Relaxed`
- **ConditionalOperator**: `Equals`, `NotEquals`, `GreaterThan`, `LessThan`, `Exists`, `NotExists`, `Contains`, `NotContains`, `Any`, `NotAny`, `None`, `StartsWith`, `EndsWith`, `RegexMatch`, `GreaterThanOrEqual`, `LessThanOrEqual`
- **ConditionalRenderMode**: `Default`, `Simple`, `Configurable`
- **ContactFieldConditionalModel**: `Name`, `Landline`, `Email`, `Gender`, `PhoneNumber`
- **ContactFieldDefinition**: `Name`, `Landline`, `Email`, `Gender`, `AddressLine1`, `AddressLine2`, `AddressCity`, `AddressState`, `AddressZipCode`, `AddressCountry`, `PhoneNumber`
- **ContactFields**: `Name`, `PhoneNumber`, `Tags`, `LastActiveUTC`, `Email`
- **ContactPhoneMaskingType**: `Partial`, `Total`
- **ContactProperty**: `Name`, `PhoneNumber`, `Email`, `LastActiveUTC`, `CreatedAtUTC`
- **ContactRatingProperty**: `CreatedAtUTC`, `Rating`, `Repository`, `Feedback`
- **ContactState**: `All`, `Blocked`, `Active`
- **ContactType**: `DirectMessage`, `Group`, `MemberDirectMessage`, `MemberGroup`, `PrivateMemberGroup`, `AIAssistant`, `Sandbox`
- **ContainerState**: `PrePool`, `Pool`, `InUse`, `Canceled`
- **ContainerStatus**: `Up`, `Down`
- **ContractPeriodicity**: `Monthly`, `Bimonthly`, `Quarterly`, `Semiannual`, `Annual`, `TwoYears`, `ThreeYears`, `FourYears`, `FiveYears`
- **ContractPlan**: `Basic`, `Professional`, `Enterprise`, `Essencial`, `Impulso`, `Escala`, `Ilimitado`, `Free`
- **ContractStatus**: `AwaitingPayment`, `AwaitingRelease`, `AwaitingReactivation`, `Active`, `AwaitingDeactivation`, `Inactive`, `Canceled`, `PreCanceled`, `Deleted`, `Paused`, `AwaitingSubscription`, `Suspended`, `Free`
- **ConversationPaceOption**: `Dynamic`, `Natural`, `Balanced`, `Detailed`, `Analytical`
- **CreditPackageType**: `Single`, `Recurrent`, `Bonus`
- **CreditsType**: `Marketing`, `Utility`, `Authentication`, `AI`, `Service`
- **CrudPermission**: `Create`, `Edit`, `Delete`
- **CurrencyEnum**: `BRL`, `USD`, `ARS`, `PYG`
- **CustomFieldAttributeType**: `Text`, `Number`, `Date`, `Logic`
- **CustomFieldCompare**: `Contains`, `ContainsNot`, `Equals`, `NotEquals`, `GreaterThan`, `LowerThan`
- **DealStatus**: `Open`, `Won`, `Lost`
- **DeleteContactChatAction**: `Close`, `Delete`
- **EmojiUsageOption**: `None`, `Discreet`, `Natural`, `Expressive`
- **EventWebhookType**: `Message`, `MemberTransfer`, `ChatClosed`, `ChatSectorChanged`, `ChatPrivateStatusChanged`, `MessageFileUploaded`, `ChatTagChanged`, `NewChat`
- **FieldEditActions**: `Added`, `Edited`
- **FileTypes**: `Text`, `Image`, `Video`, `Audio`, `File`
- **FileVisibility**: `All`, `Member`
- **FilterRules**: `Any`, `None`, `ContainsAny`, `NoneOrContainsAny`, `NotNullNorEmpty`, `ContainsAll`, `Excludes`
- **FilterTypes**: `Open`, `Waiting`, `Closed`
- **FlowCategory**: `SignUp`, `SignIn`, `AppointmentBooking`, `LeadGeneration`, `ContactUs`, `CustomerSupport`, `Survey`, `Other`
- **FlowChannelCreationStatus**: `Success`, `Failed`
- **FlowComponentType**: `Heading`, `Subheading`, `Body`, `Caption`, `TextInput`, `TextArea`, `Dropdown`, `RadioButtons`, `Checkboxes`, `DatePicker`, `ChipsSelector`, `OptIn`, `PhotoPicker`, `DocumentPicker`
- **FlowConditionOperator**: `Equals`, `NotEquals`, `IsFilled`
- **FlowPublishRequirementKind**: `BusinessVerification`, `PhoneQuality`, `MessagingTier`
- **FlowPublishRequirementState**: `Unknown`, `Met`, `Attention`
- **FlowStatus**: `Draft`, `Published`, `Deprecated`
- **FlowchartResponseType**: `BotContext`, `Contact`
- **GroupItemProperty**: `Name`, `Type`, `GroupedAtUTC`
- **GroupItemType**: `Channel`, `Chatbot`, `Template`, `Tag`, `Sector`, `QuickAnswer`, `Member`, `Flow`, `AIAgent`
- **GupshupChannelSteps**: `GetOrCreateApp`, `LinkPartner`, `SetCreationOrMigration`, `EnableTemplates`, `SetWebhooks`, `GetEmbedLink`, `CheckOnline`, `SyncCoexMessages`, `UpdateProfileAbout`, `UpdateProfileDetails`, `UpdateProfilePicture`
- **GupshupPhoneQuality**: `Unknown`, `Green`, `Yellow`, `Red`
- **InactivityFlowBehaviors**: `Disable`, `CloseChat`, `ExecuteBot`
- **IngestStatus**: `AlreadyRunning`, `Done`, `NothingChanged`, `NoKnowledgeBase`
- **KnowledgeBaseStatuses**: `Synced`, `OutOfSync`, `NeverSynced`, `Syncing`
- **LastMessage**: `Contact`, `Member`, `All`
- **LogLevel**: `Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical`, `None`
- **MatchStrategy**: `Global`, `Group`
- **MemberAvailability**: `Available`, `Away`
- **MemberContactPhoneVisibility**: `OrganizationDefault`, `Visible`, `PartiallyHidden`, `FullyHidden`
- **MemberContactsAccess**: `OwnChannels`, `None`, `All`
- **MemberGroupContactsProperty**: `Name`
- **MemberTransferStrategy**: `Direct`, `RoundRobin`, `LoadBalancing`, `LastMemberFromSameChatChannel`, `NoOne`, `LastMemberFromSameChat`, `Variable`
- **MemberTransferTarget**: `All`, `AIAgent`
- **MentionType**: `Member`, `Contact`, `Unknown`
- **MessageSources**: `Contact`, `Member`, `External`, `Bot`
- **MessageStates**: `Processing`, `Sent`, `Received`, `Read`, `Redacted`, `Failed`, `Deleted`, `Submitted`, `Played`, `Edited`, `Reaction`, `Retrying`, `Error`
- **MessageTypes**: `Text`, `Image`, `Video`, `Audio`, `Sticker`, `Location`, `Contact`, `File`, `Payment`, `List`, `ListReply`, `CallAttempt`, `QuickReply`, `Poll`, `Gif`, `Reaction`, `Order`, `ButtonReply`, `Carousel`, `Unsupported`, `Url`
- **MoveRelativeToAnchor**: `BeforeAnchor`, `AfterAnchor`
- **NotifyFirstWidgetMessage**: `Never`, `UntilClicked`
- **NotifyMemberStrategy**: `Current`, `Direct`, `Variable`
- **Order**: `Asc`, `Desc`
- **OrganizationOrigin**: `Talk`, `AsaasFlappStore`
- **OrganizationTaskLinkKind**: `Contact`, `Chat`, `PipelineItem`
- **OrganizationTaskOrderBy**: `DueAtUTC`, `CreatedAtUTC`, `CompletedAtUTC`
- **PaginationBehavior**: `GetSliceOnly`, `CountAllAndGetSlice`, `CountOnly`, `CountByGroup`
- **Permissions**: `Member`, `Operator`, `Admin`, `Owner`
- **PhoneNumberWabaStatus**: `CreateWaba`, `MigrateWaba`
- **PipedriveMcpOperation**: `SearchPersons`, `SearchOrganizations`, `SearchDeals`, `SearchLeads`
- **PipelineItemAssigneeStrategy**: `Specific`, `ChatMember`, `CustomField`, `FewestOpenItems`
- **PipelineItemFields**: `Title`, `Status`, `AssignedMembers`, `CreatedAtUTC`, `CreatedBy`, `Stage`, `TimeInStage`
- **PipelineItemOutcome**: `Success`, `Failure`
- **PipelineItemStatus**: `Open`, `Closed`
- **PipelineItemsAccess**: `SeeAllActOnAll`, `SeeAllActOnOwn`, `SeeAllActOnNone`, `SeeOwnActOnOwn`
- **PrivateChatsBehavior**: `Enabled`, `Denied`
- **QuickAnswerVisibility**: `All`, `Mine`
- **QuickAnswersProperty**: `Name`, `Content`, `OrganizationMember`, `CreatedAtUTC`, `BestMatch`
- **ReadState**: `All`, `Read`, `Unread`
- **ReassignBehaviors**: `RemoveMember`, `ExecuteBot`
- **ReassignOptions**: `Off`, `Auto`, `Always`
- **RedactReason**: `PrivatedBySomeoneElse`, `InDisallowedSector`, `InDisallowedChannel`, `AssignedToAnotherGroup`
- **RegexOptionTarget**: `Content`, `FileName`, `All`
- **ReplyInAudio**: `Never`, `Always`, `WhenQuestionIsAudio`
- **ScheduleType**: `Message`, `Template`, `Bot`, `InternalNote`
- **ScheduledMessageActions**: `Created`, `Canceled`
- **ScheduledMessageCanceledReason**: `Deleted`, `ChannelDeleted`, `ContactDeleted`, `ContactBlocked`, `OrganizationDeleted`, `MemberDeleted`, `TemplateDeleted`, `ChatbotDeleted`, `OrganizationFileDeleted`, `MemberSentMessage`, `ContactSentMessage`, `ClosedChat`
- **ScheduledMessageStatus**: `Pending`, `Error`, `Sent`, `Canceled`
- **ScoreRating**: `NoRating`, `Awful`, `Bad`, `Average`, `Good`, `Excellent`, `Disappointing`, `Fair`, `Satisfied`, `Great`, `Outstanding`
- **ScoreRatingOrderBy**: `PositiveToNegative`, `NegativeToPositive`
- **ScoreRatingScale**: `FiveOptions`, `TenOptions`
- **SearchEngines**: `Unspecified`, `Pipeline`, `Atlas`, `Hybrid`
- **SectorTransferStrategy**: `Direct`, `LastSectorFromSameChatChannel`, `LastSectorFromSameChat`
- **SendTemplatesBehavior**: `Enabled`, `Denied`
- **SnapshotChangeType**: `TitleChanged`, `BotActivated`, `BotDeactivated`, `BotMarkedAsFinal`, `BotUnmarkedAsFinal`, `ChannelsAdded`, `ChannelsRemoved`, `StepAdded`, `StepRemoved`, `StepModified`
- **SpreadsheetQueryConditions**: `Equals`, `Contains`, `LessThan`, `GreaterThan`
- **StageAutomationReference**: `TimeInStage`, `PipelineField`, `EnteringStage`, `LeavingStage`
- **StageAutomationRunResult**: `BotStarted`, `FeatureDisabled`, `ChannelUnavailable`, `ContactNotSupportedByChannel`, `ContactBlocked`, `BotNotFound`, `TriggerNotFound`, `VariablesMissing`
- **StartWidgetOpen**: `Never`, `Always`, `Once`, `UntilInteracted`
- **SummarizeChatMode**: `Detailed`, `Simplified`, `Custom`
- **TagActionOption**: `Add`, `Remove`
- **TagChangeTargets**: `Chat`, `Contact`
- **TagColor**: `Blue`, `Skyblue`, `Cyan`, `Aquamarine`, `Green`, `Kiwi`, `Gold`, `Amber`, `Tangerine`, `Chocolate`, `Salmon`, `Tomato`, `Rose`, `Pink`, `Magenta`, `Violet`, `Grape`, `Gray`, `Silver`, `Umblerito`
- **TagProperty**: `Name`, `CreatedAtUTC`, `Order`
- **TakeDirection**: `TakeBefore`, `TakeAfter`
- **TemplateCarouselType**: `Image`, `Video`
- **TemplateCreationStatus**: `Success`, `Failed`
- **TemplateProperty**: `Channel`, `Label`, `Category`, `Status`, `CreatedAtUTC`, `Content`
- **TemplateType**: `Text`, `Image`, `Video`, `Document`, `Carousel`, `CopyCode`
- **TierQualification**: `Tier1`, `Tier2`, `Tier3`, `Tier4`
- **TransferBehaviors**: `ShowAll`, `ShowAllowed`
- **TransferReason**: `AutoReassing`, `ChatBot`, `ChatEdited`, `ChatEditedByApi`, `AICreditIssue`, `ReassignRemoveMemberBehavior`, `ModifyChatAction`, `AIInvalidMessage`, `ChatCreation`, `AIMaxResponsesReached`
- **TransferSourceType**: `Unknown`, `Member`, `Bot`, `AIAgent`, `System`
- **ViewQuickAnswersFrom**: `Everyone`, `Mine`, `Public`, `PublicOrMine`
- **WABAState**: `Active`, `AccountViolation`, `AccountRestricted`, `Disabled`, `AccountVerified`
- **WaitingFlowBehaviors**: `Disable`, `ExecuteBot`
- **WebhookMethod**: `Post`, `Put`, `Get`, `Patch`

## 5. Modelos principais (campos)

### ChatModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `organization`: OrganizationReferenceIdModel; `contact`: ContactReferenceModel; `channel`: ChatChannelReferenceBaseModel \| ChatBrokerWhatsappChannelReferenceModel \| ChatCloudAPIWhatsappChannelReferenceModel \| ChatExternalChannelReferenceBaseModel \| ChatGupshupInstagramChannelReferenceModel \| ChatGupshupWhatsappChannelReferenceModel \| ChatInstagramChannelReferenceBaseModel \| ChatInternalChannelReferenceBaseModel \| ChatMembersChannelReferenceModel \| ChatPhoneNumberChannelReferenceBaseModel \| ChatUsernameChannelReferenceBaseModel \| ChatWebsiteWidgetChannelReferenceModel \| ChatWelcomerChannelReferenceModel \| ChatWhatsappChannelReferenceBaseModel; `sector`: SectorReferenceModel; `sectorHistory`: SectorHistoryReferenceModel[]; `organizationMember`: ChatAgentReferenceModel; `organizationMembers`: ChatAgentReferenceModel[]; `organizationMemberHistory`: ChatMemberReferenceModel[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastMessage`: MessageModel \| SentMessageModel; `lastMessageReaction`: MessageReactionModel; `redactReason`: RedactReason; `usingInactivityFlow`: boolean?; `usingWaitingFlow`: boolean?; `inactivityFlowAt`: string(date-time)?; `waitingFlowAt`: string(date-time)?; `open`: boolean; `private`: boolean; `waiting`: boolean; `waitingSinceUTC`: string(date-time)?; `totalUnread`: integer(int32); `totalAIResponses`: integer(int32)?; `closedAtUTC`: string(date-time)?; `closedBy`: SimpleAgentReferenceModel; `eventAtUTC`: string(date-time); `firstMemberReplyMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `firstContactMessage`: MessageReferenceModel \| MessageForwardedReferenceModel; `bots`: BotInstanceChatDataModel[]; `lastOrganizationMember`: AgentReferenceIdModel; `message`: MessageModel \| SentMessageModel; `visibility`: ChatVisibility; `favoriteMessages`: string[]; `hasMessagesBeforeAllowedHistory`: boolean; `latestMessages`: MessagePartModel \| MessageModel \| SentMessageModel \| AutomationFlowExecutedMetadataModel \| BotErrorMetadataModel \| BotManuallyStartedMetadataModel \| BotScheduledMetadataModel \| BotStartedMetadataModel \| BotStoppedMetadataModel \| ChannelTransferMetadataModel \| ChatClosedMetadataModel \| ChatCreatedMetadataModel \| ChatPrivateChangedMetadataModel \| ChatReassignBotStartedMetadataModel \| ChatReopenedMetadataModel \| ChatVisibilityChangedMetadataModel \| ChatWaitingChangedMetadataModel \| ContactFieldEditedMetadataModel \| CustomFieldEditedMetadataModel \| MemberTransferMetadataModel \| MetadataBaseModel \| ScheduledMessageChangedMetadataModel \| SectorTransferMetadataModel \| TagsChangedMetadataModel[]

### ContactModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?; `notes`: NoteModel[]

### CustomFieldDefinitionModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `description`: string?

### MessageModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `eventAtUTC`: string(date-time); `prefix`: string?; `headerContent`: string?; `content`: string?; `footer`: string?; `file`: MessageFileModel; `thumbnail`: MessageFileModel; `quotedStatusUpdate`: MessageFileModel; `contacts`: ChatContactModel[]; `messageType`: MessageTypes; `sentByOrganizationMember`: AgentReferenceIdModel; `isPrivate`: boolean; `location`: LocationModel; `question`: BotQuestionModel \| ObjectiveBotQuestionModel \| SubjectiveQuestionModel; `source`: MessageSources; `inReplyTo`: MessageReplyReferenceModel; `messageState`: MessageStates; `chat`: ChatIdReferenceModel; `fromContact`: ContactReferenceIdModel; `templateId`: string?; `whatsappFlow`: MessageFlowModel; `whatsappFlowReply`: FlowMessageReplyModel; `catalog`: MessageCatalogModel; `buttons`: MessageButtonModel[]; `latestEdit`: LatestEditModel; `botInstance`: BotInstanceReferenceModel \| ScheduledMessageBotReferenceModel; `forwardedFrom`: MessageForwardedReferenceModel; `forwardCount`: integer(int32); `frequentlyForwarded`: boolean; `isForwardRestricted`: boolean; `scheduledMessage`: ScheduledMessageReferenceIdModel; `bulkSendSession`: BulkSendSessionReferenceModel; `elements`: string?; `mentions`: MessageMentionModel[]; `ad`: AdModel; `fileId`: string?; `reactions`: MessageReactionModel[]; `deductedAiCredits`: integer(int32)?; `isFavorite`: boolean?; `carousel`: MessageCarouselModel[]; `billable`: MessageBillableModel; `linkPreview`: LinkPreviewModel; `linkPreviewAttemptedAtUTC`: string(date-time)?

### OrganizationTaskModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `title`: string; `description`: string?; `dueAtUTC`: string(date-time)?; `reminderAtUTC`: string(date-time)?; `assignedMembers`: string[]; `links`: OrganizationTaskLinkModel \| ChatTaskLinkModel \| ContactTaskLinkModel \| PipelineItemTaskLinkModel[]; `createdBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel; `completedAtUTC`: string(date-time)?; `completedBy`: AuthorBaseModel \| AgentAuthorModel \| BotAuthorModel \| ContactAuthorModel \| SystemAuthorModel

### SectorModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `default`: boolean; `order`: number(float); `groupIds`: string[]

### SimpleContactModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string?; `phoneNumber`: string?; `lid`: string?; `whatsAppUsername`: string?; `email`: string?; `landline`: string?; `gender`: string?; `address`: AddressModel; `profilePictureUrl`: string(uri)?; `isBlocked`: boolean; `groupIdentifier`: string?; `contactType`: ContactType; `organizationMembers`: string[]; `channelIds`: string[]; `tags`: SimpleTagReferenceModel \| TagModel[]; `lastActiveUTC`: string(date-time)?; `channels`: ContactChannelModel[]; `customFields`: ContactCustomFieldModel \| ContactCNPJCustomFieldModel \| ContactCPFCustomFieldModel \| ContactContactReferenceCustomFieldModel \| ContactCurrencyCustomFieldModel \| ContactDateCustomFieldModel \| ContactDecimalCustomFieldModel \| ContactLinkCustomFieldModel \| ContactLogicCustomFieldModel \| ContactMemberCustomFieldModel \| ContactMultiOptionsCustomFieldModel \| ContactNumberCustomFieldModel \| ContactTextCustomFieldModel \| ContactListFileCustomFieldModel \| ContactListContactReferenceCustomFieldModel \| ContactListMemberCustomFieldModel \| ContactDictionaryCustomFieldModel \| ContactListStringCustomFieldModel[]; `relativeCursor`: string?

### TagModel

`_t`: string; `id`: string; `name`: string; `emoji`: string?; `color`: TagColor; `description`: string?; `order`: number(float); `createdAtUTC`: string(date-time); `groupIds`: string[]

### WebhookModel

`_t`: string; `id`: string; `createdAtUTC`: string(date-time); `name`: string; `url`: string; `failuresToday`: integer(int32); `failuresByReasonToday`: WebhookDailyFailuresModel; `paused`: boolean; `pausedDueToFailures`: boolean; `forChannels`: string[]; `events`: EventWebhookType[]

