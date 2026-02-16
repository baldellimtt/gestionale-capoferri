require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const { hashPassword } = require('../utils/auth');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestionale.db');

const username = (process.argv[2] || '').trim();
const password = (process.argv[3] || '').trim();
const nome = (process.argv[4] || 'Admin').trim();
const cognome = (process.argv[5] || 'User').trim();

if (!username || !password) {
  console.error('Uso: node scripts/create-admin.js <username> <password> [nome] [cognome]');
  process.exit(1);
}

if (password.length < 12) {
  console.error('Password non valida: minimo 12 caratteri.');
  process.exit(1);
}

const db = new Database(DB_PATH);

try {
  const existing = db.prepare('SELECT id FROM utenti WHERE username = ?').get(username);
  if (existing) {
    console.error(`Utente gia esistente: ${username}`);
    process.exit(1);
  }

  const { hash, salt } = hashPassword(password);
  const result = db.prepare(`
    INSERT INTO utenti (username, role, password_hash, password_salt, rimborso_km, nome, cognome)
    VALUES (?, 'admin', ?, ?, 0, ?, ?)
  `).run(username, hash, salt, nome, cognome);

  console.log(`Admin creato con successo. id=${result.lastInsertRowid}, username=${username}`);
} finally {
  db.close();
}
