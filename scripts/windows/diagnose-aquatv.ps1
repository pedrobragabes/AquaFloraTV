param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$ServerIp = ""
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

function Get-ActiveIpv4Addresses {
  $configurations = @(
    Get-NetIPConfiguration -ErrorAction SilentlyContinue |
      Where-Object {
        $_.NetAdapter.Status -eq "Up" -and
        $null -ne $_.IPv4Address
      }
  )
  $orderedConfigurations = @(
    $configurations | Where-Object { $null -ne $_.IPv4DefaultGateway }
  ) + @(
    $configurations | Where-Object { $null -eq $_.IPv4DefaultGateway }
  )

  return @(
    $orderedConfigurations |
      ForEach-Object { $_.IPv4Address } |
      ForEach-Object { $_.IPAddress } |
      Where-Object {
        -not [string]::IsNullOrWhiteSpace($_) -and
        $_ -notlike "127.*" -and
        $_ -notlike "169.254.*"
      } |
      Select-Object -Unique
  )
}

function Get-DotEnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $prefix = "$Name="
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_.StartsWith($prefix, [System.StringComparison]::Ordinal) } |
    Select-Object -First 1
  if ($null -eq $line) {
    return $null
  }

  return $line.Substring($prefix.Length).Trim().Trim('"').Trim("'")
}

$detectedIps = @(Get-ActiveIpv4Addresses)
$networkProfiles = @(
  Get-NetConnectionProfile -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPv4Connectivity -notin @("Disconnected", "NoTraffic") -or
      $_.IPv6Connectivity -notin @("Disconnected", "NoTraffic")
    }
)

Write-Host "Diagnostico AquaTV"
Write-Host "=================="
Write-Host "Pasta: $projectRoot"
if ($detectedIps.Count -gt 0) {
  Write-Host "IPv4 ativo detectado: $($detectedIps -join ', ')"
} else {
  Write-Warning "Nenhum IPv4 ativo foi detectado."
}
if (-not [string]::IsNullOrWhiteSpace($ServerIp)) {
  Write-Host "IPv4 esperado informado: $ServerIp"
  if ($detectedIps -notcontains $ServerIp) {
    Write-Warning "O IPv4 esperado $ServerIp nao pertence a uma interface ativa. O endereco da loja pode ter mudado."
  }
}
if ($networkProfiles.Count -gt 0) {
  Write-Host "Perfis de rede ativos:"
  $networkProfiles |
    Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity |
    Format-Table -AutoSize
}
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
Test-Url "Dashboard local" "http://localhost:7740/dashboard"

$networkTestIps = @($detectedIps)
if (-not [string]::IsNullOrWhiteSpace($ServerIp) -and $networkTestIps -notcontains $ServerIp) {
  $networkTestIps += $ServerIp
}
foreach ($ipAddress in $networkTestIps) {
  Test-Url "API pela rede ($ipAddress)" "http://$ipAddress`:7741/health"
  Test-Url "Dashboard pela rede ($ipAddress)" "http://$ipAddress`:7740/dashboard"
}

Write-Host ""
Write-Host "Configuracao de URLs:"
$dashboardEnvPath = Join-Path $projectRoot "apps\dashboard\.env"
$internalApiUrl = Get-DotEnvValue -Path $dashboardEnvPath -Name "API_INTERNAL_URL"
if ([string]::IsNullOrWhiteSpace($internalApiUrl)) {
  Write-Warning "API_INTERNAL_URL nao esta configurada em apps/dashboard/.env."
} else {
  Write-Host "API_INTERNAL_URL=$internalApiUrl"
  [System.Uri]$parsedInternalApiUrl = $null
  if (-not [System.Uri]::TryCreate($internalApiUrl, [System.UriKind]::Absolute, [ref]$parsedInternalApiUrl)) {
    Write-Warning "API_INTERNAL_URL nao e uma URL absoluta valida."
  } else {
    if ($parsedInternalApiUrl.Host -notin @("localhost", "127.0.0.1", "::1")) {
      Write-Warning "API_INTERNAL_URL deveria usar localhost, pois dashboard e API rodam no mesmo PC."
    }
    if ($parsedInternalApiUrl.Port -ne 7741) {
      Write-Warning "API_INTERNAL_URL usa a porta $($parsedInternalApiUrl.Port), mas a API do AquaTV usa 7741."
    }
  }
}

$playerEnvPath = Join-Path $projectRoot "apps\player\.env"
$playerApiUrl = Get-DotEnvValue -Path $playerEnvPath -Name "API_URL"
if ([string]::IsNullOrWhiteSpace($playerApiUrl)) {
  Write-Warning "API_URL nao esta configurada em apps/player/.env."
} else {
  Write-Host "API_URL (player)=$playerApiUrl"
  [System.Uri]$parsedPlayerApiUrl = $null
  if (-not [System.Uri]::TryCreate($playerApiUrl, [System.UriKind]::Absolute, [ref]$parsedPlayerApiUrl)) {
    Write-Warning "API_URL do player nao e uma URL absoluta valida."
  } else {
    if ($parsedPlayerApiUrl.Host -in @("localhost", "127.0.0.1", "::1")) {
      Write-Warning "API_URL do player usa localhost; na TV isso aponta para a propria TV, nao para o PC da loja."
    } elseif ($detectedIps.Count -gt 0 -and $detectedIps -notcontains $parsedPlayerApiUrl.Host) {
      Write-Warning "API_URL do player aponta para $($parsedPlayerApiUrl.Host), diferente dos IPv4 ativos: $($detectedIps -join ', ')."
    }
    if ($parsedPlayerApiUrl.Port -ne 7741) {
      Write-Warning "API_URL do player usa a porta $($parsedPlayerApiUrl.Port), mas a API do AquaTV usa 7741."
    }
  }
}

Write-Host ""
Write-Host "Ultimas linhas dos logs de erro:"
$errLogs = Get-ChildItem ".\logs" -Filter "*.err*.log" -ErrorAction SilentlyContinue
if ($errLogs) {
  foreach ($log in $errLogs) {
    Write-Host "--- $($log.Name)"
    Get-Content $log.FullName -Tail 20
  }
} else {
  Write-Host "Nenhum log de erro encontrado em .\logs."
}
