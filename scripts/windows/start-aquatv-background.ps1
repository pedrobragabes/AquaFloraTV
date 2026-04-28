param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$scriptPath = Join-Path $projectRoot "scripts\windows\start-aquatv.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

Start-Process `
  -FilePath "powershell.exe" `
  -WorkingDirectory $projectRoot `
  -WindowStyle Minimized `
  -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $scriptPath,
    "-ProjectPath",
    $projectRoot
  ) | Out-Null

Write-Host "AquaTV iniciado em segundo plano."
