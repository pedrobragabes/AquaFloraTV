@echo off
setlocal

echo Parando processos nas portas 7740 e 7741...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ports = 7740,7741; $processIds = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' -and $_.OwningProcess -ne 0 } | Select-Object -ExpandProperty OwningProcess -Unique; if ($processIds) { $processIds | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('Processo parado: ' + $_) } } else { Write-Host 'Nenhum processo ouvindo nas portas do AquaTV.' }"

if errorlevel 1 (
  echo.
  echo Falha ao parar processos.
  pause
  exit /b 1
)

echo.
echo AquaTV parado nas portas 7740/7741.
pause
