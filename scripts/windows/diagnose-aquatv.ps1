param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$ServerIp = "192.168.0.114"
)

$ErrorActionPreference = "Continue"

$projectRoot = (Resolve-Path $ProjectPath).Path
Set-Location $projectRoot

function Get-PrimaryLocalIp() {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object InterfaceMetric, InterfaceIndex |
    Select-Object -First 1 -ExpandProperty IPAddress

  if ($ip) {
    return $ip
  }

  return "127.0.0.1"
}

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

function Test-Port([string]$Label, [string]$HostName, [int]$Port) {
  Write-Host ""
  Write-Host $Label
  $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
  if ($result.TcpTestSucceeded) {
    Write-Host "OK TCP: $HostName`:$Port"
  } else {
    Write-Host "FALHOU TCP: $HostName`:$Port"
  }
}

if (-not $ServerIp) {
  $ServerIp = Get-PrimaryLocalIp
}

Write-Host "Diagnostico AquaTV"
Write-Host "=================="
Write-Host "Pasta: $projectRoot"
Write-Host "IP testado: $ServerIp"
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
Test-Url "Player pelo IP fixo" "http://$ServerIp`:7740/player"

Test-Port "Porta API pelo IP" $ServerIp 7741
Test-Port "Porta Dashboard pelo IP" $ServerIp 7740

Write-Host ""
Write-Host "Ambiente da API em apps/api/.env:"
if (Test-Path ".\apps\api\.env") {
  foreach ($key in @("JWT_SECRET", "SESSION_SECRET", "API_ADMIN_TOKEN", "ALLOWED_ORIGINS")) {
    if (Select-String -Path ".\apps\api\.env" -Pattern "^$key=.+") {
      Write-Host "$key configurado"
    } else {
      Write-Host "AVISO: $key nao encontrado em apps/api/.env"
    }
  }
} else {
  Write-Host "AVISO: apps/api/.env nao encontrado. Em producao a API pode cair antes de abrir porta."
}

Write-Host ""
Write-Host "Ambiente do dashboard em apps/dashboard/.env:"
if (Test-Path ".\apps\dashboard\.env") {
  $apiEnv = Select-String -Path ".\apps\dashboard\.env" -Pattern "^NEXT_PUBLIC_API_URL="
  $internalApiEnv = Select-String -Path ".\apps\dashboard\.env" -Pattern "^API_INTERNAL_URL="
  $adminTokenEnv = Select-String -Path ".\apps\dashboard\.env" -Pattern "^API_ADMIN_TOKEN="
  if ($apiEnv) {
    $apiEnv
    if ($apiEnv.Line -match "localhost|127\.0\.0\.1") {
      Write-Host "AVISO: localhost em NEXT_PUBLIC_API_URL quebra acesso da TV/telefone. O player agora corrige isso no browser, mas vale remover ou trocar pelo IP do PC."
    }
  } else {
    Write-Host "NEXT_PUBLIC_API_URL nao definido; browser usa o host atual e porta 7741."
  }
  if ($internalApiEnv) {
    $internalApiEnv
  } else {
    Write-Host "AVISO: API_INTERNAL_URL nao definido em apps/dashboard/.env"
  }
  if ($adminTokenEnv) {
    Write-Host "API_ADMIN_TOKEN configurado no dashboard"
  } else {
    Write-Host "AVISO: API_ADMIN_TOKEN nao encontrado em apps/dashboard/.env"
  }
} else {
  Write-Host "apps/dashboard/.env nao encontrado"
}

Write-Host ""
Write-Host "DASHBOARD_ADMIN_PASSWORD:"
if (Test-Path ".\apps\dashboard\.env.local") {
  if (Select-String -Path ".\apps\dashboard\.env.local" -Pattern "^DASHBOARD_ADMIN_PASSWORD=.+") {
    Write-Host "Configurado em apps/dashboard/.env.local"
  } else {
    Write-Host "AVISO: apps/dashboard/.env.local existe, mas DASHBOARD_ADMIN_PASSWORD nao foi encontrado."
  }
} else {
  Write-Host "AVISO: apps/dashboard/.env.local nao encontrado. Em producao isso pode causar 503 no login."
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
