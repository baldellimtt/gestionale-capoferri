$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $root 'gestionale-server'
$clientPath = Join-Path $root 'gestionale-client'
$logDir = Join-Path $root 'logs'
$null = New-Item -Path $logDir -ItemType Directory -Force
$serverOutLog = Join-Path $logDir 'server.out.log'
$serverErrLog = Join-Path $logDir 'server.err.log'
$clientOutLog = Join-Path $logDir 'client.out.log'
$clientErrLog = Join-Path $logDir 'client.err.log'
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
$clientCommand = 'set NO_COLOR=1&& set FORCE_COLOR=0&& set VITE_PORT=80&& set VITE_HOST=0.0.0.0&& set VITE_API_BASE_URL=/api&& set VITE_API_PROXY_TARGET=http://localhost:3001&& npm run dev'

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
  return Start-Process -FilePath $npm -ArgumentList 'run', 'dev' -WorkingDirectory $serverPath -WindowStyle Hidden -RedirectStandardOutput $serverOutLog -RedirectStandardError $serverErrLog -PassThru
}

function Start-Client {
  Write-StartupLog 'Starting client process'
  return Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $clientCommand -WorkingDirectory $clientPath -WindowStyle Hidden -RedirectStandardOutput $clientOutLog -RedirectStandardError $clientErrLog -PassThru
}

while ($true) {
  Stop-PortListeners -Port 80
  Stop-PortListeners -Port 3001

  $serverProcess = Start-Server
  Start-Sleep -Seconds 2
  $clientProcess = Start-Client

  Write-StartupLog "Server PID: $($serverProcess.Id); Client PID: $($clientProcess.Id)"
  while ($true) {
    $serverAlive = Get-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
    $clientAlive = Get-Process -Id $clientProcess.Id -ErrorAction SilentlyContinue
    if (-not $serverAlive -or -not $clientAlive) {
      break
    }
    Start-Sleep -Seconds 2
  }
  Write-StartupLog 'Detected process exit; restarting both'

  foreach ($proc in @($serverProcess, $clientProcess)) {
    if ($proc -and -not $proc.HasExited) {
      try { $proc.Kill() } catch {}
    }
  }

  Start-Sleep -Seconds 3
}
