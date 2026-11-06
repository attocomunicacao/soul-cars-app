# Publicar o Soul Cars na Microsoft Store

Por que a Store: o Smart App Control do Windows 11 bloqueia programas sem assinatura digital
(veja [smart-app-control.md](smart-app-control.md)). Na Store, a **Microsoft assina o pacote**
(MSIX) de graça, e o Windows passa a confiar no app. A conta de desenvolvedor individual não
tem taxa.

O que o projeto já faz sozinho: a cada tag `v*`, o workflow **Release** gera o pacote
`soul-cars-store-<versão>-x64.appx` e guarda como artefato da execução (90 dias).

## 1. Criar a conta (uma vez)

1. Acesse [storedeveloper.microsoft.com](https://storedeveloper.microsoft.com/) e entre com a
   conta Microsoft que vai ser a dona do app.
2. Escolha **Individual** (sem taxa). Conta de **Empresa** também é possível, mas exige
   verificação da empresa.
3. Confirme a identidade quando o Partner Center pedir (documento e selfie, no celular).

## 2. Reservar o nome e pegar a identidade do pacote (uma vez)

1. No [Partner Center](https://partner.microsoft.com/dashboard/apps-and-games/overview):
   **Apps e jogos › Novo produto › Aplicativo MSIX ou PWA**.
2. Reserve o nome **Soul Cars** (se estiver ocupado, use por exemplo *Soul Cars — Revenda*, e
   ajuste `appx.displayName` em `apps/desktop/package.json`).
3. Abra **Gerenciamento de produto › Identidade do produto** e copie três valores:

   | No Partner Center | Variável no GitHub |
   |---|---|
   | `Package/Identity/Name` | `STORE_IDENTITY_NAME` |
   | `Package/Identity/Publisher` (começa com `CN=`) | `STORE_PUBLISHER` |
   | `Package/Properties/PublisherDisplayName` | `STORE_PUBLISHER_DISPLAY_NAME` |

4. No GitHub: **Settings › Secrets and variables › Actions › Variables › New repository
   variable** e cadastre as três (não são segredos; são públicos no pacote).

## 3. Gerar o pacote

Publique uma versão normalmente (seção no `CHANGELOG.md`, commit e tag):

```powershell
git tag v1.0.5
git push origin v1.0.5
```

Quando o workflow **Release** terminar, abra a execução em **Actions** e baixe o artefato
`soul-cars-store-<versão>`. Dentro dele está o `.appx`.

> Sem as três variáveis, o workflow avisa e gera o pacote com identidade provisória, que a
> Store recusa.

## 4. Criar a submissão (a cada versão)

No produto, **Iniciar submissão**:

| Seção | O que preencher |
|---|---|
| **Preços e disponibilidade** | Preço: **Gratuito**. Visibilidade: para uso só da loja, escolha **Oculto nas buscas** (só abre pelo link) ou **Público restrito / Private audience** (só contas Microsoft que você listar). |
| **Propriedades** | Categoria *Negócios*. Marque que o app acessa/coleta dados pessoais (documentos e contatos ficam no computador) e informe a política de privacidade. |
| **Classificação etária** | Responda o questionário (sem conteúdo sensível: classificação livre). |
| **Pacotes** | Envie o `.appx` baixado no passo 3. |
| **Listagens da Store** | Cole os textos de [docs/store/listing-pt-BR.md](../store/listing-pt-BR.md) e envie as capturas de `docs/assets/screenshots/`. |
| **Opções de submissão / notas para certificação** | Explique: *"App desktop (Electron) com runFullTrust. Usa o navegador integrado para BNDV, Instagram e Meta Ads com as contas do próprio usuário. Instala sob demanda um ambiente Python gratuito para OCR e vídeo."* |

Política de privacidade: https://attocomunicacao.github.io/soul-cars-app/privacy.html

A certificação leva de algumas horas a alguns dias. Aprovado, o app aparece na Store e as
próximas versões chegam pelas atualizações automáticas do Windows.

## 5. E o Launcher?

- **Quem instala pela Store** não precisa do Launcher: a Store atualiza sozinha.
- O Launcher e o `.zip` continuam sendo publicados nas Releases do GitHub, para quem prefere
  esse caminho, mas esse pacote não é assinado e pode ser bloqueado pelo Smart App Control.
- Os dados ficam separados: a versão da Store guarda os dados dela no espaço do pacote
  (o Windows isola o `%APPDATA%` de apps MSIX). As pastas de veículos (raiz de dados) são
  normais e podem ser apontadas nas Configurações da versão da Store.

## Problemas conhecidos

- **Gerar o MSIX localmente** pode falhar em versões Insider do Windows (o `makeappx` não
  inicia: "configuração lado a lado incorreta"). Use o pacote gerado pelo CI.
- **Motor Python** (OCR e vídeo): roda programas baixados à parte (Python, modelos). Em PCs
  com Smart App Control, confira na primeira instalação se a leitura de documentos funciona.
