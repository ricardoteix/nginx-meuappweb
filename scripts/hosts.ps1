# =============================================================================
# Adiciona/remove os domínios do exemplo no arquivo hosts do Windows.
# Execute o PowerShell COMO ADMINISTRADOR:
#   .\scripts\hosts.ps1 add
#   .\scripts\hosts.ps1 remove
# =============================================================================
param([Parameter(Mandatory = $true)][ValidateSet("add", "remove")][string]$Action)

$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$Begin = "# >>> meuappweb (exemplo NGINX) >>>"
$End   = "# <<< meuappweb (exemplo NGINX) <<<"
$Entries = @(
  "127.0.0.1   meuappweb.com.br",
  "127.0.0.1   www.meuappweb.com.br",
  "127.0.0.1   api.meuappweb.com.br",
  "127.0.0.1   admin.meuappweb.com.br"
)

$lines = Get-Content -Path $HostsFile
$out = New-Object System.Collections.Generic.List[string]
$skip = $false
foreach ($l in $lines) {
  if ($l -eq $Begin) { $skip = $true; continue }
  if ($l -eq $End)   { $skip = $false; continue }
  if (-not $skip)    { $out.Add($l) }
}

if ($Action -eq "add") {
  $out.Add("")
  $out.Add($Begin)
  $Entries | ForEach-Object { $out.Add($_) }
  $out.Add($End)
}

Set-Content -Path $HostsFile -Value $out -Encoding ASCII
ipconfig /flushdns | Out-Null
Write-Host "Arquivo hosts atualizado ($Action)."
