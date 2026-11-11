@echo off
title Stop CF-Pump-Screener
echo Stopping local pump screener on port 8787...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Done.
timeout /t 2 >nul
