@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS antes de continuar.
  echo https://nodejs.org/
  pause
  exit /b 1
)

where corepack >nul 2>&1
if errorlevel 1 (
  echo Corepack nao encontrado. Reinstale o Node.js LTS antes de continuar.
  pause
  exit /b 1
)

corepack pnpm@11.11.0 --version >nul 2>&1
if errorlevel 1 (
  echo Nao foi possivel preparar o pnpm 11.11.0 via Corepack.
  pause
  exit /b 1
)

echo Instalando e preparando o AquaTV...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\prepare-aquatv.ps1" -ProjectPath "%~dp0."

if errorlevel 1 (
  echo.
  echo Falha na preparacao do AquaTV.
  pause
  exit /b 1
)

echo.
echo AquaTV instalado e compilado.
pause
