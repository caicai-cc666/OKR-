$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Port = 3001
$LogDir = Join-Path $ProjectRoot ".logs"
$OutLog = Join-Path $LogDir "next-dev-3001.out.log"
$ErrLog = Join-Path $LogDir "next-dev-3001.err.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-StartupLog {
  param([string]$Message)
  try {
    Add-Content -Path $OutLog -Value $Message -ErrorAction Stop
  } catch {
    # The dev server may already hold the redirected log file open.
  }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-StartupLog "[$timestamp] OKR dev server already listening on port $Port. Startup task exits."
  exit 0
}

Write-StartupLog "[$timestamp] Starting OKR dev server on http://localhost:$Port ..."
Set-Location $ProjectRoot
$env:PORT = "$Port"

& npm.cmd run dev -- --port $Port 1>> $OutLog 2>> $ErrLog
