# 02 · Roadmap

Flow inicial escolhido: **Estoque até o anúncio**. Publicação do anúncio: **semiautomática, sem API da Meta**. Contexto e motivos em `01-conversa-e-decisoes.md`.

Como usar: cada fase tem tarefas, um **teste de passagem** (só avance quando passar) e um tamanho (P = poucas horas, M = alguns dias, G = semanas). Os tamanhos são estimativas minhas. Para executar uma tarefa, use o prompt de mesmo número em `03-guia-de-prompts-claude-code.md`.

Regras que valem para todas as fases:
- Custo zero de API: nada que chame serviço pago por padrão.
- Nada de bibliotecas não oficiais de WhatsApp (risco de banimento do número).
- Nenhuma automação clica em "publicar" ou "ativar" sozinha: você sempre aprova.
- Um trabalho pesado por vez (16 GB de RAM, sem GPU).
- Siga o `AGENTS.md` do app: português, sem caminhos pessoais nem segredos no código, IDs BNDV preservados, pastas existentes nunca apagadas.

---

## Fase 0 · Base e medição (P)

- [ ] (`git init` feito em 11/10/2026, sem commit; falta o commit inicial e a cópia privada fora do notebook) Confirmar que o `soul-cars-app` está sob Git no notebook e que há cópia fora dele (repositório privado, conforme `docs/06-github.md`). Não publicar dados da loja.
- [ ] Medir o baseline: cronometrar 3 carros no fluxo manual atual (baixar do WhatsApp, mover para a pasta, preparar e subir o anúncio). Sem esse número não dá para saber o ganho real.
- [ ] Configurar o Windows para não suspender com o carregador ligado durante a fila e manter o notebook ventilado.
- [x] Prompt 1: modo "prompt pronto" para os textos do anúncio, ao lado do modo API (que fica desligado por padrão).
- [ ] Decidir o serviço de pasta compartilhada (Google Drive ou OneDrive) e a convenção de nomes (ver Fase 1).

**Passa quando:** um texto de anúncio é gerado sem usar nenhuma chave de API e o baseline está anotado.

Observação: o PC a vender não tem arquivos seus, então não há backup dele a fazer. Só confirme que nenhuma senha ou sessão sua ficou nele antes de entregar.

## Fase 1 · Entrada dos arquivos (M)

Objetivo: acabar com baixar do WhatsApp e mover para a pasta.

Decisões a tomar antes de codar:
- [x] Serviço: Google Drive para Desktop (decidido em 11/10/2026).
- [ ] Convenção: uma pasta por veículo na pasta sincronizada, com a placa no nome (ex.: `TORO - 123ABCD`). A equipe sobe fotos, vídeo e documento ali.
- [ ] Quem sobe: a equipe que hoje usa a comunidade do WhatsApp.

Tarefas:
- [x] Prompt 2 (feito, falta testar com a pasta real): *watcher* que observa a pasta sincronizada, extrai a placa, acha o veículo no app e **copia** (nunca move nem sobrescreve) para `FOTOS`, `VIDEO` e o documento (`DOC.pdf`).
- [x] Tela de pendências: arquivos cuja placa não casa com nenhum veículo, para você resolver.
- [x] Limpeza opt-in (envia para a Lixeira, só dos marcados e conferidos por hash): depois de confirmado no destino e com o carro fechado, oferecer apagar a cópia da nuvem (4,8 GB por mês em vídeo).

**Passa quando:** um carro vai do envio da equipe até a pasta completa (fotos, vídeo e documento) sem você abrir WhatsApp nem Downloads, em 3 carros seguidos.

## Fase 2 · Vídeo leve para anúncio (P)

- [ ] Prompt 3: gerar, além do `VIDEO_<MODELO>.mp4` atual, uma versão leve (cerca de 10 a 12 Mbps), **sem quebrar** a regra de "um único `VIDEO_*.mp4`" usada na publicação do Instagram. Manter o render atual intacto.
- [ ] Comparar lado a lado a qualidade das duas versões antes de adotar a leve nos anúncios.

**Passa quando:** a versão leve tem uma fração do tamanho (meta: abaixo de 100 MB) e você aprova a qualidade visualmente.

## Fase 3 · Painel "Pronto para anunciar" (M)

Publicação semiautomática: o app deixa tudo pronto e você duplica a campanha modelo no Gerenciador de Anúncios.

- [ ] Prompt 4: no Studio, por veículo, checklist de prontidão (documento, fotos, vídeo, `DES.md`, criativos exportados, vídeo leve) e um cartão "Campanha" com nome, texto, título e arquivos a usar, com botões de copiar.
- [ ] Criar e manter uma **campanha modelo** no Gerenciador (objetivo vendas, WhatsApp, 28 a 60 anos, raio de 15 km, SP, R$ 15 por dia). Documentar no app o passo a passo de duplicar e trocar criativo e texto.
- [ ] Marcar manualmente "anúncio criado" no app (data e nome da campanha).
- [ ] Lembrete de pausa: quando a varredura do BNDV detectar a saída do veículo, o app avisa "pause a campanha de <modelo>".

**Passa quando:** do carro pronto ao anúncio no ar levam poucos minutos, e nenhum carro vendido fica com campanha ativa por esquecimento.

## Fase 4 · Medir e decidir (P)

- [ ] Depois de um mês (6 a 12 carros), comparar o tempo por carro com o baseline.
- [ ] Decidir se vale ir para a API da Meta (depende da verificação da empresa e do ganho medido) ou manter o semiautomático.

---

## Próximos flows (depois do estoque)

Ordem sugerida; o mesmo método (prompt, teste de passagem) vale para todos.

### Flow B · Podcast (PODPRESTEM e Segeti)
- [ ] Perfil por cliente em arquivo YAML (logo, paleta, introdução, contexto da empresa, estilo de legenda, regras de corte).
- [ ] Corte de início e fim por transcrição com tempo por palavra (faster-whisper).
- [ ] Candidatos a corte por regras (janelas de 80 a 100 s, começo e fim em frase completa, palavras-chave do perfil).
- [ ] Modo "prompt pronto": o sistema monta o prompt com a transcrição e os candidatos; você cola no chat e devolve o JSON; ele valida.
- [ ] Legenda dinâmica palavra por palavra, queimada por FFmpeg (arquivo ASS), com 2 ou 3 estilos para comparar.
- [ ] Making-off do podcast com modelo de cenas e uma biblioteca fixa de trilhas.
**Passa quando:** um episódio inteiro consome menos de 30 minutos do seu tempo.

### Flow C · Eventos
- [ ] Gerador de esqueleto do projeto (marcadores de cena, trilha, efeitos, introdução, logo, espaços para o design) em XML ou EDL que o Premiere importa.
- [ ] Variações: same-day (16:9, telão), making-off (9:16, redes), depoimentos em lote.
**Passa quando:** um evento novo abre no Premiere já com a estrutura pronta.

### Flow D · Palestras multicâmera e foto
- [ ] Sincronização por áudio, detecção de troca de palestrante, regras de plano, saída em XML.
- [ ] Caderno de regras: comparar a montagem do agente com a sua versão final; cada diferença vira regra ou exceção.
- [ ] Foto: triagem (borradas, olhos fechados, duplicatas) e cópia de ajustes entre fotos da mesma cena; o tratamento continua com você.

### Opcional · Fila e painel de tarefas
Quando houver mais de um flow, um orquestrador simples (fila em SQLite, logs, agendador do Windows) para rodar um trabalho pesado por vez.

### Opcional · API da Meta
Só depois da verificação da empresa e se a Fase 4 mostrar ganho. Campanha sempre criada pausada, com aprovação sua e pausa na venda.

---

## Pendências suas, fora do código

- [ ] Iniciar a verificação da empresa no Business Manager (prazo fora do seu controle; só relevante para o item opcional da API).
- [ ] Escolher a biblioteca de 10 a 20 trilhas agitadas da Epidemic Sound para o making-off.
- [ ] Comprar o SSD externo de 1 TB quando o orçamento permitir; até lá, apagar bruto e intermediários ao fechar cada projeto (pico mensal estimado abaixo de 25 GB).
