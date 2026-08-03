@echo off
setlocal EnableExtensions
title AquaTV - Instalacao
cd /d "%~dp0"

set "LOG_DIR=%~dp0logs"
set "LOG_FILE=%LOG_DIR%\instalacao.log"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

echo.
echo ================================================
echo AquaTV - instalacao e preparacao
echo Pasta: %CD%
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :node_error
echo Node.js encontrado:
node --version

where corepack >nul 2>&1
if errorlevel 1 goto :corepack_error
echo Corepack encontrado:
call corepack --version

echo.
echo Verificando pnpm 11.11.0 via Corepack...
call corepack enable >nul 2>&1
call corepack pnpm@11.11.0 --version
if errorlevel 1 goto :pnpm_error

echo.
echo Preparando o AquaTV. Isso pode levar alguns minutos...
echo O resultado completo sera salvo em:
echo %LOG_FILE%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\prepare-aquatv.ps1" -ProjectPath "%~dp0." > "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" goto :success

echo ================================================
echo FALHA na preparacao do AquaTV - codigo %EXIT_CODE%
echo ================================================
echo.
type "%LOG_FILE%"
echo.
echo O log foi preservado em:
echo %LOG_FILE%
pause
exit /b %EXIT_CODE%

:node_error
echo ERRO: Node.js nao encontrado no PATH.
echo Instale Node.js 22.13 ou superior em https://nodejs.org/
pause
exit /b 1

:corepack_error
echo ERRO: Corepack nao encontrado.
echo Reinstale o Node.js 22.13 ou superior e abra um novo terminal.
pause
exit /b 1

:pnpm_error
echo ERRO: nao foi possivel preparar o pnpm 11.11.0 via Corepack.
echo Confira a internet e tente novamente.
pause
exit /b 1

:success
echo ================================================
echo AquaTV instalado e compilado com sucesso.
echo ================================================
echo.
echo Proximo passo: iniciar-aquatv-segundo-plano.bat
pause
exit /b 0
