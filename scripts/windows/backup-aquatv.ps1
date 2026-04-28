param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$BackupRoot = "",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if ($RetentionDays -lt 1) {
  throw "RetentionDays precisa ser maior que zero."
}

$projectRoot = (Resolve-Path $ProjectPath).Path
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $projectRoot "backups"
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$backupRootResolved = (Resolve-Path $BackupRoot).Path

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stagingPath = Join-Path $backupRootResolved "aquatv-$timestamp"
$dbStagingPath = Join-Path $stagingPath "db"
$zipPath = Join-Path $backupRootResolved "aquatv-$timestamp.zip"

New-Item -ItemType Directory -Force -Path $dbStagingPath | Out-Null

$dbDirectory = Join-Path $projectRoot "apps\api\prisma"
$dbFiles = @("dev.db", "dev.db-wal", "dev.db-shm")

foreach ($dbFile in $dbFiles) {
  $source = Join-Path $dbDirectory $dbFile
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $dbStagingPath $dbFile) -Force
  }
}

$storagePath = Join-Path $projectRoot "storage"
if (Test-Path $storagePath) {
  Copy-Item -LiteralPath $storagePath -Destination (Join-Path $stagingPath "storage") -Recurse -Force
}

Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $zipPath -Force

$stagingResolved = (Resolve-Path $stagingPath).Path
if (-not $stagingResolved.StartsWith($backupRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Caminho de staging inesperado: $stagingResolved"
}

Remove-Item -LiteralPath $stagingResolved -Recurse -Force

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $backupRootResolved -Filter "aquatv-*.zip" |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force

Write-Host "Backup criado: $zipPath"
