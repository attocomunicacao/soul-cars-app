# GitHub

Publique **soul-cars-app** como repositório **privado** da Atto Comunicação. Tudo o que é da loja (`dados-loja/`) e os projetos anteriores (`legado/`) ficam dentro da pasta, mas são ignorados pelo `.gitignore` e nunca vão para o GitHub.

```bat
cd /d "CAMINHO\soul-cars-app"
git init
git add .
git status --short
git diff --cached --stat
git commit -m "Migra Estoque e Studio para Electron React"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Revise o status antes de commitar: não inclua dados reais, credenciais, .venv, node_modules, out ou dist. Esta migração não publica repositório remoto.

Versione código, recursos, fontes/licenças, engine, lockfiles, testes e documentação. Binários vão em Releases. `.github/workflows/ci.yml` verifica tipos/testes/build a cada push/PR. Evidências geradas docs/smoke.* são ignoradas.

O projeto é proprietário (todos os direitos reservados, Atto Comunicação); os avisos das licenças de terceiros (fontes, bibliotecas, Tesseract) permanecem. Antes de distribuir publicamente, confirme direitos da marca/logo/trilha. Para nova versão, altere package.json, confira testes e gere o instalador NSIS Windows x64, por usuário.
