const express = require('express');
const router = express.Router();
const Logger = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

class TrackingController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getCommessaById: this.db.prepare('SELECT id, titolo, cliente_nome, monte_ore_stimato FROM commesse WHERE id = ?'),
      getEntryById: this.db.prepare('SELECT * FROM commesse_ore WHERE id = ?'),
      getEntriesByCommessa: this.db.prepare(`
        SELECT t.*, u.username, u.nome, u.cognome
        FROM commesse_ore t
        LEFT JOIN utenti u ON u.id = t.user_id
        WHERE t.commessa_id = ?
        ORDER BY t.start_time DESC, t.id DESC
      `),
      getActiveByUser: this.db.prepare(`
        SELECT t.*, c.titolo as commessa_titolo, c.cliente_nome, c.monte_ore_stimato
        FROM commesse_ore t
        LEFT JOIN commesse c ON c.id = t.commessa_id
        WHERE t.user_id = ? AND t.end_time IS NULL
        ORDER BY t.start_time DESC, t.id DESC
        LIMIT 1
      `),
      getTotalMinutesByCommessa: this.db.prepare(`
        SELECT SUM(durata_minuti) as total_minuti
        FROM commesse_ore
        WHERE commessa_id = ? AND end_time IS NOT NULL
      `),
      createTimerEntry: this.db.prepare(`
        INSERT INTO commesse_ore (
          commessa_id, user_id, data, start_time, source
        ) VALUES (?, ?, date('now', 'localtime'), datetime('now', 'localtime'), 'timer')
      `),
      createManualEntry: this.db.prepare(`
        INSERT INTO commesse_ore (
          commessa_id, user_id, data, start_time, end_time, durata_minuti, note, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
      `),
      stopEntry: this.db.prepare(`
        UPDATE commesse_ore
        SET end_time = datetime('now', 'localtime'),
            durata_minuti = CAST((julianday(datetime('now', 'localtime')) - julianday(start_time)) * 24 * 60 AS INTEGER),
            updated_at = datetime('now', 'localtime')
        WHERE id = ? AND end_time IS NULL
      `)
    };
  }

  parseFloatValue(value) {
    if (value == null || value === '') return NaN;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  buildEntryResponse(entry) {
    if (!entry) return null;
    const hasEnd = !!entry.end_time;
    let runningMinutes = null;
    if (!hasEnd && entry.start_time) {
      const start = new Date(entry.start_time.replace(' ', 'T'));
      if (!Number.isNaN(start.getTime())) {
        runningMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
      }
    }
    return {
      ...entry,
      running_minutes: runningMinutes
    };
  }

  getActive(req, res) {
    try {
      const userId = req.user?.id || null;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      const active = this.stmt.getActiveByUser.get(userId);
      res.json(this.buildEntryResponse(active));
    } catch (error) {
      Logger.error('Errore GET /tracking/active', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  getEntriesByCommessa(req, res) {
    try {
      const { id } = req.params;
      const commessa = this.stmt.getCommessaById.get(id);
      if (!commessa) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }
      const entries = this.stmt.getEntriesByCommessa.all(id).map((entry) => this.buildEntryResponse(entry));
      const total = this.stmt.getTotalMinutesByCommessa.get(id);
      res.json({
        commessa,
        entries,
        total_minuti: total?.total_minuti || 0
      });
    } catch (error) {
      Logger.error('Errore GET /tracking/commesse/:id/entries', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  startTracking(req, res) {
    try {
      const userId = req.user?.id || null;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const { commessa_id } = req.body || {};
      const commessa = this.stmt.getCommessaById.get(commessa_id);
      if (!commessa) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      const active = this.stmt.getActiveByUser.get(userId);
      if (active) {
        return res.status(409).json({ error: 'Tracking giÃ  attivo', active: this.buildEntryResponse(active) });
      }

      const result = this.stmt.createTimerEntry.run(commessa_id, userId);
      const created = this.stmt.getEntryById.get(result.lastInsertRowid);
      Logger.info('POST /tracking/start', { id: result.lastInsertRowid, commessa_id, userId });
      res.status(201).json(this.buildEntryResponse(created));
    } catch (error) {
      Logger.error('Errore POST /tracking/start', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  stopTracking(req, res) {
    try {
      const userId = req.user?.id || null;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const { id } = req.params;
      const existing = this.stmt.getEntryById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Tracking non trovato' });
      }
      if (req.user?.role !== 'admin' && existing.user_id !== userId) {
        return res.status(403).json({ error: 'Permesso negato' });
      }
      if (existing.end_time) {
        return res.status(409).json({ error: 'Tracking giÃ  fermato', entry: this.buildEntryResponse(existing) });
      }

      const result = this.stmt.stopEntry.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Tracking non trovato' });
      }
      const updated = this.stmt.getEntryById.get(id);
      Logger.info('PUT /tracking/entries/:id/stop', { id });
      res.json(this.buildEntryResponse(updated));
    } catch (error) {
      Logger.error('Errore PUT /tracking/entries/:id/stop', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  addManualEntry(req, res) {
    try {
      const userId = req.user?.id || null;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const { commessa_id, data, ore, note } = req.body || {};
      const commessa = this.stmt.getCommessaById.get(commessa_id);
      if (!commessa) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      const oreValue = this.parseFloatValue(ore);
      if (!Number.isFinite(oreValue) || oreValue < 0) {
        return res.status(400).json({ error: 'Ore non valide' });
      }

      const durataMinuti = Math.round(oreValue * 60);
      const startTime = `${data} 00:00:00`;

      const result = this.stmt.createManualEntry.run(
        commessa_id,
        userId,
        data,
        startTime,
        startTime,
        durataMinuti,
        note ? String(note).trim() : null
      );
      const created = this.stmt.getEntryById.get(result.lastInsertRowid);
      Logger.info('POST /tracking/manual', { id: result.lastInsertRowid, commessa_id, userId });
      res.status(201).json(this.buildEntryResponse(created));
    } catch (error) {
      Logger.error('Errore POST /tracking/manual', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }
}

function createRouter(db) {
  const controller = new TrackingController(db);

  router.get('/active', (req, res) => controller.getActive(req, res));
  router.get('/commesse/:id/entries', validateRequest(ValidationSchemas.tracking.commessa), (req, res) => controller.getEntriesByCommessa(req, res));
  router.post('/start', validateRequest(ValidationSchemas.tracking.start), (req, res) => controller.startTracking(req, res));
  router.put('/entries/:id/stop', validateRequest(ValidationSchemas.tracking.stop), (req, res) => controller.stopTracking(req, res));
  router.post('/manual', validateRequest(ValidationSchemas.tracking.manual), (req, res) => controller.addManualEntry(req, res));

  return router;
}

module.exports = createRouter;
