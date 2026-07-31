param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TaskName = "AquaTV Local Backup",
  [string]$At = "03:00",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$scriptPath = Join-Path $projectRoot "scripts\windows\backup-aquatv.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$taskTime = [DateTime]::ParseExact($At, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectPath `"$projectRoot`" -RetentionDays $RetentionDays"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At $taskTime
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Cria backup diario do SQLite e storage do AquaTV." `
  -ErrorAction Stop `
  -Force | Out-Null

Write-Host "Tarefa registrada: $TaskName as $At"
