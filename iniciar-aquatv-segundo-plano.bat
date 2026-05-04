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
echo Abra o dashboard em http://192.168.0.114:7740/dashboard
echo Abra o player em http://192.168.0.114:7740/player?rotation=90
timeout /t 3 >nul
