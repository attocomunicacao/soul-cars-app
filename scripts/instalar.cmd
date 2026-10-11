@echo off
setlocal
cd /d "%~dp0.."
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 22 LTS ou superior e abra novamente o Git CMD.
  exit /b 1
)
call npm ci --no-fund
if errorlevel 1 exit /b 1
call npm run tipos
if errorlevel 1 exit /b 1
echo Dependencias do Electron instaladas. Execute npm run dev.
