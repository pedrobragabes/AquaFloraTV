param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TaskName = "AquaTV Local Backup",
  [string]$At = "03:00",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $ProjectPath "scripts\windows\backup-aquatv.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$taskTime = [DateTime]::ParseExact($At, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectPath `"$ProjectPath`" -RetentionDays $RetentionDays"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At $taskTime
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Cria backup diario do SQLite e storage do AquaTV." `
  -ErrorAction Stop `
  -Force | Out-Null

Write-Host "Tarefa registrada: $TaskName as $At"
