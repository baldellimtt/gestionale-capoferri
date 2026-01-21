const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const migrations = require('./migrations');
const Logger = require('../utils/loggerWinston');

class DatabaseManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.ensureDataDir();
    this.db = new Database(dbPath);
    this.init();
  }

  ensureDataDir() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  init() {
    // Attiva WAL mode per migliore concorrenza
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    // Esegui migrations
    migrations.run(this.db);
    
    // Configurazioni aggiuntive per performance e sicurezza
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
    
    Logger.info('Database inizializzato', { path: this.dbPath });
  }

  getDb() {
    return this.db;
  }

  close() {
    if (this.db && this.db.open) {
      this.db.close();
      Logger.info('Connessione database chiusa');
    }
  }

  backup(backupPath) {
    return this.db.backup(backupPath)
      .then(() => {
        Logger.info('Backup database completato', { path: backupPath });
        return backupPath;
      })
      .catch((err) => {
        Logger.error('Errore backup database', { path: backupPath, error: err.message });
        throw err;
      });
  }
}

module.exports = DatabaseManager;



