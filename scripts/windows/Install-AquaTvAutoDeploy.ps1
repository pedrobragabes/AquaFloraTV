param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$RuntimePath = "C:\AquaFlora\AquaFloraTV",
  [string]$DeployRoot = "C:\AquaFlora\AquaFloraTV-deploy",
  [string]$RunnerAccount = "*S-1-5-20"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Abra o PowerShell como administrador para instalar o deploy do AquaTV."
}

$project = (Resolve-Path -LiteralPath $ProjectPath).Path
$runtime = (Resolve-Path -LiteralPath $RuntimePath).Path
if (-not (Test-Path -LiteralPath (Join-Path $runtime ".git"))) {
  throw "O runtime do AquaTV precisa ser um checkout Git valido."
}
$deploy = [IO.Path]::GetFullPath($DeployRoot).TrimEnd('\')
$incoming = Join-Path $deploy "incoming"
foreach ($directory in @($deploy, $incoming, (Join-Path $deploy "processed"))) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$sourceWorker = Join-Path $project "scripts\windows\Invoke-AquaTvDeployment.ps1"
$installedWorker = Join-Path $deploy "Invoke-AquaTvDeployment.ps1"
Copy-Item -LiteralPath $sourceWorker -Destination $installedWorker -Force

& icacls.exe $incoming /inheritance:r | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel remover herancas da fila do AquaTV." }
& icacls.exe $incoming /grant:r "${RunnerAccount}:(OI)(CI)M" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger a fila para $RunnerAccount." }
& icacls.exe $deploy /grant "${RunnerAccount}:(RX)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel liberar a leitura do estado do AquaTV." }

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$action = New-ScheduledTaskAction `
  -Execute $powerShell `
  -Argument "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$installedWorker`" -RuntimePath `"$runtime`" -DeployRoot `"$deploy`"" `
  -WorkingDirectory $deploy
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 45) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable
$taskPrincipal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName "AquaTV-Deploy" `
  -Description "Instala commits validados da main do AquaTV, preservando configuracao, banco, midias e backups." `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $taskPrincipal `
  -Force | Out-Null

Write-Host "Deploy automatico do AquaTV instalado."
Write-Host "Fila permitida para: $RunnerAccount"
Write-Host "Tarefa: AquaTV-Deploy (SYSTEM, a cada minuto)"
