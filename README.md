# SOUL Cars

Estoque e Studio em uma janela Windows: **Electron + React + TypeScript + Vite**. O app abre em **01 · Estoque**; **02 · Studio** reúne ficha, produção, criativos, publicação, Instagram e relatórios Meta Ads em abas internas.

## Rodar pelo Git CMD

Requisitos: Git para Windows e Node.js 22.16+.

```bat
cd /d "C:\Users\gusta\Downloads\Soul Cars\soul-cars-app"
scripts\instalar.cmd
npm run dev
```

Em outro computador, ajuste o caminho do `cd`. `npm ci` baixa as versões do lockfile. Também pode iniciar por `scripts\iniciar.cmd`.

Para automações Python, execute `scripts\instalar-motor.cmd`; veja [Motor Python](docs/05-motor-python.md). Nesta máquina, npm/Python foram instalados e FFmpeg/Tesseract já estavam presentes.

```bat
npm run tipos
npm test
npm run test:engine
npm run build
npm run smoke
npm run smoke:instagram
npm run empacotar
```

`npm run start` abre o build. O instalador sai em `dist`. Os smokes usam dados temporários; o Instagram é simulado e nenhuma publicação real é feita. Veja [Instagram](docs/09-instagram.md) para conectar sua conta no navegador do app.

## Documentação

Comece por [docs/README.md](docs/README.md). Os projetos antigos permanecem como referências. **A pasta `vendas` não foi modificada.** Publique somente `soul-cars-app` no GitHub, conforme [o guia](docs/06-github.md), sem dados da loja.
