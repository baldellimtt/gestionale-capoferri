@echo off
echo.
echo ========================================
echo  Gestionale Studio Capoferri
echo  Avvio Server e Client
echo ========================================
echo.

cd /d "%~dp0"

REM Verifica che Node.js sia installato
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Node.js non trovato. Installa Node.js da https://nodejs.org
    pause
    exit /b 1
)

REM Verifica che npm sia installato
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: npm non trovato. Installa Node.js che include npm.
    pause
    exit /b 1
)

REM Avvia lo script Node.js
node scripts/start-dev.js

pause




