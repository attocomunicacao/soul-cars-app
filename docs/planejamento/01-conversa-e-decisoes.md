# 01 · Conversa e decisões

Resumo completo da conversa de 10/10/2026 sobre montar uma "produtora com 1 pessoa e vários trabalhadores de IA" rodando localmente. Este arquivo é o contexto base: leia-o antes do roadmap (`02-roadmap.md`) e dos prompts (`03-guia-de-prompts-claude-code.md`).

Documento vivo com a mesma análise (editável): https://claude.ai/code/artifact/be6c0b0f-2886-4c6c-b8a0-18fa0975e08b

---

## 1. Quem é e o que faz

Fotógrafo, cinegrafista, editor de vídeo e gestor de tráfego, com a Atto Comunicação. Quer escalar para uma produtora com um único colaborador (ele) e vários "trabalhadores" de automação/IA que possam ser melhorados com o tempo.

Trabalhos descritos:

| Área | O que faz hoje | Dor principal |
| --- | --- | --- |
| Palestras | Corte seco com 2 a 5 câmeras; sincroniza pelo áudio; abre na câmera 1, close mais aberto na câmera 2 depois da apresentação, câmera 3 (geral) na troca de palestrante | Precisa de noção de corte; ainda está aprendendo |
| Podcast (PODPRESTEM, do SINDEPRESTEM) | Corta o começo (gravação começa minutos antes) e o fim (última fala do host); transcreve; escolhe 3 cortes de 90 s para redes sociais, com valor para o associado (dica jurídica, notícia); legenda dinâmica | Escolha dos cortes; legenda; repetição |
| Podcast da Segeti Consultoria | Mesma edição; muda logo, paleta, introdução e contexto da empresa | Escalar para mais clientes em 1 a 2 anos |
| Making-off de podcast | Grava trechos do podcast acontecendo, edita com trilha agitada (assinatura Epidemic Sound) | Criar um padrão de cenas e de edição |
| Eventos (ex.: confraternização do SINDEPRESTEM) | Esqueleto de same-day (telão), esqueleto de making-off (redes), edição de depoimentos (transcrição, legenda dinâmica, trilha sob a voz, introdução) | Montar a "mesa pronta" de cada projeto |
| Fotografia | Fotografa em RAW, colore e recorta no Lightroom | Muito tempo; edição é sensível |
| Tráfego (Soul Cars) | Sobe campanhas no Meta Ads: objetivo vendas, 28 a 60 anos, raio de 15 km do endereço da loja, só estado de SP, R$ 15 por dia, sem data final (pausa quando vende), 2 criativos (1 foto e 1 vídeo) | Baixar fotos, vídeo e documento do WhatsApp, mover para a pasta do veículo e subir a campanha |

Fluxo do estoque (Soul Cars): o carro é cadastrado no BNDV; o app `soul-cars-app` faz a varredura e cria a pasta do veículo (ID BNDV) com subpastas. A equipe cria um grupo de WhatsApp por veículo dentro de uma comunidade (ex.: `[ENTRADA] FIAT TORO - 123ABCD`) e envia fotos, vídeo e documento. O trabalho manual é baixar esses arquivos e colocá-los na pasta certa.

## 2. Hardware e dados medidos

| Item | Valor |
| --- | --- |
| PC a vender | Gigabyte B450M DS3H, Ryzen 5 5600G, 8 GB DDR4, 200 GB. Em negociação; ele precisa do dinheiro. Nenhum arquivo dele está no PC. |
| Notebook (máquina única) | Intel Core i7-1255U, 2 x 8 GB DDR4-3200 (16 GB), Intel Iris Xe |
| Disco do notebook | 457 GB, 154 GB livres (medido no disco onde está o soul-cars-app) |
| Meta de folga | 80 a 100 GB, até comprar um SSD externo de 1 TB |
| Energia | Notebook transportado a eventos; fila roda com ele na tomada |

Consequências: não há máquina 24 h; tudo roda em lote. Sem GPU de IA; tudo na CPU. O app usa o codificador Intel (QSV), que funciona no notebook.

## 3. Restrições e decisões dele

- 100% local e sem tokens extras. Tem planos do Claude (inclui Claude Code) e do ChatGPT e pode deixar os chats abertos.
- Editor: Premiere (por ser mais leve).
- A equipe aceita enviar os arquivos por pasta compartilhada em vez do grupo de WhatsApp.
- Automação sem depender de API. A verificação da empresa na Meta ainda não saiu.
- Campanhas: o destino é só o WhatsApp; hoje não há evento de otimização. Ele só gerencia campanhas; o atendimento não é dele.
- Volume: 6 a 12 carros por mês (vídeo de cerca de 400 MB, `.mov`); 2 episódios do PODPRESTEM e 1 da Segeti por mês (1 a 3 GB cada, descartáveis depois da edição).
- Escolhas finais para o roadmap: flow inicial "Estoque até o anúncio"; publicação "semiautomática".

## 4. O que foi lido no `soul-cars-app`

- Stack: Electron + React 19 + TypeScript + Vite; motor Python em `engine/` (CRLV, OCR, CNW, visão, recorte, IA e vídeo) conversando com o app por JSON por linha.
- `AGENTS.md` define as regras para alterações: ler `docs/02`, `03` e `04` antes de mudar regras de negócio; preservar Estoque primeiro e Studio segundo; não mexer na pasta `vendas`; sem caminhos pessoais, documentos reais, senhas ou tokens no código; o processo principal controla disco/banco/processos e a interface usa a ponte `preload`; migrações de banco são imutáveis (criar nova versão); preservar pastas existentes e IDs BNDV, nunca apagar pastas órfãs; preservar `DES.md` e `DOC.md`; português em nomes, comentários e mensagens; validar com tipos, testes, build e smoke conforme o alcance.
- Subpastas criadas por veículo: `CRIATIVO`, `FOTOS`, `VIDEO` (`src/main/estoque/sync.ts`).
- O Studio detecta documento (PDF, com prioridade para `DOC.pdf`), fotos (em `FOTOS`) e vídeo (um único vídeo bruto em `PROJETO`, `VIDEO` ou na pasta do veículo; vídeos finais com prefixo `VIDEO_` não são usados como entrada).
- `Editor Mágico` gera `VIDEO_<MODELO>.mp4`. Em `engine/video/render.py`: 1080x1920, HEVC pelo codificador Intel (`hevc_qsv`) a 50 Mbps, com queda para `libx265` se o QSV falhar. É por isso que o vídeo final tem cerca de 400 MB.
- `engine/ia.py` usa a API paga da Anthropic para gerar textos do anúncio. Gera custo se for usado.
- O app já gera `DES.md` com blocos de cópia (nome da campanha, textos principais, títulos, descrições, mensagem de WhatsApp) e tem aba Instagram que publica pelo navegador integrado (a publicação no Instagram usa "o único `VIDEO_*.mp4`" da pasta do veículo).
- Não encontrei código de publicação de anúncios no Meta Ads; só relatórios.

## 5. Pesquisa e fontes

Consultadas em 10/10/2026. O que não está aqui vem do meu conhecimento geral e é marcado como "de memória".

- [Meta: acesso e autenticação da Marketing API](https://developers.facebook.com/docs/marketing-api/access/): nível de desenvolvimento serve para construir e testar com limites baixos; acesso padrão para produção exige app publicado e 1.500 chamadas em 30 dias com menos de 10% de erro; tokens de usuário do sistema.
- [Meta: criar um app](https://developers.facebook.com/docs/development/create-an-app/): é preciso se registrar como desenvolvedor; a Meta pode pedir verificação da empresa.
- [AdsUploader: importação em massa de anúncios](https://adsuploader.com/blog/facebook-ads-bulk-uploads) (terceiro): a importação em massa do Gerenciador aceita até 10 vídeos novos de até 10 MB.
- [Popular AI: LLMs locais só com CPU em 2026](https://www.popularai.org/p/best-cpu-only-local-llm-2026): 1B a 3B para 8 GB; 4B (e 7B a 8B mais lentos) para 16 GB; só o Llama 3.2 é citado com suporte a português.
- [Zylos: WhatsApp API e automação em 2026](https://zylos.ai/research/2026-01-26-whatsapp-api-automation): bibliotecas não oficiais (Baileys, whatsapp-web.js) violam os termos e podem causar banimento; a API oficial é voltada a negócios.

Não consegui confirmar nas páginas da Adobe o idioma e o custo da transcrição do Premiere, nem os recursos atuais do Lightroom. Conferir na versão dele.

De memória (a verificar): bots do Telegram limitam o download a cerca de 20 MB na API padrão; a automação por script do Premiere está migrando para UXP; parâmetros de campanha de mensagens por API.

## 6. Decisões de arquitetura

Três camadas e uma regra de aprovação:

1. **Construir** com a assinatura (Claude Code e ChatGPT), uma vez; o código vai para o Git.
2. **Executar** com scripts determinísticos (FFmpeg, faster-whisper, watchers, motor do app), em fila, um trabalho pesado por vez.
3. **Decidir** com modelo local pequeno ou, preferencialmente neste volume, com o modo "prompt pronto": o sistema monta o prompt, ele cola no chat que já paga e devolve o resultado.
4. **Aprovação humana** antes de gastar dinheiro ou publicar.

Conclusão importante: com 12 carros e 3 episódios por mês, não é preciso um agente de IA rodando localmente. O ganho está em scripts de repetição e em escala futura. O Ollama ficou como teste opcional.

Trabalhadores (ordem atual):

| Trabalhador | Função | IA | Ordem |
| --- | --- | --- | --- |
| Orquestrador | Fila, agenda, logs, aprovações | Nenhuma | 1 |
| Entrada do estoque | Pasta compartilhada para pasta do veículo, casando pela placa | Nenhuma | 1 |
| Pré-campanha | Motor do app, pasta do veículo pronta, textos e criativos | Visão/OCR locais; textos por prompt pronto | 1 |
| Podcast (vários clientes) | Cortes de início e fim, transcrição, legenda, 3 cortes; perfil por cliente | Escolha dos cortes por prompt pronto | 2 |
| Making-off e eventos | Esqueletos de same-day, making-off, depoimentos (XML/EDL para o Premiere) | Pouca | 3 |
| Palestras multicâmera | Sincronização por áudio e regras de plano | Nenhuma no início | 4 |
| Foto | Triagem e sincronização de ajustes; tratamento fica com ele | Detecção de borrão/olhos fechados | 4 |
| Publicador Meta Ads (API) | Criar campanha pausada e esperar aprovação | Nenhuma | Opcional, depois da verificação |

## 7. O que mudou ao longo da conversa

- A primeira resposta foi feita sem pesquisa na web; depois foi pesquisada e corrigida.
- Bot do Telegram deixou de ser recomendado (limite de download e vídeo de 400 MB); pasta compartilhada foi a escolhida.
- A importação em massa do Gerenciador de Anúncios foi descartada (limite de 10 MB por vídeo novo).
- O PC será vendido: não há servidor 24 h; fila em lote no notebook.
- Modelo local passou de "peça central" a "opcional".
- Sugerida uma versão leve do vídeo (10 a 12 Mbps) só para anúncio, mantendo o render atual.

## 8. Perguntas ainda em aberto

- Qual serviço de pasta compartilhada: Google Drive ou OneDrive (e quanto espaço na nuvem)?
- Como o app liga a placa do nome do grupo ao ID BNDV do veículo (placa na ficha ou no `INFO.md`)? Confirmar no código.
- Quanto tempo leva hoje, por carro, o fluxo manual (baseline para saber o ganho)?
- Quantas câmeras e minutos tem um episódio de podcast típico?
- Quais músicas da Epidemic Sound formam a biblioteca fixa do making-off?
