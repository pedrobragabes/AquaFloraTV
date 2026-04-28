param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectPath

$logPath = Join-Path $ProjectPath "logs"
$storagePath = Join-Path $ProjectPath "storage"
$dbPath = Join-Path $ProjectPath "apps\api\prisma\dev.db"
$migrationPath = Join-Path $ProjectPath "apps\api\prisma\migrations\20260427113000_init\migration.sql"
New-Item -ItemType Directory -Force -Path $logPath, $storagePath | Out-Null

$env:NODE_ENV = "production"
$env:STORAGE_PATH = $storagePath

function ConvertTo-PowerShellLiteral([string]$Value) {
  return "'" + ($Value -replace "'", "''") + "'"
}

function Stop-ExistingListeners([int[]]$Ports) {
  $processIds = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -ne 0 } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

Start-Transcript -Path (Join-Path $logPath "aquatv-startup.log") -Append

try {
  $pnpm = Get-Command pnpm -ErrorAction Stop

  Stop-ExistingListeners -Ports @(3000, 3001)

  if (-not (Test-Path $dbPath)) {
    & $pnpm.Source --filter "@aquatv/api" exec prisma db execute --schema prisma/schema.prisma --file $migrationPath
  }

  & $pnpm.Source --filter "@aquatv/api" exec prisma generate --schema prisma/schema.prisma
  & $pnpm.Source --filter "@aquatv/api" prisma:seed
  & $pnpm.Source build

  $apiOut = Join-Path $logPath "api.out.log"
  $apiErr = Join-Path $logPath "api.err.log"
  $dashboardOut = Join-Path $logPath "dashboard.out.log"
  $dashboardErr = Join-Path $logPath "dashboard.err.log"
  $projectLiteral = ConvertTo-PowerShellLiteral $ProjectPath
  $pnpmLiteral = ConvertTo-PowerShellLiteral $pnpm.Source

  $api = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location $projectLiteral; & $pnpmLiteral --filter '@aquatv/api' start`"" `
    -WorkingDirectory $ProjectPath `
    -RedirectStandardOutput $apiOut `
    -RedirectStandardError $apiErr `
    -PassThru `
    -WindowStyle Hidden

  $dashboard = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location $projectLiteral; & $pnpmLiteral --filter '@aquatv/dashboard' start`"" `
    -WorkingDirectory $ProjectPath `
    -RedirectStandardOutput $dashboardOut `
    -RedirectStandardError $dashboardErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Process -Id $api.Id, $dashboard.Id
}
finally {
  Stop-Transcript
}
