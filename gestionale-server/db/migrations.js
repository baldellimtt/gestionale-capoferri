class Migrations {
  run(db) {
    db.exec(`
      -- Tabella Clienti
      CREATE TABLE IF NOT EXISTS clienti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        denominazione TEXT NOT NULL,
        qualifica TEXT,
        nome TEXT,
        cognome TEXT,
        paese TEXT,
        codice_destinatario_sdi TEXT,
        indirizzo TEXT,
        comune TEXT,
        cap TEXT,
        provincia TEXT,
        partita_iva TEXT,
        codice_fiscale TEXT,
        email TEXT,
        pec TEXT,
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
        user_id INTEGER,
        cliente_id INTEGER,
        cliente_nome TEXT,
        attivita TEXT,
        km REAL DEFAULT 0,
        indennita INTEGER DEFAULT 0,
        note TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE SET NULL
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
        telefono TEXT,
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

      -- Tabella Refresh Tokens (JWT)
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        replaced_by_token_hash TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

      -- Tabella Commesse
      CREATE TABLE IF NOT EXISTS commesse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titolo TEXT NOT NULL,
        cliente_id INTEGER,
        cliente_nome TEXT,
        stato TEXT DEFAULT 'In corso',
        sotto_stato TEXT,
        stato_pagamenti TEXT,
        consuntivo_completato INTEGER DEFAULT 0,
        preventivo INTEGER DEFAULT 0,
        importo_preventivo REAL DEFAULT 0,
        importo_totale REAL DEFAULT 0,
        importo_pagato REAL DEFAULT 0,
        avanzamento_lavori INTEGER DEFAULT 0,
        monte_ore_stimato REAL,
        responsabile TEXT,
        ubicazione TEXT,
        data_inizio TEXT,
        data_fine TEXT,
        note TEXT,
        allegati TEXT,
        parent_commessa_id INTEGER,
        is_struttura INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_commessa_id) REFERENCES commesse(id) ON DELETE SET NULL
      );

      -- Tabella Cartelle Anno Commesse (per cliente)
      CREATE TABLE IF NOT EXISTS commesse_cartelle_anni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        anno INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        UNIQUE(cliente_id, anno),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE CASCADE
      );

      -- Tabella Note Spese
      CREATE TABLE IF NOT EXISTS note_spese (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        data TEXT,
        categoria TEXT,
        descrizione TEXT,
        importo REAL DEFAULT 0,
        metodo_pagamento TEXT,
        rimborsabile INTEGER DEFAULT 1,
        stato TEXT DEFAULT 'Bozza',
        allegato_nome TEXT,
        allegato_path TEXT,
        allegato_mime TEXT,
        allegato_size INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE
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
        version INTEGER DEFAULT 1,
        is_latest INTEGER DEFAULT 1,
        previous_id INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE CASCADE
      );

      -- Tabella Audit Commesse
      CREATE TABLE IF NOT EXISTS commesse_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commessa_id INTEGER NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        changes_json TEXT,
        kanban_card_ids TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE SET NULL
      );

      -- Tabella Tracking Ore Commesse
      CREATE TABLE IF NOT EXISTS commesse_ore (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commessa_id INTEGER NOT NULL,
        user_id INTEGER,
        data TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        durata_minuti INTEGER DEFAULT 0,
        note TEXT,
        source TEXT DEFAULT 'timer',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_commesse_audit_commessa_id ON commesse_audit(commessa_id);
      CREATE INDEX IF NOT EXISTS idx_commesse_audit_created_at ON commesse_audit(created_at);
      CREATE INDEX IF NOT EXISTS idx_commesse_cartelle_cliente_id ON commesse_cartelle_anni(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_commesse_cartelle_anno ON commesse_cartelle_anni(anno);

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

      -- Tabella Documenti Aziendali
      CREATE TABLE IF NOT EXISTS documenti_aziendali (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER DEFAULT 0,
        file_path TEXT NOT NULL,
        categoria TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_documenti_aziendali_created_at ON documenti_aziendali(created_at);

      -- Tabella Fatture (log locale fatture emesse via Fatture in Cloud)
      CREATE TABLE IF NOT EXISTS fatture (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fic_document_id TEXT,
        fic_company_id TEXT,
        cliente_id INTEGER,
        commessa_ids TEXT,
        numero TEXT,
        data TEXT,
        tipo_documento TEXT,
        stato TEXT,
        totale REAL DEFAULT 0,
        valuta TEXT,
        descrizione TEXT,
        payload_json TEXT,
        response_json TEXT,
        row_version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fatture_created_at ON fatture(created_at);
      CREATE INDEX IF NOT EXISTS idx_fatture_cliente_id ON fatture(cliente_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fatture_fic_unique ON fatture(fic_company_id, fic_document_id);

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
        colonna_id INTEGER,
        priorita TEXT DEFAULT 'media',
        responsabile_id INTEGER,
        cliente_id INTEGER,
        cliente_nome TEXT,
        ordine INTEGER DEFAULT 0,
        avanzamento INTEGER DEFAULT 0,
        data_inizio TEXT,
        data_fine_prevista TEXT,
        data_fine_effettiva TEXT,
        recurrence_enabled INTEGER DEFAULT 0,
        recurrence_type TEXT,
        budget REAL DEFAULT 0,
        tags TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE SET NULL,
        FOREIGN KEY (colonna_id) REFERENCES kanban_colonne(id) ON DELETE SET NULL,
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
      CREATE INDEX IF NOT EXISTS idx_commesse_ore_commessa_id ON commesse_ore(commessa_id);
      CREATE INDEX IF NOT EXISTS idx_commesse_ore_user_id ON commesse_ore(user_id);
      CREATE INDEX IF NOT EXISTS idx_commesse_ore_data ON commesse_ore(data);
      CREATE INDEX IF NOT EXISTS idx_commesse_ore_end_time ON commesse_ore(end_time);

      -- Indici per performance Note Spese
      CREATE INDEX IF NOT EXISTS idx_note_spese_user_id ON note_spese(user_id);
      CREATE INDEX IF NOT EXISTS idx_note_spese_data ON note_spese(data);
      CREATE INDEX IF NOT EXISTS idx_note_spese_categoria ON note_spese(categoria);
      CREATE INDEX IF NOT EXISTS idx_note_spese_stato ON note_spese(stato);

      -- Tabella richieste privacy (DSAR)
      CREATE TABLE IF NOT EXISTS privacy_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_type TEXT NOT NULL,
        requester_id INTEGER,
        requester_label TEXT,
        request_type TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        opened_at TEXT DEFAULT (datetime('now', 'localtime')),
        due_at TEXT,
        closed_at TEXT,
        notes TEXT,
        handled_by INTEGER,
        payload_json TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (handled_by) REFERENCES utenti(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status);
      CREATE INDEX IF NOT EXISTS idx_privacy_requests_due_at ON privacy_requests(due_at);
      CREATE INDEX IF NOT EXISTS idx_privacy_requests_request_type ON privacy_requests(request_type);

      -- Tabella inviti utenti
      CREATE TABLE IF NOT EXISTS user_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        invited_nome TEXT,
        invited_cognome TEXT,
        note TEXT,
        token_hash TEXT NOT NULL UNIQUE,
        invited_by INTEGER,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        revoked_at TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (invited_by) REFERENCES utenti(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
      CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON user_invites(expires_at);
      CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(used_at, revoked_at);
    `);

    this.ensureUserColumns(db);
    this.ensureAttivitaColumns(db);
    this.ensureClientiColumns(db);
    this.ensureCommesseColumns(db);
    this.ensureCommesseAllegatiColumns(db);
    this.ensureCommesseAuditTable(db);
    this.ensureContattiColumns(db);
    this.ensureKanbanColumns(db);
    this.ensureKanbanCommentiTable(db);
    this.ensureUserPresenceTable(db);
    this.ensureKanbanCardColumnNullable(db);
    this.ensureKanbanRecurrenceColumns(db);
    this.ensureRowVersionColumns(db);
    this.ensureDefaultUser(db);
    this.ensureDatiAziendaliInitialized(db);
    this.ensureDatiFiscaliInitialized(db);
    this.ensureDocumentiAziendaliTable(db);
    this.ensureFattureTable(db);
    this.ensurePrivacyRequestsTable(db);
    this.ensureUserInvitesTable(db);

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

  ensureKanbanCardColumnNullable(db) {
    try {
      const tableInfo = db.prepare("PRAGMA table_info(kanban_card)").all();
      if (!tableInfo || tableInfo.length === 0) {
        return;
      }
      const colonna = tableInfo.find((col) => col.name === 'colonna_id');
      const foreignKeys = db.prepare("PRAGMA foreign_key_list(kanban_card)").all();
      const colonnaFk = foreignKeys.find((fk) => fk.from === 'colonna_id');
      const needsNullable = colonna && colonna.notnull === 1;
      const needsSetNull = colonnaFk && String(colonnaFk.on_delete || '').toUpperCase() !== 'SET NULL';
      if (!needsNullable && !needsSetNull) {
        return;
      }

      db.exec('PRAGMA foreign_keys=OFF');
      db.exec('BEGIN');
      db.exec(`
        CREATE TABLE kanban_card_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          commessa_id INTEGER,
          titolo TEXT NOT NULL,
          descrizione TEXT,
          colonna_id INTEGER,
          priorita TEXT DEFAULT 'media',
          responsabile_id INTEGER,
          cliente_id INTEGER,
          cliente_nome TEXT,
          ordine INTEGER DEFAULT 0,
          avanzamento INTEGER DEFAULT 0,
          data_inizio TEXT,
          data_fine_prevista TEXT,
          data_fine_effettiva TEXT,
          recurrence_enabled INTEGER DEFAULT 0,
          recurrence_type TEXT,
          budget REAL DEFAULT 0,
          tags TEXT,
          created_by INTEGER,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          row_version INTEGER DEFAULT 1,
          FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE SET NULL,
          FOREIGN KEY (colonna_id) REFERENCES kanban_colonne(id) ON DELETE SET NULL,
          FOREIGN KEY (responsabile_id) REFERENCES utenti(id) ON DELETE SET NULL,
          FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES utenti(id) ON DELETE SET NULL
        );
      `);
      db.exec(`
        INSERT INTO kanban_card_new (
          id, commessa_id, titolo, descrizione, colonna_id, priorita, responsabile_id, cliente_id,
          cliente_nome, ordine, avanzamento, data_inizio, data_fine_prevista, data_fine_effettiva,
          recurrence_enabled, recurrence_type, budget, tags, created_by, created_at, updated_at, row_version
        )
        SELECT
          id, commessa_id, titolo, descrizione, colonna_id, priorita, responsabile_id, cliente_id,
          cliente_nome, ordine, avanzamento, data_inizio, data_fine_prevista, data_fine_effettiva,
          COALESCE(recurrence_enabled, 0), recurrence_type, budget, tags, created_by, created_at, updated_at, COALESCE(row_version, 1)
        FROM kanban_card;
      `);
      db.exec('DROP TABLE kanban_card');
      db.exec('ALTER TABLE kanban_card_new RENAME TO kanban_card');
      db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_card_colonna ON kanban_card(colonna_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_card_commessa ON kanban_card(commessa_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_card_responsabile ON kanban_card(responsabile_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_card_cliente ON kanban_card(cliente_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_card_created_at ON kanban_card(created_at)');
      db.exec('COMMIT');
      db.exec('PRAGMA foreign_keys=ON');
      console.log('[MIGRATIONS] kanban_card colonna_id reso nullable e FK aggiornato a SET NULL');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      try {
        db.exec('PRAGMA foreign_keys=ON');
      } catch {}
      console.log('[MIGRATIONS] Errore migrazione kanban_card colonna_id:', error.message);
    }
  }

  ensureKanbanRecurrenceColumns(db) {
    try {
      const tableInfo = db.prepare("PRAGMA table_info(kanban_card)").all();
      if (!tableInfo || tableInfo.length === 0) {
        return;
      }
      const columns = tableInfo.map((col) => col.name);
      if (!columns.includes('recurrence_enabled')) {
        db.exec("ALTER TABLE kanban_card ADD COLUMN recurrence_enabled INTEGER DEFAULT 0");
        console.log('[MIGRATIONS] Aggiunta colonna recurrence_enabled a kanban_card');
      }
      if (!columns.includes('recurrence_type')) {
        db.exec("ALTER TABLE kanban_card ADD COLUMN recurrence_type TEXT");
        console.log('[MIGRATIONS] Aggiunta colonna recurrence_type a kanban_card');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore aggiunta colonne ricorrenza kanban_card:', error.message);
    }
  }

  ensureUserPresenceTable(db) {
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='utenti_presenze'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE utenti_presenze (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_key TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            last_view TEXT,
            user_agent TEXT,
            ip_address TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE(user_id, session_key),
            FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_utenti_presenze_last_seen ON utenti_presenze(last_seen_at);
          CREATE INDEX IF NOT EXISTS idx_utenti_presenze_user_id ON utenti_presenze(user_id);
        `);
        console.log('[MIGRATIONS] Tabella utenti_presenze creata');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella utenti_presenze:', error.message);
    }
  }

  ensureRowVersionColumns(db) {
    const tables = [
      'clienti',
      'clienti_contatti',
      'attivita',
      'utenti',
      'commesse',
      'commesse_cartelle_anni',
      'note_spese',
      'commesse_ore',
      'dati_aziendali',
      'dati_fiscali',
      'documenti_aziendali',
      'fatture',
      'kanban_colonne',
      'kanban_card',
      'kanban_scadenze',
      'kanban_notifiche',
      'kanban_card_commenti',
      'privacy_requests'
      ,
      'user_invites'
    ];

    const addRowVersion = (table) => {
      try {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
        if (!columns.includes('row_version')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN row_version INTEGER DEFAULT 1`);
          db.exec(`UPDATE ${table} SET row_version = 1 WHERE row_version IS NULL`);
          console.log(`[MIGRATIONS] Aggiunta colonna row_version a ${table}`);
        }
      } catch (error) {
        console.log(`[MIGRATIONS] Errore aggiunta row_version a ${table}:`, error.message);
      }
    };

    tables.forEach(addRowVersion);
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
    addColumn('telefono', 'TEXT');
    if (!columns.includes('rimborso_km')) {
      db.exec('ALTER TABLE utenti ADD COLUMN rimborso_km REAL DEFAULT 0');
    }
  }

  ensureAttivitaColumns(db) {
    try {
      const columns = db.prepare('PRAGMA table_info(attivita)').all().map((col) => col.name);
      if (!columns.includes('note')) {
        db.exec('ALTER TABLE attivita ADD COLUMN note TEXT');
        console.log('[MIGRATIONS] Aggiunta colonna note a attivita');
      }
      if (!columns.includes('user_id')) {
        db.exec('ALTER TABLE attivita ADD COLUMN user_id INTEGER');
        console.log('[MIGRATIONS] Aggiunta colonna user_id a attivita');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Tabella attivita non ancora creata');
    }
  }

  ensureClientiColumns(db) {
    try {
      const columns = db.prepare('PRAGMA table_info(clienti)').all().map((col) => col.name);
      const addColumn = (name, type) => {
        if (!columns.includes(name)) {
          db.exec(`ALTER TABLE clienti ADD COLUMN ${name} ${type}`);
        }
      };

      addColumn('qualifica', 'TEXT');
      addColumn('nome', 'TEXT');
      addColumn('cognome', 'TEXT');
      addColumn('email', 'TEXT');
      addColumn('pec', 'TEXT');
      addColumn('fatture_in_cloud_id', 'TEXT');
      addColumn('fatture_in_cloud_updated_at', 'TEXT');
    } catch (error) {
      console.log('[MIGRATIONS] Tabella clienti non ancora creata');
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
    addColumn('consuntivo_completato', 'INTEGER', 0);
    addColumn('preventivo', 'INTEGER', 0);
    addColumn('importo_preventivo', 'REAL', 0);
    addColumn('importo_totale', 'REAL', 0);
    addColumn('importo_pagato', 'REAL', 0);
    addColumn('avanzamento_lavori', 'INTEGER', 0);
    addColumn('monte_ore_stimato', 'REAL');
    addColumn('responsabile', 'TEXT');
    addColumn('ubicazione', 'TEXT');
    addColumn('data_inizio', 'TEXT');
    addColumn('data_fine', 'TEXT');
    addColumn('note', 'TEXT');
    addColumn('allegati', 'TEXT');
    addColumn('parent_commessa_id', 'INTEGER');
    addColumn('is_struttura', 'INTEGER', 0);
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_commesse_parent ON commesse(parent_commessa_id);
      `);
    } catch (error) {
      console.log('[MIGRATIONS] Non è stato possibile creare idx_commesse_parent:', error.message);
    }
  }

  ensureCommesseAllegatiColumns(db) {
    try {
      const columns = db.prepare('PRAGMA table_info(commesse_allegati)').all().map((col) => col.name);
      const addColumn = (name, type, def = null) => {
        if (!columns.includes(name)) {
          const defaultClause = def == null ? '' : ` DEFAULT ${def}`;
          db.exec(`ALTER TABLE commesse_allegati ADD COLUMN ${name} ${type}${defaultClause}`);
        }
      };

      addColumn('version', 'INTEGER', 1);
      addColumn('is_latest', 'INTEGER', 1);
      addColumn('previous_id', 'INTEGER');
    } catch (error) {
      console.log('[MIGRATIONS] Tabella commesse_allegati non ancora creata');
    }
  }

  ensureCommesseAuditTable(db) {
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='commesse_audit'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE commesse_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commessa_id INTEGER NOT NULL,
            user_id INTEGER,
            action TEXT NOT NULL,
            changes_json TEXT,
            kanban_card_ids TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_commesse_audit_commessa_id ON commesse_audit(commessa_id);
          CREATE INDEX IF NOT EXISTS idx_commesse_audit_created_at ON commesse_audit(created_at);
        `);
        console.log('[MIGRATIONS] Tabella commesse_audit creata');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella commesse_audit:', error.message);
    }
  }

  ensureDefaultUser(db) {
    const { hashPassword } = require('../utils/auth');
    const shouldSeed = (process.env.SEED_DEFAULT_ADMIN || '').toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';
    const allowSeed = shouldSeed
      ? shouldSeed === 'true'
      : !isProduction;

    if (!allowSeed) {
      return;
    }

    const username = (process.env.DEFAULT_ADMIN_USERNAME || 'lcapoferri').trim();
    let password = process.env.DEFAULT_ADMIN_PASSWORD || '';
    const nome = (process.env.DEFAULT_ADMIN_NOME || 'Default').trim();
    const cognome = (process.env.DEFAULT_ADMIN_COGNOME || 'Admin').trim();
    const existing = db.prepare('SELECT id FROM utenti WHERE username = ?').get(username);

    if (!existing) {
      if (!password && !isProduction) {
        password = require('crypto').randomBytes(16).toString('hex');
        console.warn(`[MIGRATIONS] Seed admin creato in sviluppo. Username: ${username}, password temporanea: ${password}`);
      }
      if (!password || password.length < 12) {
        throw new Error('DEFAULT_ADMIN_PASSWORD obbligatoria (minimo 12 caratteri) quando SEED_DEFAULT_ADMIN=true');
      }
      const { hash, salt } = hashPassword(password);
      db.prepare(`
        INSERT INTO utenti (username, role, password_hash, password_salt, rimborso_km, nome, cognome)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(username, 'admin', hash, salt, 0, nome, cognome);
    }
  }

  ensurePrivacyRequestsTable(db) {
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='privacy_requests'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE privacy_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_type TEXT NOT NULL,
            requester_id INTEGER,
            requester_label TEXT,
            request_type TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            opened_at TEXT DEFAULT (datetime('now', 'localtime')),
            due_at TEXT,
            closed_at TEXT,
            notes TEXT,
            handled_by INTEGER,
            payload_json TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            row_version INTEGER DEFAULT 1,
            FOREIGN KEY (handled_by) REFERENCES utenti(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status);
          CREATE INDEX IF NOT EXISTS idx_privacy_requests_due_at ON privacy_requests(due_at);
          CREATE INDEX IF NOT EXISTS idx_privacy_requests_request_type ON privacy_requests(request_type);
        `);
        console.log('[MIGRATIONS] Tabella privacy_requests creata');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella privacy_requests:', error.message);
    }
  }

  ensureUserInvitesTable(db) {
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_invites'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE user_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            invited_nome TEXT,
            invited_cognome TEXT,
            note TEXT,
            token_hash TEXT NOT NULL UNIQUE,
            invited_by INTEGER,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            revoked_at TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            row_version INTEGER DEFAULT 1,
            FOREIGN KEY (invited_by) REFERENCES utenti(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
          CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON user_invites(expires_at);
          CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(used_at, revoked_at);
        `);
        console.log('[MIGRATIONS] Tabella user_invites creata');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella user_invites:', error.message);
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

  ensureDocumentiAziendaliTable(db) {
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documenti_aziendali'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE documenti_aziendali (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT,
            file_size INTEGER DEFAULT 0,
            file_path TEXT NOT NULL,
            categoria TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
          );
          CREATE INDEX IF NOT EXISTS idx_documenti_aziendali_created_at ON documenti_aziendali(created_at);
        `);
        console.log('[MIGRATIONS] Tabella documenti_aziendali creata');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella documenti_aziendali:', error.message);
    }
  }

  ensureFattureTable(db) {
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fatture'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE fatture (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fic_document_id TEXT,
            fic_company_id TEXT,
            cliente_id INTEGER,
            commessa_ids TEXT,
            numero TEXT,
            data TEXT,
            tipo_documento TEXT,
            stato TEXT,
            totale REAL DEFAULT 0,
            valuta TEXT,
            descrizione TEXT,
            payload_json TEXT,
            response_json TEXT,
            row_version INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_fatture_created_at ON fatture(created_at);
          CREATE INDEX IF NOT EXISTS idx_fatture_cliente_id ON fatture(cliente_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_fatture_fic_unique ON fatture(fic_company_id, fic_document_id);
        `);
        console.log('[MIGRATIONS] Tabella fatture creata');
      }
    } catch (error) {
      console.log('[MIGRATIONS] Errore verifica tabella fatture:', error.message);
    }
  }
}

module.exports = new Migrations();
