param(
  [string]$RulePrefix = "AquaTV Local",
  [int[]]$Ports = @(7740, 7741)
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "Execute este script em um PowerShell aberto como Administrador."
}

$activeProfiles = @(
  Get-NetConnectionProfile -ErrorAction Stop |
    Where-Object {
      $_.IPv4Connectivity -notin @("Disconnected", "NoTraffic") -or
      $_.IPv6Connectivity -notin @("Disconnected", "NoTraffic")
    }
)
$publicProfiles = @($activeProfiles | Where-Object { $_.NetworkCategory -eq "Public" })
if ($publicProfiles.Count -gt 0) {
  $profileDescriptions = ($publicProfiles | ForEach-Object {
    "'$($_.Name)' (InterfaceIndex $($_.InterfaceIndex))"
  }) -join ", "
  throw @"
A rede ativa esta marcada como Public: $profileDescriptions
Por seguranca, nenhuma regra foi alterada. Confirme que esta e a rede privada da loja e mude o perfil em Configuracoes > Rede e Internet > Propriedades > Tipo de perfil de rede > Privada.
Alternativa como Administrador: Set-NetConnectionProfile -InterfaceIndex <numero> -NetworkCategory Private
Depois execute liberar-firewall.bat novamente.
"@
}

foreach ($port in $Ports) {
  $ruleName = "$RulePrefix TCP $port"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

  if ($existingRule) {
    Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Profile Private
    $existingRule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet
  } else {
    New-NetFirewallRule `
      -DisplayName $ruleName `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $port `
      -Profile Private `
      -RemoteAddress LocalSubnet | Out-Null
  }

  Write-Host "Porta liberada somente para a rede local: $port"
}
