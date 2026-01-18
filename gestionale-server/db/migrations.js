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
    `);

    console.log('[MIGRATIONS] Schema database creato/verificato');
  }
}

module.exports = new Migrations();


