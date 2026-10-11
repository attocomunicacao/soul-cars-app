@echo off
rem Modo de desenvolvimento (com terminal e recarga automatica). Para o uso do dia a dia, use o atalho.
setlocal
cd /d "%~dp0.."
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"
call npm run dev
