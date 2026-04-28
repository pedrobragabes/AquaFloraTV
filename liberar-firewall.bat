@echo off
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Abrindo como administrador para liberar firewall...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Liberando portas do AquaTV no firewall...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\configure-firewall.ps1"

if errorlevel 1 (
  echo.
  echo Falha ao configurar firewall.
  pause
  exit /b 1
)

echo.
echo Firewall configurado.
pause
