$ErrorActionPreference='Stop'
$base=Join-Path $env:TEMP 'alinha-architecture-toolchains'
$portable=Join-Path $base 'cargo\bin\cargo.exe'
if(Test-Path $portable) {
 $cargo=$portable
 $env:CARGO_HOME=Join-Path $base 'cargo'
 $env:RUSTUP_HOME=Join-Path $base 'rustup'
 $env:CARGO_TARGET_DIR=Join-Path $base 'target-tauri-host-gnullvm'
}else {
 $cargo=(Get-Command cargo -ErrorAction Stop).Source
}
# Rust >=1.99 gnullvm ships the standard libraries; no MSVC is needed for host-core tests.
$env:RUSTFLAGS='-C linker=rust-lld'
$env:ALINHA_TEST_PYTHON=Join-Path $PSScriptRoot '..\..\..\api\.venv\Scripts\python.exe'
if(-not(Test-Path $env:ALINHA_TEST_PYTHON)) {
 Write-Warning 'Python integration test will be skipped: apps/api/.venv not found.'
 Remove-Item Env:ALINHA_TEST_PYTHON -ErrorAction SilentlyContinue
}
Push-Location (Join-Path $PSScriptRoot '..\host-core')
try {
 & $cargo +stable-x86_64-pc-windows-gnullvm test -- --nocapture
 if($LASTEXITCODE -ne 0){throw 'Rust host-core validation failed'}
}finally{Pop-Location}
