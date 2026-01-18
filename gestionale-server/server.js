const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const DatabaseManager = require('./db/database');
const Logger = require('./utils/logger');
const BackupService = require('./services/backup');

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'gestionale.db');

// Inizializza database
const dbManager = new DatabaseManager(DB_PATH);
const db = dbManager.getDb();

// Inizializza Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/clienti', require('./routes/clienti')(db));
app.use('/api/attivita', require('./routes/attivita')(db));

// Error handling middleware
app.use((err, req, res, next) => {
  Logger.error('Errore non gestito', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Errore interno del server' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// Inizializza backup automatico
const backupService = new BackupService();
const BACKUP_INTERVAL_HOURS = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24');
const BACKUP_INTERVAL_MS = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;

// Backup iniziale
backupService.createBackup().catch(err => {
  Logger.error('Errore backup iniziale', err);
});

// Backup periodico
setInterval(() => {
  backupService.createBackup().catch(err => {
    Logger.error('Errore backup periodico', err);
  });
}, BACKUP_INTERVAL_MS);

Logger.info(`Backup automatico configurato (ogni ${BACKUP_INTERVAL_HOURS} ore)`);

// Avvia server
app.listen(PORT, () => {
  Logger.info(`Server avviato su porta ${PORT}`);
  Logger.info(`Database: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  Logger.info('Chiusura server...');
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Chiusura server...');
  dbManager.close();
  process.exit(0);
});

module.exports = app;


