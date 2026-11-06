@echo off
rem Instala o motor Python (apps\engine) com todos os grupos de dependencias, usando o uv.
rem O app tambem instala sozinho pelo botao "Instalar / reparar motor Python".
setlocal
cd /d "%~dp0..\apps\engine"
where uv >nul 2>nul
if errorlevel 1 (
  echo Instale uv: winget install --id astral-sh.uv -e
  exit /b 1
)
uv sync --all-groups
if errorlevel 1 exit /b 1
echo Motor instalado. Video usa FFmpeg e OCR de imagens usa Tesseract com idioma portugues.
