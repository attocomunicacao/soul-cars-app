# SOUL Cars App

> Projeto privado da **Atto Comunicação** para a loja **SOUL Cars**. Uso interno; não é distribuído ao público.

Aplicativo de desktop para Windows que leva um carro do **estoque** até o **anúncio publicado**: lê o estoque do BNDV, organiza uma pasta por veículo, ajuda a produzir ficha, fotos, vídeo e criativos, deixa o anúncio pronto para o Meta Ads e prepara a postagem no Instagram. Tudo roda no computador da loja, com dados locais.

**Stack:** Electron 44 · React 19 · TypeScript · Vite (electron-vite) · Tailwind 4 · SQLite (`node:sqlite`) · motor Python 3.12 (OCR, recorte, visão e vídeo). **Nenhuma aplicação paga:** sem API, sem chave, sem cobrança por uso.

---

## Sumário

- [O que o app faz](#o-que-o-app-faz)
- [As duas interfaces](#as-duas-interfaces)
- [Como o app é montado](#como-o-app-é-montado)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Instalação e execução](#instalação-e-execução)
- [Comandos](#comandos)
- [Onde ficam os dados](#onde-ficam-os-dados)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Documentação](#documentação)
- [Estado atual](#estado-atual)
- [Licença e autoria](#licença-e-autoria)

---

## O que o app faz

| Etapa | O que acontece | Onde |
|---|---|---|
| 1. Estoque | Abre o BNDV numa janela própria, lê veículos e vendas pela API GraphQL, grava CSVs e cria/atualiza uma pasta por veículo (`INFO.md`, `CRIATIVO`, `FOTOS`, `VIDEO`). | Aba **Estoque** |
| 2. Balanço | Calcula patrimônio, lucro, giro e margem; mostra gráficos (inclusive lucro dos últimos 12 meses) e gera um relatório HTML. | Estoque › Relatório completo |
| 3. Entrada de arquivos | Vigia uma pasta sincronizada (Google Drive/OneDrive). Fotos, vídeo e documento enviados pela equipe, com a placa no nome da pasta, são **copiados** (nunca movidos) para a pasta do veículo. | Estoque › Entrada |
| 4. Ficha e documento | Lê o CRLV (PDF, com ou sem senha, ou escaneado via OCR), preenche a ficha, busca a ficha técnica na web (Carros na Web, com o Ficha Completa como reserva) e gera `DOC.md` e `DES.md` (descrição do anúncio). | Ficha › veículo |
| 5. Produção | Painel de fotos (reordenar, renomear, recorte de fundo), Editor Mágico de vídeo (tarjas, legendas, trilha) e versão leve do vídeo para anúncio. | Studio › Produção |
| 6. Criativos | Editor de artes (layouts 4 e 6, sombra, piso) com exportação de PNG para `CRIATIVO`. | Ficha › Criativos |
| 7. Pronto para anunciar | Checklist de prontidão e cartão de campanha com textos, títulos, descrições e arquivos, com botões de copiar. Registro do anúncio e lembrete de pausa quando o carro é vendido. | Studio › Pronto para anunciar |
| 8. Publicação | Blocos de texto para o Gerenciador de Anúncios, prontos para copiar. | Ficha › Publicação |
| 9. Instagram | Publica carrossel e depois Reels pelo navegador integrado, com retomada e prevenção de duplicatas. | Ficha › Instagram |

**Regra de ouro:** nenhuma automação ativa campanha sozinha. O app deixa tudo pronto; a pessoa cria e ativa o anúncio. O app não usa nenhum serviço pago: sem API, sem chave, sem cobrança por uso. Os textos de IA do anúncio saem pelo prompt pronto, colado no chat que a pessoa já usa.

## As duas interfaces

O app abre em **01 · Estoque** (lista de veículos, entrada de arquivos e relatório completo). Ao clicar em **Abrir ficha →** num veículo da lista abre-se a ficha dele, com as abas, na ordem: **Ficha → Produção → Criativos → Pronto para anunciar → Publicação → Instagram**, além de Configurações.

## Como o app é montado

```text
React (renderer) ──► preload (window.soul.invocar / ouvir) ──► IPC do Electron (main)
                                                                 ├─ estoque/  BNDV, CSV, pastas, balanço, relatório
                                                                 ├─ studio/   SQLite, arquivos, entrada, Instagram, motor
                                                                 └─ Python    CRLV, OCR, CNW, visão, recorte, vídeo
```

- O **renderer não tem Node**: tudo passa pela ponte do preload, que só expõe `invocar` e `ouvir`.
- O **main** valida o remetente do IPC e executa comandos de uma tabela fechada (`src/main/ipc.ts`).
- O **motor Python** conversa por JSON de uma linha por mensagem (`engine/main.py`); bibliotecas pesadas só carregam quando usadas.
- As janelas remotas (BNDV, Instagram) **não recebem preload** nem acesso a Node.

Detalhes em [docs/02-arquitetura-e-migracao.md](docs/02-arquitetura-e-migracao.md) e no [Manual do Desenvolvedor](docs/12-manual-do-desenvolvedor.md).

## Estrutura de pastas

```text
soul-cars-app/
├── src/
│   ├── main/            processo principal: janela, IPC, banco, disco, BNDV, Instagram, motor
│   │   ├── estoque/     extração BNDV, sincronização de pastas, balanço, relatório, vendas
│   │   └── studio/      banco/esquema SQLite, arquivos, entrada, Instagram, motor Python
│   ├── preload/         ponte segura window.soul
│   ├── compartilhado/   regras puras usadas por main e renderer (anúncio, entrada, publicação)
│   └── renderer/        interface React (src/) e recursos estáticos, incluindo o editor de criativos (public/criativo)
├── engine/              motor Python (CRLV, OCR, CNW, fotos, visão, vídeo) + testes
├── resources/           ícone e logo empacotados
├── scripts/             instalação (.cmd) e testes de fumaça (smoke)
├── testes/              testes Vitest e fixtures
├── docs/                guias, avaliação, manuais e planejamento
├── dados-loja/          (local, fora do Git) ESTOQUE/ e dados/ da loja
└── legado/              (local, fora do Git) projetos anteriores usados como referência
```

## Instalação e execução

Requisitos: Windows 10/11 x64, Git para Windows e Node.js 22.16+. Para as automações: [uv](https://docs.astral.sh/uv/), Tesseract (com português) e FFmpeg.

```bat
cd /d "CAMINHO\ate\soul-cars-app"
scripts\instalar.cmd
npm run dev
```

Para o dia a dia, use o atalho `SOUL Cars` (na pasta acima de `soul-cars-app`): ele abre o app **sem terminal**, com uma tela de carregamento, e só recompila se o código mudou (`scripts/iniciar-oculto.vbs` → `iniciar.cmd` → `iniciar.mjs`; erros ficam em `.tmp/iniciar.log`). `scripts/iniciar-dev.cmd` abre o modo de desenvolvimento, com terminal. Para o motor Python, execute `scripts\instalar-motor.cmd` (veja [docs/05-motor-python.md](docs/05-motor-python.md)). Passo a passo de uso em [docs/01-primeiro-uso.md](docs/01-primeiro-uso.md).

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | Abre o app em desenvolvimento |
| `npm run build` / `npm start` | Gera e abre o build (verifica `file://`) |
| `npm run lint` | ESLint, sem nenhum aviso aceito (promessas esquecidas, hooks do React, erros comuns) |
| `npm run tipos` | TypeScript (main/preload e React) |
| `npm test` | Vitest |
| `npm run test:engine` | Testes Python do motor |
| `npm run smoke` / `npm run smoke:instagram` | Testes de fumaça em Electron real, com dados temporários; o Instagram é simulado |
| `npm run formatar` / `npm run formatar:check` | Prettier |
| `npm run empacotar` | Instalador NSIS Windows x64 em `dist/` |

## Onde ficam os dados

| O quê | Onde |
|---|---|
| Banco, preferências, fotos do editor, backups, histórico do Instagram | `%APPDATA%\soul-cars-app\` |
| Pastas dos veículos e CSVs do BNDV | Raiz de dados escolhida em Configurações (por padrão `dados-loja/` ao lado do app) |
| Sessões do BNDV e do Instagram | Partições persistentes do Electron, dentro de `%APPDATA%\soul-cars-app\` |

Veja [docs/04-dados-e-backup.md](docs/04-dados-e-backup.md).

## Segurança e privacidade

- Repositório **privado**. Nunca versionar bancos, CSVs, documentos, fotos, sessões, `.env` ou chaves (o `.gitignore` já cobre os locais padrão).
- Sem caminhos pessoais, senhas ou tokens no código.
- Migrações de banco distribuídas são imutáveis; novas mudanças viram uma nova versão.
- Pastas existentes e IDs BNDV são preservados; pastas órfãs nunca são apagadas.

## Documentação

Índice completo em [docs/README.md](docs/README.md). Destaques:

- [Manual do Usuário](docs/11-manual-do-usuario.md): fluxo completo, do estoque ao anúncio.
- [Manual do Desenvolvedor](docs/12-manual-do-desenvolvedor.md): fluxo técnico, roadmap de manutenção e receitas.
- [Avaliação: erros, melhorias e pontos fortes](docs/10-avaliacao-erros-melhorias.md): resultado dos testes de 11/10/2026.
- [Roadmap do produto](docs/planejamento/02-roadmap.md).
- [Avisos de terceiros](THIRD_PARTY_NOTICES.md): licenças das dependências do motor, modelos e arquivos embutidos.

## Estado atual

Versão **1.0.0**. Em 11/10/2026: tipos sem erros, 101 testes Vitest e 36 testes Python passando, build gerado e os dois smokes em Electron real aprovados. Pendências e riscos estão na avaliação.

## Licença e autoria

Desenvolvido e assinado pela **Atto Comunicação**, para uso privado da SOUL Cars. **Todos os direitos reservados** (veja [LICENSE](LICENSE)); bibliotecas, fontes e modelos de terceiros seguem as suas próprias licenças, e os avisos delas permanecem. Confirme os direitos de marca, logo e trilha antes de qualquer distribuição pública.
