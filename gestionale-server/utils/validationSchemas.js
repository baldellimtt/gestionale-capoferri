/**
 * Schemi di validazione con express-validator
 * Incrementale, non distruttivo
 */

const { body, param, query } = require('express-validator');

const ValidationSchemas = {
  // Validazione ID
  id: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('ID deve essere un numero intero positivo')
  ],

  // Helper per validare parametri con nomi personalizzati
  idParam: (paramName = 'id') => [
    param(paramName)
      .isInt({ min: 1 })
      .withMessage(`${paramName} deve essere un numero intero positivo`)
  ],

  // Validazione Cliente
  cliente: {
    create: [
      body('denominazione')
        .trim()
        .notEmpty()
        .withMessage('Denominazione obbligatoria')
        .isLength({ max: 255 })
        .withMessage('Denominazione troppo lunga (max 255 caratteri)'),
      body('paese')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Paese troppo lungo (max 100 caratteri)'),
      // Accetta sia camelCase che snake_case per compatibilità frontend
      body('codice_destinatario_sdi')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 10;
        })
        .withMessage('Codice destinatario SDI troppo lungo (max 10 caratteri)'),
      body('codiceDestinatarioSDI')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 10;
        })
        .withMessage('Codice destinatario SDI troppo lungo (max 10 caratteri)'),
      body('indirizzo')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 255;
        })
        .withMessage('Indirizzo troppo lungo (max 255 caratteri)'),
      body('comune')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 100;
        })
        .withMessage('Comune troppo lungo (max 100 caratteri)'),
      body('cap')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? String(value).trim() : String(value);
          if (trimmed === '') return true;
          return trimmed.length <= 10;
        })
        .withMessage('CAP troppo lungo (max 10 caratteri)'),
      body('provincia')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          if (trimmed === '') return true;
          return trimmed.length <= 5;
        })
        .withMessage('Provincia troppo lunga (max 5 caratteri)'),
      body('partita_iva')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? String(value).trim() : String(value);
          if (trimmed === '') return true;
          return trimmed.length <= 20;
        })
        .withMessage('Partita IVA troppo lunga (max 20 caratteri)'),
      body('partitaIva')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? String(value).trim() : String(value);
          if (trimmed === '') return true;
          return trimmed.length <= 20;
        })
        .withMessage('Partita IVA troppo lunga (max 20 caratteri)'),
      body('codice_fiscale')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? String(value).trim() : String(value);
          if (trimmed === '') return true;
          // Solo verifica lunghezza massima, non formato specifico
          return trimmed.length <= 16;
        })
        .withMessage('Codice Fiscale troppo lungo (max 16 caratteri)'),
      body('codiceFiscale')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? String(value).trim() : String(value);
          if (trimmed === '') return true;
          // Solo verifica lunghezza massima, non formato specifico
          return trimmed.length <= 16;
        })
        .withMessage('Codice Fiscale troppo lungo (max 16 caratteri)')
    ],
    update: [] // Sarà popolato dopo la definizione
  },

  commessaAuditNote: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('ID non valido'),
    body('note')
      .trim()
      .notEmpty()
      .withMessage('Nota obbligatoria')
      .isLength({ max: 2000 })
      .withMessage('Nota troppo lunga (max 2000 caratteri)'),
    body('data')
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        if (typeof value !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
      })
      .withMessage('Data non valida')
  ],

  // Validazione Contatto Cliente
  contatto: {
    create: [
      param('id').isInt({ min: 1 }).withMessage('ID cliente non valido'),
      body('nome')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Nome troppo lungo (max 100 caratteri)'),
      body('ruolo')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Ruolo troppo lungo (max 100 caratteri)'),
      body('telefono')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = String(value).trim();
          if (trimmed === '') return true;
          return trimmed.length <= 25;
        })
        .withMessage('Telefono troppo lungo (max 25 caratteri)'),
      body('email')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = String(value).trim();
          if (trimmed === '') return true;
          return trimmed.length <= 255;
        })
        .withMessage('Email troppo lunga (max 255 caratteri)')
    ],
    update: [] // Sarà popolato dopo la definizione
  },

  // Validazione Attività
  attivita: {
    create: [
      body('data')
        .notEmpty()
        .withMessage('Data obbligatoria')
        .custom((value) => {
          if (typeof value !== 'string') return false;
          // Accetta formato date ISO8601 (YYYY-MM-DD) o datetime ISO8601
          const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
          const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
          return dateOnlyRegex.test(value) || dateTimeRegex.test(value);
        })
        .withMessage('Data non valida (formato YYYY-MM-DD)'),
      body('clienteId')
        .optional({ nullable: true, checkFalsy: false })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const num = typeof value === 'number' ? value : parseInt(value, 10);
          return !isNaN(num) && num >= 1;
        })
        .withMessage('ID cliente non valido'),
      body('userId')
        .optional({ nullable: true, checkFalsy: false })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const num = typeof value === 'number' ? value : parseInt(value, 10);
          return !isNaN(num) && num >= 1;
        })
        .withMessage('ID utente non valido'),
      body('clienteNome')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 255;
        })
        .withMessage('Nome cliente troppo lungo'),
      body('attivita')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 500;
        })
        .withMessage('Attività troppo lunga (max 500 caratteri)'),
      body('note')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const trimmed = typeof value === 'string' ? value.trim() : String(value);
          return trimmed.length <= 1000;
        })
        .withMessage('Note troppo lunghe (max 1000 caratteri)'),
      body('km')
        .optional({ nullable: true, checkFalsy: false })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          const num = typeof value === 'number' ? value : parseFloat(value);
          return !isNaN(num) && num >= 0;
        })
        .withMessage('KM deve essere un numero positivo'),
      body('indennita')
        .optional({ nullable: true, checkFalsy: false })
        .custom((value) => {
          // Accetta booleani, 0/1 (numeri), o stringhe '0'/'1'/'true'/'false'
          if (value === null || value === undefined || value === '') return true;
          if (typeof value === 'boolean') return true;
          if (typeof value === 'number' && (value === 0 || value === 1)) return true;
          if (typeof value === 'string' && ['0', '1', 'true', 'false'].includes(value.toLowerCase())) return true;
          return false;
        })
        .withMessage('Indennità deve essere true/false o 0/1')
    ],
    update: [] // Sarà popolato dopo la definizione
  },

  // Validazione Login
  login: [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username obbligatorio')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username deve essere tra 3 e 50 caratteri'),
    body('password')
      .notEmpty()
      .withMessage('Password obbligatoria')
      .isLength({ min: 8 })
      .withMessage('Password deve essere di almeno 8 caratteri')
  ],

  // Validazione Password (per creazione/aggiornamento utente)
  password: [
    body('password')
      .notEmpty()
      .withMessage('Password obbligatoria')
      .isLength({ min: 8 })
      .withMessage('Password deve essere di almeno 8 caratteri')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password deve contenere almeno una lettera minuscola, una maiuscola e un numero')
  ],

  // Validazione Paginazione
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page deve essere un numero intero positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit deve essere tra 1 e 100')
  ],

  // Validazione Date Range
  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Data inizio non valida'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Data fine non valida')
  ],

  // Validazione Commessa
  commessa: {
    create: [
      body('titolo')
        .trim()
        .notEmpty()
        .withMessage('Titolo commessa obbligatorio')
        .isLength({ max: 255 })
        .withMessage('Titolo troppo lungo (max 255 caratteri)'),
      body('cliente_id')
        .optional({ nullable: true, checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('ID cliente non valido'),
      body('clienteId')
        .optional({ nullable: true, checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('ID cliente non valido'),
      body('cliente_nome')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 255 })
        .withMessage('Nome cliente troppo lungo'),
      body('clienteNome')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 255 })
        .withMessage('Nome cliente troppo lungo'),
      body('stato')
        .optional({ nullable: true, checkFalsy: true })
        .isIn(['In corso', 'In attesa di approvazione', 'Richieste integrazioni', 'Personalizzato', 'Conclusa'])
        .withMessage('Stato non valido'),
      body('sotto_stato')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('Sotto stato troppo lungo'),
      body('stato_pagamenti')
        .optional({ nullable: true, checkFalsy: true })
        .isIn(['Non iniziato', 'Parziale', 'Consuntivo con altre commesse', 'Saldo'])
        .withMessage('Stato pagamenti non valido'),
      body('preventivo')
        .optional({ nullable: true, checkFalsy: true })
        .isBoolean()
        .withMessage('Preventivo deve essere true o false'),
      body('importo_preventivo')
        .optional({ nullable: true, checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('Importo preventivo deve essere un numero positivo'),
      body('importo_totale')
        .optional({ nullable: true, checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('Importo totale deve essere un numero positivo'),
      body('importo_pagato')
        .optional({ nullable: true, checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('Importo pagato deve essere un numero positivo'),
      body('avanzamento_lavori')
        .optional({ nullable: true, checkFalsy: true })
        .isInt({ min: 0, max: 100 })
        .withMessage('Avanzamento lavori deve essere tra 0 e 100'),
      body('responsabile')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('Responsabile troppo lungo'),
      body('data_inizio')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          // Accetta formato date ISO8601 (YYYY-MM-DD) o datetime ISO8601
          return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
        })
        .withMessage('Data inizio non valida'),
      body('data_fine')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          // Accetta formato date ISO8601 (YYYY-MM-DD) o datetime ISO8601
          return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
        })
        .withMessage('Data fine non valida'),
      body('note')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
          if (value === null || value === undefined || value === '') return true;
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          return trimmed.length <= 2000;
        })
        .withMessage('Note troppo lunghe (max 2000 caratteri)')
    ],
    update: [] // Sarà popolato dopo la definizione
  },

  // Validazione Kanban
  kanban: {
    colonna: {
      create: [
        body('nome')
          .trim()
          .notEmpty()
          .withMessage('Nome colonna obbligatorio')
          .isLength({ max: 100 })
          .withMessage('Nome colonna troppo lungo (max 100 caratteri)'),
        body('ordine')
          .optional()
          .isInt({ min: 0 })
          .withMessage('Ordine deve essere un numero intero positivo'),
        body('colore')
          .optional()
          .matches(/^#[0-9A-Fa-f]{6}$/)
          .withMessage('Colore deve essere in formato esadecimale (#RRGGBB)'),
        body('is_default')
          .optional()
          .isBoolean()
          .withMessage('is_default deve essere true o false')
      ],
      update: [] // Sarà popolato dopo la definizione
    },
    card: {
      create: [
        body('titolo')
          .trim()
          .notEmpty()
          .withMessage('Titolo card obbligatorio')
          .isLength({ max: 255 })
          .withMessage('Titolo troppo lungo (max 255 caratteri)'),
        body('descrizione')
          .optional()
          .trim()
          .isLength({ max: 2000 })
          .withMessage('Descrizione troppo lunga (max 2000 caratteri)'),
        body('colonna_id')
          .notEmpty()
          .withMessage('Colonna obbligatoria')
          .isInt({ min: 1 })
          .withMessage('ID colonna non valido'),
        body('priorita')
          .optional()
          .isIn(['bassa', 'media', 'alta', 'urgente'])
          .withMessage('Priorità non valida'),
        body('commessa_id')
          .optional({ nullable: true, checkFalsy: true })
          .custom((value) => {
            if (value === null || value === undefined || value === '') return true;
            const num = parseInt(value, 10);
            return !isNaN(num) && num >= 1;
          })
          .withMessage('ID commessa non valido'),
        body('cliente_id')
          .optional({ nullable: true, checkFalsy: false })
          .custom((value) => {
            if (value === null || value === undefined || value === '' || value === 0) return true;
            const num = typeof value === 'number' ? value : parseInt(value, 10);
            return !isNaN(num) && num >= 1;
          })
          .withMessage('ID cliente non valido'),
        body('cliente_nome')
          .optional({ nullable: true, checkFalsy: true })
          .custom((value) => {
            if (value === null || value === undefined || value === '') return true;
            const trimmed = typeof value === 'string' ? value.trim() : String(value);
            return trimmed.length <= 255;
          })
          .withMessage('Nome cliente troppo lungo'),
        body('data_inizio')
          .optional({ nullable: true, checkFalsy: true })
          .custom((value) => {
            if (value === null || value === undefined || value === '') return true;
            // Accetta formato date ISO8601 (YYYY-MM-DD) o datetime ISO8601
            const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
            const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
            return dateOnlyRegex.test(value) || dateTimeRegex.test(value);
          })
          .withMessage('Data inizio non valida'),
        body('data_fine_prevista')
          .optional({ nullable: true, checkFalsy: true })
          .custom((value) => {
            if (value === null || value === undefined || value === '') return true;
            // Accetta formato date ISO8601 (YYYY-MM-DD) o datetime ISO8601
            const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
            const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
            return dateOnlyRegex.test(value) || dateTimeRegex.test(value);
          })
          .withMessage('Data fine prevista non valida'),
        body('tags')
          .optional({ nullable: true, checkFalsy: false })
          .custom((value) => {
            // Accetta null, undefined, array vuoto
            if (value === null || value === undefined) return true;
            // Accetta array (anche vuoto)
            if (Array.isArray(value)) return true;
            // Accetta stringhe JSON valide
            if (typeof value === 'string') {
              if (value === '') return true; // Stringa vuota è valida
              try {
                JSON.parse(value);
                return true;
              } catch {
                return false;
              }
            }
            return false;
          })
          .withMessage('Tags deve essere un array o JSON valido')
      ],
      update: [], // Sarà popolato dopo la definizione
      move: [
        param('id').isInt({ min: 1 }).withMessage('ID card non valido'),
        body('colonna_id')
          .notEmpty()
          .withMessage('Colonna obbligatoria')
          .isInt({ min: 1 })
          .withMessage('ID colonna non valido'),
        body('ordine')
          .optional()
          .isInt({ min: 0 })
          .withMessage('Ordine deve essere un numero intero positivo')
      ]
    },
    scadenza: {
      create: [
        param('cardId')
          .custom((value, { path }) => {
            // Accetta sia 'cardId' che 'id' come parametro
            return true;
          })
          .isInt({ min: 1 })
          .withMessage('ID card non valido'),
        body('titolo')
          .trim()
          .notEmpty()
          .withMessage('Titolo scadenza obbligatorio')
          .isLength({ max: 255 })
          .withMessage('Titolo troppo lungo (max 255 caratteri)'),
        body('descrizione')
          .optional()
          .trim()
          .isLength({ max: 1000 })
          .withMessage('Descrizione troppo lunga (max 1000 caratteri)'),
        body('data_scadenza')
          .notEmpty()
          .withMessage('Data scadenza obbligatoria')
          .custom((value) => {
            // Accetta sia formato date-only (YYYY-MM-DD) che datetime ISO8601
            if (typeof value !== 'string') return false;
            // Formato date ISO8601 (YYYY-MM-DD)
            const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
            // Formato datetime ISO8601 completo
            const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
            if (!dateOnlyRegex.test(value) && !dateTimeRegex.test(value)) {
              return false;
            }
            const date = new Date(value);
            return !isNaN(date.getTime());
          })
          .withMessage('Data scadenza non valida (formato atteso: YYYY-MM-DD o ISO8601)'),
        body('tipo')
          .optional()
          .trim()
          .isLength({ max: 50 })
          .withMessage('Tipo troppo lungo'),
        body('priorita')
          .optional()
          .isIn(['bassa', 'media', 'alta', 'urgente'])
          .withMessage('Priorità non valida')
      ],
      update: [
        param('id').isInt({ min: 1 }).withMessage('ID scadenza non valido'),
        body('titolo')
          .trim()
          .notEmpty()
          .withMessage('Titolo scadenza obbligatorio')
          .isLength({ max: 255 })
          .withMessage('Titolo troppo lungo (max 255 caratteri)'),
        body('descrizione')
          .optional()
          .trim()
          .isLength({ max: 1000 })
          .withMessage('Descrizione troppo lunga (max 1000 caratteri)'),
        body('data_scadenza')
          .notEmpty()
          .withMessage('Data scadenza obbligatoria')
          .custom((value) => {
            // Accetta sia formato date-only (YYYY-MM-DD) che datetime ISO8601
            if (typeof value !== 'string') return false;
            // Formato date ISO8601 (YYYY-MM-DD)
            const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
            // Formato datetime ISO8601 completo
            const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
            if (!dateOnlyRegex.test(value) && !dateTimeRegex.test(value)) {
              return false;
            }
            const date = new Date(value);
            return !isNaN(date.getTime());
          })
          .withMessage('Data scadenza non valida (formato atteso: YYYY-MM-DD o ISO8601)'),
        body('tipo')
          .optional()
          .trim()
          .isLength({ max: 50 })
          .withMessage('Tipo troppo lungo'),
        body('priorita')
          .optional()
          .isIn(['bassa', 'media', 'alta', 'urgente'])
          .withMessage('Priorità non valida')
      ]
    },
    commento: {
      create: [
        param('cardId').isInt({ min: 1 }).withMessage('ID card non valido'),
        body('commento')
          .trim()
          .notEmpty()
          .withMessage('Commento obbligatorio')
          .isLength({ max: 2000 })
          .withMessage('Commento troppo lungo (max 2000 caratteri)')
      ],
      update: [
        param('id').isInt({ min: 1 }).withMessage('ID commento non valido'),
        body('commento')
          .trim()
          .notEmpty()
          .withMessage('Commento obbligatorio')
          .isLength({ max: 2000 })
          .withMessage('Commento troppo lungo (max 2000 caratteri)')
      ]
    }
  }
};

// Fix per riferimenti circolari
ValidationSchemas.cliente.update = [
  param('id').isInt({ min: 1 }).withMessage('ID non valido'),
  ...ValidationSchemas.cliente.create
];

ValidationSchemas.contatto.update = [
  param('id').isInt({ min: 1 }).withMessage('ID cliente non valido'),
  param('contattoId').isInt({ min: 1 }).withMessage('ID contatto non valido'),
  ...ValidationSchemas.contatto.create.slice(1)
];

ValidationSchemas.attivita.update = [
  param('id').isInt({ min: 1 }).withMessage('ID non valido'),
  ...ValidationSchemas.attivita.create
];

ValidationSchemas.commessa.update = [
  param('id').isInt({ min: 1 }).withMessage('ID non valido'),
  ...ValidationSchemas.commessa.create
];

// Fix per riferimenti circolari Kanban
ValidationSchemas.kanban.colonna.update = [
  param('id').isInt({ min: 1 }).withMessage('ID non valido'),
  ...ValidationSchemas.kanban.colonna.create
];

ValidationSchemas.kanban.card.update = [
  param('id').isInt({ min: 1 }).withMessage('ID non valido'),
  body('titolo')
    .trim()
    .notEmpty()
    .withMessage('Titolo card obbligatorio')
    .isLength({ max: 255 })
    .withMessage('Titolo troppo lungo (max 255 caratteri)'),
  body('descrizione')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Descrizione troppo lunga (max 2000 caratteri)'),
  body('colonna_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      return !isNaN(num) && num >= 1;
    })
    .withMessage('ID colonna non valido'),
  body('priorita')
    .optional()
    .isIn(['bassa', 'media', 'alta', 'urgente'])
    .withMessage('Priorità non valida'),
  body('commessa_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '' || value === 0) return true;
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      return !isNaN(num) && num >= 1;
    })
    .withMessage('ID commessa non valido'),
  body('cliente_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '' || value === 0) return true;
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      return !isNaN(num) && num >= 1;
    })
    .withMessage('ID cliente non valido'),
  body('cliente_nome')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Nome cliente troppo lungo'),
  body('data_inizio')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
    })
    .withMessage('Data inizio non valida'),
  body('data_fine_prevista')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
    })
    .withMessage('Data fine prevista non valida'),
  body('tags')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (Array.isArray(value)) return true;
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    })
    .withMessage('Tags deve essere un array o JSON valido')
];

module.exports = ValidationSchemas;
