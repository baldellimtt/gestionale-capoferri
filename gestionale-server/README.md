# Gestionale Studio Capoferri - Backend Server

Backend server con SQLite per il gestionale Studio Capoferri.

## Struttura

```
gestionale-server/
├── db/
│   ├── database.js      # Gestione connessione database
│   └── migrations.js     # Schema database
├── routes/
│   ├── clienti.js       # API clienti
│   └── attivita.js      # API attività
├── services/
│   └── backup.js        # Servizio backup automatico
├── utils/
│   └── logger.js        # Logger centralizzato
├── server.js            # Entry point
└── package.json
```

## Installazione

```bash
npm install
```

## Configurazione

Crea un file `.env` nella root del progetto e configura le variabili:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/gestionale.db

# Backup
BACKUP_DIR=./backups
BACKUP_INTERVAL_HOURS=24
MAX_BACKUPS=30
BACKUP_ENABLED=true

# Logging Configuration
# Log levels: error, warn, info, verbose, debug, silly
# In production, usa 'info' o 'warn' per ridurre i log
# In development, usa 'debug' per log dettagliati
LOG_LEVEL=info

# Directory per i log (default: ./logs)
LOG_DIR=./logs

# Dimensione massima file di log prima della rotazione (es: 20m, 50m, 100m)
LOG_MAX_SIZE=20m

# Numero di giorni di log da mantenere (es: 7d, 14d, 30d) o numero di file (es: 10)
LOG_MAX_FILES=14d

# Pattern data per rotazione log (default: YYYY-MM-DD)
LOG_DATE_PATTERN=YYYY-MM-DD
```

### Sistema di Logging

Il sistema di logging utilizza **Winston** con le seguenti caratteristiche:

- **Log strutturato JSON**: Tutti i log vengono salvati in formato JSON per facilitare l'analisi
- **Rotazione automatica**: I log vengono ruotati giornalmente e compressi automaticamente
- **Log level configurabile**: Imposta `LOG_LEVEL` per controllare la verbosità dei log
- **File separati**: 
  - `error.log` - Solo errori
  - `combined.log` - Tutti i log
  - `exceptions.log` - Eccezioni non gestite
  - `rejections.log` - Promise rejection non gestite

I log vengono salvati nella directory `./logs` (configurabile con `LOG_DIR`).

## Avvio

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Backup

### Backup manuale
```bash
npm run backup
```

### Backup automatico (watch mode)
```bash
npm run backup:watch
```

### Lista backup
```bash
npm run backup:list
```

### Ripristina backup
```bash
npm run backup:restore <nome-backup>
```

## API Endpoints

### Clienti
- `GET /api/clienti` - Lista clienti (query: `?search=term`)
- `GET /api/clienti/:id` - Dettaglio cliente
- `POST /api/clienti` - Crea cliente
- `PUT /api/clienti/:id` - Aggiorna cliente
- `DELETE /api/clienti/:id` - Elimina cliente

### Attività
- `GET /api/attivita` - Lista attività (query: `?filter=month&month=2026-01` o `?startDate=...&endDate=...`)
- `GET /api/attivita/:id` - Dettaglio attività
- `GET /api/attivita/totals` - Totali periodo (query: `?startDate=...&endDate=...`)
- `POST /api/attivita` - Crea attività
- `PUT /api/attivita/:id` - Aggiorna attività
- `DELETE /api/attivita/:id` - Elimina attività

## Database

Il database SQLite viene creato automaticamente al primo avvio. Il file si trova in `./data/gestionale.db`.

### Schema

**clienti**: id, denominazione, paese, codice_destinatario_sdi, indirizzo, comune, cap, provincia, partita_iva, codice_fiscale, created_at, updated_at

**attivita**: id, data, cliente_id, cliente_nome, attivita, km, indennita, created_at, updated_at



