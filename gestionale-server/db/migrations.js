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

      -- Tabella Contatti Clienti
      CREATE TABLE IF NOT EXISTS clienti_contatti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        nome TEXT,
        ruolo TEXT,
        telefono TEXT,
        email TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE CASCADE
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
      CREATE INDEX IF NOT EXISTS idx_clienti_contatti_cliente_id ON clienti_contatti(cliente_id);

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

      -- Tabella Dati Aziendali (singola riga)
      CREATE TABLE IF NOT EXISTS dati_aziendali (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        ragione_sociale TEXT,
        partita_iva TEXT,
        codice_fiscale TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Tabella Dati Fiscali (singola riga)
      CREATE TABLE IF NOT EXISTS dati_fiscali (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        codice_destinatario_sdi TEXT,
        pec TEXT,
        regime_fiscale TEXT,
        codice_ateco TEXT,
        numero_rea TEXT,
        provincia_rea TEXT,
        ufficio_iva TEXT,
        iban TEXT,
        banca TEXT,
        tipo_documento_predefinito TEXT,
        ritenuta_acconto REAL DEFAULT 0,
        rivalsa_inps REAL DEFAULT 0,
        cassa_previdenziale TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    this.ensureUserColumns(db);
    this.ensureCommesseColumns(db);
    this.ensureContattiColumns(db);
    this.ensureDefaultUser(db);
    this.ensureDatiAziendaliInitialized(db);
    this.ensureDatiFiscaliInitialized(db);

    console.log('[MIGRATIONS] Schema database creato/verificato');
  }

  ensureContattiColumns(db) {
    try {
      const columns = db.prepare('PRAGMA table_info(clienti_contatti)').all().map((col) => col.name);
      if (!columns.includes('ruolo')) {
        db.exec('ALTER TABLE clienti_contatti ADD COLUMN ruolo TEXT');
        console.log('[MIGRATIONS] Aggiunta colonna ruolo a clienti_contatti');
      }
    } catch (error) {
      // Tabella non esiste ancora, verrà creata con la migrazione principale
      console.log('[MIGRATIONS] Tabella clienti_contatti non ancora creata');
    }
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

  ensureDatiAziendaliInitialized(db) {
    const existing = db.prepare('SELECT id FROM dati_aziendali WHERE id = 1').get();
    if (!existing) {
      db.prepare(`
        INSERT INTO dati_aziendali (id, ragione_sociale, partita_iva, codice_fiscale)
        VALUES (1, '', '', '')
      `).run();
    }
  }

  ensureDatiFiscaliInitialized(db) {
    const existing = db.prepare('SELECT id FROM dati_fiscali WHERE id = 1').get();
    if (!existing) {
      db.prepare(`
        INSERT INTO dati_fiscali (id, codice_destinatario_sdi, pec, regime_fiscale, codice_ateco, numero_rea, provincia_rea, ufficio_iva, iban, banca, tipo_documento_predefinito, ritenuta_acconto, rivalsa_inps, cassa_previdenziale)
        VALUES (1, '', '', '', '', '', '', '', '', '', '', 0, 0, '')
      `).run();
    } else {
      // Migrazione: aggiungi colonne se non esistono
      const columns = db.prepare('PRAGMA table_info(dati_fiscali)').all().map((col) => col.name);
      const addColumn = (name, type, def = null) => {
        if (!columns.includes(name)) {
          const defaultClause = def == null ? '' : ` DEFAULT ${def}`;
          db.exec(`ALTER TABLE dati_fiscali ADD COLUMN ${name} ${type}${defaultClause}`);
        }
      };
      addColumn('codice_destinatario_sdi', 'TEXT');
      addColumn('pec', 'TEXT');
      addColumn('regime_fiscale', 'TEXT');
      addColumn('codice_ateco', 'TEXT');
      addColumn('numero_rea', 'TEXT');
      addColumn('provincia_rea', 'TEXT');
      addColumn('ufficio_iva', 'TEXT');
      addColumn('iban', 'TEXT');
      addColumn('banca', 'TEXT');
      addColumn('tipo_documento_predefinito', 'TEXT');
      addColumn('ritenuta_acconto', 'REAL', 0);
      addColumn('rivalsa_inps', 'REAL', 0);
      addColumn('cassa_previdenziale', 'TEXT');
    }
  }
}

module.exports = new Migrations();






