$ErrorActionPreference = 'Stop'
$go = Get-Command go -ErrorAction SilentlyContinue
if (!$go) { throw 'Go 1.25+ is required to build this isolated Wails v2 proof.' }
& (Join-Path $PSScriptRoot 'prepare-assets.ps1')
Push-Location $PSScriptRoot
try {
  & $go.Source test ./...
  if ($LASTEXITCODE -ne 0) { throw 'Go tests failed.' }
  $out = Join-Path $PSScriptRoot 'bin\alinha-desktop-probe.exe'
  New-Item -ItemType Directory -Force (Split-Path $out -Parent) | Out-Null
  & $go.Source build -tags desktop,production -ldflags '-w -s -H windowsgui' -o $out .
  if ($LASTEXITCODE -ne 0) { throw 'Wails Windows build failed.' }
  Write-Output "EXPERIMENT ONLY (no packaged Python API): $out"
} finally { Pop-Location }
