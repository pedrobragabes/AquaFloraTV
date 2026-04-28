@echo off
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Abrindo como administrador para registrar inicializacao...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Registrando AquaTV para iniciar com o Windows...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\register-startup-task.ps1" -ProjectPath "%~dp0."

if errorlevel 1 (
  echo.
  echo Falha ao registrar inicializacao.
  pause
  exit /b 1
)

echo.
echo Inicializacao registrada.
pause
