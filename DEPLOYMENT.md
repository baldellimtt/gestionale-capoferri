# Guida all'Installazione e Configurazione in Produzione

Questa guida spiega come configurare le variabili d'ambiente per l'installazione dell'applicazione su un PC di produzione.

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Configurazione Server](#configurazione-server)
3. [Configurazione Client](#configurazione-client)
4. [Installazione Completa](#installazione-completa)
5. [Verifica e Test](#verifica-e-test)
6. [Sicurezza in Produzione](#sicurezza-in-produzione)

---

## 🎯 Panoramica

L'applicazione è composta da due parti:
- **Server** (Backend): Gestisce API, database, autenticazione
- **Client** (Frontend): Interfaccia utente React

Entrambi hanno file `.env` per configurare le variabili d'ambiente.

---

## 🔧 Configurazione Server

### 1. Crea il file `.env` nel server

Nella directory `gestionale-server/`, crea un file chiamato `.env`:

```bash
cd gestionale-server
cp .env.example .env
# Oppure crea manualmente il file .env
```

### 2. Modifica le variabili d'ambiente

Apri il file `.env` e configura i valori:

#### ⚠️ VARIABILI CRITICHE (da modificare obbligatoriamente)

```env
# Ambiente
NODE_ENV=production

# Porta del server
PORT=3001

# ⚠️ IMPORTANTE: Cambia questi segreti!
JWT_SECRET=tua-chiave-secreta-sicura-di-almeno-64-caratteri
JWT_REFRESH_SECRET=tua-chiave-refresh-secreta-sicura-di-almeno-64-caratteri

# Database - usa un percorso assoluto in produzione
DB_PATH=C:\gestionale\data\gestionale.db
# Oppure su Linux/Mac:
# DB_PATH=/var/gestionale/data/gestionale.db

# CORS - specifica l'URL del client
CORS_ORIGIN=http://localhost:5173
# Oppure se usi un IP:
# CORS_ORIGIN=http://192.168.1.100:5173
```

#### 📝 Altre variabili importanti

```env
# Backup
BACKUP_ENABLED=true
BACKUP_DIR=C:\gestionale\backups
BACKUP_INTERVAL_HOURS=24
MAX_BACKUPS=30

# Upload
UPLOAD_DIR=C:\gestionale\uploads
UPLOAD_MAX_SIZE_MB=50

# Logging
LOG_LEVEL=info
LOG_DIR=C:\gestionale\logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Genera chiavi JWT sicure

**IMPORTANTE**: Non usare mai i valori di default `dev-secret-change-in-production`!

Per generare chiavi sicure:

```bash
# Su Windows (PowerShell)
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))

# Su Linux/Mac
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Oppure usa un generatore online di stringhe casuali (almeno 64 caratteri).

### 4. Struttura directory consigliata

Crea le directory necessarie:

```bash
# Windows (PowerShell come Amministratore)
mkdir C:\gestionale
mkdir C:\gestionale\data
mkdir C:\gestionale\backups
mkdir C:\gestionale\uploads
mkdir C:\gestionale\logs

# Linux/Mac
sudo mkdir -p /var/gestionale/{data,backups,uploads,logs}
sudo chown -R $USER:$USER /var/gestionale
```

---

## 💻 Configurazione Client

### 1. Crea il file `.env` nel client

Nella directory `gestionale-client/`, crea un file chiamato `.env`:

```bash
cd gestionale-client
cp .env.example .env
```

### 2. Configura l'URL dell'API

Apri il file `.env` e imposta l'URL del server:

```env
# URL del server API
# Sostituisci localhost con l'IP o dominio del server
VITE_API_URL=http://localhost:3001/api

# Se il server è su un altro PC nella rete:
# VITE_API_URL=http://192.168.1.100:3001/api

# Se usi un dominio:
# VITE_API_URL=https://gestionale.example.com/api
```

⚠️ **Nota**: Il client deve poter raggiungere il server. Se sono su PC diversi:
- Assicurati che la porta del server sia aperta nel firewall
- Usa l'IP locale del server invece di `localhost`

---

## 🚀 Installazione Completa

### Step 1: Prepara il server

```bash
# Vai nella directory del server
cd gestionale-server

# Installa le dipendenze
npm install

# Crea il file .env (vedi sezione sopra)
# Modifica .env con i tuoi valori

# Crea le directory necessarie
mkdir -p data backups uploads logs

# Avvia il server
npm start
```

### Step 2: Prepara il client

```bash
# Vai nella directory del client
cd gestionale-client

# Installa le dipendenze
npm install

# Crea il file .env (vedi sezione sopra)
# Modifica .env con l'URL del server

# Build per produzione
npm run build

# Il risultato sarà in gestionale-client/dist/
```

### Step 3: Distribuzione

#### Opzione A: Sviluppo/Test locale
- Server: `npm start` nella directory server
- Client: `npm run dev` nella directory client

#### Opzione B: Produzione
- Server: Usa un process manager come PM2:
  ```bash
  npm install -g pm2
  pm2 start server.js --name gestionale-server
  pm2 save
  pm2 startup
  ```
- Client: Servi i file statici da `dist/` con un web server (nginx, Apache, o semplicemente `npm run preview`)

---

## ✅ Verifica e Test

### 1. Verifica Server

```bash
# Avvia il server
cd gestionale-server
npm start

# Dovresti vedere:
# Server avviato su porta 3001
# Database inizializzato
# Backup service avviato (se abilitato)
```

Controlla che il server risponda:
```bash
# Da un altro terminale
curl http://localhost:3001/api/health
# Oppure apri nel browser: http://localhost:3001/api/health
```

### 2. Verifica Client

```bash
# Build del client
cd gestionale-client
npm run build

# Preview del build
npm run preview

# Dovresti poter accedere all'app su http://localhost:4173
```

### 3. Test di connessione

1. Apri il client nel browser
2. Prova a fare login
3. Verifica che le API funzionino (vedi console browser per errori)

---

## 🔒 Sicurezza in Produzione

### ⚠️ Checklist sicurezza

- [ ] ✅ Cambia `JWT_SECRET` e `JWT_REFRESH_SECRET` con valori sicuri
- [ ] ✅ Imposta `NODE_ENV=production`
- [ ] ✅ Configura `CORS_ORIGIN` con l'URL corretto (non usare `*`)
- [ ] ✅ Usa percorsi assoluti per database, backup, upload
- [ ] ✅ Imposta `LOG_LEVEL=info` o `warn` in produzione
- [ ] ✅ Abilita backup automatico (`BACKUP_ENABLED=true`)
- [ ] ✅ Configura il firewall per aprire solo le porte necessarie
- [ ] ✅ Usa HTTPS se possibile (in futuro)
- [ ] ✅ Non committare mai il file `.env` nel repository

### 🔐 Gestione file .env

**NON committare mai** i file `.env` nel repository Git!

I file `.env.example` contengono solo esempi senza valori sensibili.

### 📂 Permessi file

Assicurati che il server abbia i permessi di scrittura su:
- Directory database (`data/`)
- Directory backup (`backups/`)
- Directory upload (`uploads/`)
- Directory log (`logs/`)

---

## 🆘 Risoluzione Problemi

### Server non si avvia

1. Verifica che la porta non sia già in uso:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # Linux/Mac
   lsof -i :3001
   ```

2. Controlla i log in `logs/` per errori

3. Verifica che tutte le directory esistano

### Client non si connette al server

1. Verifica che `VITE_API_URL` in `.env` del client sia corretto
2. Controlla che il server sia avviato
3. Verifica il firewall
4. Controlla CORS nel server (`CORS_ORIGIN` deve includere l'URL del client)

### Database non trovato

1. Verifica il percorso `DB_PATH` in `.env`
2. Assicurati che la directory esista
3. Controlla i permessi di scrittura

---

## 📚 Risorse Aggiuntive

- Documentazione Winston (logging): https://github.com/winstonjs/winston
- Documentazione dotenv: https://github.com/motdotla/dotenv
- Documentazione Vite: https://vitejs.dev/
- PM2 (Process Manager): https://pm2.keymetrics.io/

---

## 📞 Supporto

Per problemi o domande, consulta i log in `gestionale-server/logs/` per dettagli sugli errori.

