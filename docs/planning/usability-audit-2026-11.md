# Auditoria de usabilidade e legibilidade — novembro de 2026 (versão 1.0.9)

> Teste feito como usuário, no app real (Electron) com o modo demonstração de
> `scripts/capture-screenshots.cjs` (7 veículos fictícios), janela de 1440 × 900.
> Telas: Estoque (lista, vitrine, relatório), Configurações, menu recolhido, Ficha,
> Produção, Criativos, Publicação, CRM e Meta Ads, e o Launcher.

## Achados e o que mudou

| # | Tela | Problema encontrado | Gravidade | Correção na 1.0.9 |
|---|---|---|---|---|
| 1 | Todas | Mesmo dourado chapado no item de menu ativo, nas abas selecionadas e nos botões de ação: não dava para saber o que é "onde estou" e o que é "clique aqui" | Alta | Seleção vira fundo cinza (menu) ou segmento branco (abas); bronze fica só nas ações principais |
| 2 | Todas | Todo controle era um botão com borda do mesmo peso ("sopa de botões") | Alta | Três níveis: `primary`, neutro e `plain` (texto); ações de linha viram texto + ícone |
| 3 | Estoque | A vitrine só abria por um texto "Ver estoque →" dentro do cartão de métrica (affordance escondida) | Alta | Controle segmentado Lista · Vitrine · Relatório completo |
| 4 | Estoque | Linhas de 104 px: status e três selos ✓/✗ empilhados; selos vermelhos em quase todos os carros (alarme constante) | Média | Linha única de 68 px; selos viram ponto verde (tem) / círculo cinza (falta) |
| 5 | Estoque | Só o botão "Abrir ficha →" abria a ficha; dois botões por linha | Média | Linha inteira clicável (e Enter pelo teclado); pasta vira botão-ícone |
| 6 | Estoque | Chave "BNDV" sem dizer o que filtra | Média | Rótulo "Só em estoque" |
| 7 | Menu | Logo de 190 px empurrava o menu; "SEU ESPAÇO DE TRABALHO" quebrava em duas linhas; numeração "01 ·" competia com o nome | Média | Marca compacta (ícone + nome), rótulos limpos, ícones SVG |
| 8 | Menu recolhido | Emojis 🚗💬📣 (mudam a cada versão do Windows, aparência infantil) | Média | Ícones de linha próprios (`app/icons.tsx`) |
| 9 | Configurações | Abria empurrando a página; rótulos crus do banco ("loja", "horario", "endereco"); "Escolher engine" em inglês; "Fechar" perdido entre ações | Alta | Folha modal com seções, rótulos legíveis, Esc/X/clique fora para fechar |
| 10 | Ficha | Ao trocar de aba a página continuava rolada no meio; abas e "Salvar ficha" sumiam ao rolar | Alta | Cabeçalho fixo (voltar, nome, etapas, Salvar) e volta ao topo ao trocar de etapa |
| 11 | Publicação | Estado vazio só com "Gere DES.md na ficha antes de publicar." | Média | Estado vazio explica e tem botão "Ir para a ficha" |
| 12 | CRM / Meta Ads | Área cinza vazia enquanto o site carrega | Baixa | Texto "Abrindo CRM…" por baixo da vista nativa |
| 13 | Relatório | "R$" e o valor quebravam em duas linhas nos cartões | Baixa | Cartões mais largos e valor sem quebra |
| 14 | Legibilidade | Texto secundário `#777` sobre `#f5f3ef` (≈ 4,1:1) e cabeçalhos de tabela `#888` sobre branco (≈ 3,5:1), abaixo do WCAG AA | Média | `--muted #6e6e73` (5,1:1 sobre branco) e `--faint` só em rótulos grandes/curtos |
| 15 | Botões desativados | Cursor de "aguarde" mesmo quando não havia nada carregando | Baixa | Cursor `not-allowed` |
| 16 | Erros | Aviso vermelho sem forma de dispensar | Baixa | Botão "Fechar" no aviso |
| 17 | Tema escuro | `global.css` ignorava os tokens (cores fixas), então o tema escuro nunca funcionaria no app | Média | CSS 100% em tokens |
| 18 | Launcher | Rótulos em CAIXA ALTA monoespaçada ("ABRIR PASTA", "01 / BIBLIOTECA") cansam a leitura; só tema escuro | Média | Frases normais, controle segmentado, segue o tema do Windows |

## Pendências observadas (fora do escopo visual)

- A quilometragem aparece como `0` quando o BNDV não informa (deveria ficar vazia).
- "Ler documento e preencher ficha" fica desativado sem explicar que falta o PDF.
- Ano vazio na lista de veículos quando a ficha ainda não leu o CRLV.

## Como repetir

```bash
npm run screenshots
```

Gera os prints de `docs/assets/screenshots/` com dados fictícios. Para uma revisão
completa, percorra também Produção, Criativos, Publicação e Configurações.
