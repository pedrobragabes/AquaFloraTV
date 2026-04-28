@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Abrindo como administrador para remover inicializacao...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Removendo tarefa de inicializacao do AquaTV...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Unregister-ScheduledTask -TaskName 'AquaTV Local Server' -Confirm:$false"

if errorlevel 1 (
  echo.
  echo Falha ao remover. Talvez a tarefa ainda nao exista.
  pause
  exit /b 1
)

echo.
echo Inicializacao removida.
pause
