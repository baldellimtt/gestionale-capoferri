require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const Logger = require('../utils/loggerWinston');
const { hashPassword } = require('../utils/auth');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestionale.db');

// Connessione al database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

try {
  const username = process.argv[2];
  const newPassword = (process.argv[3] || '').trim();

  if (!username || !newPassword) {
    console.error('Uso: node scripts/reset-password.js <username> <nuova_password>');
    process.exit(1);
  }

  if (newPassword.length < 12) {
    console.error('La nuova password deve avere almeno 12 caratteri.');
    process.exit(1);
  }
  
  Logger.info('Reset password in corso...', { username });
  
  // Verifica se l'utente esiste
  const user = db.prepare('SELECT id, username FROM utenti WHERE username = ?').get(username);
  
  if (!user) {
    Logger.error('Utente non trovato', { username });
    console.error(`❌ Utente "${username}" non trovato nel database.`);
    console.log('\nUtenti disponibili:');
    const allUsers = db.prepare('SELECT id, username, role FROM utenti').all();
    allUsers.forEach(u => {
      console.log(`  - ${u.username} (${u.role})`);
    });
    process.exit(1);
  }
  
  // Genera nuovo hash e salt
  const { hash, salt } = hashPassword(newPassword);
  
  // Aggiorna la password
  const updateStmt = db.prepare(`
    UPDATE utenti 
    SET password_hash = ?, password_salt = ?, updated_at = datetime('now', 'localtime')
    WHERE username = ?
  `);
  
  const result = updateStmt.run(hash, salt, username);
  
  if (result.changes > 0) {
    Logger.info('Password resettata con successo', { username });
    console.log(`✅ Password resettata con successo per l'utente "${username}"`);
  } else {
    Logger.error('Errore durante il reset della password', { username });
    console.error(`❌ Errore durante il reset della password`);
    process.exit(1);
  }
  
} catch (error) {
  Logger.error('Errore durante il reset della password:', error);
  console.error('❌ Errore:', error.message);
  process.exit(1);
} finally {
  db.close();
}

