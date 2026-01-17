const express = require('express');
const router = express.Router();
const Logger = require('../utils/logger');

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
      create: this.db.prepare(`
        INSERT INTO attivita (
          data, cliente_id, cliente_nome, attivita, km, indennita
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE attivita SET
          data = ?, cliente_id = ?, cliente_nome = ?,
          attivita = ?, km = ?, indennita = ?,
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
      `)
    };
  }

  getAll(req, res) {
    try {
      const { filter, startDate, endDate, month, quarter, year } = req.query;
      
      let attivita;
      
      if (filter === 'month' && month) {
        attivita = this.stmt.getByMonth.all(month);
      } else if (filter === 'quarter' && quarter && year) {
        const startMonth = (parseInt(quarter) - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        attivita = this.stmt.getByQuarter.all(year, startMonth, endMonth);
      } else if (startDate && endDate) {
        attivita = this.stmt.getByDateRange.all(startDate, endDate);
      } else {
        attivita = this.stmt.getAll.all();
      }

      Logger.info('GET /attivita', { count: attivita.length, filter });
      res.json(attivita);
    } catch (error) {
      Logger.error('Errore GET /attivita', error);
      res.status(500).json({ error: error.message });
    }
  }

  getById(req, res) {
    try {
      const { id } = req.params;
      const attivita = this.stmt.getById.get(id);

      if (!attivita) {
        return res.status(404).json({ error: 'Attività non trovata' });
      }

      Logger.info(`GET /attivita/${id}`);
      res.json(attivita);
    } catch (error) {
      Logger.error(`Errore GET /attivita/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  getTotals(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate e endDate obbligatori' });
      }

      const totals = this.stmt.getTotals.all(startDate, endDate);
      
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

      Logger.info('GET /attivita/totals', { startDate, endDate });
      res.json(result);
    } catch (error) {
      Logger.error('Errore GET /attivita/totals', error);
      res.status(500).json({ error: error.message });
    }
  }

  create(req, res) {
    try {
      const { data, clienteId, clienteNome, attivita, km, indennita } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'Data obbligatoria' });
      }

      const result = this.stmt.create.run(
        data,
        clienteId || null,
        clienteNome || null,
        attivita || null,
        km || 0,
        indennita ? 1 : 0
      );

      Logger.info('POST /attivita', { id: result.lastInsertRowid });
      res.status(201).json({ id: result.lastInsertRowid, ...req.body });
    } catch (error) {
      Logger.error('Errore POST /attivita', error);
      res.status(500).json({ error: error.message });
    }
  }

  update(req, res) {
    try {
      const { id } = req.params;
      const { data, clienteId, clienteNome, attivita, km, indennita } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'Data obbligatoria' });
      }

      const result = this.stmt.update.run(
        data,
        clienteId || null,
        clienteNome || null,
        attivita || null,
        km || 0,
        indennita ? 1 : 0,
        id
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Attività non trovata' });
      }

      Logger.info(`PUT /attivita/${id}`);
      res.json({ id: parseInt(id), ...req.body });
    } catch (error) {
      Logger.error(`Errore PUT /attivita/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  delete(req, res) {
    try {
      const { id } = req.params;
      const result = this.stmt.delete.run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Attività non trovata' });
      }

      Logger.info(`DELETE /attivita/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /attivita/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }
}

function createRouter(db) {
  const controller = new AttivitaController(db);

  router.get('/totals', (req, res) => controller.getTotals(req, res));
  router.get('/:id', (req, res) => controller.getById(req, res));
  router.get('/', (req, res) => controller.getAll(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createRouter;

