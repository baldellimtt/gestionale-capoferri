#!/bin/bash

echo "========================================"
echo "Riavvio Gestionale Capoferri"
echo "========================================"
echo ""

echo "[1/3] Chiusura processi Node.js esistenti..."
pkill -f "node.*server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "node.*start-dev.js" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "Processi Node.js chiusi con successo"
else
    echo "Nessun processo Node.js trovato"
fi

echo ""
echo "[2/3] Attesa chiusura porte..."
sleep 3

echo ""
echo "[3/3] Avvio applicazione..."
echo ""

# Avvia server in background
cd gestionale-server
npm run dev > ../logs/server.log 2>&1 &
SERVER_PID=$!
cd ..

# Attesa breve prima di avviare client
sleep 2

# Avvia client in background
cd gestionale-client
npm run dev > ../logs/client.log 2>&1 &
CLIENT_PID=$!
cd ..

echo ""
echo "========================================"
echo "Applicazione avviata!"
echo "========================================"
echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
echo "Server: http://localhost:3001"
echo "Client: http://localhost:5173"
echo ""
echo "Logs disponibili in:"
echo "  - logs/server.log"
echo "  - logs/client.log"
echo ""
echo "Premi Ctrl+C per fermare l'applicazione..."

# Crea directory logs se non esiste
mkdir -p logs

# Attendi terminazione
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
wait



