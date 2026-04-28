@echo off
setlocal
cd /d "%~dp0"

echo Iniciando AquaTV em segundo plano...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-aquatv-background.ps1" -ProjectPath "%~dp0."

if errorlevel 1 (
  echo.
  echo Falha ao iniciar em segundo plano.
  pause
  exit /b 1
)

echo.
echo AquaTV iniciado em segundo plano.
echo Abra o dashboard em http://localhost:7740/dashboard
timeout /t 3 >nul
