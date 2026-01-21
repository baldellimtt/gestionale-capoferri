const express = require('express');
const router = express.Router();
const Logger = require('../utils/logger');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');
const ErrorHandler = require('../utils/errorHandler');

class AttivitaController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getAll: this.db.prepare('SELECT * FROM attivita ORDER BY data DESC, id DESC'),
      getById: this.db.prepare('SELECT * FROM attivita WHERE id = ?'),
      getByDateRange: this.db.prepare(`
        SELECT * FROM attivita
        WHERE data >= ? AND data <= ?
        ORDER BY data DESC, id DESC
      `),
      getByMonth: this.db.prepare(`
        SELECT * FROM attivita
        WHERE strftime('%Y-%m', data) = ?
        ORDER BY data DESC, id DESC
      `),
      getByQuarter: this.db.prepare(`
        SELECT * FROM attivita
        WHERE strftime('%Y', data) = ? AND
              CAST(strftime('%m', data) AS INTEGER) BETWEEN ? AND ?
        ORDER BY data DESC, id DESC
      `),
      getByUser: this.db.prepare(`
        SELECT * FROM attivita
        WHERE user_id = ?
        ORDER BY data DESC, id DESC
      `),
      getByUserDateRange: this.db.prepare(`
        SELECT * FROM attivita
        WHERE user_id = ? AND data >= ? AND data <= ?
        ORDER BY data DESC, id DESC
      `),
      getByUserMonth: this.db.prepare(`
        SELECT * FROM attivita
        WHERE user_id = ? AND strftime('%Y-%m', data) = ?
        ORDER BY data DESC, id DESC
      `),
      getByUserQuarter: this.db.prepare(`
        SELECT * FROM attivita
        WHERE user_id = ? AND strftime('%Y', data) = ? AND
              CAST(strftime('%m', data) AS INTEGER) BETWEEN ? AND ?
        ORDER BY data DESC, id DESC
      `),
      create: this.db.prepare(`
        INSERT INTO attivita (
          data, user_id, cliente_id, cliente_nome, attivita, km, indennita, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE attivita SET
          data = ?, user_id = ?, cliente_id = ?, cliente_nome = ?,
          attivita = ?, km = ?, indennita = ?, note = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM attivita WHERE id = ?'),
      getTotals: this.db.prepare(`
        SELECT
          COUNT(*) as totale_attivita,
          SUM(km) as totale_km,
          SUM(indennita) as totale_indennita,
          attivita,
          COUNT(*) as count_per_tipo
        FROM attivita
        WHERE data >= ? AND data <= ?
        GROUP BY attivita
      `),
      getTotalsByUser: this.db.prepare(`
        SELECT
          COUNT(*) as totale_attivita,
          SUM(km) as totale_km,
          SUM(indennita) as totale_indennita,
          attivita,
          COUNT(*) as count_per_tipo
        FROM attivita
        WHERE user_id = ? AND data >= ? AND data <= ?
        GROUP BY attivita
      `)
    };
  }

  getAll(req, res) {
    try {
      const { filter, startDate, endDate, month, quarter, year, userId } = req.query;
      const isAdmin = req.user?.role === 'admin';
      let effectiveUserId = null;

      if (isAdmin && userId) {
        const parsed = parseInt(userId, 10);
        if (!Number.isFinite(parsed)) {
          return res.status(400).json({ error: 'userId non valido' });
        }
        effectiveUserId = parsed;
      } else if (!isAdmin && req.user?.id) {
        effectiveUserId = req.user.id;
      }

      let attivita;

      if (filter === 'month' && month) {
        attivita = effectiveUserId
          ? this.stmt.getByUserMonth.all(effectiveUserId, month)
          : this.stmt.getByMonth.all(month);
      } else if (filter === 'quarter' && quarter && year) {
        const startMonth = (parseInt(quarter) - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        attivita = effectiveUserId
          ? this.stmt.getByUserQuarter.all(effectiveUserId, year, startMonth, endMonth)
          : this.stmt.getByQuarter.all(year, startMonth, endMonth);
      } else if (startDate && endDate) {
        attivita = effectiveUserId
          ? this.stmt.getByUserDateRange.all(effectiveUserId, startDate, endDate)
          : this.stmt.getByDateRange.all(startDate, endDate);
      } else if (effectiveUserId) {
        attivita = this.stmt.getByUser.all(effectiveUserId);
      } else {
        attivita = this.stmt.getAll.all();
      }

      Logger.info('GET /attivita', { count: attivita.length, filter, userId: effectiveUserId });
      res.json(attivita);
    } catch (error) {
      Logger.error('Errore GET /attivita', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  getById(req, res) {
    try {
      const { id } = req.params;
      const attivita = this.stmt.getById.get(id);

      if (!attivita) {
        return res.status(404).json({ error: 'Attività non trovata' });
      }

      if (req.user?.role !== 'admin' && attivita.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Permesso negato' });
      }

      Logger.info(`GET /attivita/${id}`);
      res.json(attivita);
    } catch (error) {
      Logger.error(`Errore GET /attivita/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  getTotals(req, res) {
    try {
      const { startDate, endDate, userId } = req.query;
      const isAdmin = req.user?.role === 'admin';
      let effectiveUserId = null;

      if (isAdmin && userId) {
        const parsed = parseInt(userId, 10);
        if (!Number.isFinite(parsed)) {
          return res.status(400).json({ error: 'userId non valido' });
        }
        effectiveUserId = parsed;
      } else if (!isAdmin && req.user?.id) {
        effectiveUserId = req.user.id;
      }

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate e endDate obbligatori' });
      }

      const totals = effectiveUserId
        ? this.stmt.getTotalsByUser.all(effectiveUserId, startDate, endDate)
        : this.stmt.getTotals.all(startDate, endDate);

      const result = {
        totale_km: totals.reduce((sum, t) => sum + (t.totale_km || 0), 0),
        totale_indennita: totals.reduce((sum, t) => sum + (t.totale_indennita || 0), 0),
        totale_attivita: totals.reduce((sum, t) => sum + (t.count_per_tipo || 0), 0),
        attivita_count: {}
      };

      totals.forEach(t => {
        if (t.attivita) {
          result.attivita_count[t.attivita] = t.count_per_tipo || 0;
        }
      });

      Logger.info('GET /attivita/totals', { startDate, endDate, userId: effectiveUserId });
      res.json(result);
    } catch (error) {
      Logger.error('Errore GET /attivita/totals', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  create(req, res) {
    try {
      const { data, clienteId, clienteNome, attivita, km, indennita, note, userId } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'Data obbligatoria' });
      }

      let ownerId = req.user?.id || null;
      if (req.user?.role === 'admin' && userId) {
        const parsed = parseInt(userId, 10);
        if (!Number.isFinite(parsed)) {
          return res.status(400).json({ error: 'userId non valido' });
        }
        ownerId = parsed;
      }

      const result = this.stmt.create.run(
        data,
        ownerId,
        clienteId || null,
        clienteNome || null,
        attivita || null,
        km || 0,
        indennita ? 1 : 0,
        note || null
      );

      Logger.info('POST /attivita', { id: result.lastInsertRowid });
      res.status(201).json({ id: result.lastInsertRowid, ...req.body, userId: ownerId });
    } catch (error) {
      Logger.error('Errore POST /attivita', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  update(req, res) {
    try {
      const { id } = req.params;
      const { data, clienteId, clienteNome, attivita, km, indennita, note, userId } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'Data obbligatoria' });
      }

      const existing = this.stmt.getById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'AttivitÃ  non trovata' });
      }
      if (req.user?.role !== 'admin' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Permesso negato' });
      }

      let nextUserId = existing.user_id || null;
      if (req.user?.role === 'admin' && userId) {
        const parsed = parseInt(userId, 10);
        if (!Number.isFinite(parsed)) {
          return res.status(400).json({ error: 'userId non valido' });
        }
        nextUserId = parsed;
      } else if (!nextUserId && req.user?.id) {
        nextUserId = req.user.id;
      }

      const result = this.stmt.update.run(
        data,
        nextUserId,
        clienteId || null,
        clienteNome || null,
        attivita || null,
        km || 0,
        indennita ? 1 : 0,
        note || null,
        id
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Attività non trovata' });
      }

      Logger.info(`PUT /attivita/${id}`);
      res.json({ id: parseInt(id, 10), ...req.body, userId: nextUserId });
    } catch (error) {
      Logger.error(`Errore PUT /attivita/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  delete(req, res) {
    try {
      const { id } = req.params;
      // Converti ID a numero per sicurezza
      const numericId = parseInt(id, 10);
      
      if (isNaN(numericId)) {
        return res.status(400).json({ error: 'ID non valido' });
      }

      const existing = this.stmt.getById.get(numericId);
      if (!existing) {
        return res.status(404).json({ error: 'AttivitÃ  non trovata' });
      }
      if (req.user?.role !== 'admin' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Permesso negato' });
      }

      const result = this.stmt.delete.run(numericId);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Attività non trovata' });
      }

      Logger.info(`DELETE /attivita/${numericId} - Riga eliminata con successo`);
      res.json({ success: true, deletedId: numericId });
    } catch (error) {
      Logger.error(`Errore DELETE /attivita/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }
}

function createRouter(db) {
  const controller = new AttivitaController(db);

  router.get('/totals', validateRequest(ValidationSchemas.dateRange), (req, res) => controller.getTotals(req, res));
  router.get('/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.getById(req, res));
  router.get('/', validateRequest(ValidationSchemas.dateRange), (req, res) => controller.getAll(req, res));
  router.post('/', validateRequest(ValidationSchemas.attivita.create), (req, res) => controller.create(req, res));
  router.put('/:id', validateRequest(ValidationSchemas.attivita.update), (req, res) => controller.update(req, res));
  router.delete('/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createRouter;
