# Visão geral do app para assistentes de IA

> Continuidade entre chats: consulte também [CONTEXTO-PARA-OUTRO-CHAT.md](handoff-context.md), conferido com o código local em 23/10/2026. Ele detalha os fluxos atuais e ressalva descrições históricas abaixo, como CRM no menu, edição financeira e funcionalidades sem tela montada.

> Aprofundamento: [contratos e detalhes de implementação](../architecture/implementation-details.md), [inventário](../architecture/code-inventory.md) e [cobertura da leitura](../architecture/reading-coverage.md). Esses documentos registram regras encontradas nos corpos do código, testes e scripts, além dos limites da análise.

Leia este arquivo primeiro. Ele resume o que o app faz, onde cada coisa mora e quais regras não se quebram. Depois leia `AGENTS.md`, `02`, `03` e `04` antes de mexer em regra de negócio.

## 1. O que é

**SOUL Cars App**: aplicativo desktop (Windows) privado da Atto Comunicação para a loja de veículos SOUL Cars. Leva um carro do estoque do BNDV até o anúncio pronto (ficha, fotos, vídeo, criativos, textos, Instagram) e acompanha o atendimento no CRM uTalk. Tudo roda localmente. **Não usa serviço pago nem chave de API**; textos de IA saem por prompt pronto, colado no chat do usuário. Única exceção: o token pessoal (somente leitura) do uTalk, opcional, cifrado no `config.json` e nunca devolvido à interface.

Stack: Electron 44, React 19, TypeScript, electron-vite, Tailwind 4, SQLite (`node:sqlite`), motor Python 3.12 (OCR, recorte, visão, vídeo, planilhas).

## 2. Páginas da interface (menu lateral)

| Menu | Componente | Função |
|---|---|---|
| 01 · Estoque | `App.tsx`, `Vitrine.tsx`, `Ficha.tsx` | Lista de veículos, vitrine, relatório completo e, por veículo, as abas Ficha → Produção → Criativos → Pronto para anunciar → Publicação → Instagram |
| 02 · CRM | `VisaoCrm.tsx` | Visão geral do uTalk (leads por etiqueta), via API somente leitura |
| 03 · Leads e Soul IA | `LeadsSouliaIa.tsx`, `DesempenhoLeads.tsx`, `SouliaIa.tsx` | Desempenho do atendimento e memória das conversas (base do futuro agente de WhatsApp) |
| 04 · BNDV | `Embutida.tsx` | Janela embutida do BNDV |
| 05 · Meta ADS | `Embutida.tsx` | Janela embutida do Gerenciador de Anúncios |
| 06 · Finanças | `Financas.tsx` | Planilha mensal vinculada (nunca copiada nem alterada), totais e vencimentos |
| Configurações | `Configuracoes.tsx` | Pastas, motor Python, token uTalk, backup |

Componentes sem rota hoje (código e testes existem, mas nenhuma tela os importa): `Entrada.tsx`, `PromptAnuncio.tsx`, `Relatorios.tsx`. Confirme com o usuário antes de religar ou remover.

## 3. Camadas

```text
renderer (React)  →  preload (window.soul.invocar / ouvir)  →  IPC (main)  →  disco, SQLite, BNDV, uTalk, motor Python
```

- `src/renderer/src`: telas e `lib/` (regras de interface, formatos, chamadas ao IPC). Sem Node.
- `src/renderer/public/criativo`: editor de artes (JS/CSS próprios, em iframe local).
- `apps/desktop/src/preload/index.ts`: ponte; expõe só `invocar` e `ouvir`.
- `apps/desktop/src/main/index.ts`: janela, segurança, ciclo de vida. `ipc.ts` é a **tabela fechada de comandos**; `ipc-esquemas.ts` valida os argumentos de cada um.
- `apps/desktop/src/main/inventory/`: extração BNDV (GraphQL), sincronização de pastas, balanço, vendas, relatório HTML/PDF, vitrine.
- `apps/desktop/src/main/studio/`: SQLite (`esquema.ts` com migrações imutáveis, `repositorio.ts`), arquivos e fotos, entrada por pasta sincronizada, Instagram (`instagram*.ts`), ponte com o motor (`motor.ts`).
- `apps/desktop/src/main/soul-ai/`: memória do CRM (`sincronizar.ts`, `memoria.ts`), análise de atendimento (`analise.ts`, `desempenho.ts`), planilha (`planilha.ts`), orquestração (`soulia.ts`).
- `apps/desktop/src/main/crm/utalk.ts` e `utalk-api.ts`: token e leitura da API do uTalk (só `GET`). `financas.ts`, `caminhos.ts`, `config-json.ts`, `validacao.ts`, `gpu.ts`, `splash.ts`: apoio.
- `apps/desktop/src/shared/`: regras puras usadas por main e renderer (anúncio, checklist, entrada, publicação, vitrine, etiquetas do CRM).
- `apps/engine/`: motor Python (CRLV, OCR, CNW, fotos, recorte, visão, vídeo, planilhas), conversa por JSON de uma linha por mensagem (`main.py`). Testes em `engine/tests`.
- `apps/desktop/tests/`: Vitest (`.test.ts`) e suítes `.mjs` de núcleo; `fixtures/` e `helpers/`.
- `scripts/`: instalação, inicialização sem terminal, smokes em Electron real, geração dos avisos de licença.
- `docs/`: documentação. `docs/13` é a biblioteca da API do uTalk (grande; consulte só quando mexer no CRM).

## 4. Regras que não se quebram

- Não modificar `legado/` nem `dados-loja/` (locais, fora do Git).
- ID BNDV identifica pasta/veículo; pastas existentes e órfãs nunca são renomeadas nem apagadas.
- Migrações de banco distribuídas são imutáveis: nova mudança vira nova versão.
- Preservar `DES.md` e `DOC.md` (formato verificado por fixture).
- Consignados não entram no custo patrimonial; margem é bruta.
- Nenhuma automação ativa campanha: o app deixa pronto, a pessoa publica.
- Renderer nunca toca disco/Node; tudo via preload. Janelas remotas (BNDV, Instagram) não recebem preload.
- Interface limpa listeners/timers e mostra erros de operação ao usuário.
- Código, nomes, comentários e mensagens em português; sem caminhos pessoais, senhas ou tokens no código.
- uTalk: somente `GET`.

## 5. Onde ficam os dados

`%APPDATA%\soul-cars-app\` (banco, `config.json`, backups, sessões) e a raiz de dados escolhida em Configurações (padrão `dados-loja/` ao lado do app: pastas dos veículos, CSVs, `soul-ia/`). Detalhes em `04-dados-e-backup.md`.

## 6. Como validar

| Alcance | Comando |
|---|---|
| Tipos | `npm run typecheck` |
| Estilo | `npm run lint`, `npm run format:check` |
| Regras e IPC | `npm test` |
| Motor Python | `npm run test:engine` |
| App real (IPC, preload, editor, arquivos) | `npm run smoke`, `npm run smoke:instagram` |
| Build / instalador | `npm run build`, `npm run package:desktop` |

## 7. Mapa de leitura por tarefa

| Tarefa | Leia |
|---|---|
| Entender arquitetura | `02-arquitetura-e-migracao.md`, `12-manual-do-desenvolvedor.md` |
| Dados, backup, pastas | `04-dados-e-backup.md` |
| Fluxo do Studio, Instagram | `08-fluxo-studio.md`, `09-instagram.md` |
| Motor Python | `05-motor-python.md` |
| CRM, Leads, Soul IA | `13`, `14`, `15`, `16` |
| Uso pelo usuário final | `11-manual-do-usuario.md` |
