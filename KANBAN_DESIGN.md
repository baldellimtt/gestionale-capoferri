# Progettazione Sistema Kanban per Studio Ingegneristico

## 1. ANALISI DELLE ESIGENZE

### 1.1 Dominio Specifico - Studio Ingegneristico
- **Progetti strutturali in acciaio**: Fasi di progettazione, calcolo, approvazione, esecuzione
- **Progetti edili/urbanistici**: Pratiche amministrative, approvazioni, scadenze enti
- **Scadenze critiche**: Presentazione pratiche, scadenze amministrative, scadenze cantiere
- **Documenti tecnici**: Relazioni di calcolo, disegni tecnici, pratiche edilizie
- **Stakeholder multipli**: Committenti, enti pubblici, imprese, collaboratori

### 1.2 Requisiti Funzionali
1. **Kanban Board**
   - Colonne configurabili per fasi progetto
   - Card drag & drop tra colonne
   - Vista dettaglio card con informazioni complete
   - Filtri avanzati (cliente, responsabile, scadenza, priorità)
   - Ricerca full-text

2. **Gestione Scadenze**
   - Scadenze multiple per card
   - Alert visivi (colori, badge)
   - Notifiche automatiche (7, 3, 1 giorno prima)
   - Calendario scadenze

3. **Notifiche**
   - Bacheca notifiche centralizzata
   - Notifiche automatiche per scadenze
   - Notifiche per cambiamenti stato
   - Notifiche per assegnazioni
   - Notifiche per commenti/aggiornamenti
   - Notifiche push (opzionale)

4. **Integrazione Sistema Esistente**
   - Collegamento con commesse esistenti
   - Collegamento con clienti
   - Collegamento con utenti/responsabili
   - Sincronizzazione stati

## 2. ARCHITETTURA DATI

### 2.1 Schema Database

```sql
-- Tabella Colonne Kanban (configurabili)
CREATE TABLE kanban_colonne (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ordine INTEGER NOT NULL,
  colore TEXT, -- Colore colonna
  workflow_id INTEGER, -- Per workflow personalizzati
  is_default INTEGER DEFAULT 0, -- Colonne predefinite
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabella Card/Task Kanban
CREATE TABLE kanban_card (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commessa_id INTEGER, -- Collegamento con commessa esistente
  titolo TEXT NOT NULL,
  descrizione TEXT,
  colonna_id INTEGER NOT NULL,
  priorita TEXT DEFAULT 'media', -- bassa, media, alta, urgente
  responsabile_id INTEGER, -- Utente responsabile
  cliente_id INTEGER,
  cliente_nome TEXT,
  ordine INTEGER DEFAULT 0, -- Ordine nella colonna
  avanzamento INTEGER DEFAULT 0, -- 0-100
  data_inizio TEXT,
  data_fine_prevista TEXT,
  data_fine_effettiva TEXT,
  budget REAL DEFAULT 0,
  ore_stimate REAL DEFAULT 0,
  ore_effettive REAL DEFAULT 0,
  tags TEXT, -- JSON array di tag
  metadata TEXT, -- JSON per dati aggiuntivi
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (commessa_id) REFERENCES commesse(id) ON DELETE SET NULL,
  FOREIGN KEY (colonna_id) REFERENCES kanban_colonne(id) ON DELETE RESTRICT,
  FOREIGN KEY (responsabile_id) REFERENCES utenti(id) ON DELETE SET NULL,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES utenti(id) ON DELETE SET NULL
);

-- Tabella Scadenze
CREATE TABLE kanban_scadenze (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  data_scadenza TEXT NOT NULL,
  tipo TEXT, -- 'pratica', 'amministrativa', 'cantiere', 'documento', 'altro'
  priorita TEXT DEFAULT 'media',
  completata INTEGER DEFAULT 0,
  data_completamento TEXT,
  completata_da INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
  FOREIGN KEY (completata_da) REFERENCES utenti(id) ON DELETE SET NULL
);

-- Tabella Notifiche
CREATE TABLE kanban_notifiche (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- 'scadenza', 'assegnazione', 'commento', 'stato', 'sistema'
  titolo TEXT NOT NULL,
  messaggio TEXT,
  card_id INTEGER,
  scadenza_id INTEGER,
  letto INTEGER DEFAULT 0,
  data_lettura TEXT,
  link TEXT, -- Link per navigare alla risorsa
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
  FOREIGN KEY (scadenza_id) REFERENCES kanban_scadenze(id) ON DELETE CASCADE
);

-- Tabella Commenti/Attività
CREATE TABLE kanban_commenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  commento TEXT NOT NULL,
  tipo TEXT DEFAULT 'commento', -- 'commento', 'sistema', 'cambio_stato'
  metadata TEXT, -- JSON per dati aggiuntivi (es. stato precedente/nuovo)
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE
);

-- Tabella Assegnazioni (many-to-many)
CREATE TABLE kanban_assegnazioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  ruolo TEXT, -- 'responsabile', 'collaboratore', 'osservatore'
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES utenti(id) ON DELETE CASCADE,
  UNIQUE(card_id, user_id)
);

-- Tabella Allegati Card
CREATE TABLE kanban_allegati (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER DEFAULT 0,
  file_path TEXT NOT NULL,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (card_id) REFERENCES kanban_card(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES utenti(id) ON DELETE SET NULL
);

-- Indici per performance
CREATE INDEX idx_kanban_card_colonna ON kanban_card(colonna_id);
CREATE INDEX idx_kanban_card_commessa ON kanban_card(commessa_id);
CREATE INDEX idx_kanban_card_responsabile ON kanban_card(responsabile_id);
CREATE INDEX idx_kanban_card_cliente ON kanban_card(cliente_id);
CREATE INDEX idx_kanban_scadenze_card ON kanban_scadenze(card_id);
CREATE INDEX idx_kanban_scadenze_data ON kanban_scadenze(data_scadenza);
CREATE INDEX idx_kanban_notifiche_user ON kanban_notifiche(user_id);
CREATE INDEX idx_kanban_notifiche_letto ON kanban_notifiche(letto);
CREATE INDEX idx_kanban_commenti_card ON kanban_commenti(card_id);
CREATE INDEX idx_kanban_assegnazioni_card ON kanban_assegnazioni(card_id);
```

### 2.2 Colonne Predefinite (Workflow Studio Ingegneristico)

1. **Backlog** - Progetti in attesa di avvio
2. **Progettazione** - In fase di progettazione
3. **Calcolo Strutturale** - Calcoli e verifiche
4. **Documentazione** - Preparazione documenti tecnici
5. **Pratiche** - Gestione pratiche amministrative
6. **Approvazione** - In attesa di approvazione
7. **Esecuzione** - In esecuzione/cantiere
8. **Collaudo** - Fase di collaudo
9. **Chiusura** - Progetto completato

## 3. ARCHITETTURA API

### 3.1 Endpoints Backend

```
GET    /api/kanban/colonne              - Lista colonne
POST   /api/kanban/colonne              - Crea colonna
PUT    /api/kanban/colonne/:id          - Aggiorna colonna
DELETE /api/kanban/colonne/:id          - Elimina colonna

GET    /api/kanban/card                 - Lista card (con filtri)
GET    /api/kanban/card/:id              - Dettaglio card
POST   /api/kanban/card                 - Crea card
PUT    /api/kanban/card/:id              - Aggiorna card
DELETE /api/kanban/card/:id              - Elimina card
PUT    /api/kanban/card/:id/move         - Sposta card (cambio colonna)
PUT    /api/kanban/card/:id/reorder      - Riordina card nella colonna

GET    /api/kanban/card/:id/scadenze    - Scadenze card
POST   /api/kanban/card/:id/scadenze    - Crea scadenza
PUT    /api/kanban/scadenze/:id         - Aggiorna scadenza
DELETE /api/kanban/scadenze/:id         - Elimina scadenza
PUT    /api/kanban/scadenze/:id/complete - Completa scadenza

GET    /api/kanban/notifiche            - Notifiche utente
PUT    /api/kanban/notifiche/:id/read   - Segna come letta
PUT    /api/kanban/notifiche/read-all   - Segna tutte come lette
GET    /api/kanban/notifiche/unread-count - Contatore non lette

GET    /api/kanban/card/:id/commenti    - Commenti card
POST   /api/kanban/card/:id/commenti    - Aggiungi commento

GET    /api/kanban/card/:id/allegati    - Allegati card
POST   /api/kanban/card/:id/allegati    - Carica allegato
DELETE /api/kanban/allegati/:id         - Elimina allegato

GET    /api/kanban/scadenze/prossime    - Scadenze prossime (per notifiche)
```

### 3.2 Servizio Notifiche Automatiche

- **Job schedulato** (es. ogni ora) per verificare scadenze
- Genera notifiche per scadenze a 7, 3, 1 giorno
- Genera notifiche per scadenze scadute
- Notifiche per cambiamenti stato card
- Notifiche per nuove assegnazioni

## 4. ARCHITETTURA FRONTEND

### 4.1 Componenti Principali

```
KanbanBoard/
  ├── KanbanBoard.jsx          - Container principale
  ├── KanbanColumn.jsx         - Colonna singola
  ├── KanbanCard.jsx           - Card singola
  ├── KanbanCardDetail.jsx     - Modal dettaglio card
  ├── KanbanFilters.jsx        - Filtri e ricerca
  ├── KanbanNotifications.jsx - Bacheca notifiche
  └── KanbanDeadlines.jsx      - Vista calendario scadenze
```

### 4.2 Librerie Consigliate

- **react-beautiful-dnd** o **@dnd-kit/core** - Drag & drop
- **date-fns** - Gestione date
- **react-calendar** - Calendario scadenze (opzionale)

## 5. FUNZIONALITÀ AVANZATE

### 5.1 Filtri e Ricerca
- Filtro per cliente
- Filtro per responsabile
- Filtro per priorità
- Filtro per scadenze (oggi, questa settimana, scadute)
- Ricerca full-text su titolo/descrizione
- Filtro per tag

### 5.2 Vista Calendario
- Vista mensile scadenze
- Vista settimanale
- Evidenziazione scadenze critiche

### 5.3 Statistiche Dashboard
- Card per colonna
- Scadenze prossime
- Progetti in ritardo
- Carico lavoro per responsabile

## 6. INTEGRAZIONE CON SISTEMA ESISTENTE

### 6.1 Sincronizzazione Commesse
- Creazione automatica card da commessa esistente
- Sincronizzazione stato commessa ↔ colonna kanban
- Collegamento bidirezionale

### 6.2 Permessi e Ruoli
- Admin: gestione completa
- Utente: gestione card assegnate
- Osservatore: sola lettura

## 7. PRIORITÀ DI IMPLEMENTAZIONE

### Fase 1 - MVP (Minimum Viable Product)
1. Schema database base
2. API CRUD colonne e card
3. Board Kanban base con drag & drop
4. Gestione scadenze base
5. Notifiche base (solo bacheca)

### Fase 2 - Funzionalità Core
1. Sistema notifiche completo
2. Commenti e attività
3. Allegati
4. Filtri avanzati
5. Vista dettaglio card completa

### Fase 3 - Avanzato
1. Vista calendario
2. Dashboard statistiche
3. Integrazione completa con commesse
4. Notifiche push (opzionale)
5. Export/Report

## 8. CONSIDERAZIONI TECNICHE

### 8.1 Performance
- Lazy loading card per colonne con molti elementi
- Virtualizzazione liste lunghe
- Caching notifiche
- Ottimizzazione query database

### 8.2 UX/UI
- Design coerente con sistema esistente
- Animazioni smooth per drag & drop
- Feedback visivo immediato
- Responsive design

### 8.3 Sicurezza
- Validazione input lato server
- Autorizzazioni per operazioni
- Sanitizzazione dati
- Rate limiting API







