const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const migrations = require('./migrations');

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
    
    console.log('[DB] Database inizializzato:', this.dbPath);
  }

  getDb() {
    return this.db;
  }

  close() {
    this.db.close();
    console.log('[DB] Connessione chiusa');
  }

  backup(backupPath) {
    this.db.backup(backupPath)
      .then(() => {
        console.log('[DB] Backup completato:', backupPath);
      })
      .catch((err) => {
        console.error('[DB] Errore backup:', err);
        throw err;
      });
  }
}

module.exports = DatabaseManager;

