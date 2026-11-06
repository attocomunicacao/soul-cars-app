# Launcher and updates

Como o Soul Cars chega ao computador da loja e se mantém atualizado. Modelo inspirado no
ArtCraft Launcher: **um Launcher instala e atualiza os apps; cada app roda sozinho**.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| Soul Cars Launcher | `apps/launcher` | Instalador NSIS leve. Lê o catálogo, baixa, confere, instala, atualiza e abre os apps. Atualiza a si mesmo. |
| Soul Cars Desktop | `apps/desktop` | O app. Publicado como `.zip` (electron-builder, alvo `zip`). |
| Motor Python | `apps/engine` | Vai dentro do pacote do app (`resources/engine`); o ambiente Python é instalado sob demanda pelo próprio app. |
| Manifesto | `manifest.json` na GitHub Release | Catálogo: versões, notas, URLs, SHA-256 e tamanho de cada pacote. |
| Gerador do manifesto | `scripts/release/create-manifest.mjs` | Calcula hashes e monta o manifesto no CI. |

## Fluxo de uma release

```text
git tag v1.1.0 && git push origin v1.1.0
        │
        ▼  .github/workflows/release.yml (windows-latest)
  npm ci → versão aplicada aos dois apps → typecheck → testes
  package:desktop → soul-cars-desktop-1.1.0-win-x64.zip
  package:launcher → soul-cars-launcher-setup-1.1.0.exe
  create-manifest  → manifest.json (SHA-256 + tamanho)
  gh release create v1.1.0 (zip + exe + manifest.json, notas do CHANGELOG.md)
        │
        ▼
  Launcher lê https://github.com/<dono>/<repo>/releases/latest/download/manifest.json
```

## Fluxo no computador da loja

1. O Launcher abre e (se a preferência estiver ligada) verifica o catálogo.
2. Cartão do app mostra: **Instalar**, **Atualizar para vX** ou **Abrir**.
3. Instalar/atualizar:
   - baixa o `.zip` para `%LOCALAPPDATA%\SoulCars\downloads` como `.part`;
   - confere **tamanho e SHA-256**; se não bater, apaga e mostra erro;
   - extrai com o `tar.exe` do Windows em `apps\soul-cars\<versão>.extraindo`;
   - confere se `SoulCars.exe` existe e renomeia para `apps\soul-cars\<versão>`;
   - marca a versão como ativa e apaga as antigas, **mantendo a anterior**.
4. Abrir: inicia `SoulCars.exe` como processo independente (fechar o Launcher não fecha o app).
5. Nova versão do Launcher: faixa no topo → baixa o instalador, confere o SHA-256, roda em
   silêncio (`/S --updated --force-run`) e reabre.

## Dados do usuário

O Launcher **nunca** toca nos dados: banco (`soul.db`), configurações, backups e sessões ficam
em `%APPDATA%\soul-cars-app`, e as pastas de veículos na raiz de dados escolhida no app
(padrão `Documentos\SOUL Cars`). Atualizar ou trocar de versão não perde nada.

## Requisitos para publicar

- As releases precisam ser **públicas** (o Launcher baixa sem token). Se o código for privado,
  publique as releases num repositório público separado e ajuste `REPOSITORIO` em
  `apps/launcher/src/main/config.ts`.
- Não marque a release como *pre-release* (o endereço `latest` ignora pré-lançamentos).
- Mantenha `CHANGELOG.md` com uma seção `## [x.y.z]` por versão (vira as notas no Launcher).

## Testar localmente

```bash
npm run package:desktop
npm run package:launcher
node scripts/release/create-manifest.mjs --version 1.0.0 \
  --app-zip apps/desktop/dist/soul-cars-desktop-1.0.0-win-x64.zip \
  --base-url http://127.0.0.1:8787/ --out .tmp/feed/manifest.json
# sirva .tmp/feed e o zip em http://127.0.0.1:8787/ e abra o Launcher com:
# SOUL_CARS_FEED_URL=http://127.0.0.1:8787/manifest.json
```

Com `SOUL_CARS_FEED_URL` definida, o Launcher aceita downloads de `http://127.0.0.1` (só para teste);
em produção, apenas `https`.
