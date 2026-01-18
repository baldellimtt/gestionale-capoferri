require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const Logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestionale.db');

// Connessione al database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

try {
  Logger.info('Inizio reset attività...');
  
  // 1. Elimina TUTTE le righe
  const deleteAll = db.prepare('DELETE FROM attivita');
  const result = deleteAll.run();
  Logger.info(`Eliminate ${result.changes} righe dal database`);
  
  // 2. Calcola le date (oggi, ieri, l'altro ieri)
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayBefore = new Date(today);
  dayBefore.setDate(dayBefore.getDate() - 2);
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const dates = [
    { date: formatDate(today), label: 'Oggi' },
    { date: formatDate(yesterday), label: 'Ieri' },
    { date: formatDate(dayBefore), label: 'L\'altro ieri' }
  ];
  
  // 3. Crea le righe per le 3 date
  const create = db.prepare(`
    INSERT INTO attivita (
      data, cliente_id, cliente_nome, attivita, km, indennita
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insert = db.transaction((dates) => {
    for (const { date } of dates) {
      create.run(date, null, '', '', 0, 0);
    }
  });
  
  insert(dates);
  
  Logger.info(`Create ${dates.length} righe: ${dates.map(d => d.label).join(', ')}`);
  Logger.info('Reset completato con successo!');
  
} catch (error) {
  Logger.error('Errore durante il reset:', error);
  process.exit(1);
} finally {
  db.close();
}



