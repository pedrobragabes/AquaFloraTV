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
$apiRoot = Join-Path $projectRoot "apps\api"
$node = Get-Command node.exe -ErrorAction Stop
$tsxEntryPoint = Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs"
if (-not (Test-Path -LiteralPath $tsxEntryPoint -PathType Leaf)) {
  throw "tsx nao encontrado. Execute instalar-dependencias.bat primeiro: $tsxEntryPoint"
}

function Test-PathInside([string]$Candidate, [string]$Parent) {
  $candidatePath = [System.IO.Path]::GetFullPath($Candidate)
  $parentPath = [System.IO.Path]::GetFullPath($Parent)
  $parentPrefix = $parentPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  return (
    [string]::Equals($candidatePath, $parentPath, [System.StringComparison]::OrdinalIgnoreCase) -or
    $candidatePath.StartsWith($parentPrefix, [System.StringComparison]::OrdinalIgnoreCase)
  )
}

function Invoke-DatabaseMaintenance([string[]]$Arguments) {
  Push-Location $apiRoot
  try {
    & $node.Source $tsxEntryPoint "src/scripts/database-maintenance.ts" @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Falha na manutencao do SQLite: $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
  Write-Host ""
}

function Assert-ZipArchive([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Arquivo ZIP nao foi criado: $Path"
  }

  $zipInfo = Get-Item -LiteralPath $Path
  if ($zipInfo.Length -le 0) {
    throw "Arquivo ZIP vazio: $Path"
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entryNames = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
    if ($entryNames -notcontains "db/dev.db") {
      throw "O ZIP nao contem o snapshot db/dev.db."
    }

    foreach ($entry in $archive.Entries) {
      if ([string]::IsNullOrEmpty($entry.Name)) {
        continue
      }

      $stream = $entry.Open()
      try {
        $stream.CopyTo([System.IO.Stream]::Null)
      } finally {
        $stream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
  }
}

$storagePath = Join-Path $projectRoot "storage"
if (-not (Test-Path -LiteralPath $storagePath -PathType Container)) {
  throw "Storage nao encontrado: $storagePath"
}
$storageResolved = (Resolve-Path $storagePath).Path
if (Test-PathInside -Candidate $backupRootResolved -Parent $storageResolved) {
  throw "BackupRoot nao pode ficar dentro de storage: $backupRootResolved"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$stagingPath = Join-Path $backupRootResolved "aquatv-$timestamp"
$dbStagingPath = Join-Path $stagingPath "db"
$configStagingPath = Join-Path $stagingPath "config"
$storageStagingPath = Join-Path $stagingPath "storage"
$zipPath = Join-Path $backupRootResolved "aquatv-$timestamp.zip"
$partialZipPath = Join-Path $backupRootResolved "aquatv-$timestamp.partial.zip"

$stagingFullPath = [System.IO.Path]::GetFullPath($stagingPath)
$backupPrefix = $backupRootResolved.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $stagingFullPath.StartsWith($backupPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Caminho de staging inesperado: $stagingFullPath"
}
if ((Test-Path -LiteralPath $stagingPath) -or (Test-Path -LiteralPath $zipPath) -or (Test-Path -LiteralPath $partialZipPath)) {
  throw "Ja existe artefato com o mesmo timestamp de backup; tente novamente."
}

$published = $false
try {
  Set-Location $projectRoot
  $consistentSnapshot = $false
  $maxConsistencyAttempts = 3

  for ($attempt = 1; $attempt -le $maxConsistencyAttempts; $attempt += 1) {
    if (Test-Path -LiteralPath $stagingPath) {
      Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $dbStagingPath, $configStagingPath | Out-Null

    try {
      Copy-Item -LiteralPath $storagePath -Destination $storageStagingPath -Recurse -Force
      $snapshotPath = Join-Path $dbStagingPath "dev.db"
      Invoke-DatabaseMaintenance -Arguments @("backup", $snapshotPath)
      Invoke-DatabaseMaintenance -Arguments @(
        "verify-storage",
        $snapshotPath,
        (Join-Path $storageStagingPath "media")
      )
      $consistentSnapshot = $true
      break
    } catch {
      if ($attempt -ge $maxConsistencyAttempts) {
        throw
      }
      Write-Warning "Storage mudou durante o backup (tentativa $attempt de $maxConsistencyAttempts); tentando novamente. $($_.Exception.Message)"
      Start-Sleep -Seconds 1
    }
  }

  if (-not $consistentSnapshot) {
    throw "Nao foi possivel obter um snapshot consistente de banco e storage."
  }

  foreach ($configFile in @("apps\api\.env", "apps\dashboard\.env")) {
    $source = Join-Path $projectRoot $configFile
    if (Test-Path -LiteralPath $source) {
      $safeName = $configFile.Replace("\", "-").Replace("/", "-")
      Copy-Item -LiteralPath $source -Destination (Join-Path $configStagingPath $safeName) -Force
    }
  }

  Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $partialZipPath
  Assert-ZipArchive -Path $partialZipPath
  Move-Item -LiteralPath $partialZipPath -Destination $zipPath
  $published = $true

  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $backupRootResolved -Filter "aquatv-*.zip" |
    Where-Object { $_.Name -notlike "*.partial.zip" -and $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force

  Write-Host "Backup criado e validado: $zipPath"
} finally {
  if (Test-Path -LiteralPath $stagingPath) {
    $stagingResolved = (Resolve-Path $stagingPath).Path
    if ($stagingResolved.StartsWith($backupPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $stagingResolved -Recurse -Force
    }
  }
  if (Test-Path -LiteralPath $partialZipPath) {
    Remove-Item -LiteralPath $partialZipPath -Force
  }
  if (-not $published -and (Test-Path -LiteralPath $zipPath)) {
    Remove-Item -LiteralPath $zipPath -Force
  }
}
