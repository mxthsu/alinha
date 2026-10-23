param(
 [Parameter(Mandatory=$true)][string]$ExecutablePath,
 [Parameter(Mandatory=$true)][string]$PythonPath,
 [int]$TimeoutSeconds=45,
 [switch]$BrowserJourney
)
$ErrorActionPreference='Stop'
if(-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)){throw 'Executable not found'}
if(-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)){throw 'Isolated Python missing'}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class AlinhaWindowProbe {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder value, int length);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static IntPtr FindWindow(uint wantedPid) {
    IntPtr matched=IntPtr.Zero;
    EnumWindows((h, unused) => {
      uint pid; GetWindowThreadProcessId(h,out pid);
      if (pid == wantedPid && IsWindowVisible(h)) {
        var title=new StringBuilder(256);
        GetWindowText(h,title,title.Capacity);
        if(title.ToString().Contains("Alinha")){matched=h;return false;}
      }
      return true;
    },IntPtr.Zero);
    return matched;
  }
}
'@
# The proof must not read or overwrite the user's actual Community database.
$sandbox=Join-Path $env:TEMP ('alinha-desktop-smoke-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
$oldPython=$env:ALINHA_DESKTOP_PYTHON
$oldAppData=$env:APPDATA
$oldLocalData=$env:LOCALAPPDATA
$oldWebviewArgs=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$oldCdpPort=$env:ALINHA_SMOKE_CDP_PORT
if($BrowserJourney){
 $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
 $listener.Start()
 $port=([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
 $listener.Stop()
 $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-address=127.0.0.1 --remote-debugging-port=$port"
 $env:ALINHA_SMOKE_CDP_PORT=[string]$port
}
$env:ALINHA_DESKTOP_PYTHON=(Resolve-Path $PythonPath).Path
$env:APPDATA=Join-Path $sandbox 'roaming'
$env:LOCALAPPDATA=Join-Path $sandbox 'local'
New-Item -ItemType Directory -Force -Path $env:APPDATA,$env:LOCALAPPDATA | Out-Null
$process=$null
try{
  $process=Start-Process -FilePath (Resolve-Path $ExecutablePath).Path -PassThru
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
  $handle=[IntPtr]::Zero
  while((Get-Date) -lt $deadline){
    $process.Refresh()
    if($process.HasExited){throw ('Tauri exited before opening window (exit code '+$process.ExitCode+')')}
    $handle=[AlinhaWindowProbe]::FindWindow([uint32]$process.Id)
    if($handle -ne [IntPtr]::Zero){break}
    Start-Sleep -Milliseconds 500
  }
  if($handle -eq [IntPtr]::Zero){throw 'Tauri window was not visible before deadline'}
  Write-Output ('WINDOW_VISIBLE pid='+$process.Id+' hwnd='+$handle.ToInt64())
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Start-Sleep -Seconds 3
  $element=[System.Windows.Automation.AutomationElement]::FromHandle($handle)
  $nodes=$element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  $names=@()
  foreach($node in $nodes){
    $name=$node.Current.Name
    if($name -and $name.Trim().Length -gt 2){$names+= $name}
  }
  $interesting=$names | Where-Object { $_ -match 'Alinha|Agente|Currículo|Vagas|Conectar|Início|Jornada' } | Select-Object -First 10
  Write-Output ('ACCESSIBLE_NODES='+$nodes.Count)
  Write-Output ('ALINHA_LABELS='+($interesting -join ' | '))
  if(-not $interesting){throw 'Window launched, but expected Alinha UI labels were not found'}
  if($BrowserJourney) {
    $browserScript=Join-Path $PSScriptRoot '..\..\..\web\tests\native-tauri-browser.mjs'
    if(-not(Test-Path -LiteralPath $browserScript)){throw 'Browser journey test not found'}
    & node $browserScript
    if($LASTEXITCODE -ne 0){throw 'Native browser journey failed'}
  }
  Write-Output 'NATIVE_SMOKE_SUCCESS'
}finally{
  $env:ALINHA_DESKTOP_PYTHON=$oldPython
  $env:APPDATA=$oldAppData
  $env:LOCALAPPDATA=$oldLocalData
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$oldWebviewArgs
  $env:ALINHA_SMOKE_CDP_PORT=$oldCdpPort
  if($process -and -not $process.HasExited){
    $process.CloseMainWindow() | Out-Null
    Start-Sleep -Seconds 2
    $process.Refresh()
    if(-not $process.HasExited){$process.Kill()}
  }
  if($process){$process.Dispose()}
  # Keep scratch sandbox if the local API still has handles open; never purge
  # any directory outside the newly created isolated testing path.
}
