param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$processStatePath = Join-Path $projectRoot "logs\aquatv-processes.json"
$supervisorScriptPath = Join-Path $projectRoot "scripts\windows\start-aquatv.ps1"
$apiEntryPoint = Join-Path $projectRoot "apps\api\dist\index.js"
$nextEntryPoint = Join-Path $projectRoot "node_modules\next\dist\bin\next"

function Read-ProcessState {
  if (-not (Test-Path -LiteralPath $processStatePath)) {
    return $null
  }

  try {
    $state = Get-Content -LiteralPath $processStatePath -Raw | ConvertFrom-Json
  } catch {
    Write-Warning "Arquivo de estado invalido; nenhum processo sera encerrado."
    Remove-Item -LiteralPath $processStatePath -Force
    return $null
  }
  if (-not [string]::Equals($state.projectRoot, $projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "O arquivo de estado pertence a outro projeto: $($state.projectRoot)"
  }

  return $state
}

function Test-AquaTvProcess([int]$ProcessId, [string]$Role, [object]$ExpectedStartTime) {
  if ($ProcessId -le 0) {
    return $false
  }

  if ($null -ne $ExpectedStartTime) {
    try {
      $expected = [DateTime]::Parse(
        [string]$ExpectedStartTime,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
      ).ToUniversalTime()
      $actual = (Get-Process -Id $ProcessId -ErrorAction Stop).StartTime.ToUniversalTime()
      if ([Math]::Abs(($actual - $expected).TotalSeconds) -ge 1) {
        return $false
      }
    } catch {
      return $false
    }
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) {
    return $false
  }

  $commandLine = [string]$process.CommandLine
  if ($Role -eq "supervisor") {
    return (
      $process.Name -in @("powershell.exe", "pwsh.exe") -and
      $commandLine.IndexOf($supervisorScriptPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
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

function Stop-AquaTvProcess([object]$ProcessId, [object]$StartTime, [string]$Role) {
  if ($null -eq $ProcessId) {
    return
  }

  $numericId = [int]$ProcessId
  if (-not (Test-AquaTvProcess -ProcessId $numericId -Role $Role -ExpectedStartTime $StartTime)) {
    return
  }

  Stop-Process -Id $numericId -Force -ErrorAction SilentlyContinue
  Write-Host "Processo AquaTV parado ($Role): $numericId"
}

$state = Read-ProcessState
if (-not $state) {
  Write-Warning "Arquivo de estado ausente; procurando processos AquaTV gerenciados."
  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
      $commandLine = [string]$_.CommandLine
      if ($_.Name -in @("powershell.exe", "pwsh.exe") -and
        $commandLine.IndexOf($supervisorScriptPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        [pscustomobject]@{ ProcessId = $_.ProcessId; Role = "supervisor" }
      } elseif ($_.Name -eq "node.exe" -and
        $commandLine.IndexOf($apiEntryPoint, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        [pscustomobject]@{ ProcessId = $_.ProcessId; Role = "api" }
      } elseif ($_.Name -eq "node.exe" -and
        $commandLine.IndexOf($nextEntryPoint, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $commandLine -match "(?:^|\s)-p\s+7740(?:\s|$)") {
        [pscustomobject]@{ ProcessId = $_.ProcessId; Role = "dashboard" }
      }
    })

  foreach ($process in $processes) {
    Stop-AquaTvProcess -ProcessId $process.ProcessId -StartTime $null -Role $process.Role
  }

  if (Test-Path -LiteralPath $processStatePath) {
    Remove-Item -LiteralPath $processStatePath -Force
  }

  $remainingListeners = Get-NetTCPConnection -LocalPort 7740, 7741 -State Listen -ErrorAction SilentlyContinue
  if ($remainingListeners) {
    Write-Warning "Ainda existem processos nas portas 7740/7741; eles nao foram encerrados."
  } else {
    Write-Host "AquaTV parado."
  }
  return
}

Stop-AquaTvProcess -ProcessId $state.supervisorPid -StartTime $state.supervisorStartTime -Role "supervisor"
Start-Sleep -Milliseconds 300

$latestState = Read-ProcessState
$states = @($state)
if ($latestState) {
  $states += $latestState
}

foreach ($knownState in $states) {
  Stop-AquaTvProcess -ProcessId $knownState.apiPid -StartTime $knownState.apiStartTime -Role "api"
  Stop-AquaTvProcess -ProcessId $knownState.dashboardPid -StartTime $knownState.dashboardStartTime -Role "dashboard"
}

if (Test-Path -LiteralPath $processStatePath) {
  Remove-Item -LiteralPath $processStatePath -Force
}

$remainingListeners = Get-NetTCPConnection -LocalPort 7740, 7741 -State Listen -ErrorAction SilentlyContinue
if ($remainingListeners) {
  Write-Warning "Ainda existem processos nao identificados nas portas 7740/7741; eles nao foram encerrados."
} else {
  Write-Host "AquaTV parado."
}
