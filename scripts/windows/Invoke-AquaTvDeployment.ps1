param(
  [string]$RuntimePath = "C:\AquaFlora\AquaFloraTV",
  [string]$DeployRoot = "C:\AquaFlora\AquaFloraTV-deploy"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"
$env:CI = "true"

$runtime = (Resolve-Path -LiteralPath $RuntimePath).Path
$deploy = [IO.Path]::GetFullPath($DeployRoot).TrimEnd('\')
$incoming = Join-Path $deploy "incoming"
$processed = Join-Path $deploy "processed"
$logRoot = Join-Path $runtime "logs"
foreach ($directory in @($incoming, $processed, $logRoot)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

function Assert-PathUnder([string]$Path, [string]$Parent) {
  $fullPath = [IO.Path]::GetFullPath($Path)
  $fullParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\')
  if (-not $fullPath.StartsWith("$fullParent\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Caminho fora da area de deploy: $fullPath"
  }
  return $fullPath
}

function Invoke-Git([string[]]$Arguments) {
  $output = @(& git -c "safe.directory=$runtime" -C $runtime @Arguments 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments[0]) falhou com codigo $LASTEXITCODE."
  }
  return (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
}

$lock = $null
$transcriptStarted = $false
$requestFile = $null
$request = $null
$logPath = Join-Path $logRoot "deploy-$(Get-Date -Format 'yyyy-MM-dd').log"
$errorLogPath = Join-Path $logRoot "deploy-errors-$(Get-Date -Format 'yyyy-MM-dd').log"
$errorLogPath = Join-Path $deploy "deploy-errors.log"
$temporaryRef = "refs/aquatv-deploy/incoming"
try {
  try {
    $lock = [IO.File]::Open((Join-Path $deploy "deploy.lock"), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  }
  catch [IO.IOException] {
    return
  }

  $requestFile = Get-ChildItem -LiteralPath $incoming -Filter "*.request.json" -File |
    Sort-Object LastWriteTimeUtc |
    Select-Object -First 1
  if (-not $requestFile) { return }

  $request = Get-Content -LiteralPath $requestFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($request.schemaVersion -ne 1 -or $request.commitSha -notmatch '^[a-f0-9]{40}$') {
    throw "Pedido de deploy do AquaTV invalido."
  }
  $expectedBundleName = "$($request.commitSha).bundle"
  if ($request.bundleName -ne $expectedBundleName) { throw "Nome de bundle divergente." }
  $bundlePath = Assert-PathUnder (Join-Path $incoming $request.bundleName) $incoming
  if (-not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) { throw "Bundle do deploy ausente." }

  Start-Transcript -Path $logPath -Append | Out-Null
  $transcriptStarted = $true
  Write-Host "Iniciando deploy do AquaTV $($request.commitSha)."

  if ((Invoke-Git @("branch", "--show-current")) -ne "main") {
    throw "O runtime do AquaTV nao esta na main."
  }
  if (Invoke-Git @("status", "--porcelain=v1", "--untracked-files=all")) {
    throw "O runtime do AquaTV possui alteracoes locais; deploy recusado."
  }
  $beforeCommit = Invoke-Git @("rev-parse", "HEAD")
  & git bundle verify $bundlePath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Bundle do AquaTV invalido." }
  Invoke-Git @("fetch", "--no-tags", $bundlePath, "HEAD:$temporaryRef") | Out-Null
  $incomingCommit = Invoke-Git @("rev-parse", $temporaryRef)
  if ($incomingCommit -ne $request.commitSha) { throw "Commit do bundle diverge do pedido." }
  & git -c "safe.directory=$runtime" -C $runtime merge-base --is-ancestor $beforeCommit $incomingCommit
  if ($LASTEXITCODE -ne 0) { throw "O deploy nao e fast-forward; runtime preservado." }

  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $runtime "scripts\windows\backup-aquatv.ps1") -ProjectPath $runtime
  if ($LASTEXITCODE -ne 0) { throw "O backup pre-deploy do AquaTV falhou." }

  Invoke-Git @("merge", "--ff-only", $incomingCommit) | Out-Null
  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $runtime "scripts\windows\prepare-aquatv.ps1") -ProjectPath $runtime
  if ($LASTEXITCODE -ne 0) { throw "Dependencias, migrations ou build do AquaTV falharam." }

  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $runtime "scripts\windows\stop-aquatv.ps1") -ProjectPath $runtime
  if ($LASTEXITCODE -ne 0) { throw "O AquaTV antigo nao foi encerrado com seguranca." }
  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $runtime "scripts\windows\start-aquatv-background.ps1") -ProjectPath $runtime
  if ($LASTEXITCODE -ne 0) { throw "O AquaTV atualizado nao iniciou." }

  $api = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:7741/health" -TimeoutSec 10
  $dashboard = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:7740/login" -TimeoutSec 10
  if ($api.StatusCode -ne 200 -or $dashboard.StatusCode -lt 200 -or $dashboard.StatusCode -ge 400) {
    throw "O smoke HTTP do AquaTV falhou."
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Move-Item -LiteralPath $bundlePath -Destination (Join-Path $processed "$stamp-$expectedBundleName")
  Move-Item -LiteralPath $requestFile.FullName -Destination (Join-Path $processed "$stamp-$($requestFile.Name)")
  [pscustomobject]@{
    schemaVersion = 1
    status = "deployed"
    commitSha = $request.commitSha
    previousCommitSha = $beforeCommit
    deployedAt = [DateTimeOffset]::UtcNow.ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $deploy "deploy-state.json") -Encoding UTF8

  $newWorker = Join-Path $runtime "scripts\windows\Invoke-AquaTvDeployment.ps1"
  if (Test-Path -LiteralPath $newWorker -PathType Leaf) {
    Copy-Item -LiteralPath $newWorker -Destination (Join-Path $deploy "Invoke-AquaTvDeployment.ps1") -Force
  }
  Write-Host "Deploy do AquaTV concluido: $($request.commitSha)."
}
catch {
  try {
    Add-Content -LiteralPath $errorLogPath -Value ("$(Get-Date -Format o) DEPLOY_ERROR " + $_.Exception.ToString()) -Encoding UTF8
  }
  catch {
    # A diagnostic write must never replace the original deployment failure.
  }
  if ($requestFile -and (Test-Path -LiteralPath $requestFile.FullName -PathType Leaf)) {
    Move-Item -LiteralPath $requestFile.FullName -Destination "$($requestFile.FullName).failed" -Force
  }
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:7741/health" -TimeoutSec 3 | Out-Null
  }
  catch {
    try {
      & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $runtime "scripts\windows\start-aquatv-background.ps1") -ProjectPath $runtime
    }
    catch {
      Write-Warning "A recuperacao do processo AquaTV tambem falhou."
    }
  }
  throw
}
finally {
  & git -c "safe.directory=$runtime" -C $runtime update-ref -d $temporaryRef 2>$null
  if ($transcriptStarted) { Stop-Transcript | Out-Null }
  if ($lock) { $lock.Dispose() }
}
