param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-f0-9]{40}$')]
  [string]$CommitSha,

  [string]$DeployRoot = "C:\AquaFlora\AquaFloraTV-deploy",

  [switch]$WaitForCompletion,
  [ValidateRange(5, 45)]
  [int]$TimeoutMinutes = 40
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$source = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $source ".git"))) {
  throw "Checkout Git do AquaTV invalido."
}
$head = (& git -C $source rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $CommitSha) {
  throw "O checkout nao corresponde ao commit validado."
}

$deploy = [IO.Path]::GetFullPath($DeployRoot).TrimEnd('\')
$incoming = Join-Path $deploy "incoming"
New-Item -ItemType Directory -Path $incoming -Force | Out-Null

$bundlePath = Join-Path $incoming "$CommitSha.bundle"
$requestPath = Join-Path $incoming "$CommitSha.request.json"
$temporaryBundle = "$bundlePath.tmp"
$temporaryRequest = "$requestPath.tmp"
if ((Test-Path -LiteralPath $bundlePath) -or (Test-Path -LiteralPath $requestPath)) {
  throw "O commit $CommitSha ja esta na fila de deploy."
}

try {
  & git -C $source bundle create $temporaryBundle HEAD
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel criar o bundle Git do AquaTV." }
  & git bundle verify $temporaryBundle | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "O bundle Git do AquaTV e invalido." }
  Move-Item -LiteralPath $temporaryBundle -Destination $bundlePath

  [pscustomobject]@{
    schemaVersion = 1
    commitSha = $CommitSha
    bundleName = [IO.Path]::GetFileName($bundlePath)
    queuedAt = [DateTimeOffset]::UtcNow.ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $temporaryRequest -Encoding UTF8
  Move-Item -LiteralPath $temporaryRequest -Destination $requestPath
}
finally {
  foreach ($temporaryPath in @($temporaryBundle, $temporaryRequest)) {
    if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

Write-Host "Commit $CommitSha colocado na fila protegida do AquaTV."

if ($WaitForCompletion) {
  $statePath = Join-Path $deploy "deploy-state.json"
  $failedRequest = "$requestPath.failed"
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  do {
    if (Test-Path -LiteralPath $failedRequest -PathType Leaf) {
      throw "Deploy $CommitSha falhou. Consulte os logs locais do AquaTV."
    }
    if (Test-Path -LiteralPath $statePath -PathType Leaf) {
      try {
        $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($state.commitSha -eq $CommitSha -and $state.status -eq "deployed") {
          Write-Host "Deploy $CommitSha confirmado pelo servidor."
          return
        }
      }
      catch {
        Write-Verbose "Estado do deploy ainda esta sendo atualizado."
      }
    }
    Start-Sleep -Seconds 10
  } while ((Get-Date) -lt $deadline)
  throw "Deploy $CommitSha nao foi confirmado em $TimeoutMinutes minutos."
}
