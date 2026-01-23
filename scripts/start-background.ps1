$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $root 'gestionale-server'
$clientPath = Join-Path $root 'gestionale-client'
$logDir = Join-Path $root 'logs'
$null = New-Item -Path $logDir -ItemType Directory -Force
$serverOutLog = Join-Path $logDir 'server.out.log'
$serverErrLog = Join-Path $logDir 'server.err.log'
$clientBuildOutLog = Join-Path $logDir 'client.build.out.log'
$clientBuildErrLog = Join-Path $logDir 'client.build.err.log'
$startupLog = Join-Path $logDir 'startup.log'

$npm = (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue).Source
if (-not $npm) {
  $npm = 'C:\Program Files\nodejs\npm.cmd'
}
if (-not (Test-Path $npm)) {
  $npm = 'C:\Program Files (x86)\nodejs\npm.cmd'
}
if (-not (Test-Path $npm)) {
  throw 'npm.cmd not found. Install Node.js or update the npm path.'
}
$buildClientOnStartup = $true

function Write-StartupLog {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $startupLog -Value "[$timestamp] $Message" -Encoding ASCII
}

function Stop-PortListeners {
  param([int]$Port)
  try {
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
      if ($listener.OwningProcess -and $listener.OwningProcess -ne $PID) {
        Write-StartupLog "Stopping process $($listener.OwningProcess) on port $Port"
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
      }
    }
  } catch {
    Write-StartupLog "Warning: unable to stop listeners on port $Port - $($_.Exception.Message)"
  }
}

function Start-Server {
  Write-StartupLog 'Starting server process'
  return Start-Process -FilePath $npm -ArgumentList 'run', 'start' -WorkingDirectory $serverPath -WindowStyle Hidden -RedirectStandardOutput $serverOutLog -RedirectStandardError $serverErrLog -PassThru
}

function Build-Client {
  Write-StartupLog 'Building client'
  $env:NO_COLOR = '1'
  $env:FORCE_COLOR = '0'
  return Start-Process -FilePath $npm -ArgumentList 'run', 'build' -WorkingDirectory $clientPath -WindowStyle Hidden -RedirectStandardOutput $clientBuildOutLog -RedirectStandardError $clientBuildErrLog -Wait -PassThru
}

$didBuildClient = $false
while ($true) {
  Stop-PortListeners -Port 80
  Stop-PortListeners -Port 443
  
  if ($buildClientOnStartup -and -not $didBuildClient) {
    $buildProc = Build-Client
    Write-StartupLog "Client build exit code: $($buildProc.ExitCode)"
    $didBuildClient = $true
  }
  
  $serverProcess = Start-Server
  Write-StartupLog "Server PID: $($serverProcess.Id)"
  while ($true) {
    $serverAlive = Get-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
    if (-not $serverAlive) {
      break
    }
    Start-Sleep -Seconds 2
  }
  Write-StartupLog 'Detected server exit; restarting'
  if ($serverProcess -and -not $serverProcess.HasExited) {
    try { $serverProcess.Kill() } catch {}
  }

  Start-Sleep -Seconds 3
}
