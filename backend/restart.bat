@echo off
echo 🔄 Restarting Backend Server...
echo.

echo 🛑 Stopping all Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo ✅ Node processes stopped
echo.

echo 🚀 Starting backend server...
echo.

cd /d "%~dp0"
npm start
