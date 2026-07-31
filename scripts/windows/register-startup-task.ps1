param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TaskName = "AquaTV Local Server"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$scriptPath = Join-Path $projectRoot "scripts\windows\start-aquatv.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectPath `"$projectRoot`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Inicia API e dashboard do AquaTV ao ligar o Windows, sem exigir login." `
  -ErrorAction Stop `
  -Force | Out-Null

Write-Host "Tarefa registrada: $TaskName"
