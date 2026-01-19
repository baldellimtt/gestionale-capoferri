class Migrations {
  run(db) {
    db.exec(`
      -- Tabella Clienti
      CREATE TABLE IF NOT EXISTS clienti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        denominazione TEXT NOT NULL,
        paese TEXT,
        codice_destinatario_sdi TEXT,
        indirizzo TEXT,
        comune TEXT,
        cap TEXT,
        provincia TEXT,
        partita_iva TEXT,
        codice_fiscale TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Tabella Attività
      CREATE TABLE IF NOT EXISTS attivita (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        cliente_id INTEGER,
        cliente_nome TEXT,
        attivita TEXT,
        km REAL DEFAULT 0,
        indennita INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL
      );

      -- Indici per performance
      CREATE INDEX IF NOT EXISTS idx_attivita_data ON attivita(data);
      CREATE INDEX IF NOT EXISTS idx_attivita_cliente_id ON attivita(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_clienti_denominazione ON clienti(denominazione);

      -- Tabella Utenti
      CREATE TABLE IF NOT EXISTS utenti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        rimborso_km REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Tabella Sessioni
      CREATE TABLE IF NOT EXISTS sessioni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE
      );

      -- Tabella Commesse
      CREATE TABLE IF NOT EXISTS commesse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titolo TEXT NOT NULL,
        cliente_id INTEGER,
        cliente_nome TEXT,
        stato TEXT DEFAULT 'In corso',
        sotto_stato TEXT,
        stato_pagamenti TEXT,
        preventivo INTEGER DEFAULT 0,
        importo_preventivo REAL DEFAULT 0,
        importo_totale REAL DEFAULT 0,
        importo_pagato REAL DEFAULT 0,
        avanzamento_lavori INTEGER DEFAULT 0,
        responsabile TEXT,
        data_inizio TEXT,
        data_fine TEXT,
        note TEXT,
        allegati TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL
      );

      -- Tabella Allegati Commesse
      CREATE TABLE IF NOT EXISTS commesse_allegati (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commessa_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER DEFAULT 0,
        file_path TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE CASCADE
      );
    `);

    this.ensureUserColumns(db);
    this.ensureCommesseColumns(db);
    this.ensureDefaultUser(db);

    console.log('[MIGRATIONS] Schema database creato/verificato');
  }

  ensureUserColumns(db) {
    const columns = db.prepare('PRAGMA table_info(utenti)').all().map((col) => col.name);
    const addColumn = (name, type, def = null) => {
      if (!columns.includes(name)) {
        const defaultClause = def == null ? '' : ` DEFAULT ${def}`;
        db.exec(`ALTER TABLE utenti ADD COLUMN ${name} ${type}${defaultClause}`);
      }
    };

    addColumn('nome', 'TEXT');
    addColumn('cognome', 'TEXT');
    addColumn('mezzo', 'TEXT');
    addColumn('targa', 'TEXT');
    addColumn('email', 'TEXT');
    if (!columns.includes('rimborso_km')) {
      db.exec('ALTER TABLE utenti ADD COLUMN rimborso_km REAL DEFAULT 0');
    }
  }

  ensureCommesseColumns(db) {
    const columns = db.prepare('PRAGMA table_info(commesse)').all().map((col) => col.name);
    const addColumn = (name, type, def = null) => {
      if (!columns.includes(name)) {
        const defaultClause = def == null ? '' : ` DEFAULT ${def}`;
        db.exec(`ALTER TABLE commesse ADD COLUMN ${name} ${type}${defaultClause}`);
      }
    };

    addColumn('titolo', 'TEXT');
    addColumn('cliente_id', 'INTEGER');
    addColumn('cliente_nome', 'TEXT');
    addColumn('stato', 'TEXT', `'In corso'`);
    addColumn('sotto_stato', 'TEXT');
    addColumn('stato_pagamenti', 'TEXT');
    addColumn('preventivo', 'INTEGER', 0);
    addColumn('importo_preventivo', 'REAL', 0);
    addColumn('importo_totale', 'REAL', 0);
    addColumn('importo_pagato', 'REAL', 0);
    addColumn('avanzamento_lavori', 'INTEGER', 0);
    addColumn('responsabile', 'TEXT');
    addColumn('data_inizio', 'TEXT');
    addColumn('data_fine', 'TEXT');
    addColumn('note', 'TEXT');
    addColumn('allegati', 'TEXT');
  }

  ensureDefaultUser(db) {
    const { hashPassword } = require('../utils/auth');
    const existing = db.prepare('SELECT id FROM utenti WHERE username = ?').get('lcapoferri');

    if (!existing) {
      const { hash, salt } = hashPassword('rasputin123');
      db.prepare(`
        INSERT INTO utenti (username, role, password_hash, password_salt, rimborso_km, nome, cognome)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('lcapoferri', 'admin', hash, salt, 0, 'Luca', 'Capoferri');
    }
  }
}

module.exports = new Migrations();




