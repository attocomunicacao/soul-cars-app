@echo off
setlocal
cd /d "%~dp0.."
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"
call npm run dev
