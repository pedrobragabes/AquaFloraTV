@echo off
setlocal

cd /d "%~dp0"

echo Parando AquaTV...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\stop-aquatv.ps1" -ProjectPath "%~dp0."

if errorlevel 1 (
  echo.
  echo Falha ao parar processos.
  pause
  exit /b 1
)

echo.
echo AquaTV parado.
pause
