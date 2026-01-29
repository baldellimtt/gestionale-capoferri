const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Logger = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');
const fileValidator = require('../utils/fileValidator');

const router = express.Router();
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'note-spese');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const noteId = req.params.id || 'tmp';
    const targetDir = path.join(uploadsRoot, String(noteId));
    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const safeName = fileValidator.generateSafeFileName(file.originalname);
    cb(null, safeName);
  }
});

const upload = multer({ storage });

class NoteSpeseController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getAll: this.db.prepare(`
        SELECT * FROM note_spese
        ORDER BY COALESCE(data, created_at) DESC, id DESC
      `),
      getByUser: this.db.prepare(`
        SELECT * FROM note_spese
        WHERE user_id = ?
        ORDER BY COALESCE(data, created_at) DESC, id DESC
      `),
      getFiltered: this.db.prepare(`
        SELECT * FROM note_spese
        WHERE user_id = ?
          AND (? IS NULL OR categoria = ?)
          AND (? IS NULL OR stato = ?)
          AND (? IS NULL OR data >= ?)
          AND (? IS NULL OR data <= ?)
        ORDER BY COALESCE(data, created_at) DESC, id DESC
      `),
      getById: this.db.prepare('SELECT * FROM note_spese WHERE id = ?'),
      create: this.db.prepare(`
        INSERT INTO note_spese (
          user_id, data, categoria, descrizione, importo, metodo_pagamento,
          rimborsabile, stato, allegato_nome, allegato_path, allegato_mime, allegato_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE note_spese SET
          data = ?, categoria = ?, descrizione = ?, importo = ?, metodo_pagamento = ?,
          rimborsabile = ?, stato = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      updateAllegato: this.db.prepare(`
        UPDATE note_spese SET
          allegato_nome = ?, allegato_path = ?, allegato_mime = ?, allegato_size = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM note_spese WHERE id = ?')
    };
  }

  getAll(req, res) {
    try {
      const { userId, categoria, stato, startDate, endDate } = req.query;
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

      let noteSpese;
      if (effectiveUserId) {
        const cat = categoria || null;
        const st = stato || null;
        const from = startDate || null;
        const to = endDate || null;
        noteSpese = this.stmt.getFiltered.all(
          effectiveUserId,
          cat,
          cat,
          st,
          st,
          from,
          from,
          to,
          to
        );
      } else {
        noteSpese = this.stmt.getAll.all();
      }

      Logger.info('GET /note-spese', { count: noteSpese.length, userId: effectiveUserId });
      res.json(noteSpese);
    } catch (error) {
      Logger.error('Errore GET /note-spese', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  create(req, res) {
    try {
      const isAdmin = req.user?.role === 'admin';
      const userId = isAdmin && req.body.userId ? Number(req.body.userId) : req.user?.id;
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: 'userId non valido' });
      }

      const {
        data = null,
        categoria = null,
        descrizione = '',
        importo = 0,
        metodo_pagamento = null,
        rimborsabile = 1,
        stato = 'Bozza'
      } = req.body || {};

      const parsedImporto = Number(importo);
      if (!descrizione || !Number.isFinite(parsedImporto) || parsedImporto <= 0) {
        return res.status(400).json({ error: 'Descrizione e importo validi sono obbligatori' });
      }

      const result = this.stmt.create.run(
        userId,
        data,
        categoria,
        descrizione,
        parsedImporto,
        metodo_pagamento,
        rimborsabile ? 1 : 0,
        stato,
        null,
        null,
        null,
        0
      );

      const created = this.stmt.getById.get(result.lastInsertRowid);
      Logger.info('POST /note-spese', { id: result.lastInsertRowid, userId });
      res.json(created);
    } catch (error) {
      Logger.error('Errore POST /note-spese', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  update(req, res) {
    try {
      const { id } = req.params;
      const existing = this.stmt.getById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Voce nota spese non trovata' });
      }
      if (req.user?.role !== 'admin' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Permesso negato' });
      }

      const {
        data = existing.data,
        categoria = existing.categoria,
        descrizione = existing.descrizione,
        importo = existing.importo,
        metodo_pagamento = existing.metodo_pagamento,
        rimborsabile = existing.rimborsabile,
        stato = existing.stato,
        row_version
      } = req.body || {};

      const parsedImporto = Number(importo);
      if (!descrizione || !Number.isFinite(parsedImporto) || parsedImporto <= 0) {
        return res.status(400).json({ error: 'Descrizione e importo validi sono obbligatori' });
      }
      if (!Number.isInteger(Number(row_version))) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const result = this.stmt.update.run(
        data,
        categoria,
        descrizione,
        parsedImporto,
        metodo_pagamento,
        rimborsabile ? 1 : 0,
        stato,
        id,
        row_version
      );

      if (result.changes === 0) {
        const current = this.stmt.getById.get(id);
        if (!current) {
          return res.status(404).json({ error: 'Voce nota spese non trovata' });
        }
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current });
      }

      const updated = this.stmt.getById.get(id);
      Logger.info(`PUT /note-spese/${id}`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /note-spese/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  delete(req, res) {
    try {
      const { id } = req.params;
      const existing = this.stmt.getById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Voce nota spese non trovata' });
      }
      if (req.user?.role !== 'admin' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Permesso negato' });
      }

      this.stmt.delete.run(id);
      Logger.info(`DELETE /note-spese/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /note-spese/${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  uploadAllegato(req, res) {
    try {
      const { id } = req.params;
      const existing = this.stmt.getById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Voce nota spese non trovata' });
      }
      if (req.user?.role !== 'admin' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Permesso negato' });
      }
      const rowVersionValue = req.body?.row_version;
      if (!Number.isInteger(Number(rowVersionValue))) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const validation = fileValidator.validate(req.file);
      if (!validation.valid) {
        if (req.file?.path) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ error: validation.error });
      }

      const relativePath = path.relative(path.join(__dirname, '..', 'uploads'), req.file.path);
      const result = this.stmt.updateAllegato.run(
        req.file.originalname,
        relativePath,
        req.file.mimetype || null,
        req.file.size || 0,
        id,
        rowVersionValue
      );

      if (result.changes === 0) {
        const current = this.stmt.getById.get(id);
        if (!current) {
          return res.status(404).json({ error: 'Voce nota spese non trovata' });
        }
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current });
      }

      const updated = this.stmt.getById.get(id);
      Logger.info(`POST /note-spese/${id}/allegato`, { id });
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore upload allegato note spese ${req.params.id}`, error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }
}

module.exports = (db) => {
  const controller = new NoteSpeseController(db);
  router.get('/', (req, res) => controller.getAll(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));
  router.post('/:id/allegato', upload.single('file'), (req, res) => controller.uploadAllegato(req, res));
  return router;
};


