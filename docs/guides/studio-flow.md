# Produção no Studio

Ao abrir um veículo, a primeira aba é **Ficha** (com o documento CRLV no topo); a segunda é **Produção** (fotos e vídeo). Vincule a pasta do veículo caso ela ainda não esteja associada. A tela consulta documento, fotos e vídeo ao entrar e a cada 5 segundos. Os botões **Verificar documento**, **Verificar fotos** e **Verificar vídeo** permitem atualizar imediatamente.

1. **Documento (aba Ficha, no topo):** qualquer PDF na pasta é detectado; DOC.pdf tem prioridade quando existe. **Anexar documento** abre a seleção de PDF e copia para DOC.pdf. **Ler documento e preencher ficha** executa a leitura do CRLV, preenche os campos e gera DOC.md. Informe a senha quando o PDF estiver protegido. A leitura utiliza o motor Python.
2. **Fotos:** coloque os arquivos em FOTOS (FOTO também é aceito para compatibilidade). O painel mostra prévias; arraste uma foto para outra posição ou use as setas. **Sugerir ordem das fotos** utiliza o motor opcional, mas a organização manual funciona sem ele. **Renomear pela ordem do painel** aplica 1, 2, 3… preservando a extensão. Recortes com sufixo `_sem_fundo` acompanham a foto original e não aparecem como fotos adicionais no painel. Trocar posições não sobrescreve originais; em caso de falha, os nomes são restaurados.
3. **Vídeo:** coloque um único vídeo bruto em PROJETO, VIDEO ou na pasta do veículo. **Editor Mágico** utiliza a ficha para gerar tarjas, legendas e trilha e salva VIDEO_<MARCA>.mp4 (o trecho depois do primeiro `_` do nome da pasta do estoque, por exemplo `VIDEO_JEEP.mp4`). A edição exige o motor e as ferramentas descritas no guia 05. Vídeos finais com prefixo VIDEO_ não são usados como entrada.
   **Trilha sonora:** o app **não traz trilha**. O vídeo usa, nesta ordem, `TRILHA.wav`, `TRILHA.flac` ou `TRILHA.mp3` de `PROJETO/ASSETS` do veículo (uma trilha só para ele), depois a pasta `trilha` dos dados do app (`%APPDATA%/soul-cars-app/trilha/`, a trilha padrão do computador) e, no desenvolvimento, `engine/video/assets/` (ignorada pelo Git). Sem nenhuma, o vídeo sai só com a voz. Use apenas músicas que você tenha direito de usar em anúncios e redes.
   **Gerar versão leve para anúncio** recodifica esse `VIDEO_*.mp4` em H.264 a cerca de 10 Mbps (áudio AAC 160 kbps, mesma composição, 1080x1920 a 59,94 fps) e salva em `ANUNCIO/ANUNCIO_<MARCA>.mp4`; no vídeo de teste de 62 s, 366 MB viraram 72 MB em cerca de 35 s com o codificador Intel (com queda para x264, mais lento). O `VIDEO_*.mp4` e o bruto não mudam. A subpasta `ANUNCIO` existe para a versão leve não ser tomada como vídeo bruto nem contar como segundo `VIDEO_*.mp4` na publicação do Instagram. O painel mostra o tamanho dos dois arquivos. Acima de cerca de 75 s a versão leve passa de 100 MB. Só um vídeo (render ou versão leve) é gerado por vez.
4. **Publicação:** os blocos mantêm o formato anterior. Ao copiar, o botão anima e mostra **✓ Copiado**. A indicação permanece durante a sessão do veículo; se o texto mudar, o botão volta a mostrar Copiar.

## Pronto para anunciar (Studio › veículo › aba "Pronto para anunciar")

Publicação semiautomática: o app deixa tudo pronto e orienta, e **você** cria e ativa o anúncio no Gerenciador de Anúncios. Nenhuma ação do app publica ou ativa anúncio.

1. **Checklist:** documento lido (DOC.pdf e DOC.md), fotos presentes e numeradas 1, 2, 3… sem buraco, vídeo gerado, versão leve (ANUNCIO/), DES.md na pasta e o criativo de foto `<nome>-<ano>-trafego-pago.png` em CRIATIVO. Cada pendência tem o botão **Resolver**, que leva à aba certa.
2. **Campanha:** nome da campanha com prefixo `[VENDA]` (o DES.md ainda gera `[LEAD]`; o cartão troca ao mostrar e copiar), os 5 textos principais, 5 títulos e 5 descrições (as cinco lacunas do Gerenciador), as mensagens do WhatsApp, os arquivos exatos (foto e vídeo leve, com **Abrir pasta** e **Copiar**) e o passo a passo. O nome da campanha modelo vem de Configurações.
3. **Registro:** **Registrar anúncio criado** guarda data e nome da campanha (tabela `anuncios`). Não altera o status do veículo.

**Lembrete de pausa:** o app lê `dados/bndv_vendas.csv`. Se um anúncio registrado e não pausado pertence a um veículo com venda no dia da criação do anúncio ou depois, aparece nas duas interfaces o aviso "Pause a campanha de <modelo>" até você marcar **Marcar como pausada**. O CSV só muda quando você clica em **Atualizar BNDV**; se houver anúncio no ar e o CSV tiver mais de 24 horas, o app avisa que os dados estão velhos. A venda é detectada só por esse arquivo; saídas do estoque sem linha de venda não são detectadas.

## Entrada por pasta sincronizada (Estoque › Entrada)

A equipe sobe fotos, vídeo e documento do carro numa pasta do Google Drive para Desktop (ou OneDrive), em uma subpasta com a placa no nome, por exemplo `TORO - ABC1D23`. Em **Estoque › Entrada**, escolha essa pasta uma vez; o app confere a cada 30 segundos (e em **Verificar agora**) e **copia** para a pasta do veículo do ESTOQUE que tem a mesma placa no nome.

- Fotos (jpg, jpeg, png, webp) vão para FOTOS; HEIC é copiado com aviso, porque o app não o exibe. Vídeo (mp4, mov, mkv, avi) vai para VIDEO; PDF vira DOC.pdf.
- Nunca move nem apaga a origem, nunca sobrescreve: nome igual com conteúdo diferente ganha sufixo (`_2`). Só copia arquivo que parou de mudar de tamanho.
- Vira **pendência**, sem copiar: placa sem veículo ou em mais de um veículo, tipo de arquivo desconhecido, vídeo bruto que já existe (o Editor Mágico exige um só), PDF que já existe ou mais de um PDF na entrada.
- **Liberar espaço** envia para a Lixeira apenas os arquivos marcados cuja cópia foi conferida por tamanho e hash.

No Estoque, **Abrir relatório completo** exibe o relatório dentro do app, com botão para voltar. O HTML continua sendo gerado para compatibilidade, mas não abre o navegador externo.

Para alterar a produção, leia `apps/desktop/src/renderer/src/pages/vehicle/production/Production.tsx`, `Ficha.tsx`, `apps/desktop/src/main/studio/files.ts` e a tabela IPC em `apps/desktop/src/main/ipc/commands.ts`. O relatório interno é exibido em `App.tsx`; a animação da cópia fica em `style.css`.
