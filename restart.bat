@echo off
echo ========================================
echo Riavvio Gestionale Capoferri
echo ========================================
echo.

echo [1/3] Chiusura processi Node.js esistenti...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Processi Node.js chiusi con successo
) else (
    echo Nessun processo Node.js trovato
)
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Attesa chiusura porte...
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Avvio applicazione...
echo.
start "Gestionale Server" cmd /k "cd gestionale-server && npm run dev"
timeout /t 2 /nobreak >nul
start "Gestionale Client" cmd /k "cd gestionale-client && npm run dev"

echo.
echo ========================================
echo Applicazione avviata!
echo ========================================
echo Server: http://localhost:3001
echo Client: http://localhost:5173
echo.
echo Premi un tasto per chiudere questa finestra...
pause >nul




