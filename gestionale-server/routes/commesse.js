const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const Logger = require('../utils/logger');
const fileValidator = require('../utils/fileValidator');
const ErrorHandler = require('../utils/errorHandler');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');
const Pagination = require('../utils/pagination');

const STATI_COMMESSA = ['In corso', 'Preventivato', 'In attesa di approvazione', 'Richieste integrazioni', 'Personalizzato', 'Conclusa'];
const STATI_PAGAMENTI = ['Non iniziato', 'Parziale', 'Consuntivo con altre commesse', 'Saldo'];

const uploadsRoot = path.join(__dirname, '..', 'uploads', 'commesse');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const commessaId = String(req.params.id || 'temp');
    const targetDir = path.join(uploadsRoot, commessaId);
    ensureDir(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}_${safeBase}`);
  }
});

const upload = multer({ storage });

class CommesseController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    // Query base senza LIMIT per retrocompatibilità
    this.stmt = {
      getAll: this.db.prepare('SELECT * FROM commesse ORDER BY data_inizio DESC, id DESC'),
      getByCliente: this.db.prepare('SELECT * FROM commesse WHERE cliente_id = ? ORDER BY data_inizio DESC, id DESC'),
      getByStato: this.db.prepare('SELECT * FROM commesse WHERE stato = ? ORDER BY data_inizio DESC, id DESC'),
      getByStatoPagamenti: this.db.prepare('SELECT * FROM commesse WHERE stato_pagamenti = ? ORDER BY data_inizio DESC, id DESC'),
      getByClienteStatoPagamenti: this.db.prepare(`
        SELECT * FROM commesse
        WHERE cliente_id = ? AND stato_pagamenti = ?
        ORDER BY data_inizio DESC, id DESC
      `),
      getByClienteStato: this.db.prepare(`
        SELECT * FROM commesse
        WHERE cliente_id = ? AND stato = ?
        ORDER BY data_inizio DESC, id DESC
      `),
      // Query paginate con LIMIT/OFFSET
      getAllPaginated: this.db.prepare('SELECT * FROM commesse ORDER BY data_inizio DESC, id DESC LIMIT ? OFFSET ?'),
      getByClientePaginated: this.db.prepare('SELECT * FROM commesse WHERE cliente_id = ? ORDER BY data_inizio DESC, id DESC LIMIT ? OFFSET ?'),
      getByStatoPaginated: this.db.prepare('SELECT * FROM commesse WHERE stato = ? ORDER BY data_inizio DESC, id DESC LIMIT ? OFFSET ?'),
      getByStatoPagamentiPaginated: this.db.prepare('SELECT * FROM commesse WHERE stato_pagamenti = ? ORDER BY data_inizio DESC, id DESC LIMIT ? OFFSET ?'),
      getByClienteStatoPagamentiPaginated: this.db.prepare(`
        SELECT * FROM commesse
        WHERE cliente_id = ? AND stato_pagamenti = ?
        ORDER BY data_inizio DESC, id DESC
        LIMIT ? OFFSET ?
      `),
      getByClienteStatoPaginated: this.db.prepare(`
        SELECT * FROM commesse
        WHERE cliente_id = ? AND stato = ?
        ORDER BY data_inizio DESC, id DESC
        LIMIT ? OFFSET ?
      `),
      // Count queries
      getCount: this.db.prepare('SELECT COUNT(*) as total FROM commesse'),
      getCountByCliente: this.db.prepare('SELECT COUNT(*) as total FROM commesse WHERE cliente_id = ?'),
      getCountByStato: this.db.prepare('SELECT COUNT(*) as total FROM commesse WHERE stato = ?'),
      getCountByStatoPagamenti: this.db.prepare('SELECT COUNT(*) as total FROM commesse WHERE stato_pagamenti = ?'),
      getCountByClienteStatoPagamenti: this.db.prepare(`
        SELECT COUNT(*) as total FROM commesse
        WHERE cliente_id = ? AND stato_pagamenti = ?
      `),
      getCountByClienteStato: this.db.prepare(`
        SELECT COUNT(*) as total FROM commesse
        WHERE cliente_id = ? AND stato = ?
      `),
      getById: this.db.prepare('SELECT * FROM commesse WHERE id = ?'),
      create: this.db.prepare(`
        INSERT INTO commesse (
          titolo, cliente_id, cliente_nome, stato, sotto_stato, stato_pagamenti,
          preventivo, importo_preventivo, importo_totale, importo_pagato,
          avanzamento_lavori, monte_ore_stimato, responsabile, ubicazione,
          data_inizio, data_fine, note, allegati, parent_commessa_id, is_struttura
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE commesse SET
          titolo = ?,
          cliente_id = ?,
          cliente_nome = ?,
          stato = ?,
          sotto_stato = ?,
          stato_pagamenti = ?,
          preventivo = ?,
          importo_preventivo = ?,
          importo_totale = ?,
          importo_pagato = ?,
          avanzamento_lavori = ?,
          monte_ore_stimato = ?,
          responsabile = ?,
          ubicazione = ?,
          data_inizio = ?,
          data_fine = ?,
          note = ?,
          allegati = ?,
          parent_commessa_id = ?,
          is_struttura = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM commesse WHERE id = ?'),
      getAllegati: this.db.prepare(`
        SELECT id, commessa_id, filename, original_name, mime_type, file_size, file_path, version, is_latest, previous_id, created_at
        FROM commesse_allegati
        WHERE commessa_id = ?
        ORDER BY created_at DESC, id DESC
      `),
      getAllegatoById: this.db.prepare('SELECT * FROM commesse_allegati WHERE id = ?'),
      getLatestAllegatoByName: this.db.prepare(`
        SELECT * FROM commesse_allegati
        WHERE commessa_id = ? AND original_name = ? AND is_latest = 1
        ORDER BY version DESC, id DESC
        LIMIT 1
      `),
      getLatestAllegatoByNameExcluding: this.db.prepare(`
        SELECT * FROM commesse_allegati
        WHERE commessa_id = ? AND original_name = ? AND id != ?
        ORDER BY version DESC, id DESC
        LIMIT 1
      `),
      createAllegato: this.db.prepare(`
        INSERT INTO commesse_allegati (
          commessa_id, filename, original_name, mime_type, file_size, file_path, version, is_latest, previous_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      deleteAllegato: this.db.prepare('DELETE FROM commesse_allegati WHERE id = ?'),
      markAllegatoNotLatest: this.db.prepare(`
        UPDATE commesse_allegati
        SET is_latest = 0
        WHERE id = ?
      `),
      markAllegatoLatest: this.db.prepare(`
        UPDATE commesse_allegati
        SET is_latest = 1
        WHERE id = ?
      `),
      createAudit: this.db.prepare(`
        INSERT INTO commesse_audit (commessa_id, user_id, action, changes_json, kanban_card_ids)
        VALUES (?, ?, ?, ?, ?)
      `),
      createAuditWithDate: this.db.prepare(`
        INSERT INTO commesse_audit (commessa_id, user_id, action, changes_json, kanban_card_ids, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      getAuditByCommessa: this.db.prepare(`
        SELECT a.id, a.commessa_id, a.user_id, a.action, a.changes_json, a.kanban_card_ids, a.created_at,
               u.username, u.nome, u.cognome
        FROM commesse_audit a
        LEFT JOIN utenti u ON u.id = a.user_id
        WHERE a.commessa_id = ?
        ORDER BY a.created_at DESC, a.id DESC
      `),
      getKanbanCardsByCommessa: this.db.prepare(`
        SELECT id FROM kanban_card WHERE commessa_id = ? ORDER BY id ASC
      `),
      getYearFoldersByCliente: this.db.prepare(`
        SELECT id, cliente_id, anno, created_at, updated_at
        FROM commesse_cartelle_anni
        WHERE cliente_id = ?
        ORDER BY anno DESC, id DESC
      `),
      getYearFolderByClienteYear: this.db.prepare(`
        SELECT id, cliente_id, anno, created_at, updated_at
        FROM commesse_cartelle_anni
        WHERE cliente_id = ? AND anno = ?
        LIMIT 1
      `),
      createYearFolder: this.db.prepare(`
        INSERT INTO commesse_cartelle_anni (cliente_id, anno)
        VALUES (?, ?)
      `)
    };
  }

  parseNumber(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  parseNullableNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  parseParentId(value) {
    if (value == null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  parseBooleanFlag(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    const normalized = String(value).toLowerCase();
    if (['1', 'true'].includes(normalized)) return 1;
    if (['0', 'false'].includes(normalized)) return 0;
    return fallback;
  }

  parseIntValue(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  normalizeValue(value) {
    if (value === undefined) return null;
    if (value === '') return null;
    return value;
  }

  getRelatedKanbanCardIds(commessaId) {
    try {
      const rows = this.stmt.getKanbanCardsByCommessa.all(commessaId);
      return rows.map((row) => row.id);
    } catch (error) {
      Logger.warn('Errore recupero card kanban per commessa', { commessaId, error: error.message });
      return [];
    }
  }

  createAuditEntry(commessaId, action, changes, userId) {
    const kanbanCardIds = this.getRelatedKanbanCardIds(commessaId);
    const changesJson = changes ? JSON.stringify(changes) : null;
    const kanbanJson = kanbanCardIds.length ? JSON.stringify(kanbanCardIds) : null;
    this.stmt.createAudit.run(
      commessaId,
      userId || null,
      action,
      changesJson,
      kanbanJson
    );
  }

  createAuditEntryWithDate(commessaId, action, changes, userId, createdAt) {
    const kanbanCardIds = this.getRelatedKanbanCardIds(commessaId);
    const changesJson = changes ? JSON.stringify(changes) : null;
    const kanbanJson = kanbanCardIds.length ? JSON.stringify(kanbanCardIds) : null;
    this.stmt.createAuditWithDate.run(
      commessaId,
      userId || null,
      action,
      changesJson,
      kanbanJson,
      createdAt
    );
  }

  buildChanges(existing, nextValues) {
    const fields = [
      'titolo',
      'cliente_id',
      'cliente_nome',
      'stato',
      'sotto_stato',
      'stato_pagamenti',
      'preventivo',
      'importo_preventivo',
      'importo_totale',
      'importo_pagato',
      'avanzamento_lavori',
      'monte_ore_stimato',
      'responsabile',
      'ubicazione',
      'data_inizio',
      'data_fine',
      'note',
      'parent_commessa_id',
      'is_struttura'
    ];

    const changes = [];
    fields.forEach((field) => {
      const before = existing ? this.normalizeValue(existing[field]) : null;
      const after = this.normalizeValue(nextValues[field]);
      if (before !== after) {
        changes.push({ field, from: before, to: after });
      }
    });

    return changes;
  }

  validatePayload(payload) {
    const {
      titolo,
      stato,
      sotto_stato,
      stato_pagamenti,
      preventivo,
      importo_preventivo,
      importo_totale,
      importo_pagato,
      avanzamento_lavori,
      monte_ore_stimato
    } = payload;

    if (!titolo || String(titolo).trim() === '') {
      return 'Titolo commessa obbligatorio';
    }

    if (stato && !STATI_COMMESSA.includes(stato)) {
      return 'Stato non valido';
    }

    if (stato_pagamenti && !STATI_PAGAMENTI.includes(stato_pagamenti)) {
      return 'Stato pagamenti non valido';
    }

    if (stato === 'Conclusa' && sotto_stato) {
      return 'Fase di lavoro non valida per commessa chiusa';
    }

    const preventivoValue = preventivo ? 1 : 0;

    const preventivoNumber = this.parseNumber(importo_preventivo, 0);
    if (!Number.isFinite(preventivoNumber) || preventivoNumber < 0) {
      return 'Importo preventivo non valido';
    }

    const totaleNumber = this.parseNumber(importo_totale, 0);
    if (!Number.isFinite(totaleNumber) || totaleNumber < 0) {
      return 'Importo totale non valido';
    }

    const pagatoNumber = this.parseNumber(importo_pagato, 0);
    if (!Number.isFinite(pagatoNumber) || pagatoNumber < 0) {
      return 'Importo pagato non valido';
    }

    const avanzamentoValue = this.parseIntValue(avanzamento_lavori, 0);
    if (!Number.isFinite(avanzamentoValue) || avanzamentoValue < 0 || avanzamentoValue > 100) {
      return 'Avanzamento lavori non valido';
    }

    const monteOreValue = this.parseNullableNumber(monte_ore_stimato);
    if (monteOreValue !== null && (!Number.isFinite(monteOreValue) || monteOreValue < 0)) {
      return 'Monte ore stimato non valido';
    }

    const parentIdValue = payload.parent_commessa_id ?? payload.parentCommessaId;
    if (parentIdValue != null && parentIdValue !== '') {
      const parentId = Number.parseInt(parentIdValue, 10);
      if (!Number.isFinite(parentId) || parentId <= 0) {
        return 'Commessa padre non valida';
      }
    }

    const structureValue = payload.is_struttura ?? payload.isStruttura;
    if (structureValue != null && structureValue !== '') {
      const normalized = String(structureValue).toLowerCase();
      const allowed = ['1', '0', 'true', 'false'];
      if (!allowed.includes(normalized)) {
        return 'Valore struttura non valido';
      }
    }

    return null;
  }

  getAll(req, res) {
    try {
      const { clienteId, stato, statoPagamenti } = req.query;
      const { page, limit, offset } = Pagination.getParams(req, 50, 100);
      
      let commesse;
      let total;

      // Usa query paginate e count separati per performance
      const usePagination = !!(req.query.page || req.query.limit);

      if (clienteId && statoPagamenti) {
        total = this.stmt.getCountByClienteStatoPagamenti.get(clienteId, statoPagamenti).total;
        commesse = usePagination 
          ? this.stmt.getByClienteStatoPagamentiPaginated.all(clienteId, statoPagamenti, limit, offset)
          : this.stmt.getByClienteStatoPagamenti.all(clienteId, statoPagamenti);
      } else if (clienteId && stato) {
        total = this.stmt.getCountByClienteStato.get(clienteId, stato).total;
        commesse = usePagination
          ? this.stmt.getByClienteStatoPaginated.all(clienteId, stato, limit, offset)
          : this.stmt.getByClienteStato.all(clienteId, stato);
      } else if (statoPagamenti) {
        total = this.stmt.getCountByStatoPagamenti.get(statoPagamenti).total;
        commesse = usePagination
          ? this.stmt.getByStatoPagamentiPaginated.all(statoPagamenti, limit, offset)
          : this.stmt.getByStatoPagamenti.all(statoPagamenti);
      } else if (clienteId) {
        total = this.stmt.getCountByCliente.get(clienteId).total;
        commesse = usePagination
          ? this.stmt.getByClientePaginated.all(clienteId, limit, offset)
          : this.stmt.getByCliente.all(clienteId);
      } else if (stato) {
        total = this.stmt.getCountByStato.get(stato).total;
        commesse = usePagination
          ? this.stmt.getByStatoPaginated.all(stato, limit, offset)
          : this.stmt.getByStato.all(stato);
      } else {
        total = this.stmt.getCount.get().total;
        commesse = usePagination
          ? this.stmt.getAllPaginated.all(limit, offset)
          : this.stmt.getAll.all();
      }

      Logger.info('GET /commesse', { count: commesse.length, total, page, limit, clienteId, stato, statoPagamenti });
      
      // Se ci sono parametri di paginazione, restituisci risposta paginata
      if (usePagination) {
        res.json(Pagination.createResponse(commesse, total, page, limit));
      } else {
        // Per retrocompatibilità, restituisci array semplice
        res.json(commesse);
      }
    } catch (error) {
      Logger.error('Errore GET /commesse', error);
      const isProduction = process.env.NODE_ENV === 'production';
      res.status(500).json({ error: isProduction ? 'Errore interno del server' : error.message });
    }
  }

  getById(req, res) {
    try {
      const { id } = req.params;
      const commessa = this.stmt.getById.get(id);

      if (!commessa) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      Logger.info(`GET /commesse/${id}`);
      res.json(commessa);
    } catch (error) {
      Logger.error(`Errore GET /commesse/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  create(req, res) {
    try {
      const payload = req.body || {};
      const validationError = this.validatePayload(payload);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const {
        titolo,
        cliente_id,
        clienteId,
        cliente_nome,
        clienteNome,
        stato,
        sotto_stato,
        stato_pagamenti,
        preventivo,
        importo_preventivo,
        importo_totale,
        importo_pagato,
        avanzamento_lavori,
        monte_ore_stimato,
        responsabile,
        ubicazione,
        data_inizio,
        data_fine,
        note,
        allegati
        ,
        parent_commessa_id,
        parentCommessaId,
        is_struttura,
        isStruttura
      } = payload;

      // Usa transazione per garantire atomicità
      const transaction = this.db.transaction(() => {
        const parentIdValue = this.parseParentId(parent_commessa_id ?? parentCommessaId);
        const structureFlag = this.parseBooleanFlag(is_struttura ?? isStruttura);
        const result = this.stmt.create.run(
          titolo.trim(),
          cliente_id || clienteId || null,
          cliente_nome || clienteNome || null,
          stato || 'In corso',
          sotto_stato || null,
          stato_pagamenti || 'Non iniziato',
          preventivo ? 1 : 0,
          this.parseNumber(importo_preventivo, 0),
          this.parseNumber(importo_totale, 0),
          this.parseNumber(importo_pagato, 0),
          this.parseIntValue(avanzamento_lavori, 0),
          this.parseNullableNumber(monte_ore_stimato),
          responsabile || null,
          ubicazione || null,
          data_inizio || null,
          data_fine || null,
          note || null,
          allegati || null,
          parentIdValue,
          structureFlag
        );
        return result.lastInsertRowid;
      });

      const commessaId = transaction();
      Logger.info('POST /commesse', { id: commessaId });
      const created = this.stmt.getById.get(commessaId);
      this.createAuditEntry(commessaId, 'create', { created }, req.user?.id);
      res.status(201).json(created);
    } catch (error) {
      Logger.error('Errore POST /commesse', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  update(req, res) {
    try {
      const { id } = req.params;
      const payload = req.body || {};
      // Validazione aggiuntiva per logica business (stato, avanzamento, etc.)
      const validationError = this.validatePayload(payload);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const {
        titolo,
        cliente_id,
        clienteId,
        cliente_nome,
        clienteNome,
        stato,
        sotto_stato,
        stato_pagamenti,
        preventivo,
        importo_preventivo,
        importo_totale,
        importo_pagato,
        avanzamento_lavori,
        monte_ore_stimato,
        responsabile,
        ubicazione,
        data_inizio,
        data_fine,
        note,
        allegati
        ,
        parent_commessa_id,
        parentCommessaId,
        is_struttura,
        isStruttura
      } = payload;

      const existing = this.stmt.getById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      const parentIdValue = this.parseParentId(parent_commessa_id ?? parentCommessaId);
      if (parentIdValue && Number(parentIdValue) === Number(id)) {
        return res.status(400).json({ error: 'Una commessa non puÃ² essere figlia di se stessa' });
      }

      const nextValues = {
        titolo: titolo.trim(),
        cliente_id: cliente_id || clienteId || null,
        cliente_nome: cliente_nome || clienteNome || null,
        stato: stato || 'In corso',
        sotto_stato: (stato === 'Conclusa') ? null : (sotto_stato || null),
        stato_pagamenti: stato_pagamenti || 'Non iniziato',
        preventivo: preventivo ? 1 : 0,
        importo_preventivo: this.parseNumber(importo_preventivo, 0),
        importo_totale: this.parseNumber(importo_totale, 0),
        importo_pagato: this.parseNumber(importo_pagato, 0),
        avanzamento_lavori: this.parseIntValue(avanzamento_lavori, 0),
        monte_ore_stimato: this.parseNullableNumber(monte_ore_stimato),
        responsabile: responsabile || null,
        ubicazione: ubicazione || null,
        data_inizio: data_inizio || null,
        data_fine: data_fine || null,
        note: note || null,
        allegati: allegati || null
        ,
        parent_commessa_id: parentIdValue,
        is_struttura: this.parseBooleanFlag(is_struttura ?? isStruttura, 0)
      };

      const result = this.stmt.update.run(
        nextValues.titolo,
        nextValues.cliente_id,
        nextValues.cliente_nome,
        nextValues.stato,
        nextValues.sotto_stato,
        nextValues.stato_pagamenti,
        nextValues.preventivo,
        nextValues.importo_preventivo,
        nextValues.importo_totale,
        nextValues.importo_pagato,
        nextValues.avanzamento_lavori,
        nextValues.monte_ore_stimato,
        nextValues.responsabile,
        nextValues.ubicazione,
        nextValues.data_inizio,
        nextValues.data_fine,
        nextValues.note,
        nextValues.allegati,
        nextValues.parent_commessa_id,
        nextValues.is_struttura,
        id
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      Logger.info(`PUT /commesse/${id}`);
      const updated = this.stmt.getById.get(id);
      const changes = this.buildChanges(existing, nextValues);
      if (changes.length > 0) {
        this.createAuditEntry(id, 'update', { changes }, req.user?.id);
      }
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /commesse/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  delete(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number.parseInt(id, 10);
      if (!Number.isFinite(numericId)) {
        return res.status(400).json({ error: 'ID non valido' });
      }

      // Usa transazione per garantire atomicità dell'eliminazione
      const transaction = this.db.transaction(() => {
        // Verifica che la commessa esista
        const existing = this.stmt.getById.get(numericId);
        if (!existing) {
          throw ErrorHandler.createError('Commessa non trovata', 404);
        }

        // Elimina allegati dal database (i file vengono eliminati dopo per sicurezza)
        const allegati = this.stmt.getAllegati.all(numericId);
        
        // Elimina commessa dal database
        const result = this.stmt.delete.run(numericId);
        if (result.changes === 0) {
          throw ErrorHandler.createError('Commessa non trovata', 404);
        }

        return allegati;
      });

      // Esegui transazione
      const allegati = transaction();

      // Dopo la transazione, elimina i file fisici
      // Se l'eliminazione dei file fallisce, la commessa è già stata eliminata dal DB
      try {
        allegati.forEach((allegato) => {
          const absolutePath = path.join(__dirname, '..', allegato.file_path || '');
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
          }
        });

        const commessaDir = path.join(uploadsRoot, String(numericId));
        if (fs.existsSync(commessaDir)) {
          fs.rmSync(commessaDir, { recursive: true, force: true });
        }
      } catch (fileError) {
        Logger.warn(`Errore eliminazione file per commessa ${numericId}`, fileError);
        // Non blocchiamo la risposta anche se l'eliminazione file fallisce
      }

      Logger.info(`DELETE /commesse/${numericId}`);
      res.json({ success: true });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      Logger.error(`Errore DELETE /commesse/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  getAllegati(req, res) {
    try {
      const { id } = req.params;
      const allegati = this.stmt.getAllegati.all(id);
      res.json(allegati);
    } catch (error) {
      Logger.error('Errore GET /commesse/allegati', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  getAudit(req, res) {
    try {
      const { id } = req.params;
      const entries = this.stmt.getAuditByCommessa.all(id).map((entry) => {
        let changes = null;
        let kanbanCardIds = null;
        try {
          changes = entry.changes_json ? JSON.parse(entry.changes_json) : null;
        } catch {
          changes = entry.changes_json;
        }
        try {
          kanbanCardIds = entry.kanban_card_ids ? JSON.parse(entry.kanban_card_ids) : null;
        } catch {
          kanbanCardIds = entry.kanban_card_ids;
        }
        const user = entry.user_id ? {
          id: entry.user_id,
          username: entry.username || null,
          nome: entry.nome || null,
          cognome: entry.cognome || null
        } : null;

        return {
          id: entry.id,
          commessa_id: entry.commessa_id,
          user_id: entry.user_id,
          user,
          action: entry.action,
          changes,
          kanban_card_ids: kanbanCardIds,
          created_at: entry.created_at
        };
      });
      res.json(entries);
    } catch (error) {
      Logger.error('Errore GET /commesse/audit', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  addAuditNote(req, res) {
    try {
      const { id } = req.params;
      const payload = req.body || {};
      const note = typeof payload.note === 'string' ? payload.note.trim() : '';
      if (!note) {
        return res.status(400).json({ error: 'Nota obbligatoria' });
      }

      const existing = this.stmt.getById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      const noteDate = typeof payload.data === 'string' && payload.data.trim() ? payload.data.trim() : null;
      const changes = { note, date: noteDate };

      if (noteDate) {
        const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(noteDate)
          ? `${noteDate} 00:00:00`
          : noteDate;
        this.createAuditEntryWithDate(id, 'note', changes, req.user?.id, normalizedDate);
      } else {
        this.createAuditEntry(id, 'note', changes, req.user?.id);
      }

      res.status(201).json({ success: true });
    } catch (error) {
      Logger.error('Errore POST /commesse/audit', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  uploadAllegato(req, res) {
    try {
      const { id } = req.params;
      if (!req.file) {
        throw ErrorHandler.createError('File mancante', 400);
      }

      // Valida file
      const validation = fileValidator.validate(req.file);
      if (!validation.valid) {
        throw ErrorHandler.createError(validation.error, 400);
      }

      // Genera nome file sicuro
      const safeFileName = fileValidator.generateSafeFileName(req.file.originalname);
      const oldPath = req.file.path;
      const newPath = path.join(path.dirname(oldPath), safeFileName);
      
      // Rinomina file con nome sicuro
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }

      const filePath = path.relative(path.join(__dirname, '..'), newPath).replace(/\\/g, '/');

      const transaction = this.db.transaction(() => {
        const latest = this.stmt.getLatestAllegatoByName.get(id, req.file.originalname);
        const version = latest ? (Number(latest.version) || 1) + 1 : 1;
        const previousId = latest ? latest.id : null;
        if (latest) {
          this.stmt.markAllegatoNotLatest.run(latest.id);
        }

        const result = this.stmt.createAllegato.run(
          id,
          safeFileName,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          filePath,
          version,
          1,
          previousId
        );
        return result.lastInsertRowid;
      });

      const allegatoId = transaction();
      const created = this.stmt.getAllegatoById.get(allegatoId);
      this.createAuditEntry(id, 'attachment_uploaded', {
        allegato_id: created.id,
        original_name: created.original_name,
        version: created.version,
        previous_id: created.previous_id
      }, req.user?.id);

      Logger.info(`POST /commesse/${id}/allegati`, { allegatoId });
      res.status(201).json(created);
    } catch (error) {
      // Elimina file se upload fallisce
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          Logger.error('Errore eliminazione file dopo upload fallito', e);
        }
      }

      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      Logger.error('Errore POST /commesse/allegati', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  deleteAllegato(req, res) {
    try {
      const { allegatoId } = req.params;
      const existing = this.stmt.getAllegatoById.get(allegatoId);
      if (!existing) {
        return res.status(404).json({ error: 'Allegato non trovato' });
      }

      const transaction = this.db.transaction(() => {
        if (Number(existing.is_latest) === 1) {
          const fallback = this.stmt.getLatestAllegatoByNameExcluding.get(
            existing.commessa_id,
            existing.original_name,
            existing.id
          );
          if (fallback) {
            this.stmt.markAllegatoLatest.run(fallback.id);
          }
        }
        this.stmt.deleteAllegato.run(allegatoId);
      });
      transaction();

      const absolutePath = path.join(__dirname, '..', existing.file_path || '');
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      this.createAuditEntry(existing.commessa_id, 'attachment_deleted', {
        allegato_id: existing.id,
        original_name: existing.original_name,
        version: existing.version
      }, req.user?.id);
      res.json({ success: true });
    } catch (error) {
      Logger.error('Errore DELETE /commesse/allegati', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  getYearFolders(req, res) {
    try {
      const { clienteId, cliente_id } = req.query;
      const selectedClienteId = clienteId || cliente_id;
      if (!selectedClienteId) {
        return res.status(400).json({ error: 'clienteId obbligatorio' });
      }
      const folders = this.stmt.getYearFoldersByCliente.all(selectedClienteId);
      res.json(folders);
    } catch (error) {
      Logger.error('Errore GET /commesse/cartelle-anni', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  createYearFolder(req, res) {
    try {
      const payload = req.body || {};
      const clienteId = payload.cliente_id || payload.clienteId;
      const annoValue = payload.anno;
      if (!clienteId) {
        return res.status(400).json({ error: 'clienteId obbligatorio' });
      }
      const annoText = String(annoValue || '').trim();
      if (!/^\d{4}$/.test(annoText)) {
        return res.status(400).json({ error: 'Anno non valido' });
      }
      const anno = Number.parseInt(annoText, 10);
      if (!Number.isFinite(anno)) {
        return res.status(400).json({ error: 'Anno non valido' });
      }

      const existing = this.stmt.getYearFolderByClienteYear.get(clienteId, anno);
      if (existing) {
        return res.status(200).json(existing);
      }

      const result = this.stmt.createYearFolder.run(clienteId, anno);
      const created = this.stmt.getYearFolderByClienteYear.get(clienteId, anno) || {
        id: result.lastInsertRowid,
        cliente_id: clienteId,
        anno
      };
      res.status(201).json(created);
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        return res.status(409).json({ error: 'Cartella già presente' });
      }
      Logger.error('Errore POST /commesse/cartelle-anni', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }
}

function createRouter(db) {
  const controller = new CommesseController(db);

  router.get('/cartelle-anni', validateRequest(ValidationSchemas.commessaYearFolder.list), (req, res) => controller.getYearFolders(req, res));
  router.post('/cartelle-anni', validateRequest(ValidationSchemas.commessaYearFolder.create), (req, res) => controller.createYearFolder(req, res));
  router.get('/:id/allegati', validateRequest(ValidationSchemas.id), (req, res) => controller.getAllegati(req, res));
  router.get('/:id/audit', validateRequest(ValidationSchemas.id), (req, res) => controller.getAudit(req, res));
  router.post('/:id/audit', validateRequest(ValidationSchemas.commessaAuditNote), (req, res) => controller.addAuditNote(req, res));
  router.post('/:id/allegati', validateRequest(ValidationSchemas.id), upload.single('file'), (req, res) => controller.uploadAllegato(req, res));
  router.delete('/allegati/:allegatoId', validateRequest(ValidationSchemas.idParam('allegatoId')), (req, res) => controller.deleteAllegato(req, res));
  router.get('/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.getById(req, res));
  router.get('/', validateRequest(ValidationSchemas.pagination), (req, res) => controller.getAll(req, res));
  router.post('/', validateRequest(ValidationSchemas.commessa.create), (req, res) => controller.create(req, res));
  router.put('/:id', validateRequest(ValidationSchemas.commessa.update), (req, res) => controller.update(req, res));
  router.delete('/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createRouter;
