# Auto-restart script for backend with session-based auth
Write-Host "🔄 Restarting Backend Server..." -ForegroundColor Cyan
Write-Host ""

# Kill all Node processes (this ensures old backend is stopped)
Write-Host "🛑 Stopping all Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "✅ Node processes stopped" -ForegroundColor Green
Write-Host ""

# Start backend
Write-Host "🚀 Starting backend server..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory and start
Set-Location $PSScriptRoot
npm start
