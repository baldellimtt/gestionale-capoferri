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

Copia `.env.example` in `.env` e modifica le variabili:

```env
PORT=3001
NODE_ENV=development
DB_PATH=./data/gestionale.db
BACKUP_DIR=./backups
BACKUP_INTERVAL_HOURS=24
MAX_BACKUPS=30
```

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



