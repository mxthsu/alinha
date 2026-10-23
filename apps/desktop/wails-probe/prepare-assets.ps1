$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$web = Join-Path $repo 'apps\web'
$dest = Join-Path $PSScriptRoot 'frontend\dist'
Push-Location $web
try {
  $env:ALINHA_DESKTOP_EXPORT = '1'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Desktop static export failed.' }
} finally { Pop-Location; Remove-Item Env:ALINHA_DESKTOP_EXPORT -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item -Path (Join-Path $web 'out\*') -Destination $dest -Recurse -Force
if (!(Test-Path (Join-Path $dest 'agente.html'))) { throw 'Missing bundled agent page.' }
Write-Output "Static assets prepared: $dest"
