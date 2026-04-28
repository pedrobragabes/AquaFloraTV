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

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm nao encontrado. Tentando ativar via Corepack...
  corepack enable
  if errorlevel 1 (
    echo Falha ao ativar Corepack.
    pause
    exit /b 1
  )

  corepack prepare pnpm@10.0.0 --activate
  if errorlevel 1 (
    echo Falha ao instalar pnpm via Corepack.
    pause
    exit /b 1
  )
)

echo Instalando dependencias do AquaTV...
pnpm install

if errorlevel 1 (
  echo.
  echo Falha no pnpm install.
  pause
  exit /b 1
)

echo.
echo Dependencias instaladas.
pause
