# DESIGN.md — linguagem visual do Soul Cars

> Guia de estilo para pessoas e agentes de IA (formato DESIGN.md). Vale para o app
> (`apps/desktop`) e para o Launcher (`apps/launcher`). A arte dos criativos e o vídeo
> têm identidade própria (`docs/video/`) e **não** seguem este guia.

Inspiração: as Human Interface Guidelines da Apple e o site apple.com — clareza,
deferência ao conteúdo e profundidade discreta. Não copiamos marca, ícones nem fontes
da Apple: usamos a fonte do sistema e o bronze da Soul Cars.

## Princípios

1. **O conteúdo manda.** Veículos, números e fotos em primeiro plano; o chrome some
   (cinza neutro, linhas finas, sem bordas grossas).
2. **Uma cor de destaque.** O bronze só aparece no que é clicável e na seleção.
   Status usam verde (ok) e vermelho (erro), nunca o bronze.
3. **Uma ação principal por área.** Só um botão `primary` por barra ou cartão; o resto
   é `button` neutro (pílula cinza) ou `plain` (texto bronze).
4. **Hierarquia pela tipografia**, não por caixas: título 30/21/17 px, corpo 15 px,
   legendas 13 px, pesos 400/500/600/700.
5. **Sempre dizer o que acontece.** Carregando, vazio e erro têm texto próprio; botão
   desativado tem `title` explicando por quê; erro tem botão de fechar.

## Tokens (`apps/desktop/src/renderer/public/shared/tokens.css`)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--canvas` | `#f5f5f7` | `#000000` | Fundo da janela |
| `--surface` | `#ffffff` | `#1c1c1e` | Cartões, painéis, folhas |
| `--surface-2` | `#fbfbfd` | `#232325` | Barra lateral, hover de linha |
| `--fill` / `--fill-hover` | `#e8e8ed` / `#dcdce1` | `#3a3a3c` / `#48484a` | Botões neutros, controle segmentado, busca |
| `--ink` | `#1d1d1f` | `#f5f5f7` | Texto principal |
| `--muted` | `#6e6e73` | `#a1a1a6` | Texto secundário (≥ 4,5:1 sobre branco) |
| `--faint` | `#86868b` | `#8e8e93` | Rótulos de tabela, placeholders |
| `--line` / `--hairline` | `#d2d2d7` / `#e5e5ea` | `#424245` / `#333336` | Bordas de campo / divisórias |
| `--accent` | `#8a5a2c` | `#dcb27c` | Bronze: ações, seleção, foco |
| `--success`, `--warning`, `--danger` (+ `-soft`) | | | Estados |
| `--radius-sm/--radius/--radius-lg` | 8 / 12 / 18 px | | Botões de menu / campos / cartões |
| `--pill` | 980 px | | Botões |
| `--shadow`, `--shadow-lg`, `--focus` | | | Elevação e anel de foco |

Regra: **nenhuma cor fixa** em `global.css` ou nos componentes; use os tokens (o tema
escuro depende disso). O relatório HTML (`main/inventory/report.ts`) repete os valores
claros porque roda isolado num iframe.

## Componentes

| Componente | Classe | Notas |
|---|---|---|
| Botão neutro | `button` | Pílula cinza, 36 px de altura, 14 px |
| Botão principal | `button.primary` | Bronze com texto branco; um por área |
| Botão discreto | `button.plain` | Só texto bronze (ex.: "Abrir ficha", "Ver diagnóstico") |
| Tamanhos | `.small`, `.icon-only` | Linhas de tabela e ícones |
| Abas | `nav.segmented` + `button.selected` | Controle segmentado (Lista/Vitrine/Relatório; Ficha/Produção/…) |
| Barra de ferramentas | `.barra-pasta` + `.toolbar-title` | Fixa, translúcida com desfoque, 60 px |
| Cabeçalho da ficha | `.vehicle-head` | Fixo abaixo da barra: voltar, nome, etapas, Salvar |
| Cartão | `.panel`, `.metrics > div` | Branco, raio 18, sombra suave, sem borda |
| Busca | `label.search` + `Icon busca` | Campo cinza com lupa |
| Chave | `button.chave[role=switch]` | Interruptor estilo iOS |
| Folha modal | `.sheet-backdrop > .sheet` | Configurações; fecha no X, Esc ou clique fora |
| Selos de produção | `.selo.ok` / `.selo.falta` | Ponto cheio verde / círculo vazio cinza |
| Estado vazio | `.empty` com `h3`, `p` e ação | Diz o que fazer em seguida |
| Ícones | `app/icons.tsx` (`<Icon nome=… />`) | SVG de linha 1,6 px, `currentColor`; nada de emoji |

## Layout

- Barra lateral de 240 px (68 px recolhida) estilo macOS; item ativo com fundo `--fill`
  e ícone bronze.
- Conteúdo com 40 px de margem lateral; grades de 16–20 px; cartões nunca encostam.
- Tabelas: linha inteira clicável, números com `tabular-nums`, ações alinhadas à direita.
- Movimento curto (160–220 ms, `--ease`) e desligado com `prefers-reduced-motion`.

## Launcher

Mesmos tokens em `apps/launcher/src/renderer/src/styles.css`, seguindo o tema do
Windows (claro/escuro). Títulos grandes no estilo apple.com, controle segmentado nas
seções, rótulos em frase (nada de CAIXA ALTA em monoespaçada).

## Referências abertas

- Apple — Human Interface Guidelines (referência de princípios).
- `VoltAgent/awesome-design-md` — coleção de DESIGN.md (inclui um no estilo Apple).
- Skills de agente open-source com as HIG: `axiaoge2/apple-hig-designer` (tokens CSS),
  `raintree-technology/apple-hig-skills`, `dickwu/apple-design-skill` (revisão para Electron).
