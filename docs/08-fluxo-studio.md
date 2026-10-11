# Produção no Studio

Ao abrir um veículo, a primeira aba é **Produção**. Vincule a pasta do veículo caso ela ainda não esteja associada. A tela consulta documento, fotos e vídeo ao entrar e a cada 5 segundos. Os botões **Verificar documento**, **Verificar fotos** e **Verificar vídeo** permitem atualizar imediatamente.

1. **Documento:** qualquer PDF na pasta é detectado; DOC.pdf tem prioridade quando existe. **Anexar documento** abre a seleção de PDF e copia para DOC.pdf. **Ler documento e preencher ficha** executa a leitura do CRLV, preenche os campos e gera DOC.md. Informe a senha quando o PDF estiver protegido. A leitura utiliza o motor Python.
2. **Fotos:** coloque os arquivos em FOTOS (FOTO também é aceito para compatibilidade). O painel mostra prévias; arraste uma foto para outra posição ou use as setas. **Sugerir ordem das fotos** utiliza o motor opcional, mas a organização manual funciona sem ele. **Renomear pela ordem do painel** aplica 1, 2, 3… preservando a extensão. Recortes com sufixo `_sem_fundo` acompanham a foto original e não aparecem como fotos adicionais no painel. Trocar posições não sobrescreve originais; em caso de falha, os nomes são restaurados.
3. **Vídeo:** coloque um único vídeo bruto em PROJETO, VIDEO ou na pasta do veículo. **Editor Mágico** utiliza a ficha para gerar tarjas, legendas e trilha e salva VIDEO_<MODELO>.mp4. A edição exige o motor e as ferramentas descritas no guia 05. Vídeos finais com prefixo VIDEO_ não são usados como entrada.
4. **Publicação:** os blocos mantêm o formato anterior. Ao copiar, o botão anima e mostra **✓ Copiado**. A indicação permanece durante a sessão do veículo; se o texto mudar, o botão volta a mostrar Copiar.

## Entrada por pasta sincronizada (Estoque › Entrada)

A equipe sobe fotos, vídeo e documento do carro numa pasta do Google Drive para Desktop (ou OneDrive), em uma subpasta com a placa no nome, por exemplo `TORO - ABC1D23`. Em **Estoque › Entrada**, escolha essa pasta uma vez; o app confere a cada 30 segundos (e em **Verificar agora**) e **copia** para a pasta do veículo do ESTOQUE que tem a mesma placa no nome.

- Fotos (jpg, jpeg, png, webp) vão para FOTOS; HEIC é copiado com aviso, porque o app não o exibe. Vídeo (mp4, mov, mkv, avi) vai para VIDEO; PDF vira DOC.pdf.
- Nunca move nem apaga a origem, nunca sobrescreve: nome igual com conteúdo diferente ganha sufixo (`_2`). Só copia arquivo que parou de mudar de tamanho.
- Vira **pendência**, sem copiar: placa sem veículo ou em mais de um veículo, tipo de arquivo desconhecido, vídeo bruto que já existe (o Editor Mágico exige um só), PDF que já existe ou mais de um PDF na entrada.
- **Liberar espaço** envia para a Lixeira apenas os arquivos marcados cuja cópia foi conferida por tamanho e hash.

No Estoque, **Abrir relatório completo** exibe o relatório dentro do app, com botão para voltar. O HTML continua sendo gerado para compatibilidade, mas não abre o navegador externo.

Para alterar a produção, leia `src/renderer/src/Producao.tsx`, `Ficha.tsx`, `src/main/studio/arquivos.ts` e a tabela IPC em `src/main/ipc.ts`. O relatório interno é exibido em `App.tsx`; a animação da cópia fica em `style.css`.
