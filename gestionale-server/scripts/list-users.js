require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const Logger = require('../utils/loggerWinston');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestionale.db');

// Connessione al database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

try {
  Logger.info('Recupero lista utenti...');
  
  const users = db.prepare('SELECT id, username, role, email, nome, cognome, rimborso_km FROM utenti ORDER BY username').all();
  
  if (users.length === 0) {
    console.log('❌ Nessun utente trovato nel database.');
  } else {
    console.log(`\n✅ Trovati ${users.length} utente/i:\n`);
    users.forEach(user => {
      console.log(`  Username: ${user.username}`);
      console.log(`  Ruolo: ${user.role}`);
      console.log(`  Nome: ${user.nome || 'N/A'} ${user.cognome || 'N/A'}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Rimborso KM: €${user.rimborso_km || 0}`);
      console.log(`  Password hash presente: ${db.prepare('SELECT password_hash FROM utenti WHERE id = ?').get(user.id)?.password_hash ? 'Sì' : 'No'}`);
      console.log('');
    });
  }
  
} catch (error) {
  Logger.error('Errore durante il recupero degli utenti:', error);
  console.error('❌ Errore:', error.message);
  process.exit(1);
} finally {
  db.close();
}



