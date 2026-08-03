param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path $ProjectPath).Path
$initialMigration = "20260427113000_init"

Set-Location $projectRoot

$node = Get-Command node -ErrorAction Stop
$nodeVersionText = (& $node.Source --version).Trim().TrimStart("v")
$nodeVersion = $null
if (-not [System.Version]::TryParse($nodeVersionText.Split("-")[0], [ref]$nodeVersion)) {
  throw "Nao foi possivel interpretar a versao do Node.js: $nodeVersionText"
}
if ($nodeVersion -lt [System.Version]"22.13.0") {
  throw "Node.js 22.13.0 ou superior e obrigatorio para o pnpm 11.11.0. Instalado: $nodeVersionText"
}

$corepack = Get-Command corepack -ErrorAction Stop
$pnpmCommand = "pnpm@11.11.0"

function Invoke-PnpmChecked([string[]]$Arguments) {
  & $corepack.Source $pnpmCommand @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($Arguments -join ' ') falhou com exit code $LASTEXITCODE"
  }
}

function Get-DotEnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $prefix = "$Name="
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_.StartsWith($prefix, [System.StringComparison]::Ordinal) } |
    Select-Object -First 1
  if ($null -eq $line) {
    return $null
  }

  return $line.Substring($prefix.Length).Trim().Trim('"').Trim("'")
}

function Test-WeakSecret([string]$Value, [int]$MinimumLength) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -lt $MinimumLength) {
    return $true
  }

  $normalized = $Value.ToLowerInvariant()
  foreach ($placeholder in @("change-me", "replace-me", "troque-esta", "min-32-chars", "dev-admin-token")) {
    if ($normalized.Contains($placeholder)) {
      return $true
    }
  }

  return $false
}

function New-RandomHexSecret([int]$ByteCount = 32) {
  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }

  return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

function ConvertTo-DotEnvLiteral([string]$Value) {
  if ($Value -match "^[A-Za-z0-9_./:,@%+!#^&*()?;=-]+$") {
    return $Value
  }

  $escaped = $Value.Replace("\", "\\").Replace('"', '\"').Replace('$', '\$')
  $escaped = $escaped.Replace("`r", "\r").Replace("`n", "\n")
  return '"' + $escaped + '"'
}

function Set-DotEnvValues([string]$Path, [hashtable]$Values) {
  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null

  $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
  $result = New-Object System.Collections.Generic.List[string]
  $written = @{}

  foreach ($line in $lines) {
    if ($line -match "^([A-Za-z_][A-Za-z0-9_]*)=") {
      $name = $Matches[1]
      if ($Values.ContainsKey($name)) {
        if (-not $written.ContainsKey($name)) {
          $result.Add("$name=$(ConvertTo-DotEnvLiteral -Value ([string]$Values[$name]))")
          $written[$name] = $true
        }
        continue
      }
    }

    $result.Add($line)
  }

  foreach ($name in $Values.Keys) {
    if (-not $written.ContainsKey($name)) {
      $result.Add("$name=$(ConvertTo-DotEnvLiteral -Value ([string]$Values[$name]))")
    }
  }

  $temporaryPath = Join-Path $directory ("." + [System.IO.Path]::GetFileName($Path) + "." + [guid]::NewGuid().ToString("N") + ".tmp")
  $backupPath = "$Path.$([guid]::NewGuid().ToString('N')).replace-backup"
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  try {
    [System.IO.File]::WriteAllLines($temporaryPath, $result, $utf8WithoutBom)
    if (Test-Path -LiteralPath $Path) {
      [System.IO.File]::Replace($temporaryPath, $Path, $backupPath, $true)
      [System.IO.File]::Delete($backupPath)
    } else {
      [System.IO.File]::Move($temporaryPath, $Path)
    }
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
    if ((Test-Path -LiteralPath $Path) -and (Test-Path -LiteralPath $backupPath)) {
      Remove-Item -LiteralPath $backupPath -Force
    }
  }
}

function ConvertFrom-SecureStringPlainText([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Read-AdminPassword {
  while ($true) {
    $securePassword = Read-Host "Crie a senha do painel (minimo 12 caracteres)" -AsSecureString
    $plainPassword = ConvertFrom-SecureStringPlainText -SecureValue $securePassword
    if ($plainPassword -match '^[A-Za-z0-9!@#%^&*()_+=.,:;?/-]{12,256}$') {
      return $plainPassword
    }

    Write-Warning "Use de 12 a 256 caracteres: letras, numeros e ! @ # % ^ & * ( ) _ + = . , : ; ? / - (sem espacos, `$`, aspas ou barra invertida)."
  }
}

function Initialize-ProductionConfiguration {
  $apiEnvPath = Join-Path $projectRoot "apps\api\.env"
  $dashboardEnvPath = Join-Path $projectRoot "apps\dashboard\.env"

  $apiToken = Get-DotEnvValue -Path $apiEnvPath -Name "API_ADMIN_TOKEN"
  $dashboardToken = Get-DotEnvValue -Path $dashboardEnvPath -Name "API_ADMIN_TOKEN"
  $databaseUrl = Get-DotEnvValue -Path $apiEnvPath -Name "DATABASE_URL"
  if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    $databaseUrl = "file:./dev.db"
  } elseif (-not $databaseUrl.StartsWith("file:", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "DATABASE_URL invalida. Use SQLite no formato file:./dev.db em apps/api/.env."
  }

  if (-not (Test-WeakSecret -Value $apiToken -MinimumLength 32)) {
    $sharedToken = $apiToken
  } elseif (-not (Test-WeakSecret -Value $dashboardToken -MinimumLength 32)) {
    $sharedToken = $dashboardToken
  } else {
    $sharedToken = New-RandomHexSecret
  }

  $sessionSecret = Get-DotEnvValue -Path $dashboardEnvPath -Name "DASHBOARD_SESSION_SECRET"
  if (Test-WeakSecret -Value $sessionSecret -MinimumLength 32) {
    $sessionSecret = New-RandomHexSecret
  }

  $dashboardAuthEnabled = Get-DotEnvValue -Path $dashboardEnvPath -Name "DASHBOARD_AUTH_ENABLED"
  $adminPassword = Get-DotEnvValue -Path $dashboardEnvPath -Name "DASHBOARD_ADMIN_PASSWORD"
  $needsPassword = $dashboardAuthEnabled -ne "true" -or (Test-WeakSecret -Value $adminPassword -MinimumLength 12)
  if ($needsPassword) {
    $adminPassword = Read-AdminPassword
  }

  $allowedOrigins = Get-DotEnvValue -Path $apiEnvPath -Name "ALLOWED_ORIGINS"
  if ([string]::IsNullOrWhiteSpace($allowedOrigins) -or $allowedOrigins.Contains("*")) {
    $allowedOrigins = "http://localhost:7740,http://127.0.0.1:7740"
  }

  Set-DotEnvValues -Path $apiEnvPath -Values @{
    API_ADMIN_TOKEN = $sharedToken
    ALLOWED_ORIGINS = $allowedOrigins
    DATABASE_URL = $databaseUrl
  }

  $dashboardValues = @{
    API_ADMIN_TOKEN = $sharedToken
    API_INTERNAL_URL = "http://127.0.0.1:7741"
    DASHBOARD_AUTH_ENABLED = "true"
    DASHBOARD_SESSION_SECRET = $sessionSecret
  }
  if ($needsPassword) {
    $dashboardValues["DASHBOARD_ADMIN_PASSWORD"] = $adminPassword
  }
  Set-DotEnvValues -Path $dashboardEnvPath -Values $dashboardValues

  $adminPassword = $null
  $sharedToken = $null
  $sessionSecret = $null
  Write-Host "Configuracao de producao atualizada sem exibir segredos."
}

function New-PreMigrationBackup {
  $backupScript = Join-Path $projectRoot "scripts\windows\backup-aquatv.ps1"
  $backupRoot = Join-Path $projectRoot "backups\pre-migration"
  $windowsPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) {
    throw "Script de backup pre-migration nao encontrado: $backupScript"
  }
  if (-not (Test-Path -LiteralPath $windowsPowerShell -PathType Leaf)) {
    throw "Windows PowerShell nao encontrado: $windowsPowerShell"
  }

  Write-Host "Criando backup recuperavel antes das migrations..."
  & $windowsPowerShell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File $backupScript `
    -ProjectPath $projectRoot `
    -BackupRoot $backupRoot `
    -RetentionDays 90
  if ($LASTEXITCODE -ne 0) {
    throw "O backup pre-migration falhou; nenhuma migration foi executada."
  }
}

Write-Host "Preparando AquaTV..."

Initialize-ProductionConfiguration

Invoke-PnpmChecked -Arguments @("install", "--frozen-lockfile")
Invoke-PnpmChecked -Arguments @("--filter", "@aquatv/api", "prisma:generate")

$locationRaw = & $corepack.Source $pnpmCommand --filter "@aquatv/api" exec tsx src/scripts/database-maintenance.ts location
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel resolver DATABASE_URL."
}
$location = $locationRaw | Out-String | ConvertFrom-Json

if ($location.exists) {
  $inspectionRaw = & $corepack.Source $pnpmCommand --filter "@aquatv/api" exec tsx src/scripts/database-maintenance.ts inspect
  if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel inspecionar o banco existente."
  }

  $inspection = $inspectionRaw | Out-String | ConvertFrom-Json
  if (-not [string]::Equals($inspection.databasePath, $location.databasePath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Prisma conectou em um banco diferente de DATABASE_URL: $($inspection.databasePath)"
  }
  if (-not $inspection.integrityOk) {
    throw "O banco existente falhou no PRAGMA integrity_check."
  }
  if ($inspection.foreignKeyErrorCount -gt 0) {
    throw "O banco existente possui $($inspection.foreignKeyErrorCount) violacao(oes) de chave estrangeira."
  }

  if (-not $inspection.hasMigrationTable) {
    if ($inspection.isEmpty) {
      Write-Host "Banco SQLite vazio; as migrations criarao a estrutura inicial."
    } elseif ($inspection.missingLegacyTables.Count -gt 0) {
      throw "Banco legado incompleto. Tabelas ausentes: $($inspection.missingLegacyTables -join ', ')"
    } else {
      New-PreMigrationBackup
      Write-Host "Registrando migration inicial no banco legado..."
      Invoke-PnpmChecked -Arguments @(
        "--filter", "@aquatv/api", "exec", "prisma", "migrate", "resolve",
        "--schema", "prisma/schema.prisma", "--applied", $initialMigration
      )
    }
  } elseif (-not $inspection.isEmpty) {
    New-PreMigrationBackup
  }
}

Invoke-PnpmChecked -Arguments @(
  "--filter", "@aquatv/api", "exec", "prisma", "migrate", "deploy",
  "--schema", "prisma/schema.prisma"
)
Invoke-PnpmChecked -Arguments @("--filter", "@aquatv/api", "prisma:seed")
Invoke-PnpmChecked -Arguments @("--filter", "@aquatv/types", "build")
Invoke-PnpmChecked -Arguments @("--filter", "@aquatv/api", "build")
Invoke-PnpmChecked -Arguments @("--filter", "@aquatv/dashboard", "build")

Write-Host "AquaTV preparado. Use iniciar-aquatv.bat para executar."
