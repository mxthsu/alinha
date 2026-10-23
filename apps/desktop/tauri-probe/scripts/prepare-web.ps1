$ErrorActionPreference = 'Stop'
$web = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\web')).Path
Push-Location $web
try {
  if (-not (Test-Path '.\node_modules')) {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  }
  $env:ALINHA_DESKTOP_EXPORT = '1'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Static Next export failed' }
  if (-not (Test-Path '.\out\index.html')) { throw 'Missing exported index.html' }
  Write-Output "Static web assets ready: $web\out"
} finally {
  Remove-Item Env:ALINHA_DESKTOP_EXPORT -ErrorAction SilentlyContinue
  Pop-Location
}
