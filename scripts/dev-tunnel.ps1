# ============================================================
# dev-tunnel.ps1 - One-click dev server + Cloudflare Tunnel
# Usage: .\scripts\dev-tunnel.ps1  or  npm run tunnel
# ============================================================

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "=== Cleaning old processes ===" -ForegroundColor Cyan
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "=== Cleaning Turbopack cache ===" -ForegroundColor Cyan
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

Write-Host "=== Starting Next.js dev server ===" -ForegroundColor Cyan
$devJob = Start-Job -Name "NextDev" -ScriptBlock {
    Set-Location $using:projectRoot
    npm run dev 2>&1 | Out-File -FilePath "$using:projectRoot\.dev-server.log" -Append
}

Write-Host "Waiting for dev server..." -ForegroundColor Yellow
$maxWait = 60
for ($i = 0; $i -lt $maxWait; $i++) {
    try {
        $response = Invoke-WebRequest -Uri http://localhost:3000 -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "Dev server ready (localhost:3000)" -ForegroundColor Green
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($i -ge $maxWait) {
    Write-Host "Dev server startup timeout. Check .dev-server.log" -ForegroundColor Red
    exit 1
}

Write-Host "=== Starting Cloudflare Tunnel ===" -ForegroundColor Cyan
$tunnelJob = Start-Job -Name "CloudflareTunnel" -ScriptBlock {
    Set-Location $using:projectRoot
    cloudflared tunnel --url http://localhost:3000 2>&1
}

Write-Host "Waiting for tunnel URL..." -ForegroundColor Yellow
$tunnelUrl = $null
$maxWait = 30
for ($i = 0; $i -lt $maxWait; $i++) {
    $output = Receive-Job -Name "CloudflareTunnel" 2>$null
    if ($output -match "(https://[a-z0-9-]+\.trycloudflare\.com)") {
        $tunnelUrl = $matches[1]
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $tunnelUrl) {
    Write-Host "Tunnel startup timeout" -ForegroundColor Red
    exit 1
}

# Write URL to public directory for frontend access
$publicDir = Join-Path $projectRoot "public"
if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir | Out-Null
}
$tunnelUrl | Out-File -FilePath (Join-Path $publicDir "tunnel-url.txt") -Encoding utf8 -NoNewline

# Auto-copy to clipboard
$tunnelUrl | Set-Clipboard

# Open in default browser
Start-Process $tunnelUrl

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  TUNNEL URL COPIED TO CLIPBOARD!" -ForegroundColor Cyan
Write-Host "  Browser opened - verify then paste to team chat" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Local:  http://localhost:3000" -ForegroundColor White
Write-Host "  Public: $tunnelUrl" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Gray

# Keep alive - stream tunnel logs until Ctrl+C
try {
    while ($true) {
        $output = Receive-Job -Name "CloudflareTunnel" 2>$null
        if ($output) {
            Write-Host $output
        }
        Start-Sleep -Seconds 5
    }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job -Name "NextDev" -ErrorAction SilentlyContinue
    Stop-Job -Name "CloudflareTunnel" -ErrorAction SilentlyContinue
    Remove-Job -Name "NextDev" -ErrorAction SilentlyContinue
    Remove-Job -Name "CloudflareTunnel" -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Gray
}