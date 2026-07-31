param(
  [int]$ApiPort = 7751,
  [int]$DashboardPort = 7750
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiBuild = Join-Path $projectRoot 'apps\api\dist\index.js'
$dashboardBuild = Join-Path $projectRoot 'apps\dashboard\.next\BUILD_ID'
$node = Get-Command node -ErrorAction Stop
$corepack = Get-Command corepack -ErrorAction Stop
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
$smokeRoot = Join-Path $projectRoot "logs\integration-smoke-$timestamp"
$databasePath = Join-Path $smokeRoot 'smoke.db'
$storagePath = Join-Path $smokeRoot 'storage'
$apiStdout = Join-Path $smokeRoot 'api.stdout.log'
$apiStderr = Join-Path $smokeRoot 'api.stderr.log'
$dashboardStdout = Join-Path $smokeRoot 'dashboard.stdout.log'
$dashboardStderr = Join-Path $smokeRoot 'dashboard.stderr.log'
$apiProcess = $null
$dashboardProcess = $null
$environmentNames = @(
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'API_ADMIN_TOKEN',
  'STORAGE_PATH',
  'MAX_UPLOAD_MB',
  'ALLOWED_ORIGINS',
  'API_INTERNAL_URL',
  'DASHBOARD_SESSION_SECRET',
  'DASHBOARD_AUTH_ENABLED',
  'DASHBOARD_ADMIN_PASSWORD',
  'DASHBOARD_COOKIE_SECURE'
)
$previousEnvironment = @{}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function New-HexSecret {
  param([int]$ByteCount)

  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  }
  finally {
    $generator.Dispose()
  }

  return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Assert-PortAvailable {
  param([int]$Port)

  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  try {
    $listener.Start()
  }
  catch {
    throw "A porta $Port ja esta em uso"
  }
  finally {
    $listener.Stop()
  }
}

function Set-ProcessEnvironment {
  param(
    [string]$Name,
    [string]$Value
  )

  [System.Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}

function Invoke-Pnpm {
  param([string[]]$PnpmArguments)

  & $corepack.Source 'pnpm@11.11.0' @PnpmArguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($PnpmArguments -join ' ') falhou com exit code $LASTEXITCODE"
  }
}

function Wait-HttpReady {
  param(
    [string]$Uri,
    [System.Diagnostics.Process]$Process,
    [string]$ErrorLog
  )

  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    $Process.Refresh()
    if ($Process.HasExited) {
      $details = if (Test-Path -LiteralPath $ErrorLog) {
        (Get-Content -LiteralPath $ErrorLog -Tail 30) -join [Environment]::NewLine
      }
      else {
        'sem log de erro'
      }
      throw "Processo encerrou durante o boot: $details"
    }

    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return
      }
    }
    catch {
      Start-Sleep -Milliseconds 250
    }
  }

  throw "Timeout aguardando $Uri"
}

function Invoke-ExpectedStatus {
  param(
    [string]$Method,
    [string]$Uri,
    [int]$ExpectedStatus,
    [hashtable]$Headers,
    [object]$Body,
    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
  )

  $request = @{
    Method = $Method
    Uri = $Uri
    UseBasicParsing = $true
    TimeoutSec = 10
  }
  if ($null -ne $Headers) {
    $request.Headers = $Headers
  }
  if ($null -ne $Body) {
    $request.ContentType = 'application/json'
    $request.Body = $Body | ConvertTo-Json -Depth 10 -Compress
  }
  if ($null -ne $WebSession) {
    $request.WebSession = $WebSession
  }

  $actualStatus = $null
  try {
    $actualStatus = [int](Invoke-WebRequest @request).StatusCode
  }
  catch {
    if ($null -eq $_.Exception.Response) {
      throw
    }
    $actualStatus = [int]$_.Exception.Response.StatusCode
  }

  Assert-True ($actualStatus -eq $ExpectedStatus) "$Method $Uri retornou $actualStatus; esperado $ExpectedStatus"
}

function Upload-SmokeMedia {
  param(
    [string]$Uri,
    [string]$AdminToken,
    [string]$FixturePath
  )

  Add-Type -AssemblyName System.Net.Http
  $client = New-Object System.Net.Http.HttpClient
  $form = New-Object System.Net.Http.MultipartFormDataContent
  try {
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $AdminToken)
    $client.DefaultRequestHeaders.Add('x-uploaded-by', 'smoke-test')
    $fileContent = New-Object System.Net.Http.ByteArrayContent(, [System.IO.File]::ReadAllBytes($FixturePath))
    $fileContent.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue('image/png')
    $form.Add($fileContent, 'file', 'smoke.png')

    $response = $client.PostAsync($Uri, $form).GetAwaiter().GetResult()
    $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    Assert-True ([int]$response.StatusCode -eq 201) "Upload retornou $([int]$response.StatusCode): $responseBody"
    return $responseBody | ConvertFrom-Json
  }
  finally {
    $form.Dispose()
    $client.Dispose()
  }
}

foreach ($name in $environmentNames) {
  $current = [System.Environment]::GetEnvironmentVariable($name, 'Process')
  $previousEnvironment[$name] = @{
    Exists = $null -ne $current
    Value = $current
  }
}

try {
  Assert-True (Test-Path -LiteralPath $apiBuild) 'Build da API ausente; rode pnpm build'
  Assert-True (Test-Path -LiteralPath $dashboardBuild) 'Build do dashboard ausente; rode pnpm build'
  Assert-PortAvailable $ApiPort
  Assert-PortAvailable $DashboardPort

  New-Item -ItemType Directory -Path $smokeRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $storagePath -Force | Out-Null
  New-Item -ItemType File -Path $databasePath -Force | Out-Null

  $adminToken = New-HexSecret 32
  $sessionSecret = New-HexSecret 32
  $dashboardPassword = "Smoke-$(New-HexSecret 12)"
  $apiBase = "http://127.0.0.1:$ApiPort"
  $dashboardBase = "http://127.0.0.1:$DashboardPort"
  $databaseUrl = "file:$($databasePath.Replace('\', '/'))"

  Set-ProcessEnvironment 'NODE_ENV' 'production'
  Set-ProcessEnvironment 'PORT' "$ApiPort"
  Set-ProcessEnvironment 'DATABASE_URL' $databaseUrl
  Set-ProcessEnvironment 'API_ADMIN_TOKEN' $adminToken
  Set-ProcessEnvironment 'STORAGE_PATH' $storagePath
  Set-ProcessEnvironment 'MAX_UPLOAD_MB' '10'
  Set-ProcessEnvironment 'ALLOWED_ORIGINS' $dashboardBase

  Push-Location $projectRoot
  try {
    Invoke-Pnpm @('--filter', '@aquatv/api', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma')
    Invoke-Pnpm @('--filter', '@aquatv/api', 'exec', 'prisma', 'db', 'seed', '--schema', 'prisma/schema.prisma')
  }
  finally {
    Pop-Location
  }

  $apiProcess = Start-Process -FilePath $node.Source -ArgumentList @($apiBuild) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $apiStdout -RedirectStandardError $apiStderr -PassThru
  Wait-HttpReady "$apiBase/health" $apiProcess $apiStderr

  $adminHeaders = @{ Authorization = "Bearer $adminToken" }
  Invoke-ExpectedStatus 'GET' "$apiBase/api/media" 401 $null $null $null

  $registration = Invoke-RestMethod -Method Post -Uri "$apiBase/api/devices" -ContentType 'application/json' -Body (@{
      name = 'TV Smoke'
      deviceModel = 'STV-3000 Plus'
      androidVersion = '11'
    } | ConvertTo-Json -Compress)
  Assert-True (-not [string]::IsNullOrWhiteSpace($registration.id)) 'Registro nao retornou id'
  Assert-True (-not [string]::IsNullOrWhiteSpace($registration.token)) 'Registro nao retornou token'

  $defaultState = Invoke-RestMethod -Method Get -Uri "$apiBase/api/playlists/default" -Headers $adminHeaders
  Assert-True (-not [string]::IsNullOrWhiteSpace($defaultState.playlistId)) 'Seed nao configurou playlist padrao'

  $fixturePath = Join-Path $smokeRoot 'smoke.png'
  [System.IO.File]::WriteAllBytes(
    $fixturePath,
    [byte[]](0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52)
  )
  $media = Upload-SmokeMedia "$apiBase/api/media/upload" $adminToken $fixturePath

  $playlist = Invoke-RestMethod -Method Put -Uri "$apiBase/api/playlists/$($defaultState.playlistId)" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
      items = @(
        @{
          mediaId = $media.id
          order = 0
          durationOverrideMs = 1000
        }
      )
    } | ConvertTo-Json -Depth 5 -Compress)
  Assert-True (@($playlist.items).Count -eq 1) 'Playlist nao recebeu a midia do smoke'

  $deviceHeaders = @{ Authorization = "Bearer $($registration.token)" }
  $currentPlaylist = Invoke-RestMethod -Method Get -Uri "$apiBase/api/devices/$($registration.id)/current-playlist" -Headers $deviceHeaders
  Assert-True (@($currentPlaylist.items).Count -eq 1) 'Player nao recebeu a playlist esperada'
  $mediaResponse = Invoke-WebRequest -UseBasicParsing -Uri "$apiBase$($currentPlaylist.items[0].media.url)" -TimeoutSec 10
  Assert-True ($mediaResponse.StatusCode -eq 200) 'Storage estatico nao serviu a midia'

  $paused = Invoke-RestMethod -Method Put -Uri "$apiBase/api/playlists/default" -Headers $adminHeaders -ContentType 'application/json' -Body '{"playlistId":null}'
  Assert-True ($paused.playbackEnabled -eq $false) 'Pausa global nao foi persistida'
  Assert-True ($paused.playlistId -eq $defaultState.playlistId) 'Pausa global apagou a playlist padrao'
  Invoke-ExpectedStatus 'GET' "$apiBase/api/devices/$($registration.id)/current-playlist" 404 $deviceHeaders $null $null

  $resumed = Invoke-RestMethod -Method Put -Uri "$apiBase/api/playlists/default" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
      playlistId = $defaultState.playlistId
    } | ConvertTo-Json -Compress)
  Assert-True ($resumed.playbackEnabled -eq $true) 'Retomada global nao foi persistida'

  Invoke-ExpectedStatus 'POST' "$apiBase/api/devices/$($registration.id)/heartbeat" 204 $deviceHeaders @{
    uptimeSeconds = 42
    freeDiskMb = 1024
    totalDiskMb = 4096
    appVersion = 'smoke'
    currentMediaId = $null
    networkType = 'ethernet'
  } $null

  $devices = Invoke-RestMethod -Method Get -Uri "$apiBase/api/devices" -Headers $adminHeaders
  Assert-True (@($devices.data).Count -eq 1) 'Painel admin nao encontrou o dispositivo'
  Assert-True (-not ($devices.data[0].PSObject.Properties.Name -contains 'token')) 'Lista admin vazou token do dispositivo'
  Assert-True ($null -eq $devices.data[0].currentMediaId) 'Heartbeat nao limpou currentMediaId'

  Set-ProcessEnvironment 'PORT' "$DashboardPort"
  Set-ProcessEnvironment 'API_INTERNAL_URL' $apiBase
  Set-ProcessEnvironment 'DASHBOARD_SESSION_SECRET' $sessionSecret
  Set-ProcessEnvironment 'DASHBOARD_AUTH_ENABLED' 'true'
  Set-ProcessEnvironment 'DASHBOARD_ADMIN_PASSWORD' $dashboardPassword
  Set-ProcessEnvironment 'DASHBOARD_COOKIE_SECURE' 'false'

  $nextCli = Join-Path $projectRoot 'node_modules\next\dist\bin\next'
  $dashboardProcess = Start-Process -FilePath $node.Source -ArgumentList @($nextCli, 'start', '-p', "$DashboardPort", '-H', '127.0.0.1') -WorkingDirectory (Join-Path $projectRoot 'apps\dashboard') -WindowStyle Hidden -RedirectStandardOutput $dashboardStdout -RedirectStandardError $dashboardStderr -PassThru
  Wait-HttpReady "$dashboardBase/login" $dashboardProcess $dashboardStderr

  $webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$dashboardBase/api/auth/login" -WebSession $webSession -ContentType 'application/json' -Body (@{
      password = $dashboardPassword
    } | ConvertTo-Json -Compress)
  Assert-True ($login.StatusCode -eq 200) 'Login do dashboard falhou'
  Assert-True ($webSession.Cookies.Count -gt 0) 'Login nao criou cookie de sessao'

  $dashboardPage = Invoke-WebRequest -UseBasicParsing -Uri "$dashboardBase/dashboard" -WebSession $webSession
  Assert-True ($dashboardPage.StatusCode -eq 200) 'Dashboard autenticado nao abriu'
  $proxiedPlaylists = Invoke-RestMethod -Method Get -Uri "$dashboardBase/api/proxy/api/playlists" -WebSession $webSession
  Assert-True (@($proxiedPlaylists.data).Count -ge 1) 'Proxy autenticado nao retornou playlists'

  Invoke-ExpectedStatus 'DELETE' "$dashboardBase/api/proxy/api/devices/$($registration.id)" 204 $null $null $webSession
  $remainingDevices = Invoke-RestMethod -Method Get -Uri "$apiBase/api/devices" -Headers $adminHeaders
  Assert-True (@($remainingDevices.data).Count -eq 0) 'Exclusao do dispositivo via dashboard nao foi aplicada'

  [pscustomobject]@{
    ok = $true
    api = $apiBase
    dashboard = $dashboardBase
    database = $databasePath
    logs = $smokeRoot
    checks = 16
  } | ConvertTo-Json -Compress
}
catch {
  if (Test-Path -LiteralPath $apiStderr) {
    Write-Error ((Get-Content -LiteralPath $apiStderr -Tail 30) -join [Environment]::NewLine)
  }
  if (Test-Path -LiteralPath $dashboardStderr) {
    Write-Error ((Get-Content -LiteralPath $dashboardStderr -Tail 30) -join [Environment]::NewLine)
  }
  throw
}
finally {
  foreach ($process in @($dashboardProcess, $apiProcess)) {
    if ($null -eq $process) {
      continue
    }
    $process.Refresh()
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
      Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue
    }
  }

  foreach ($name in $environmentNames) {
    $previous = $previousEnvironment[$name]
    if ($previous.Exists) {
      [System.Environment]::SetEnvironmentVariable($name, $previous.Value, 'Process')
    }
    else {
      [System.Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
  }
}
