@echo off
rem Abre o SOUL Cars (versao compilada) sem terminal visivel quando chamado por iniciar-oculto.vbs.
setlocal
cd /d "%~dp0.."
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  if not exist ".tmp" mkdir ".tmp"
  echo Node.js nao encontrado. Instale o Node.js 22 ou superior.>".tmp\iniciar.log"
  exit /b 1
)
node scripts\iniciar.mjs
exit /b %errorlevel%
