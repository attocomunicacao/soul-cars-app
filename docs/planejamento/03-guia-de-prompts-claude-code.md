# 03 · Guia de prompts para o Claude Code

Prompts prontos para colar no Claude Code, na ordem do `02-roadmap.md`. O Claude Code usa a sua assinatura; nenhum prompt aqui chama API paga.

## Como usar

1. Abra o Claude Code na pasta do app (`soul-cars-app`). Os três arquivos de planejamento ficam em `docs/planejamento/`.
2. Cole o **Prompt 0 (contexto)** uma vez no começo de cada sessão nova.
3. Cole **um prompt de tarefa por vez**. Cada um pede um plano antes de alterar código: leia o plano, ajuste e só então diga "pode executar".
4. Ao final de cada tarefa, peça para rodar as validações (abaixo) e **faça um commit por tarefa**. Se algo der errado, você volta uma tarefa só.
5. Teste na prática com um carro real antes de passar para a tarefa seguinte (o "teste de passagem" do roadmap).

Validações do app (`package.json`): `npm run tipos`, `npm test`, `npm run test:engine` (quando mexer em Python), `npm run build`, `npm run smoke` (quando mexer em IPC, preload, editor ou arquivos). Mudanças só de documentação não precisam.

Dica: se uma resposta vier grande demais, peça "faça só o passo 1 do plano".

---

## Prompt 0 · Contexto (cole primeiro)

```text
Você vai trabalhar no projeto soul-cars-app (Electron + React 19 + TypeScript + Vite, com motor Python em engine/). Sou fotógrafo, editor de vídeo e gestor de tráfego da Atto Comunicação e uso este app no estoque da Soul Cars.

Antes de qualquer alteração, leia nesta ordem: AGENTS.md, docs/02-arquitetura-e-migracao.md, docs/03-vibe-code.md, docs/04-dados-e-backup.md, e depois o módulo que a tarefa tocar. Leia também docs/planejamento/01-conversa-e-decisoes.md e docs/planejamento/02-roadmap.md para entender o contexto e a ordem das tarefas.

Restrições que valem sempre:
- Custo zero: nada pode chamar API paga por padrão. Não adicione dependências que exijam chave.
- Sem API da Meta e sem bibliotecas não oficiais de WhatsApp (Baileys, whatsapp-web.js etc.). Nenhuma automação publica ou ativa anúncio sozinha.
- Máquina: notebook Windows, i7-1255U, 16 GB de RAM, sem GPU de IA, cerca de 154 GB livres. Um trabalho pesado por vez; arquivos de vídeo têm cerca de 400 MB.
- Siga o AGENTS.md: português em nomes, comentários e mensagens; sem caminhos pessoais, documentos reais, senhas ou tokens no código; renderer só fala com o main pela ponte preload; migrações de banco são imutáveis (crie nova versão); preserve pastas existentes e IDs BNDV; nunca apague pastas órfãs; preserve DES.md e DOC.md; não modifique a pasta vendas.
- Não apague nem sobrescreva arquivos do usuário. Prefira copiar.
- Interface deve limpar listeners e timers e mostrar erros de operação ao usuário.

Forma de trabalho: primeiro me apresente um plano curto (arquivos que vai ler e alterar, riscos, como vai testar) e espere minha aprovação. Depois implemente em passos pequenos, rode as validações pertinentes (npm run tipos, npm test, e npm run smoke ou npm run test:engine quando o alcance exigir) e resuma o que mudou. Não faça commit sem eu pedir.

Confirme que entendeu respondendo apenas com as 5 regras mais importantes que você vai respeitar.
```

---

## Prompt 1 · Modo "prompt pronto" para os textos do anúncio (Fase 0)

```text
Tarefa: eliminar o custo de API na geração dos textos do anúncio, sem perder a funcionalidade.

Contexto: engine/ia.py usa a API da Anthropic (cobrada) para gerar 5 textos, 5 títulos e uma frase de WhatsApp a partir da ficha do veículo. Quero manter esse modo, mas desligado por padrão, e adicionar um modo "prompt pronto" que usa o chat que eu já pago.

Faça assim:
1. Leia engine/ia.py, o schema e o SYSTEM prompt, e onde o app chama a IA (renderer e main). Me mostre o fluxo atual.
2. Proponha o plano do modo "prompt pronto": o app monta o prompt completo (regras do SYSTEM + dados da ficha + lista de equipamentos) e o mostra com um botão Copiar; eu colo no chat (Claude ou ChatGPT) e peço a resposta em JSON no mesmo schema; eu colo a resposta de volta num campo; o app valida o JSON contra o schema (5 textos com chamada, 3 destaques copiados literalmente da lista de equipamentos, CTA começando com 📲; 5 títulos em maiúsculas com até 40 caracteres; frase de WhatsApp) e mostra erros claros; se válido, gera o DES.md pelo mesmo caminho que já existe.
3. Os destaques precisam ser copiados literalmente da lista de equipamentos e itens marcados como opcionais não podem virar destaque: reaproveite as validações que já existirem.
4. O modo API continua existindo, mas só é usado se eu ativar nas configurações e informar a chave; nunca por padrão.
5. Preço, km, ano e cor continuam vindo da ficha, nunca da IA.
6. Acrescente testes (vitest) para a validação do JSON.

Critério de aceite: com o modo "prompt pronto", consigo gerar o DES.md de um veículo de teste sem nenhuma chave configurada e sem nenhum acesso à internet pelo app.
```

---

## Prompt 2 · Entrada dos arquivos por pasta sincronizada (Fase 1)

```text
Tarefa: criar o "trabalhador de entrada": observar uma pasta sincronizada (Google Drive para Desktop ou OneDrive) e copiar fotos, vídeo e documento de cada veículo para a pasta certa do app, sem eu baixar nada do WhatsApp.

Antes de codar, leia src/main/estoque/sync.ts (criação das pastas e subpastas CRIATIVO, FOTOS, VIDEO), src/main/studio/arquivos.ts, src/main/studio/banco.ts e esquema.ts, src/main/ipc.ts e src/preload/index.ts, e docs/08-fluxo-studio.md (regras de documento, fotos e vídeo). Descubra COMO o app liga um veículo à placa (campo na ficha? INFO.md?) e me diga o que encontrou.

Especificação:
- Configuração: o caminho da pasta sincronizada vem das configurações do app (nunca fixo no código). Dentro dela, cada veículo é uma subpasta com a placa no nome, por exemplo "TORO - 123ABCD" ou "[ENTRADA] FIAT TORO - 123ABCD". Extraia a placa por regex (padrão antigo ABC1234 e Mercosul ABC1D23), ignorando maiúsculas e minúsculas e separadores.
- Casamento: ache o veículo pela placa. Se a placa não casar com nenhum veículo, ou casar com mais de um, NÃO copie: registre em uma lista de pendências visível na interface.
- Classificação por extensão: fotos (jpg, jpeg, png, heic) vão para FOTOS; vídeo (mov, mp4) vai para VIDEO (lembre da regra de um único vídeo bruto); PDF é o documento e segue a regra de DOC.pdf do app. Outros arquivos vão para a lista de pendências.
- Segurança: COPIE, nunca mova nem apague a origem; nunca sobrescreva um arquivo existente no destino (se o nome colidir, ignore e registre, ou use sufixo previsível); só processe arquivos cujo tamanho esteja estável (a sincronização pode estar no meio do download; ignore arquivos temporários e parciais); seja idempotente: rodar duas vezes não duplica nada (guarde um registro do que já foi copiado, em nova migração de banco, sem alterar migrações antigas).
- Vídeos de cerca de 400 MB: copie em fluxo (stream), sem carregar em memória, e mostre progresso.
- Interface: no Estoque ou no Studio, um painel "Entrada" com o estado (observando, copiando, pendências), botão para verificar agora e botão para pausar. Mostre erros ao usuário. Limpe listeners e timers.
- Limpeza: NÃO apague nada da nuvem automaticamente. Opcionalmente, ofereça um botão "Liberar espaço" que apaga a cópia da nuvem apenas dos veículos que eu marcar, com confirmação, e só se o destino tiver os mesmos arquivos (compare tamanho e hash).
- Testes: vitest para extração de placa, classificação, idempotência e colisão de nomes, usando pastas temporárias. Rode npm run smoke porque envolve arquivos e IPC.

Me entregue primeiro o plano. Critério de aceite: com 3 carros de teste, a pasta completa (fotos, vídeo, documento) aparece no veículo certo sem eu abrir o WhatsApp nem a pasta Downloads, e rodar de novo não duplica nada.
```

---

## Prompt 3 · Versão leve do vídeo para anúncio (Fase 2)

```text
Tarefa: gerar uma versão leve do vídeo só para anúncio, sem mexer no render atual.

Contexto: engine/video/render.py codifica 1080x1920 em HEVC pelo codificador Intel (hevc_qsv) a 50 Mbps (-b:v 50M, -maxrate 100M), com queda para libx265 se o QSV falhar. O resultado tem cerca de 400 MB, grande demais para subir em anúncio. O app também publica no Instagram usando "o único VIDEO_*.mp4" da pasta do veículo (veja src/main/studio/instagram-plano.ts e docs/09-instagram.md), e vídeos com prefixo VIDEO_ nunca são usados como entrada do Editor Mágico (docs/08-fluxo-studio.md).

Faça assim:
1. Leia render.py, instagram-plano.ts, arquivos.ts e como o Editor Mágico chama o motor. Me diga como a versão leve pode existir sem criar um segundo arquivo VIDEO_*.mp4 na pasta do veículo (por exemplo, com outro prefixo ou dentro de CRIATIVO) e sem ser pega como vídeo bruto de entrada.
2. Proponha o plano. A versão leve deve reaproveitar o mesmo filtro (mesma composição, tarjas, legendas e trilha), mudando apenas a codificação: alvo de cerca de 10 a 12 Mbps, mesmo codec que funcionar melhor no notebook (QSV quando disponível, com queda segura), áudio AAC a 128 a 192 kbps, mantendo +faststart. Evite renderizar duas vezes do zero se for possível gerar a leve a partir do render principal sem perda perceptível; me explique a troca entre qualidade, tempo e disco.
3. O render atual e o VIDEO_<MODELO>.mp4 existentes NÃO podem mudar de comportamento nem de nome.
4. Exponha um botão ou opção no Studio ("Gerar versão leve para anúncio") e mostre o tamanho dos dois arquivos.
5. Testes: engine/tests (test_video.py) para o novo caminho, usando mídia mínima gerada na hora. Rode npm run test:engine e npm run smoke.

Critério de aceite: a versão leve fica abaixo de 100 MB para um vídeo típico, eu aprovo a qualidade lado a lado, e a publicação no Instagram continua achando exatamente um VIDEO_*.mp4.
```

---

## Prompt 4 · Painel "Pronto para anunciar" (Fase 3)

```text
Tarefa: no Studio, deixar a publicação do anúncio semiautomática, sem API da Meta.

Contexto: o app já gera DES.md com blocos de cópia (nome da campanha, textos principais, títulos, descrições, mensagem de WhatsApp) pela lógica em src/compartilhado/publicacao.ts e src/renderer/src/lib/publicacao.ts, e tem uma aba Instagram com histórico anti-duplicação e fluxo de retomada (src/renderer/src/Instagram.tsx, src/main/studio/instagram.ts). Meus anúncios são campanhas de vendas com destino WhatsApp, 28 a 60 anos, raio de 15 km, apenas SP, R$ 15 por dia, sem data final, com 2 criativos (1 foto e 1 vídeo). Eu mesmo duplico uma campanha modelo no Gerenciador de Anúncios e troco criativo e texto. Quero que o app deixe tudo pronto e me guie.

Leia primeiro Producao.tsx, Ficha.tsx, Criativos.tsx, Instagram.tsx, publicacao.ts, o esquema do banco e a varredura do BNDV em src/main/estoque (para saber como a saída de um veículo é detectada). Me diga o que encontrou e proponha o plano.

Especificação:
1. Checklist de prontidão por veículo: documento lido, fotos presentes e na ordem, vídeo gerado (e versão leve, se existir), DES.md gerado, criativos exportados. Cada item com estado e atalho para resolver.
2. Cartão "Campanha": nome da campanha, texto principal, título, os arquivos exatos a usar (foto e vídeo leve) com botão de abrir a pasta e botões de copiar, e um passo a passo curto "duplicar a campanha modelo e trocar criativo e texto".
3. Registro manual "Anúncio criado": data e nome da campanha. Nova migração de banco (não altere migrações antigas). Nenhuma ação do app publica ou ativa nada.
4. Lembrete de pausa: quando a varredura do BNDV detectar a saída de um veículo que tem anúncio registrado como criado, mostre um aviso claro "Pause a campanha de <modelo>" até eu marcar como pausada. Se a detecção de saída ainda não existir, diga o que falta em vez de inventar.
5. Preserve as duas interfaces principais (Estoque primeiro, Studio segundo) e as regras de DES.md e DOC.md.
6. Testes e validações: npm run tipos, npm test, npm run build, e npm run smoke.

Critério de aceite: do carro pronto ao anúncio no ar eu levo poucos minutos, seguindo só o cartão, e nenhum veículo vendido fica sem aviso de pausa.
```

---

## Prompt 5 · Revisão antes de seguir (use ao fim de cada fase)

```text
Revise as alterações desta fase como um revisor exigente, sem mudar nada:
1. Liste cada arquivo alterado e diga, em uma frase, por quê.
2. Aponte qualquer violação das regras do AGENTS.md (português, caminhos pessoais, segredos, migrações imutáveis, pastas órfãs, DES.md/DOC.md, renderer sem acesso direto a disco).
3. Aponte qualquer risco de apagar, sobrescrever ou duplicar arquivos do usuário, de vazar memória com vídeos grandes, ou de deixar timers e listeners abertos.
4. Rode npm run tipos, npm test e, se couber, npm run smoke, e mostre o resultado.
5. Diga o que ainda não foi testado com arquivos reais e como eu devo testar.
Responda em lista curta e só proponha correções; não aplique.
```

---

## Modelos para os próximos flows

Use o mesmo método (plano primeiro, passos pequenos, validações, commit por tarefa). Ajuste antes de usar: os detalhes abaixo são o ponto de partida, não a especificação final.

### Modelo · Podcast (Flow B)

```text
Tarefa: criar um pipeline de podcast com perfis de cliente, em Python dentro de engine/ (ou em módulo separado, se fizer mais sentido; justifique), reaproveitando o faster-whisper que o app já usa (engine/video/transcribe.py).

Entrada: um vídeo de episódio (1 a 3 GB). Perfis em YAML por cliente: nome, logo, paleta, introdução, contexto da empresa (para orientar a escolha dos cortes), estilo de legenda e regras de corte. Clientes iniciais: PODPRESTEM (SINDEPRESTEM) e Segeti Consultoria.

Etapas: (1) transcrição com tempo por palavra em português; (2) detectar onde a conversa realmente começa e a última fala do host e cortar início e fim; (3) gerar cerca de 10 candidatos de corte de 80 a 100 s que começam e terminam em frase completa e pontuam por palavras-chave do perfil; (4) modo "prompt pronto": montar o prompt com a transcrição e os candidatos, eu colo no chat, devolvo o JSON com os 3 melhores, o sistema valida (3 cortes de cerca de 90 s, sem sobreposição); (5) renderizar cada corte vertical com legenda dinâmica palavra por palavra (arquivo ASS por FFmpeg), logo e paleta do perfil.

Restrições: custo zero, um trabalho pesado por vez (16 GB, sem GPU), episódio bruto pode ser apagado depois; não apagar nada sozinho; logs claros; testes com mídia mínima. Primeiro me apresente o plano.
```

### Modelo · Eventos (Flow C)

```text
Tarefa: criar um gerador de esqueleto de projeto para eventos, que produz um XML ou EDL importável no Premiere Pro com: marcadores de cada cena (nomeados em sequência de filmagem), trilhas e efeitos sonoros em trilhas separadas (a partir de uma pasta de biblioteca que eu configuro), introdução, logo e espaços vazios para os designs do evento. Variações: same-day (16:9, para telão), making-off (9:16, redes sociais) e depoimentos em lote (transcrição, legenda dinâmica, trilha baixa sob a voz, introdução).

Antes de codar, me diga qual formato o Premiere importa com mais fidelidade (FCPXML, EDL ou outro), quais limitações cada um tem, e como validar o arquivo gerado. Não invente suporte; se algo precisar de teste manual no Premiere, diga. Plano primeiro.
```

### Modelo · Palestras multicâmera (Flow D)

```text
Tarefa: montar uma primeira timeline automática de palestra com 2 a 5 câmeras. Passos: sincronizar as câmeras pelo áudio (correlação entre as ondas, com FFmpeg e Python); detectar quem fala e a troca de palestrante; aplicar regras de plano (abre na câmera 1; durante a fala, câmera 2 em close mais aberto; na troca de palestrante, câmera 3 geral; plano mínimo de 4 a 6 s); exportar XML para o Premiere. Mantenha as regras em um arquivo de configuração e registre, a cada projeto, a diferença entre a montagem do agente e a minha versão final, para eu transformar diferenças em regras novas. Plano primeiro; diga o que não for confiável com 16 GB e sem GPU.
```

---

## Boas práticas ao trabalhar com o Claude Code

- Uma tarefa por sessão sempre que possível; sessões longas acumulam contexto e confusão.
- Peça o plano e leia. Se o plano mexe em arquivos demais, peça para dividir.
- Teste com **arquivos reais** (um carro de verdade) antes de aprovar; testes automáticos não pegam tudo.
- Guarde segredos fora do repositório; o Claude Code não precisa de nenhuma chave deste projeto.
- Se uma fase mudar uma regra do app, peça para atualizar `docs/` e o `AGENTS.md` na mesma tarefa.
- Atualize o `02-roadmap.md` marcando as caixas conforme concluir.
