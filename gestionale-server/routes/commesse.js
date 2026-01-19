const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const Logger = require('../utils/logger');

const STATI_COMMESSA = ['In corso', 'Chiusa'];
const STATI_PAGAMENTI = ['Non iniziato', 'Parziale', 'Saldo'];

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
      getById: this.db.prepare('SELECT * FROM commesse WHERE id = ?'),
      create: this.db.prepare(`
        INSERT INTO commesse (
          titolo, cliente_id, cliente_nome, stato, sotto_stato, stato_pagamenti,
          preventivo, importo_preventivo, importo_totale, importo_pagato,
          avanzamento_lavori, responsabile,
          data_inizio, data_fine, note, allegati
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          responsabile = ?,
          data_inizio = ?,
          data_fine = ?,
          note = ?,
          allegati = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM commesse WHERE id = ?'),
      getAllegati: this.db.prepare(`
        SELECT id, commessa_id, filename, original_name, mime_type, file_size, file_path, created_at
        FROM commesse_allegati
        WHERE commessa_id = ?
        ORDER BY created_at DESC
      `),
      getAllegatoById: this.db.prepare('SELECT * FROM commesse_allegati WHERE id = ?'),
      createAllegato: this.db.prepare(`
        INSERT INTO commesse_allegati (
          commessa_id, filename, original_name, mime_type, file_size, file_path
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      deleteAllegato: this.db.prepare('DELETE FROM commesse_allegati WHERE id = ?')
    };
  }

  parseNumber(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  parseIntValue(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
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
      avanzamento_lavori
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

    if (stato === 'Chiusa' && sotto_stato) {
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

    return null;
  }

  getAll(req, res) {
    try {
      const { clienteId, stato, statoPagamenti } = req.query;
      let commesse;

      if (clienteId && statoPagamenti) {
        commesse = this.stmt.getByClienteStatoPagamenti.all(clienteId, statoPagamenti);
      } else if (clienteId && stato) {
        commesse = this.stmt.getByClienteStato.all(clienteId, stato);
      } else if (statoPagamenti) {
        commesse = this.stmt.getByStatoPagamenti.all(statoPagamenti);
      } else if (clienteId) {
        commesse = this.stmt.getByCliente.all(clienteId);
      } else if (stato) {
        commesse = this.stmt.getByStato.all(stato);
      } else {
        commesse = this.stmt.getAll.all();
      }

      Logger.info('GET /commesse', { count: commesse.length, clienteId, stato, statoPagamenti });
      res.json(commesse);
    } catch (error) {
      Logger.error('Errore GET /commesse', error);
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
        responsabile,
        data_inizio,
        data_fine,
        note,
        allegati
      } = payload;

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
        responsabile || null,
        data_inizio || null,
        data_fine || null,
        note || null,
        allegati || null
      );

      Logger.info('POST /commesse', { id: result.lastInsertRowid });
      const created = this.stmt.getById.get(result.lastInsertRowid);
      res.status(201).json(created);
    } catch (error) {
      Logger.error('Errore POST /commesse', error);
      res.status(500).json({ error: error.message });
    }
  }

  update(req, res) {
    try {
      const { id } = req.params;
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
        responsabile,
        data_inizio,
        data_fine,
        note,
        allegati
      } = payload;

      const result = this.stmt.update.run(
        titolo.trim(),
        cliente_id || clienteId || null,
        cliente_nome || clienteNome || null,
        stato || 'In corso',
        stato === 'Chiusa' ? null : (sotto_stato || null),
        stato_pagamenti || 'Non iniziato',
        preventivo ? 1 : 0,
        this.parseNumber(importo_preventivo, 0),
        this.parseNumber(importo_totale, 0),
        this.parseNumber(importo_pagato, 0),
        this.parseIntValue(avanzamento_lavori, 0),
        responsabile || null,
        data_inizio || null,
        data_fine || null,
        note || null,
        allegati || null,
        id
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      Logger.info(`PUT /commesse/${id}`);
      const updated = this.stmt.getById.get(id);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /commesse/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  delete(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number.parseInt(id, 10);
      if (!Number.isFinite(numericId)) {
        return res.status(400).json({ error: 'ID non valido' });
      }

      const allegati = this.stmt.getAllegati.all(numericId);
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

      const result = this.stmt.delete.run(numericId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Commessa non trovata' });
      }

      Logger.info(`DELETE /commesse/${numericId}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /commesse/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  getAllegati(req, res) {
    try {
      const { id } = req.params;
      const allegati = this.stmt.getAllegati.all(id);
      res.json(allegati);
    } catch (error) {
      Logger.error('Errore GET /commesse/allegati', error);
      res.status(500).json({ error: error.message });
    }
  }

  uploadAllegato(req, res) {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'File mancante' });
      }

      const filePath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');
      const result = this.stmt.createAllegato.run(
        id,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        filePath
      );

      const created = this.stmt.getAllegatoById.get(result.lastInsertRowid);
      res.status(201).json(created);
    } catch (error) {
      Logger.error('Errore POST /commesse/allegati', error);
      res.status(500).json({ error: error.message });
    }
  }

  deleteAllegato(req, res) {
    try {
      const { allegatoId } = req.params;
      const existing = this.stmt.getAllegatoById.get(allegatoId);
      if (!existing) {
        return res.status(404).json({ error: 'Allegato non trovato' });
      }

      const absolutePath = path.join(__dirname, '..', existing.file_path || '');
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      this.stmt.deleteAllegato.run(allegatoId);
      res.json({ success: true });
    } catch (error) {
      Logger.error('Errore DELETE /commesse/allegati', error);
      res.status(500).json({ error: error.message });
    }
  }
}

function createRouter(db) {
  const controller = new CommesseController(db);

  router.get('/:id/allegati', (req, res) => controller.getAllegati(req, res));
  router.post('/:id/allegati', upload.single('file'), (req, res) => controller.uploadAllegato(req, res));
  router.delete('/allegati/:allegatoId', (req, res) => controller.deleteAllegato(req, res));
  router.get('/:id', (req, res) => controller.getById(req, res));
  router.get('/', (req, res) => controller.getAll(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createRouter;
