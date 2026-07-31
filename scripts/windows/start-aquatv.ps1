param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$apiRoot = Join-Path $projectRoot "apps\api"
$dashboardRoot = Join-Path $projectRoot "apps\dashboard"
$logPath = Join-Path $projectRoot "logs"
$storagePath = Join-Path $projectRoot "storage"
$apiEntryPoint = Join-Path $apiRoot "dist\index.js"
$dashboardBuildId = Join-Path $dashboardRoot ".next\BUILD_ID"
$nextEntryPoint = Join-Path $projectRoot "node_modules\next\dist\bin\next"
$processStatePath = Join-Path $logPath "aquatv-processes.json"

New-Item -ItemType Directory -Force -Path $logPath, $storagePath | Out-Null

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

function Get-EffectiveEnvValue([string]$Path, [string]$Name) {
  $processValue = [System.Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($processValue)) {
    return $processValue
  }

  return Get-DotEnvValue -Path $Path -Name $Name
}

function Test-WeakSecret([string]$Value, [int]$MinimumLength) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -lt $MinimumLength) {
    return $true
  }

  $normalized = $Value.ToLowerInvariant()
  foreach ($placeholder in @("change-me", "replace-me", "troque-esta", "min-32-chars", "dev-admin-token")) {
    if ($normalized.Contains($placeholder)) {
      return $true
    }
  }

  return $false
}

function Assert-ProductionConfiguration {
  $dashboardEnvPath = Join-Path $dashboardRoot ".env"
  $apiEnvPath = Join-Path $apiRoot ".env"
  $authEnabled = Get-EffectiveEnvValue -Path $dashboardEnvPath -Name "DASHBOARD_AUTH_ENABLED"
  $adminPassword = Get-EffectiveEnvValue -Path $dashboardEnvPath -Name "DASHBOARD_ADMIN_PASSWORD"
  $sessionSecret = Get-EffectiveEnvValue -Path $dashboardEnvPath -Name "DASHBOARD_SESSION_SECRET"
  $apiAdminToken = Get-EffectiveEnvValue -Path $apiEnvPath -Name "API_ADMIN_TOKEN"
  $dashboardAdminToken = Get-EffectiveEnvValue -Path $dashboardEnvPath -Name "API_ADMIN_TOKEN"
  $allowedOrigins = Get-EffectiveEnvValue -Path $apiEnvPath -Name "ALLOWED_ORIGINS"

  if ($authEnabled -ne "true") {
    throw "DASHBOARD_AUTH_ENABLED precisa ser true na operacao da loja."
  }
  if (Test-WeakSecret -Value $adminPassword -MinimumLength 12) {
    throw "Configure DASHBOARD_ADMIN_PASSWORD com uma senha real de pelo menos 12 caracteres em apps/dashboard/.env."
  }
  if (Test-WeakSecret -Value $sessionSecret -MinimumLength 32) {
    throw "Configure DASHBOARD_SESSION_SECRET com um segredo real de pelo menos 32 caracteres em apps/dashboard/.env."
  }
  if (Test-WeakSecret -Value $apiAdminToken -MinimumLength 32) {
    throw "Configure API_ADMIN_TOKEN com um token real de pelo menos 32 caracteres em apps/api/.env."
  }
  if (Test-WeakSecret -Value $dashboardAdminToken -MinimumLength 32) {
    throw "Configure API_ADMIN_TOKEN com o token compartilhado em apps/dashboard/.env."
  }
  if (-not [string]::Equals($apiAdminToken, $dashboardAdminToken, [System.StringComparison]::Ordinal)) {
    throw "API_ADMIN_TOKEN precisa ser identico em apps/api/.env e apps/dashboard/.env."
  }
  if ([string]::IsNullOrWhiteSpace($allowedOrigins) -or $allowedOrigins.Contains("*")) {
    throw "ALLOWED_ORIGINS precisa listar origens explicitas em apps/api/.env."
  }
}

function Test-Url([string]$Url, [int]$TimeoutSeconds = 3) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSeconds
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-UntilReady([string]$Name, [string]$Url, [System.Diagnostics.Process]$Process) {
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    if ($Process.HasExited) {
      throw "$Name encerrou antes de ficar pronto (exit code $($Process.ExitCode))."
    }
    if (Test-Url -Url $Url) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "$Name nao respondeu em $Url dentro de 30 segundos."
}

function Get-AquaTvListeners {
  return Get-NetTCPConnection -LocalPort 7740, 7741 -State Listen -ErrorAction SilentlyContinue |
    Select-Object LocalPort, OwningProcess
}

function Read-ProcessState {
  if (-not (Test-Path -LiteralPath $processStatePath)) {
    return $null
  }

  try {
    return Get-Content -LiteralPath $processStatePath -Raw | ConvertFrom-Json
  } catch {
    Write-Warning "Arquivo de estado invalido; ele sera descartado: $($_.Exception.Message)"
    Remove-Item -LiteralPath $processStatePath -Force
    return $null
  }
}

function Test-ProcessStartTime([int]$ProcessId, [object]$ExpectedStartTime) {
  if ($ProcessId -le 0 -or $null -eq $ExpectedStartTime) {
    return $false
  }

  try {
    $expected = [DateTime]::Parse(
      [string]$ExpectedStartTime,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::RoundtripKind
    ).ToUniversalTime()
    $actual = (Get-Process -Id $ProcessId -ErrorAction Stop).StartTime.ToUniversalTime()
    return [Math]::Abs(($actual - $expected).TotalSeconds) -lt 1
  } catch {
    return $false
  }
}

function Test-AquaTvProcess([int]$ProcessId, [string]$Role, [object]$ExpectedStartTime) {
  if (-not (Test-ProcessStartTime -ProcessId $ProcessId -ExpectedStartTime $ExpectedStartTime)) {
    return $false
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) {
    return $false
  }

  $commandLine = [string]$process.CommandLine
  if ($Role -eq "supervisor") {
    return (
      $process.Name -in @("powershell.exe", "pwsh.exe") -and
      $commandLine.IndexOf($PSCommandPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    )
  }
  if ($process.Name -ne "node.exe") {
    return $false
  }
  if ($Role -eq "api") {
    return $commandLine.IndexOf($apiEntryPoint, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  }
  if ($Role -eq "dashboard") {
    return (
      $commandLine.IndexOf($nextEntryPoint, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $commandLine -match "(?:^|\s)-p\s+7740(?:\s|$)"
    )
  }

  return $false
}

function Stop-OrphanProcess([object]$ProcessId, [object]$StartTime, [string]$Role) {
  if ($null -eq $ProcessId) {
    return
  }

  $numericId = [int]$ProcessId
  if (Test-AquaTvProcess -ProcessId $numericId -Role $Role -ExpectedStartTime $StartTime) {
    Stop-Process -Id $numericId -Force -ErrorAction Stop
    Write-SupervisorLog "Processo orfao encerrado ($Role): $numericId"
  }
}

function Write-SupervisorLog([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -LiteralPath (Join-Path $logPath "supervisor.log") -Value $line
  Write-Host $line
}

function Write-ProcessState {
  $supervisorProcess = Get-Process -Id $PID -ErrorAction Stop
  $state = [ordered]@{
    projectRoot = $projectRoot
    supervisorPid = $PID
    supervisorStartTime = $supervisorProcess.StartTime.ToUniversalTime().ToString("o")
    apiPid = if ($api -and -not $api.HasExited) { $api.Id } else { $null }
    apiStartTime = if ($api -and -not $api.HasExited) { $api.StartTime.ToUniversalTime().ToString("o") } else { $null }
    dashboardPid = if ($dashboard -and -not $dashboard.HasExited) { $dashboard.Id } else { $null }
    dashboardStartTime = if ($dashboard -and -not $dashboard.HasExited) { $dashboard.StartTime.ToUniversalTime().ToString("o") } else { $null }
    updatedAt = (Get-Date).ToString("o")
  }
  $temporaryPath = "$processStatePath.tmp"
  $state | ConvertTo-Json | Set-Content -LiteralPath $temporaryPath
  Move-Item -LiteralPath $temporaryPath -Destination $processStatePath -Force
}

function Clear-ProcessState {
  if (-not (Test-Path -LiteralPath $processStatePath)) {
    return
  }

  try {
    $state = Get-Content -LiteralPath $processStatePath -Raw | ConvertFrom-Json
    if ([int]$state.supervisorPid -eq $PID) {
      Remove-Item -LiteralPath $processStatePath -Force
    }
  } catch {
    Write-SupervisorLog "Nao foi possivel limpar o estado de processos: $($_.Exception.Message)"
  }
}

$api = $null
$dashboard = $null

try {
if (-not (Test-Path -LiteralPath $apiEntryPoint)) {
  throw "Build da API nao encontrado. Execute instalar-dependencias.bat primeiro."
}
if (-not (Test-Path -LiteralPath $dashboardBuildId)) {
  throw "Build do dashboard nao encontrado. Execute instalar-dependencias.bat primeiro."
}
if (-not (Test-Path -LiteralPath $nextEntryPoint)) {
  throw "Next.js nao encontrado. Execute instalar-dependencias.bat primeiro."
}

Assert-ProductionConfiguration

$existingState = Read-ProcessState
if ($existingState) {
  if (-not [string]::Equals($existingState.projectRoot, $projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Warning "O estado salvo pertence a outro caminho e sera descartado: $($existingState.projectRoot)"
    Remove-Item -LiteralPath $processStatePath -Force
  } elseif (Test-AquaTvProcess `
      -ProcessId ([int]$existingState.supervisorPid) `
      -Role "supervisor" `
      -ExpectedStartTime $existingState.supervisorStartTime) {
    Write-Host "O supervisor do AquaTV ja esta em execucao (PID $($existingState.supervisorPid))."
    return
  } else {
    Stop-OrphanProcess `
      -ProcessId $existingState.apiPid `
      -StartTime $existingState.apiStartTime `
      -Role "api"
    Stop-OrphanProcess `
      -ProcessId $existingState.dashboardPid `
      -StartTime $existingState.dashboardStartTime `
      -Role "dashboard"
    Remove-Item -LiteralPath $processStatePath -Force
    Start-Sleep -Milliseconds 300
  }
}

$listeners = @(Get-AquaTvListeners)
if ($listeners.Count -gt 0) {
  $listenerDescriptions = ($listeners | ForEach-Object {
    "porta $($_.LocalPort) (PID $($_.OwningProcess))"
  }) -join ", "
  throw "Ha processos nao gerenciados pelo AquaTV em $listenerDescriptions. Eles nao foram encerrados."
}

$node = Get-Command node.exe -ErrorAction Stop
$env:NODE_ENV = "production"
$env:PORT = "7741"
$env:STORAGE_PATH = $storagePath

function Rotate-ProcessLogs([string]$Name) {
  foreach ($streamName in @("out", "err")) {
    $currentPath = Join-Path $logPath "$Name.$streamName.log"
    $previousPath = Join-Path $logPath "$Name.$streamName.previous.log"
    if (Test-Path -LiteralPath $currentPath) {
      Move-Item -LiteralPath $currentPath -Destination $previousPath -Force
    }
  }
}

function Start-ApiProcess {
  Rotate-ProcessLogs -Name "api"
  return Start-Process `
    -FilePath $node.Source `
    -ArgumentList "`"$apiEntryPoint`"" `
    -WorkingDirectory $apiRoot `
    -RedirectStandardOutput (Join-Path $logPath "api.out.log") `
    -RedirectStandardError (Join-Path $logPath "api.err.log") `
    -PassThru `
    -WindowStyle Hidden
}

function Start-DashboardProcess {
  Rotate-ProcessLogs -Name "dashboard"
  return Start-Process `
    -FilePath $node.Source `
    -ArgumentList "`"$nextEntryPoint`" start -p 7740" `
    -WorkingDirectory $dashboardRoot `
    -RedirectStandardOutput (Join-Path $logPath "dashboard.out.log") `
    -RedirectStandardError (Join-Path $logPath "dashboard.err.log") `
    -PassThru `
    -WindowStyle Hidden
}

  Write-ProcessState
  $api = Start-ApiProcess
  Write-ProcessState
  Wait-UntilReady -Name "API" -Url "http://localhost:7741/health" -Process $api

  $dashboard = Start-DashboardProcess
  Write-ProcessState
  Wait-UntilReady -Name "Dashboard" -Url "http://localhost:7740/login" -Process $dashboard

  Write-SupervisorLog "AquaTV pronto em http://localhost:7740/dashboard"
  $apiHealthFailures = 0
  $dashboardHealthFailures = 0

  while ($true) {
    if (-not $api.HasExited) {
      if (Test-Url -Url "http://localhost:7741/health" -TimeoutSeconds 2) {
        $apiHealthFailures = 0
      } else {
        $apiHealthFailures += 1
      }
      if ($apiHealthFailures -ge 3) {
        Write-SupervisorLog "API parou de responder; encerrando para reiniciar."
        Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
        $api.WaitForExit(5000) | Out-Null
      }
    }

    if (-not $dashboard.HasExited) {
      if (Test-Url -Url "http://localhost:7740/login" -TimeoutSeconds 2) {
        $dashboardHealthFailures = 0
      } else {
        $dashboardHealthFailures += 1
      }
      if ($dashboardHealthFailures -ge 3) {
        Write-SupervisorLog "Dashboard parou de responder; encerrando para reiniciar."
        Stop-Process -Id $dashboard.Id -Force -ErrorAction SilentlyContinue
        $dashboard.WaitForExit(5000) | Out-Null
      }
    }

    if ($api.HasExited) {
      Write-SupervisorLog "API encerrou (exit $($api.ExitCode)); reiniciando."
      Start-Sleep -Seconds 2
      $api = Start-ApiProcess
      Write-ProcessState
      Wait-UntilReady -Name "API" -Url "http://localhost:7741/health" -Process $api
      $apiHealthFailures = 0
    }

    if ($dashboard.HasExited) {
      Write-SupervisorLog "Dashboard encerrou (exit $($dashboard.ExitCode)); reiniciando."
      Start-Sleep -Seconds 2
      $dashboard = Start-DashboardProcess
      Write-ProcessState
      Wait-UntilReady -Name "Dashboard" -Url "http://localhost:7740/login" -Process $dashboard
      $dashboardHealthFailures = 0
    }

    Start-Sleep -Seconds 5
  }
} catch {
  Write-SupervisorLog "Falha: $($_.Exception.Message)"
  if ($api -and -not $api.HasExited) {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
  }
  if ($dashboard -and -not $dashboard.HasExited) {
    Stop-Process -Id $dashboard.Id -Force -ErrorAction SilentlyContinue
  }
  throw
} finally {
  Clear-ProcessState
}
