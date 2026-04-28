@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0logs" (
  echo Pasta de logs ainda nao existe.
  pause
  exit /b 1
)

start "" "%~dp0logs"
