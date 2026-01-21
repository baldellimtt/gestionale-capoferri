#!/bin/bash

echo ""
echo "========================================"
echo " Gestionale Studio Capoferri"
echo " Avvio Server e Client"
echo "========================================"
echo ""

# Vai alla directory dello script
cd "$(dirname "$0")"

# Verifica che Node.js sia installato
if ! command -v node &> /dev/null; then
    echo "ERRORE: Node.js non trovato. Installa Node.js da https://nodejs.org"
    exit 1
fi

# Verifica che npm sia installato
if ! command -v npm &> /dev/null; then
    echo "ERRORE: npm non trovato. Installa Node.js che include npm."
    exit 1
fi

# Avvia lo script Node.js
node scripts/start-dev.js




