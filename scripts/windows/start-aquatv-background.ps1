param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$scriptPath = Join-Path $projectRoot "scripts\windows\start-aquatv.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectPath `"$projectRoot`""
$supervisor = Start-Process `
  -FilePath "powershell.exe" `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -ArgumentList $arguments `
  -PassThru

function Test-Url([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
  } catch {
    return $false
  }
}

$deadline = (Get-Date).AddSeconds(70)
while ((Get-Date) -lt $deadline) {
  if ((Test-Url "http://localhost:7741/health") -and (Test-Url "http://localhost:7740/login")) {
    Write-Host "AquaTV iniciado em segundo plano."
    return
  }

  if ($supervisor.HasExited) {
    throw "A inicializacao do AquaTV falhou (exit code $($supervisor.ExitCode)). Consulte logs\supervisor.log."
  }

  Start-Sleep -Seconds 1
}

throw "AquaTV nao ficou pronto dentro de 70 segundos. Consulte logs\supervisor.log."
