param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$ServerIp = "192.168.0.114"
)

$ErrorActionPreference = "Continue"

$projectRoot = (Resolve-Path $ProjectPath).Path
Set-Location $projectRoot

function Test-Url([string]$Label, [string]$Url) {
  Write-Host ""
  Write-Host $Label
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    Write-Host "OK HTTP $([int]$response.StatusCode): $Url"
    if ($response.Content.Length -lt 500) {
      Write-Host $response.Content
    }
  } catch {
    Write-Host "FALHOU: $Url"
    Write-Host $_.Exception.Message
  }
}

Write-Host "Diagnostico AquaTV"
Write-Host "=================="
Write-Host "Pasta: $projectRoot"
Write-Host "IP esperado: $ServerIp"
Write-Host ""

Write-Host "Processos ouvindo nas portas 7740/7741:"
$listeners = Get-NetTCPConnection -LocalPort 7740, 7741 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object LocalAddress, LocalPort, OwningProcess

if ($listeners) {
  $listeners | Format-Table -AutoSize
} else {
  Write-Host "Nenhum processo ouvindo nas portas 7740/7741."
}

Test-Url "API local" "http://localhost:7741/health"
Test-Url "API pelo IP fixo" "http://$ServerIp`:7741/health"
Test-Url "Dashboard local" "http://localhost:7740/dashboard"
Test-Url "Dashboard pelo IP fixo" "http://$ServerIp`:7740/dashboard"

Write-Host ""
Write-Host "NEXT_PUBLIC_API_URL em apps/dashboard/.env:"
if (Test-Path ".\apps\dashboard\.env") {
  Select-String -Path ".\apps\dashboard\.env" -Pattern "^NEXT_PUBLIC_API_URL="
} else {
  Write-Host "apps/dashboard/.env nao encontrado"
}

Write-Host ""
Write-Host "Ultimas linhas dos logs de erro:"
$errLogs = Get-ChildItem ".\logs" -Filter "*.err.log" -ErrorAction SilentlyContinue
if ($errLogs) {
  foreach ($log in $errLogs) {
    Write-Host "--- $($log.Name)"
    Get-Content $log.FullName -Tail 20
  }
} else {
  Write-Host "Nenhum log de erro encontrado em .\logs."
}
