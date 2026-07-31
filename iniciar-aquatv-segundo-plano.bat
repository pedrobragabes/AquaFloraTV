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
echo Dashboard local: http://localhost:7740/dashboard
echo Para descobrir o endereco da rede, execute diagnostico-aquatv.bat.
timeout /t 3 >nul
