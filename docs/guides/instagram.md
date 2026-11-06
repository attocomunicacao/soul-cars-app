# Instagram: primeiro uso e automação

A quinta aba do veículo, depois de Publicação, é **Instagram**. A opção escolhida para este app foi publicar pelo navegador integrado, com a sessão mantida em `persist:instagram`.

## Primeiro uso

1. Gere as legendas em DES.md e o vídeo no Editor Mágico.
2. Abra **Instagram**, informe o usuário da loja sem `@` e clique em **Salvar conta**.
3. Se os criativos ainda não estiverem em CRIATIVO, clique em **Baixar carrossel e capa**. O editor carrega fotos/ajustes salvos e exporta os dois formatos. Ao salvar as quatro imagens, o app retorna para Instagram. Fotos do carrossel precisam dos recortes 1, 2 e 4; se necessário, use **Recortar carrossel 1, 2 e 4** no editor e repita a exportação.
4. Clique em **Abrir Instagram no app**, faça login e resolva as verificações do Instagram na janela. Deixe a página inicial aberta; o botão Perfil identifica a conta conectada.
5. Revise as imagens e legendas no Studio e clique em **Publicar carrossel e depois Reels**. O app verifica que o usuário conectado corresponde à conta salva.

O nome das peças é derivado do nome/ano da ficha. Para Jeep Renegade 2020, o carrossel é enviado nesta ordem:

1. `jeep-renegade-2020-carrossel-2.png`
2. `jeep-renegade-2020-carrossel-1.png`
3. `jeep-renegade-2020-carrossel-3.png`

A legenda é exatamente o bloco **1. TEXTO PRINCIPAL**. Depois da confirmação do carrossel, o app envia o único `VIDEO_*.mp4` na pasta do veículo (a versão leve para anúncio fica em `ANUNCIO/` e não é usada aqui) com **2. TEXTO PRINCIPAL**. A capa é `jeep-renegade-2020-trafego-pago.png`, correspondente a **01 · Tráfego Pago**.

## Retomada

Cada envio confirmado fica registrado por veículo e conta. Se o Reels falhar, **Retomar publicação do Reels** conserva o carrossel já publicado. A capa é obrigatória: quando a tela do Instagram não permite anexá-la, a automação interrompe antes de compartilhar o vídeo.

O app só publica; não há etapa de consulta ou conferência. Se o app fechar ou perder a confirmação após clicar em Compartilhar, a etapa volta a **Pendente** e o resultado no perfil é responsabilidade de quem publica.

Feche um editor/rascunho que ficou aberto na janela antes de retomar. **Interromper automação** para os próximos passos; se o envio já começou, veja o perfil. Mantenha arquivos/legendas do mesmo conjunto durante uma retomada. Com carrossel e Reels já publicados, o botão vira **Publicar novamente** e refaz as duas etapas (útil se o post foi apagado).

## Pesquisa de tecnologias

Pesquisa em 09/10/2026:

| Abordagem | Tecnologias e uso | Aplicação neste projeto |
|---|---|---|
| Publicação por API | Meta Instagram API, OAuth e acompanhamento de contêineres; exige conta profissional. Buffer oferece API de publicação, com posts, mídias, estados e configuração de post/Reel. | Caminho para uma integração futura com conta profissional e permissões configuradas. |
| Orquestração | n8n possui nó Facebook Graph API para compor chamadas, arquivos e fluxos. | Opção para servidor/agendamento futuro. |
| Navegador | Playwright/Puppeteer usam automação Chromium; Playwright também documenta conexão CDP e testes Electron. | O app utiliza diretamente o Chromium/CDP que acompanha o Electron, sem instalar um segundo navegador. |

Fontes primárias: [Instagram API — coleção oficial da Meta](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00), [Buffer API](https://buffer.com/api), [posts e agendamento do Buffer](https://developers.buffer.com/guides/posts-and-scheduling.html), [n8n Facebook Graph API](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.facebookgraphapi/), [Playwright Electron](https://playwright.dev/docs/api/class-electron), [Electron Debugger/CDP](https://www.electronjs.org/docs/latest/api/debugger).

O navegador foi escolhido pelo usuário para atender a conta atual, que pode ser pessoal. Esta integração depende dos controles da interface web do Instagram, em português/inglês. Mudanças de tela ou verificações de login podem exigir intervenção. A API oficial é a alternativa para uma operação baseada em permissões e endpoints estáveis.

## Arquivos para vibe code

- `apps/desktop/src/renderer/src/pages/vehicle/instagram/InstagramPublisher.tsx`: prévias, botões, conta e acompanhamento.
- `apps/desktop/src/renderer/src/pages/vehicle/VehiclePage.tsx`: ordem das abas e ligação com o editor.
- `apps/desktop/src/renderer/src/pages/vehicle/creatives/Creatives.tsx` e `public/criativo/flow-bridge.js`: exportação dos quatro arquivos.
- `apps/desktop/src/shared/instagram.ts`: tipos e padrão do nome do criativo.
- `apps/desktop/src/shared/publication.ts`: extração dos blocos de DES.md; o módulo antigo reexporta estas regras.
- `apps/desktop/src/main/studio/instagram-plan.ts`: ordem 2, 1, 3 e seleção de capa/vídeo/legendas.
- `apps/desktop/src/main/studio/instagram-browser.ts`: seletores de Criar, Avançar, legenda, capa e Compartilhar.
- `apps/desktop/src/main/studio/instagram.ts`: sessão, conta, cópia do pacote e histórico.

Disco e automação ficam no main. A página remota não recebe preload nem acesso Node. Login e verificações ficam com o usuário; arquivos trafegam pelo seletor de mídia do próprio Chromium.

`%APPDATA%\soul-cars-app\instagram` guarda a conta escolhida, os registros e cópias dos pacotes enviados. Inclua essa pasta no backup para preservar a prevenção de duplicatas. A sessão de login fica na partição persistente do Electron, fora do código. Os pacotes contêm apenas as mídias selecionadas para postagem. Eles ocupam espaço; guarde o histórico ao gerenciar o armazenamento.

## Verificação

Execute `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` e `npm run smoke:instagram`. O último usa uma página local simulada interceptada em sessão temporária: verifica arquivos/ordem, texto, capa, retomada, interrupção e as setas do lucro mensal, sem acessar uma conta real. A validação na conta da loja acontece no primeiro uso autenticado; a suíte offline não confirma que a interface atual do Instagram mantém os mesmos seletores.
