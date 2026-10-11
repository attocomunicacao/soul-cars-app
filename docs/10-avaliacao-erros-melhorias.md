# Avaliação do projeto: testes, erros, melhorias e pontos fortes

Data: 11/10/2026 · Ambiente: Windows 11 x64, Node 24.x (Electron 44.7.0 / Chromium 152), Python 3.12.10.
Autoria: Atto Comunicação (projeto privado).

## 1. O que foi testado

| # | Teste | Comando | Resultado |
|---|---|---|---|
| 1 | Tipos (main/preload e React) | `npm run tipos` | ✅ Sem erros |
| 2 | Testes unitários e de regra de negócio | `npm test` | ✅ 12 arquivos, **101 passaram**, 2 pulados (dependem de arquivos externos) |
| 3 | Formatação | `npm run formatar:check` | ✅ Tudo no padrão Prettier |
| 4 | Build de produção | `npm run build` | ✅ main, preload e renderer gerados (renderer: 1 chunk de ~796 kB) |
| 5 | Smoke do app (Electron real, dados temporários) | `npm run smoke` | ✅ Preload, SQLite/IPC, relatório interno, painel de fotos, cópia, editor, aba Instagram, pacote, motor Python 3.12.10 e exportação de PNG |
| 6 | Smoke do Instagram (página local simulada) | `npm run smoke:instagram` | ✅ Ordem 2→1→3, duas legendas, capa do Reels, retomada sem duplicatas, histórico após interrupção, lucro de 12 meses com setas, conta conferida, página remota sem Node |
| 7 | Testes do motor Python | `npm run test:engine` | ✅ 36 testes, OK, **5 pulados** (dependem de documentos reais) |
| 8 | Auditoria de dependências | `npm audit` | ⚠️ 8 vulnerabilidades **moderadas**, todas na cadeia de ferramentas do `electron-builder` (não vão no executável) |
| 9 | Inspeção de código (segurança, acoplamentos, dados sensíveis) | leitura de `main/`, `preload/`, `engine/`, `.gitignore` | Achados nas seções 2 e 3 |
| 10 | Conferência do que o Git rastreia | `git ls-files` | ✅ Nenhum banco, CSV, documento, foto ou sessão versionado (147 arquivos) |

### O que **não** foi possível testar (precisa de você)

- Login real no BNDV e atualização com dados reais pela janela do app.
- Publicação real no Instagram (os seletores só foram validados contra uma página simulada).
- Chamadas de IA paga (chave Anthropic) e download dos modelos de recorte/visão/transcrição.
- Geração de vídeo com o Editor Mágico em arquivo real da loja e a qualidade visual da versão leve.
- Instalação do `.exe` em outro computador.
- Entrada de arquivos com a pasta real do Google Drive.
- Uso manual clicando em cada tela: a cobertura de interface vem dos smokes automatizados, não de uma sessão manual.

## 2. Erros encontrados

Gravidade: 🔴 alta · 🟠 média · 🟡 baixa.

| ID | Gravidade | Erro | Evidência | Sugestão |
|---|---|---|---|---|
| E1 | 🟠 | **Acentos corrompidos nas mensagens do motor Python.** O Python no Windows usa `cp1252` no stdout/stdin quando é um pipe, e o Electron lê como UTF-8. | `main.py` devolveu o byte `0xE9` (`é` em cp1252) em `"Método desconhecido"`; `motor.ts` não define `PYTHONUTF8`/`PYTHONIOENCODING`. Os logs do teste de vídeo também aparecem com `�`. Caracteres fora do cp1252 podem até gerar erro ao escrever. | Em `src/main/studio/motor.ts`, acrescentar `PYTHONUTF8: "1"` e `PYTHONIOENCODING: "utf-8"` ao `env` do `spawn`, e `sys.stdout.reconfigure(encoding="utf-8")` em `engine/main.py`. ✅ **Corrigido em 11/10/2026** (`motor.ts`, `engine/main.py` e teste `engine/tests/test_utf8.py`). |
| E2 | 🟠 | **Chave da IA (Anthropic) guardada em texto simples no SQLite** (`config`, chave `anthropic_api_key`). Qualquer pessoa com acesso ao `soul.db` ou aos backups lê a chave. | `Configuracoes.tsx` → `salvarConfig("anthropic_api_key", …)`. | Guardar com `safeStorage` do Electron (cifra por usuário do Windows) ou no Gerenciador de Credenciais; excluir a chave dos backups. |
| E3 | 🟡 | **Versão do app exibida sempre "1.0.0" no instalado.** O preload lê `process.env.npm_package_version`, que só existe quando rodado via `npm`. | `src/preload/index.ts`, bloco `versoes.app`. | Expor a versão pelo main (`app.getVersion()`). |
| E4 | 🟡 | **Aviso `ResourceWarning: unclosed file`** ao gerar a versão leve do vídeo. Os pipes do `ffmpeg` não são fechados explicitamente. | Saída de `npm run test:engine` (`leve.py:84` → `run_ffmpeg`). | Usar `with subprocess.Popen(...)` em `video/render.py`. |
| E5 | 🟡 | **README tinha caminho pessoal** (`C:\Users\gusta\...`), contra a regra do `AGENTS.md`. | README anterior, linha 10. | ✅ Corrigido neste README. |
| E6 | 🟡 | **Documentação cita uma pasta `vendas`** que não existe neste workspace e manda nunca alterá-la. Pode confundir quem chega novo. | `README`, `AGENTS.md`, docs 04 e 06. | ✅ Corrigido: menções removidas/trocadas em `AGENTS.md` e docs 04 e 06. |
| E7 | 🟡 | **Pastas vazias** `src/renderer/src/componentes`, `estoque` e `studio` (restos da migração; o Git não as rastreia). | Listagem de diretórios. | ✅ Removidas na reorganização. |
| E8 | 🟡 | **Licença incoerente:** o repositório é privado, mas `LICENSE` é MIT ("SOUL CARS") e o `package.json` declara `MIT`. A autoria é da Atto Comunicação. | `LICENSE`, `package.json`. | Trocar por aviso proprietário ("Todos os direitos reservados — Atto Comunicação") ou manter MIT conscientemente. |
| E9 | 🟡 | **Fragilidade de caminho:** o app adotava a raiz de dados procurando `../soul-cars-estoque` ao lado do código. Mover a pasta quebrava o app em silêncio. | `src/main/caminhos.ts`, `raizDados()`. | ✅ Tratado na reorganização (agora procura `dados-loja/` primeiro). |

Riscos de segurança observados (sem exploração conhecida):

- `sandbox: false` na janela principal (`src/main/index.ts`). O renderer só carrega código local e não tem Node, mas ativar `sandbox: true` seria mais seguro se o preload permitir.
- Os argumentos do IPC são tipados como `Record<string, any>` (`ipc.ts`); a validação é feita comando a comando. Um esquema (ex.: Zod) por comando reduziria o risco de caminho ou tipo inesperado.
- A sessão de login do BNDV e do Instagram fica em partições persistentes; quem acessa o `%APPDATA%` do Windows da loja acessa as sessões.

## 3. Pontos que podem ser melhores

### Qualidade e automação
1. **CI mais completo.** Hoje o `ci.yml` roda tipos, testes, build e formatação. Falta `npm run test:engine`, `npm run smoke` e `npm audit` (o smoke exige janela; dá para rodar no runner Windows).
2. **Linter.** Não há ESLint; só Prettier e TypeScript. Regras como `no-floating-promises` e `react-hooks/exhaustive-deps` pegariam bugs de efeitos e listeners.
3. **Testes de interface.** Nenhum componente React tem teste; só `lib/`, `compartilhado/` e os smokes. Um `@testing-library/react` nas telas Entrada, Anunciar e Ficha cobriria regressões de fluxo.
4. **Testes pulados.** 2 (Vitest) + 5 (Python) dependem de arquivos reais. Criar fixtures sintéticas (PDF de CRLV fictício) permitiria rodá-los no CI.
5. **Dependabot/Renovate** e a atualização do `electron-builder` quando sair a correção da cadeia vulnerável.

### Desempenho e empacotamento
6. **Bundle único de ~796 kB.** Carregar sob demanda (`React.lazy`) as telas Instagram, Relatórios e o gerador XLSX.
7. **Instalador com motor sem `.venv`:** o usuário precisa instalar uv, Tesseract e FFmpeg. Um assistente "verificar requisitos" nas Configurações (com os `winget` prontos) reduziria o atrito.
8. **Atualização automática** (`electron-updater` com release privada) e versão exibida corretamente (E3).

### Experiência de uso
9. **Primeiro uso guiado.** Um passo a passo dentro do app (raiz de dados → Atualizar BNDV → primeiro veículo) em vez de só em documentos.
10. **Estado de saúde visível.** Uma tela "Diagnóstico" (motor Python, Tesseract, FFmpeg, última atualização do BNDV, espaço em disco, último backup).
11. **Aviso de dados antigos** do BNDV já existe para anúncios; estender para o balanço.
12. **Observabilidade.** Log em arquivo rotativo no `%APPDATA%` e botão "Copiar relatório de erro" para facilitar suporte.

### Manutenção do código
13. **Arquivos grandes:** `studio/entrada.ts` (642 linhas), `estoque/relatorio.ts` (629), `lib/relatorios.ts` (534), `studio/arquivos.ts` (511), `Ficha.tsx` (472). Dividir por responsabilidade.
14. **Tabela IPC única** (`ipc.ts`, ~380 linhas) pode ser dividida por domínio (estoque, studio, instagram, entrada) mantendo o registro central.
15. **Editor de criativos em JS/CSS puros** (`public/criativo`) fica fora do TypeScript e dos testes. Documentar o contrato da ponte (`app-bridge.js`, `flow-bridge.js`) e cobrir com um teste de exportação.
16. **Instagram por automação de tela** é frágil por natureza. Manter o plano B da API oficial (conta profissional) documentado e isolar todos os seletores em um arquivo só (já estão em `instagram-browser.ts`).

### Dados e backup
17. **Backup além do banco:** hoje há 7 cópias diárias do SQLite, mas fotos do editor, `config.json`, ESTOQUE e histórico do Instagram dependem de cópia manual. Um comando "Exportar backup completo" ajudaria.
18. **Backup externo** da raiz de dados (`dados-loja/`): ela não está no Git e é o ativo mais valioso da loja.

## 4. Pontos positivos

- **Arquitetura segura e clara:** renderer sem Node, ponte mínima (`invocar`/`ouvir`), IPC com validação de remetente e tabela fechada de comandos, janelas remotas sem preload, navegação bloqueada, instância única do app.
- **Boa cobertura de regra de negócio:** 101 testes Vitest + 36 do motor, incluindo regressão de formato (`DES.md` contra fixture) e OCR de equipamentos (40/40 itens exatos).
- **Smoke em Electron real** com dados temporários: o que muitos projetos não têm. Cobre IPC, banco, editor e exportação de PNG reais.
- **Dados protegidos:** migrações imutáveis e transacionais, verificação de integridade e backup diário com `VACUUM INTO`, importação do banco legado sem alterar a origem, IDs BNDV e pastas existentes preservados, nunca apaga pastas órfãs.
- **Cópia, não movimentação:** a entrada de arquivos nunca move, apaga ou sobrescreve; confere por hash antes de liberar espaço e envia para a Lixeira.
- **Segurança operacional do anúncio:** nenhuma ação publica ou ativa campanha sozinha; retomada do Instagram sem duplicar; histórico de envios.
- **Funciona sem pagar nada por padrão:** OCR, recorte, visão e transcrição locais; IA é opcional, por conta do usuário, e sem chave no código.
- **Documentação excelente para o porte:** 9 guias técnicos, planejamento com decisões e prompts, `AGENTS.md` com as regras de negócio, tudo em português.
- **Higiene de repositório:** `.gitignore` cobre bancos, CSVs, sessões, `.venv`, `out/`, `dist/`; lockfiles para Node e Python; CI em Windows.
- **Código legível:** nomes, comentários e mensagens em português, módulos com cabeçalhos explicando responsabilidade, formatação padronizada.

## 5. Avaliação geral

| Critério | Nota (0–10) | Comentário |
|---|---|---|
| Funcionalidade | 8,5 | Cobre o fluxo inteiro do estoque ao anúncio; partes dependem de serviços externos sem validação real |
| Qualidade do código | 8 | Organizado e legível; alguns arquivos grandes e sem ESLint |
| Testes | 8 | Muito bons na regra de negócio e smoke; sem testes de componentes e com testes pulados |
| Segurança | 7,5 | Base sólida; chave de IA em texto simples e `sandbox: false` são os pontos principais |
| Documentação | 9 | Completa e atualizada |
| Manutenibilidade | 8 | Estrutura clara; divisão de módulos grandes e CI mais completo ajudariam |
| Prontidão para uso | 7,5 | Precisa de validação real (BNDV, Instagram, instalador) antes de depender dele |

**Veredito:** projeto maduro para uso interno, sem erros bloqueantes encontrados. Prioridade sugerida: **E1** (acentos do motor), **E2** (chave da IA), depois as validações reais listadas na seção 1.

## 6. Reorganização feita em 11/10/2026

Antes, "Soul Cars" tinha três pastas soltas: `soul-cars-app` (o projeto), `soul-cars-estoque` (app Python antigo **com os dados reais da loja**, 200 pastas de veículos e a sessão do Chrome) e `soul-cars-studio` (app Tauri/Svelte antigo). Agora:

```text
Soul Cars/
└── soul-cars-app/        ← repositório (privado) da Atto Comunicação
    ├── src/ engine/ docs/ scripts/ testes/ resources/ …   (versionado)
    ├── dados-loja/        ESTOQUE/ e dados/ reais da loja   (local, ignorado pelo Git)
    └── legado/
        ├── estoque-python/   app antigo (com .git próprio e .chrome-perfil)  (local, ignorado)
        └── studio-tauri/     app antigo (com .git próprio)                    (local, ignorado)
```

- Foram só **renomeações de pasta** no mesmo disco: nada foi copiado nem apagado. As 200 pastas de veículos estão em `dados-loja/ESTOQUE`.
- `%APPDATA%soul-cars-appconfig.json`: `raizDados` agora aponta para `soul-cars-appdados-loja`.
- O banco `soul.db` **não foi alterado**. Os veículos guardam o caminho antigo da pasta, mas o app liga cada pasta ao veículo pelo ID BNDV e regrava o caminho na próxima leitura do Estoque (a lógica está em `lib/importacao.ts`; não foi exercitada com a interface aberta, por isso **confira a lista de veículos no primeiro uso**).
- `src/main/caminhos.ts` passou a procurar `dados-loja` (e `legado/estoque-python`) antes do caminho antigo.
- `.gitignore` ignora `/dados-loja/` e `/legado/`; os dois projetos antigos mantêm seus próprios repositórios Git locais (ficam fora do GitHub).
- O executável antigo `legado/estoque-python/SOUL Cars Estoque.exe` procura `ESTOQUE/` e `dados/` ao lado dele, que agora estão em `dados-loja`. Use-o só como referência.
