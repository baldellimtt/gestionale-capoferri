const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './data/gestionale.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30');

class BackupService {
  constructor() {
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  generateBackupFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `backup-${timestamp}.db`;
  }

  async createBackup() {
    if (!fs.existsSync(DB_PATH)) {
      console.log('[BACKUP] Database non trovato, nessun backup necessario');
      return null;
    }

    const backupFilename = this.generateBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    try {
      const db = new Database(DB_PATH);
      await db.backup(backupPath);
      db.close();

      console.log(`[BACKUP] Backup creato: ${backupPath}`);
      this.cleanOldBackups();
      return backupPath;
    } catch (error) {
      console.error('[BACKUP] Errore durante il backup:', error);
      throw error;
    }
  }

  cleanOldBackups() {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .map(f => ({
          name: f,
          path: path.join(BACKUP_DIR, f),
          time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > MAX_BACKUPS) {
        const toDelete = files.slice(MAX_BACKUPS);
        toDelete.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`[BACKUP] Backup vecchio eliminato: ${file.name}`);
        });
      }
    } catch (error) {
      console.error('[BACKUP] Errore durante pulizia backup:', error);
    }
  }

  listBackups() {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .map(f => {
          const filePath = path.join(BACKUP_DIR, f);
          const stats = fs.statSync(filePath);
          return {
            filename: f,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      return files;
    } catch (error) {
      console.error('[BACKUP] Errore durante list backup:', error);
      return [];
    }
  }

  async restore(backupFilename) {
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup non trovato: ${backupFilename}`);
    }

    try {
      // Crea backup del database corrente prima del restore
      const currentBackup = this.generateBackupFilename().replace('backup-', 'pre-restore-');
      const currentBackupPath = path.join(BACKUP_DIR, currentBackup);
      
      if (fs.existsSync(DB_PATH)) {
        const db = new Database(DB_PATH);
        await db.backup(currentBackupPath);
        db.close();
        console.log(`[BACKUP] Backup pre-restore creato: ${currentBackupPath}`);
      }

      // Copia il backup sul database
      fs.copyFileSync(backupPath, DB_PATH);
      console.log(`[BACKUP] Database ripristinato da: ${backupFilename}`);
      return true;
    } catch (error) {
      console.error('[BACKUP] Errore durante restore:', error);
      throw error;
    }
  }
}

// CLI handling
if (require.main === module) {
  const backupService = new BackupService();
  const args = process.argv.slice(2);

  if (args.includes('--watch')) {
    const intervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24');
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`[BACKUP] Modalità watch attiva (backup ogni ${intervalHours} ore)`);
    backupService.createBackup();
    setInterval(() => {
      backupService.createBackup();
    }, intervalMs);
  } else if (args.includes('--list')) {
    const backups = backupService.listBackups();
    console.log('\n[BACKUP] Backup disponibili:');
    backups.forEach((backup, index) => {
      const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
      console.log(`${index + 1}. ${backup.filename} (${sizeMB} MB) - ${backup.modified}`);
    });
  } else if (args.includes('--restore')) {
    const backupIndex = args.indexOf('--restore') + 1;
    const backupName = args[backupIndex];
    if (!backupName) {
      console.error('[BACKUP] Specifica il nome del backup da ripristinare');
      process.exit(1);
    }
    backupService.restore(backupName)
      .then(() => {
        console.log('[BACKUP] Restore completato con successo');
        process.exit(0);
      })
      .catch(err => {
        console.error('[BACKUP] Errore restore:', err);
        process.exit(1);
      });
  } else {
    backupService.createBackup()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('[BACKUP] Errore:', err);
        process.exit(1);
      });
  }
}

module.exports = BackupService;



