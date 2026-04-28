@echo off
setlocal
cd /d "%~dp0"

echo Iniciando AquaTV local...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-aquatv.ps1" -ProjectPath "%~dp0."

if errorlevel 1 (
  echo.
  echo Falha ao iniciar. Confira a mensagem acima.
  pause
  exit /b 1
)
