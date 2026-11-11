@echo off
title CF-Pump-Screener Local Terminal
cd /d "%~dp0"
echo ==================================================
echo   Starting Local Pump.fun Screener & Terminal...
echo ==================================================
node --experimental-strip-types src/server.ts
pause
