@echo off
setlocal
cd /d "%~dp0"

echo Criando backup do AquaTV...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\backup-aquatv.ps1" -ProjectPath "%~dp0"

if errorlevel 1 (
  echo.
  echo Falha ao criar backup.
  pause
  exit /b 1
)

echo.
echo Backup concluido.
pause
