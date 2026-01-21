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

      -- Tabella Colonne Kanban
      CREATE TABLE IF NOT EXISTS kanban_colonne (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        ordine INTEGER NOT NULL,
        colore TEXT,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Tabella Card Kanban
      CREATE TABLE IF NOT EXISTS kanban_card (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commessa_id INTEGER,
        titolo TEXT NOT NULL,
        descrizione TEXT,
        colonna_id INTEGER NOT NULL,
        priorita TEXT DEFAULT 'media',
        responsabile_id INTEGER,
        cliente_id INTEGER,
        cliente_nome TEXT,
        ordine INTEGER DEFAULT 0,
        avanzamento INTEGER DEFAULT 0,
        data_inizio TEXT,
        data_fine_prevista TEXT,
        data_fine_effettiva TEXT,
        budget REAL DEFAULT 0,
        tags TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE SET NULL,
        FOREIGN KEY (colonna_id) REFERENCES kanban_colonne(id) ON DELETE RESTRICT,
        FOREIGN KEY (responsabile_id) REFERENCES utenti(id) ON DELETE SET NULL,
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES utenti(id) ON DELETE SET NULL
      );

      -- Tabella Scadenze Kanban
      CREATE TABLE IF NOT EXISTS kanban_scadenze (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL,
        titolo TEXT NOT NULL,
        descrizione TEXT,
        data_scadenza TEXT NOT NULL,
        tipo TEXT,
        priorita TEXT DEFAULT 'media',
        completata INTEGER DEFAULT 0,
        data_completamento TEXT,
        completata_da INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
        FOREIGN KEY (completata_da) REFERENCES utenti(id) ON DELETE SET NULL
      );

      -- Tabella Notifiche Kanban
      CREATE TABLE IF NOT EXISTS kanban_notifiche (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        titolo TEXT NOT NULL,
        messaggio TEXT,
        card_id INTEGER,
        scadenza_id INTEGER,
        letto INTEGER DEFAULT 0,
        data_lettura TEXT,
        link TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
        FOREIGN KEY (scadenza_id) REFERENCES kanban_scadenze(id) ON DELETE CASCADE
      );

      -- Tabella Commenti Kanban
      CREATE TABLE IF NOT EXISTS kanban_card_commenti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        commento TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE
      );

      -- Indici per performance Kanban
      CREATE INDEX IF NOT EXISTS idx_kanban_card_colonna ON kanban_card(colonna_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_card_commessa ON kanban_card(commessa_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_card_responsabile ON kanban_card(responsabile_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_card_cliente ON kanban_card(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_card_created_at ON kanban_card(created_at);
      CREATE INDEX IF NOT EXISTS idx_kanban_scadenze_card ON kanban_scadenze(card_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_scadenze_data ON kanban_scadenze(data_scadenza);
      CREATE INDEX IF NOT EXISTS idx_kanban_notifiche_user ON kanban_notifiche(user_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_notifiche_letto ON kanban_notifiche(letto);
      CREATE INDEX IF NOT EXISTS idx_kanban_commenti_card ON kanban_card_commenti(card_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_commenti_user ON kanban_card_commenti(user_id);
      
      -- Indici per performance Commesse
      CREATE INDEX IF NOT EXISTS idx_commesse_data_inizio ON commesse(data_inizio);
      CREATE INDEX IF NOT EXISTS idx_commesse_stato_pagamenti ON commesse(stato_pagamenti);
      CREATE INDEX IF NOT EXISTS idx_commesse_stato ON commesse(stato);
      CREATE INDEX IF NOT EXISTS idx_commesse_cliente_id ON commesse(cliente_id);
    `);

    this.ensureUserColumns(db);
    this.ensureCommesseColumns(db);
    this.ensureContattiColumns(db);
    this.ensureKanbanColumns(db);
    this.ensureKanbanCommentiTable(db);
    this.ensureDefaultUser(db);
    this.ensureDatiAziendaliInitialized(db);
    this.ensureDatiFiscaliInitialized(db);

    console.log('[MIGRATIONS] Schema database creato/verificato');
  }

  ensureKanbanColumns(db) {
    try {
      // Verifica se esistono già colonne
      const existing = db.prepare('SELECT COUNT(*) as count FROM kanban_colonne').get();
      if (existing.count === 0) {
        // Inserisci colonne predefinite
        const colonne = [
          { nome: 'In Attesa', ordine: 1, colore: '#94a3b8', is_default: 1 },
          { nome: 'Progettazione', ordine: 2, colore: '#3b82f6', is_default: 1 },
          { nome: 'Calcolo Strutturale', ordine: 3, colore: '#8b5cf6', is_default: 1 },
          { nome: 'Documentazione', ordine: 4, colore: '#06b6d4', is_default: 1 },
          { nome: 'Pratiche', ordine: 5, colore: '#10b981', is_default: 1 },
          { nome: 'Approvazione', ordine: 6, colore: '#f59e0b', is_default: 1 },
          { nome: 'Esecuzione', ordine: 7, colore: '#ef4444', is_default: 1 },
          { nome: 'Collaudo', ordine: 8, colore: '#ec4899', is_default: 1 },
          { nome: 'Chiusura', ordine: 9, colore: '#6b7280', is_default: 1 }
        ];

        const stmt = db.prepare('INSERT INTO kanban_colonne (nome, ordine, colore, is_default) VALUES (?, ?, ?, ?)');
        colonne.forEach((colonna) => {
          stmt.run(colonna.nome, colonna.ordine, colonna.colore, colonna.is_default);
        });
        console.log('[MIGRATIONS] Colonne Kanban predefinite create');
      } else {
        // Aggiorna il nome "Backlog" a "In Attesa" se esiste
        const backlogColonna = db.prepare('SELECT id FROM kanban_colonne WHERE nome = ?').get('Backlog');
        if (backlogColonna) {
          db.prepare('UPDATE kanban_colonne SET nome = ? WHERE id = ?').run('In Attesa', backlogColonna.id);
          console.log('[MIGRATIONS] Colonna "Backlog" rinominata in "In Attesa"');
        }
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore inizializzazione colonne Kanban:', error.message);
    }
  }

  ensureKanbanCommentiTable(db) {
    try {
      // Verifica se la tabella esiste già
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kanban_card_commenti'").get();
      if (!tableInfo) {
        // La tabella verrà creata dalla migrazione principale
        console.log('[MIGRATIONS] Tabella kanban_card_commenti verrà creata dalla migrazione principale');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella commenti:', error.message);
    }
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






