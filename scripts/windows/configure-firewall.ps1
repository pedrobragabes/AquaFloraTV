param(
  [string]$RulePrefix = "AquaTV Local",
  [int[]]$Ports = @(3000, 3001)
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "Execute este script em um PowerShell aberto como Administrador."
}

foreach ($port in $Ports) {
  $ruleName = "$RulePrefix TCP $port"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

  if ($existingRule) {
    Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Profile Private
  } else {
    New-NetFirewallRule `
      -DisplayName $ruleName `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $port `
      -Profile Private | Out-Null
  }

  Write-Host "Porta liberada no perfil Private: $port"
}
